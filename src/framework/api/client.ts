// ApiClient — the ONLY thing that touches fetch, status codes, or JSON envelopes
// (PRD §7.3, §12.2). Everyone else calls typed methods and receives parsed data or
// a thrown ApiError. Ported from the Godot F0 (autoload/api_client.gd): auth attach,
// ONE silent refresh on 401, backoff on NETWORK/5xx, Zod-validated bodies.
import type { z } from "zod";
import { appConfig, CLIENT_VERSION } from "@/framework/config/appConfig";
import { ApiError, parseEnvelope } from "./errors";
import {
  RegistryModules,
  LevelResponse,
  ActivityPublic,
  SubmitResponse,
  BadgesResponse,
  ProfileResponse,
  FollowupPublic,
  FollowupCommit,
  StateEnvelope,
  BuildingStateEnvelope,
  StateAck,
  BeaconToken,
  Me,
  Wallet,
  WalletTransactions,
  type SubmitRequest,
  type StateWriteResult,
} from "./schemas";

/** What the client asks the server to write about the transfer beat. */
export interface FollowupParams {
  activityId: string;
  track: "SCA" | "SCB";
  buildingId: string;
  /** The seed choice and the follow-up choice, in that order. */
  path: [string, string];
  speakerId?: string;
  worldState?: Record<string, string>;
}

/** Supplies a Firebase ID token; injected so the client stays testable/decoupled. */
export interface TokenProvider {
  getIdToken(forceRefresh?: boolean): Promise<string | null>;
}

const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 4000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const backoff = (attempt: number) => Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);

export interface ApiClientOptions {
  onSessionLost?: (reason: string) => void;
  onRetryToast?: (message: string) => void;
}

export class ApiClient {
  constructor(
    private readonly tokens: TokenProvider,
    private readonly opts: ApiClientOptions = {},
  ) {}

  // ── Typed backend methods (all authed) ──────────────────────────────────────

  /** F0 bootstrap: the first authed call that exists on the live backend (no /me yet). */
  getRegistryModules() {
    return this.request("GET", "/api/v1/registry/modules", RegistryModules);
  }

  getLevel(comp: string, level: string) {
    return this.request("GET", `/api/v1/registry/${comp}/${level}`, LevelResponse);
  }

  getActivity(activityId: string) {
    return this.request("GET", `/api/v1/registry/activity/${activityId}`, ActivityPublic);
  }

  startActivity(activityId: string): Promise<unknown> {
    return this.perform("POST", `/api/v1/progress/${activityId}/start`);
  }

  getState(activityId: string): Promise<unknown> {
    return this.perform("GET", `/api/v1/progress/${activityId}/state`);
  }

  putState(activityId: string, blob: unknown): Promise<unknown> {
    return this.perform("PUT", `/api/v1/progress/${activityId}/state`, blob);
  }

  /** Trophy Hall (PRD §9.4) — the caller's earned badges. */
  getBadges() {
    return this.request("GET", "/api/v1/badges", BadgesResponse);
  }

  /** Trophy Hall progress board — per-competency P-levels. */
  getProfile() {
    return this.request("GET", "/api/v1/profile", ProfileResponse);
  }

  submit(activityId: string, body: SubmitRequest) {
    return this.request("POST", `/api/v1/progress/${activityId}/submit`, SubmitResponse, {
      ...body,
      clientVersion: body.clientVersion || CLIENT_VERSION,
    });
  }

  // ── Bootstrap and the wallet (PRD §9) ───────────────────────────────────────

  /** The first authed call. Also performs the starter grant, server-side. */
  getMe() {
    return this.request("GET", "/api/v1/me", Me);
  }

  getWallet() {
    return this.request("GET", "/api/v1/wallet", Wallet);
  }

  /** The coin ledger, newest first. */
  getWalletTransactions(limit = 25, offset = 0) {
    return this.request(
      "GET",
      `/api/v1/wallet/transactions?limit=${limit}&offset=${offset}`,
      WalletTransactions,
    );
  }

  // ── The generated transfer beat (ADR-006 §7.3) ──────────────────────────────

  /**
   * Ask for the third beat. Fired the instant the second one commits, so it
   * generates while that consequence is still being read.
   *
   * The server never 5xxs this: no key, model error, deadline, gate failure and
   * rate limit all resolve to an authored beat. A failure here is therefore a
   * network or auth failure, and the caller falls through to its local bank.
   */
  aiFollowup(params: FollowupParams) {
    return this.request("POST", "/api/v1/ai/followup", FollowupPublic, params);
  }

  /**
   * Commit a choice and receive its consequence.
   *
   * The consequences are not shipped with the options on purpose — three
   * consequences in the payload are three hints at which option is which.
   */
  commitFollowup(followupId: string, optionId: string) {
    return this.request("POST", `/api/v1/ai/followup/${followupId}/commit`, FollowupCommit, {
      optionId,
    });
  }

  // ── Session state (ADR-006 §11) ─────────────────────────────────────────────

  /** City-wide: the track, FTUE flags, where they were standing. */
  getCityState() {
    return this.request("GET", "/api/v1/city/state", StateEnvelope);
  }

  putCityState(rev: number, blob: unknown) {
    return this.writeState("/api/v1/city/state", { rev, blob });
  }

  /** The season: mission, objective, world, the pending transfer question. */
  getBuildingState(buildingId: string) {
    return this.request("GET", `/api/v1/city/buildings/${buildingId}/state`, BuildingStateEnvelope);
  }

  putBuildingState(buildingId: string, rev: number, blob: unknown, track?: "SCA" | "SCB") {
    return this.writeState(`/api/v1/city/buildings/${buildingId}/state`, { rev, blob, track });
  }

  /**
   * Mint the short-lived token the exit flush uses.
   *
   * `sendBeacon` cannot attach an Authorization header, so the beacon route
   * authorises on a write-only, single-building token in the body instead.
   */
  getBeaconToken(buildingId: string) {
    return this.request(
      "GET",
      `/api/v1/city/beacon-token?buildingId=${encodeURIComponent(buildingId)}`,
      BeaconToken,
    );
  }

  /**
   * A state write either lands or loses a race.
   *
   * A 409 is not an error anybody should see: it carries the server's current
   * document so the caller can resolve in one round trip, which is what makes
   * two tabs in the same building survivable. It is returned, not thrown.
   */
  private async writeState(path: string, body: unknown): Promise<StateWriteResult> {
    const { status, body: raw } = await this.performAllowing([409], "PUT", path, body);
    if (status === 409) {
      const conflict = raw as { rev?: number; blob?: unknown; updatedAt?: string } | null;
      return {
        ok: false,
        rev: conflict?.rev ?? 0,
        blob: conflict?.blob ?? null,
        updatedAt: conflict?.updatedAt ?? "",
      };
    }
    const ack = StateAck.safeParse(raw);
    if (!ack.success) throw new ApiError("BAD_RESPONSE", "Unexpected response from the server.");
    return { ok: true, rev: ack.data.rev, updatedAt: ack.data.updatedAt };
  }

  // ── Schema-validated request ────────────────────────────────────────────────

  private async request<S extends z.ZodTypeAny>(
    method: string,
    path: string,
    schema: S,
    body?: unknown,
  ): Promise<z.output<S>> {
    const raw = await this.perform(method, path, body);
    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    throw new ApiError("BAD_RESPONSE", "Unexpected response from the server.");
  }

  /**
   * `perform`, but treating some non-2xx statuses as answers rather than errors.
   *
   * Exists for the one case where a status carries a payload the caller needs:
   * a 409 from the state endpoints returns the server's current document, and
   * throwing it away would cost a second round trip to get it back.
   */
  private async performAllowing(
    allowed: number[],
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; body: unknown }> {
    try {
      return { status: 200, body: await this.perform(method, path, body) };
    } catch (e) {
      if (e instanceof ApiError && allowed.includes(e.httpStatus)) {
        return { status: e.httpStatus, body: e.body };
      }
      throw e;
    }
  }

  // ── Core request with auth + retry/refresh policy (returns raw JSON body) ────

  private async perform(
    method: string,
    path: string,
    body?: unknown,
    allowRefresh = true,
  ): Promise<unknown> {
    const url = appConfig.apiBaseUrl + path;
    let attempt = 0;

    for (;;) {
      let res: Response;
      try {
        const token = await this.tokens.getIdToken();
        res = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch {
        if (attempt < MAX_RETRIES) {
          attempt += 1;
          this.opts.onRetryToast?.("Reconnecting…");
          await sleep(backoff(attempt));
          continue;
        }
        throw new ApiError("NETWORK", "Network request failed. Check your connection.");
      }

      const parsedBody = await this.readJson(res);
      if (res.ok) return parsedBody;

      const err = parseEnvelope(res.status, parsedBody);

      // 401 → one silent Firebase refresh, then retry once.
      if (err.code === "INVALID_TOKEN" && allowRefresh) {
        const fresh = await this.tokens.getIdToken(true).catch(() => null);
        if (fresh) return this.perform(method, path, body, false);
        this.opts.onSessionLost?.("token_expired");
        throw err;
      }

      // Transient server errors back off and retry (submits are idempotent).
      if (err.code === "SERVER_ERROR" && attempt < MAX_RETRIES) {
        attempt += 1;
        this.opts.onRetryToast?.("Reconnecting…");
        await sleep(backoff(attempt));
        continue;
      }

      throw err;
    }
  }

  private async readJson(res: Response): Promise<unknown> {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { error: text };
    }
  }
}

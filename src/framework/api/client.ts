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
  JourneyStageResult,
  ConsequenceResult,
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
/** What a stage close sends. `answers` for a typed stage, `units` for a scenario one. */
export interface JourneyStageBody {
  runId?: string;
  stageId: string;
  track?: string;
  answers?: { unitId: string; text: string }[];
  units?: { unitId: string; choice: string }[];
}

/**
 * What a consequence request sends. Ids, a letter, and a closed-enum world map —
 * and nothing a typed answer could travel in.
 */
export interface ConsequenceBody {
  buildingId: string;
  stageId?: string;
  unitId: string;
  choice: string;
  speakerId?: string;
  worldState?: Record<string, string>;
}

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

interface PerformOpts {
  allowRefresh?: boolean;
  /**
   * Suppress the retry toast. For paths that already have their own
   * silent-failure contract — the AI follow-up (ADR-006 §7.4: "not a spinner...
   * the player is never told") and session-state writes (ADR-006 §11: "a
   * backend outage degrades... never to a lost season", handled by the mirror
   * and the next hydrate) — a "Reconnecting…" toast on retry is itself the leak
   * those sections forbid, not a helpful status update.
   */
  silent?: boolean;
  /** Lets a caller with its own deadline (the transfer beat's 4 s race) cancel
   *  an attempt already in flight instead of leaving it to keep retrying. */
  signal?: AbortSignal;
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
  aiFollowup(params: FollowupParams, signal?: AbortSignal) {
    // Silent, and cancellable: ADR-006 §7.4 forbids a spinner or any other tell
    // during this wait, and the caller (transfer.ts) races it against its own
    // 4 s deadline, so a losing attempt needs to actually stop rather than keep
    // retrying in the background after the bank has already answered.
    return this.request("POST", "/api/v1/ai/followup", FollowupPublic, params, {
      silent: true,
      signal,
    });
  }

  /**
   * Commit a choice and receive its consequence.
   *
   * The consequences are not shipped with the options on purpose — three
   * consequences in the payload are three hints at which option is which.
   */
  commitFollowup(followupId: string, optionId: string) {
    return this.request(
      "POST",
      `/api/v1/ai/followup/${followupId}/commit`,
      FollowupCommit,
      { optionId },
      { silent: true },
    );
  }

  // ── The career journey (ADR-007) ────────────────────────────────────────────

  /**
   * Close one journey stage: grade a typed sitting, append the attempt, and
   * reveal the revenue that stage moved.
   *
   * Not silent. Unlike a generated beat, a stage close is a commitment the
   * player made — losing one loses an interview they sat — so a failure here
   * should surface and be retried rather than degrade quietly.
   */
  journeyStage(buildingId: string, body: JourneyStageBody) {
    return this.request(
      "POST",
      `/api/v1/city/buildings/${buildingId}/journey/stage`,
      JourneyStageResult,
      body,
    );
  }

  /**
   * Ask what happened after an L1 or L2 choice.
   *
   * Silent and cancellable, exactly like `aiFollowup`: the caller races it
   * against its own deadline and falls through to the authored line, and there
   * must be no spinner or other tell that this beat is the generated one.
   *
   * Note what the body cannot carry: there is no free-text field, and there must
   * never be one. That absence is what keeps the typed interview and the
   * generator apart (ADR-007 §13).
   */
  aiConsequence(body: ConsequenceBody, signal?: AbortSignal) {
    return this.request("POST", "/api/v1/ai/consequence", ConsequenceResult, body, {
      silent: true,
      signal,
    });
  }

  // ── Session state (ADR-006 §11) ─────────────────────────────────────────────

  /** City-wide: the track, FTUE flags, where they were standing. */
  getCityState() {
    return this.request("GET", "/api/v1/city/state", StateEnvelope, undefined, { silent: true });
  }

  putCityState(rev: number, blob: unknown) {
    return this.writeState("/api/v1/city/state", { rev, blob });
  }

  /** The season: mission, objective, world, the pending transfer question. */
  getBuildingState(buildingId: string) {
    return this.request(
      "GET",
      `/api/v1/city/buildings/${buildingId}/state`,
      BuildingStateEnvelope,
      undefined,
      { silent: true },
    );
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
      undefined,
      { silent: true },
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
    // Silent: a session write's failure story is already the mirror-and-next-
    // hydrate one (ADR-006 §11), not a toast.
    const { status, body: raw } = await this.performAllowing([409], "PUT", path, body, {
      silent: true,
    });
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
    opts?: Pick<PerformOpts, "silent" | "signal">,
  ): Promise<z.output<S>> {
    const raw = await this.perform(method, path, body, opts);
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
    opts?: Pick<PerformOpts, "silent" | "signal">,
  ): Promise<{ status: number; body: unknown }> {
    try {
      return { status: 200, body: await this.perform(method, path, body, opts) };
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
    opts: PerformOpts = {},
  ): Promise<unknown> {
    const { allowRefresh = true, silent = false, signal } = opts;
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
          signal,
        });
      } catch (e) {
        // An intentional cancellation (the transfer beat's deadline losing the
        // race) is not a connectivity failure — retrying it would spend the
        // budget re-fetching something nobody is waiting on any more.
        if (e instanceof DOMException && e.name === "AbortError") throw e;
        if (attempt < MAX_RETRIES) {
          attempt += 1;
          if (!silent) this.opts.onRetryToast?.("Reconnecting…");
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
        if (fresh) return this.perform(method, path, body, { ...opts, allowRefresh: false });
        this.opts.onSessionLost?.("token_expired");
        throw err;
      }

      // Transient server errors back off and retry (submits are idempotent).
      if (err.code === "SERVER_ERROR" && attempt < MAX_RETRIES) {
        attempt += 1;
        if (!silent) this.opts.onRetryToast?.("Reconnecting…");
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

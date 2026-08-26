// The season, on the server (ADR-006 §11).
//
// A building owns the shape of its blob and knows nothing about how it gets
// anywhere — buildings do not call fetch (ADR-005 §8.4). This is the layer that
// does: read once when the door opens, write while you play, and flush on the
// way out with `sendBeacon` so closing the laptop and walking out of the room
// have the same consequence.
//
// **Reads are synchronous and writes are fire-and-forget, deliberately.** The
// room moves on the trace and never on the score (PRD §19.7), and it must move
// at the speed of the player rather than the network. `hydrate` is the one await,
// and it happens behind the door-opening line the interior already shows.
import { api } from "@/framework/api";
import { appConfig } from "@/framework/config/appConfig";
import { loadJson, saveJson } from "@/lib/persist";

/** Debounce for the writes that are allowed to wait. ADR-006 §11.2. */
const DEBOUNCE_MS = 800;
/** A beacon token lives five minutes; re-mint well inside that. */
const TOKEN_TTL_MS = 4 * 60 * 1000;

interface Mirror {
  rev: number;
  blob: unknown;
  /** Server time when this rev was written, or our own when it has not been. */
  updatedAt: string;
}

const isMirror = (v: unknown): v is Mirror =>
  typeof v === "object" && v !== null && typeof (v as Mirror).rev === "number";

const key = (buildingId: string) => `city.${buildingId}.session`;

interface Live {
  rev: number;
  updatedAt: string;
  timer: number | null;
  pending: unknown;
  token: { value: string; mintedAt: number } | null;
  track?: "SCA" | "SCB";
}

const live = new Map<string, Live>();

function state(buildingId: string): Live {
  let s = live.get(buildingId);
  if (!s) {
    const m = loadJson<Mirror>(key(buildingId), isMirror);
    s = {
      rev: m?.rev ?? 0,
      updatedAt: m?.updatedAt ?? "",
      timer: null,
      pending: null,
      token: null,
    };
    live.set(buildingId, s);
  }
  return s;
}

function mirror(buildingId: string, blob: unknown, updatedAt: string): void {
  const s = state(buildingId);
  s.updatedAt = updatedAt;
  saveJson(key(buildingId), { rev: s.rev, blob, updatedAt } satisfies Mirror);
}

/** The blob this browser last knew about. Synchronous — the room boots on it. */
export function readSession(buildingId: string): unknown | null {
  return loadJson<Mirror>(key(buildingId), isMirror)?.blob ?? null;
}

/**
 * Pull the season down before the room is built.
 *
 * The newer document wins. A player who left mid-mission on another device
 * should walk back in standing where they left it; a player whose last session
 * was offline here should not lose it to an older server copy.
 *
 * Never throws. A backend that is not there degrades to exactly the behaviour
 * this had before it existed: localStorage, pushed on the next good load.
 */
export async function hydrateSession(buildingId: string): Promise<void> {
  const s = state(buildingId);
  try {
    const envelope = await api.getBuildingState(buildingId);
    s.rev = envelope.rev;
    if (envelope.track) s.track = envelope.track;

    const localAt = s.updatedAt;
    const serverAt = envelope.updatedAt;
    if (envelope.blob != null && (!localAt || serverAt >= localAt)) {
      mirror(buildingId, envelope.blob, serverAt);
      return;
    }
    // Ours is newer, or the server has nothing. Push what we have.
    const held = readSession(buildingId);
    if (held != null) await push(buildingId, held);
  } catch {
    // Offline. The mirror is the season.
  }
  void armBeacon(buildingId);
}

/** Which track the server has recorded for this building's session, if any. */
export function sessionTrack(buildingId: string): "SCA" | "SCB" | undefined {
  return state(buildingId).track;
}

/** Remember the track to send with the next write. */
export function setSessionTrack(buildingId: string, track: "SCA" | "SCB"): void {
  state(buildingId).track = track;
}

/**
 * A write that may wait — an objective closing, the world moving, a step across
 * a zone boundary. Coalesced, so a walk across the room is one request.
 */
export function writeSession(buildingId: string, blob: unknown): void {
  const s = state(buildingId);
  mirror(buildingId, blob, new Date().toISOString());
  s.pending = blob;
  if (s.timer !== null) return;
  s.timer = window.setTimeout(() => {
    s.timer = null;
    const held = s.pending;
    s.pending = null;
    if (held !== null) void push(buildingId, held);
  }, DEBOUNCE_MS);
}

/**
 * A write that must not wait. A beat committing is the one this exists for: a
 * decision the server never heard about is a decision that did not happen.
 */
export function writeSessionNow(buildingId: string, blob: unknown): void {
  const s = state(buildingId);
  if (s.timer !== null) {
    window.clearTimeout(s.timer);
    s.timer = null;
  }
  s.pending = null;
  mirror(buildingId, blob, new Date().toISOString());
  void push(buildingId, blob);
}

/**
 * The way out.
 *
 * `sendBeacon` is the only thing a browser reliably runs while a page is going
 * away, and it cannot attach an Authorization header — which is why the backend
 * exposes a POST that authorises on a short-lived, write-only, single-building
 * token in the body instead. It must not block the fade, so nothing here is
 * awaited and nothing here can throw.
 */
export function flushSession(buildingId: string, blob: unknown): void {
  const s = state(buildingId);
  if (s.timer !== null) {
    window.clearTimeout(s.timer);
    s.timer = null;
  }
  s.pending = null;
  mirror(buildingId, blob, new Date().toISOString());

  const token = s.token?.value;
  const url = `${appConfig.apiBaseUrl}/api/v1/city/buildings/${buildingId}/state`;
  const body = JSON.stringify({ rev: s.rev, blob, track: s.track, beaconToken: token });

  if (token && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    // text/plain keeps it a simple request, which is what makes it survive the
    // unload path without a preflight.
    if (navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }))) return;
  }
  // No token, or the browser refused it. keepalive is the next best thing, and
  // an ordinary authed PUT is the one after that.
  void push(buildingId, blob);
}

/**
 * Mint the beacon token ahead of the moment it is needed.
 *
 * Minting it at the door would mean a network round trip on the way out, which
 * is the one path that must not have one.
 */
export async function armBeacon(buildingId: string): Promise<void> {
  const s = state(buildingId);
  if (s.token && Date.now() - s.token.mintedAt < TOKEN_TTL_MS) return;
  try {
    const { beaconToken } = await api.getBeaconToken(buildingId);
    s.token = { value: beaconToken, mintedAt: Date.now() };
  } catch {
    s.token = null; // the keepalive path covers it
  }
}

async function push(buildingId: string, blob: unknown): Promise<void> {
  const s = state(buildingId);
  try {
    const res = await api.putBuildingState(buildingId, s.rev, blob, s.track);
    if (res.ok) {
      s.rev = res.rev;
      mirror(buildingId, blob, res.updatedAt || new Date().toISOString());
      return;
    }
    // Somebody else wrote first — the other tab, or this player on their phone.
    // Adopt their revision and re-send ours: the season we are holding is the
    // one this player is actually looking at.
    s.rev = res.rev;
    const retry = await api.putBuildingState(buildingId, s.rev, blob, s.track);
    if (retry.ok) {
      s.rev = retry.rev;
      mirror(buildingId, blob, retry.updatedAt || new Date().toISOString());
    }
  } catch {
    // The mirror holds it; the next hydrate pushes it.
  }
}

/** Tests only. */
export function resetSessionSync(): void {
  for (const s of live.values()) {
    if (s.timer !== null) window.clearTimeout(s.timer);
  }
  live.clear();
}

// The season, saved.
//
// The blob is exactly the document ADR-006 §11.1 describes, and it always was —
// it was written in the server's shape while the endpoints were still being
// built, precisely so that closing the seam would be three functions rather than
// a save-format migration players had to be carried across.
//
// This is those three functions. They now go through the framework's session
// layer (src/framework/session/sync.ts), which owns the revision, the debounce,
// the localStorage mirror and the exit beacon. The Café still does not call
// fetch (ADR-005 §8.4) and still does not know what a `rev` is.
import { loadJson, saveJson } from "@/lib/persist";
import { flushSession, readSession, writeSession, writeSessionNow } from "@/framework/session/sync";
import type { CastId } from "./cast";
import type { DecisionSoFar } from "./dialogue";
import { SEASON_START, type Progress } from "./missionRunner";
import { OPENING_WORLD, applyPatch, openingWorldFor, type World } from "./world";
import { trackOrDefault } from "@/framework/city/track";
import type { Decided } from "./report";

/** Where the season lived before the framework owned it. Read once, then dropped. */
const LEGACY_KEY = "city.cafe.season";

/** Exactly the document §19.2 describes, minus the `rev` the server owns. */
export interface SeasonBlob {
  missionOrder: number;
  objectiveIndex: number;
  /** The letters taken so far this mission. `partialPath` on the wire. */
  partialPath: string[];
  /** The generated beat waiting to be answered. Null when the bank served it. */
  pendingFollowupId: string | null;
  world: World;
  playerCell: [number, number];
  /** Who the live mission has brought in, so a resume does not lose Nadia. */
  visitors: CastId[];
  /** Decisions the backend has not taken yet, kept to retry. */
  unsent: {
    activityId: string;
    taken: DecisionSoFar;
    durationSec: number;
    /** The generated beat this decision answered, so a retry still counts it. */
    followup?: { id: string; choice: string } | null;
  }[];
  /**
   * Every week that has closed, and what was taken in it. A Café extension to
   * §19.2's document: the end-of-season report is built from this trail (§13.2),
   * and a trail that does not survive leaving is a report that only exists for
   * someone who played nine missions without ever shutting the laptop.
   *
   * It carries option letters, never anything derived from them. Nothing here is
   * a tier and nothing here decides one.
   */
  decided: Decided[];
}

export interface Season {
  progress: Progress;
  world: World;
  taken: DecisionSoFar;
  visitors: CastId[];
  playerCell: { x: number; y: number };
  unsent: SeasonBlob["unsent"];
  decided: Decided[];
  /** The generated beat waiting to be answered, if one is. */
  pendingFollowupId: string | null;
}

const BEATS = ["seed", "follow", "transfer"] as const;

export function toBlob(s: Season): SeasonBlob {
  return {
    missionOrder: s.progress.missionOrder,
    objectiveIndex: s.progress.objectiveIndex,
    partialPath: BEATS.map((b) => s.taken[b]).filter((v): v is string => typeof v === "string"),
    pendingFollowupId: s.pendingFollowupId,
    world: s.world,
    playerCell: [s.playerCell.x, s.playerCell.y],
    visitors: s.visitors,
    unsent: s.unsent,
    decided: s.decided,
  };
}

/**
 * Rebuild a season from a blob, defending against every field being wrong.
 *
 * A save that has been sitting in a browser across a content change is the
 * normal case, not the exotic one, and the failure to avoid is a resume that
 * drops the player into a mission that no longer exists with a world state that
 * no longer renders. Anything unrecognised falls back to the opening state
 * rather than being trusted.
 */
export function fromBlob(blob: unknown): Season | null {
  if (!isBlob(blob)) return null;
  const world = applyPatch(OPENING_WORLD, blob.world);
  const taken: DecisionSoFar = {};
  blob.partialPath.slice(0, BEATS.length).forEach((letter, i) => {
    if (typeof letter === "string") taken[BEATS[i]] = letter;
  });
  return {
    progress: {
      missionOrder: clamp(blob.missionOrder, 1, 10),
      objectiveIndex: Math.max(0, Math.floor(blob.objectiveIndex)),
    },
    world,
    taken,
    visitors: blob.visitors.filter((v): v is CastId => typeof v === "string"),
    playerCell: { x: blob.playerCell[0], y: blob.playerCell[1] },
    unsent: Array.isArray(blob.unsent) ? blob.unsent : [],
    decided: Array.isArray(blob.decided) ? blob.decided.filter(isDecided) : [],
    pendingFollowupId: typeof blob.pendingFollowupId === "string" ? blob.pendingFollowupId : null,
  };
}

/** A record row, checked field by field — a stale save is the normal case. */
function isDecided(v: unknown): v is Decided {
  if (typeof v !== "object" || v === null) return false;
  const d = v as Record<string, unknown>;
  const letter = (x: unknown) => x === null || typeof x === "string";
  return (
    typeof d.activityId === "string" && letter(d.seed) && letter(d.follow) && letter(d.transfer)
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.floor(n)));
}

function isBlob(v: unknown): v is SeasonBlob {
  if (typeof v !== "object" || v === null) return false;
  const b = v as Record<string, unknown>;
  return (
    typeof b.missionOrder === "number" &&
    Number.isFinite(b.missionOrder) &&
    typeof b.objectiveIndex === "number" &&
    Number.isFinite(b.objectiveIndex) &&
    Array.isArray(b.partialPath) &&
    Array.isArray(b.visitors) &&
    Array.isArray(b.playerCell) &&
    b.playerCell.length === 2 &&
    typeof b.world === "object" &&
    b.world !== null
  );
}

// ── The adapter ──────────────────────────────────────────────────────────────

export const BUILDING_ID = "cafe";

/**
 * A write that may wait. Debounced and coalesced by the layer below, so walking
 * across the room is one request rather than one per step.
 */
export function saveSeason(s: Season): void {
  writeSession(BUILDING_ID, toBlob(s));
}

/**
 * A write that must not wait — a beat committing. A decision the server never
 * heard about is a decision that did not happen.
 */
export function saveSeasonNow(s: Season): void {
  writeSessionNow(BUILDING_ID, toBlob(s));
}

/**
 * The way out. Goes by `sendBeacon`, which is the only thing a browser reliably
 * runs while the page is going away — and which is why the backend exposes a
 * POST that authorises on a token in the body rather than a header.
 */
export function flushSeason(s: Season): void {
  flushSession(BUILDING_ID, toBlob(s));
}

/**
 * Synchronous, and reads whatever the framework last mirrored. The interior
 * hydrates from the server behind its own door-opening line, so by the time the
 * room boots this is the current season.
 */
export function loadSeason(): Season | null {
  const raw = readSession(BUILDING_ID) ?? migrateLegacySave();
  return raw == null ? null : fromBlob(raw);
}

export function clearSeason(): void {
  writeSessionNow(BUILDING_ID, null);
  saveJson(LEGACY_KEY, null);
}

/**
 * Seasons written before the server had anywhere to put them.
 *
 * Read once, and only when the new mirror is empty. A player who was mid-week-6
 * when this shipped should not be handed a fresh café.
 */
function migrateLegacySave(): unknown | null {
  const raw = loadJson<unknown>(LEGACY_KEY, (_v): _v is unknown => true);
  if (raw == null) return null;
  writeSession(BUILDING_ID, raw);
  saveJson(LEGACY_KEY, null);
  return raw;
}

/** A season nobody has played yet. */
export function freshSeason(): Season {
  return {
    progress: SEASON_START,
    // Level B opens with the awning already up across the road, so a fresh
    // season on that track starts under the pressure rather than building to it.
    world: openingWorldFor(trackOrDefault()),
    taken: {},
    visitors: [],
    playerCell: { x: 4, y: 8 },
    unsent: [],
    decided: [],
    pendingFollowupId: null,
  };
}

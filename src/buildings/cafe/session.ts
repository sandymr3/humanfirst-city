// The season, saved.
//
// PRD §19 puts this on the server: `PUT /api/v1/city/buildings/cafe/state`, with
// a `rev`, a 16 KB blob, and a `sendBeacon` flush on the way out. None of that
// exists — the endpoints are BE-15/BE-16 and the ApiClient that would call them
// is maintainer-owned — so the season lives in localStorage instead.
//
// **The blob is written in the server's shape anyway** (§19.2, ten world keys and
// all), and everything goes through the adapter below. When the endpoints land,
// the maintainer replaces two functions and the building does not change. Writing
// a convenient local shape now would mean rewriting the save format later, and
// migrating players across it.
//
// This is also the degraded path the PRD already specifies for a backend outage
// (§19.7): localStorage, pushed on the next successful load. Today it is the only
// path; tomorrow it is the fallback. Same code either way.
import { loadJson, saveJson } from "@/lib/persist";
import type { CastId } from "./cast";
import type { DecisionSoFar } from "./dialogue";
import { SEASON_START, type Progress } from "./missionRunner";
import { OPENING_WORLD, applyPatch, openingWorldFor, type World } from "./world";
import { trackOrDefault } from "./track";
import type { Decided } from "./report";

const KEY = "city.cafe.season";

/** Exactly the document §19.2 describes, minus the `rev` the server owns. */
export interface SeasonBlob {
  missionOrder: number;
  objectiveIndex: number;
  /** The letters taken so far this mission. `partialPath` on the wire. */
  partialPath: string[];
  /** The generated beat waiting to be answered. Always null while the bank serves it. */
  pendingFollowupId: string | null;
  world: World;
  playerCell: [number, number];
  /** Who the live mission has brought in, so a resume does not lose Nadia. */
  visitors: CastId[];
  /** Decisions the backend has not taken yet, kept to retry. */
  unsent: { activityId: string; taken: DecisionSoFar; durationSec: number }[];
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
}

const BEATS = ["seed", "follow", "transfer"] as const;

export function toBlob(s: Season): SeasonBlob {
  return {
    missionOrder: s.progress.missionOrder,
    objectiveIndex: s.progress.objectiveIndex,
    partialPath: BEATS.map((b) => s.taken[b]).filter((v): v is string => typeof v === "string"),
    pendingFollowupId: null,
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
// Two functions. Both become one ApiClient call each when BE-15/16 land.

export function saveSeason(s: Season): void {
  saveJson(KEY, toBlob(s));
}

export function loadSeason(): Season | null {
  const raw = loadJson<unknown>(KEY, (_v): _v is unknown => true);
  return raw === null ? null : fromBlob(raw);
}

export function clearSeason(): void {
  saveJson(KEY, null);
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
  };
}

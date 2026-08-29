// The interview, saved.
//
// One blob per player, written in the shape the server stores opaquely, and put
// there by the framework's session layer (src/framework/session/sync.ts) — which
// owns the revision, the debounce, the localStorage mirror and the exit beacon.
// The Café still does not call fetch (ADR-005 §8.4) and still does not know what
// a `rev` is.
//
// The blob used to describe a season: which of nine missions, which objective
// within it, who had walked in. It describes a sitting now — which question, and
// which of its three beats. **A season blob does not migrate into an interview
// blob**, because they are not the same game; `fromBlob` rejects what it does
// not recognise and hands back a fresh interview, which is the honest outcome.
import { saveJson } from "@/lib/persist";
import { flushSession, readSession, writeSession, writeSessionNow } from "@/framework/session/sync";
import type { DecisionSoFar } from "./dialogue";
import {
  BEATS,
  INTERVIEW_START,
  type Answered,
  type Beat,
  type InterviewProgress,
} from "./interview";
import { OPENING_WORLD, applyPatch, openingWorldFor, type World } from "./world";
import { trackOrDefault } from "@/framework/city/track";

/** Where the season lived before any of this. Cleared once, never read. */
const LEGACY_KEY = "city.cafe.season";

export interface InterviewBlob {
  /** 0…8 while he is asking, 9 once he has decided. */
  questionIndex: number;
  /** The beat on screen, or null between questions. */
  beat: Beat | null;
  /** The letters taken so far on this question. `partialPath` on the wire. */
  partialPath: string[];
  /** The generated beat waiting to be answered. Null when the bank served it. */
  pendingFollowupId: string | null;
  world: World;
  /** Answers the backend has not taken yet, kept to retry. */
  unsent: {
    activityId: string;
    taken: DecisionSoFar;
    durationSec: number;
    /** The generated beat this answer answered, so a retry still counts it. */
    followup?: { id: string; choice: string } | null;
  }[];
  /** Every question that has closed, and what was taken on it. */
  answered: Answered[];
}

export interface Interview {
  progress: InterviewProgress;
  world: World;
  taken: DecisionSoFar;
  unsent: InterviewBlob["unsent"];
  answered: Answered[];
  /** The generated beat waiting to be answered, if one is. */
  pendingFollowupId: string | null;
}

export function toBlob(s: Interview): InterviewBlob {
  return {
    questionIndex: s.progress.index,
    beat: s.progress.beat,
    partialPath: BEATS.map((b) => s.taken[b]).filter((v): v is string => typeof v === "string"),
    pendingFollowupId: s.pendingFollowupId,
    world: s.world,
    unsent: s.unsent,
    answered: s.answered,
  };
}

/**
 * Rebuild a sitting from a blob, defending against every field being wrong.
 *
 * A blob that has been sitting in a browser across a content change is the
 * normal case, not the exotic one. Anything unrecognised falls back to a fresh
 * interview rather than being trusted — including every blob written by the
 * season this replaced.
 */
export function fromBlob(blob: unknown): Interview | null {
  if (!isBlob(blob)) return null;
  const taken: DecisionSoFar = {};
  blob.partialPath.slice(0, BEATS.length).forEach((letter, i) => {
    if (typeof letter === "string") taken[BEATS[i]] = letter;
  });
  return {
    progress: {
      index: clamp(blob.questionIndex, 0, 9),
      beat: isBeat(blob.beat) ? blob.beat : null,
    },
    world: applyPatch(OPENING_WORLD, blob.world),
    taken,
    unsent: Array.isArray(blob.unsent) ? blob.unsent : [],
    answered: Array.isArray(blob.answered) ? blob.answered.filter(isAnswered) : [],
    pendingFollowupId: typeof blob.pendingFollowupId === "string" ? blob.pendingFollowupId : null,
  };
}

/** A record row, checked field by field — a stale save is the normal case. */
function isAnswered(v: unknown): v is Answered {
  if (typeof v !== "object" || v === null) return false;
  const d = v as Record<string, unknown>;
  const letter = (x: unknown) => x === null || typeof x === "string";
  return (
    typeof d.activityId === "string" &&
    typeof d.competency === "string" &&
    letter(d.seed) &&
    letter(d.follow) &&
    letter(d.transfer)
  );
}

const isBeat = (v: unknown): v is Beat => BEATS.includes(v as Beat);

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.floor(n)));
}

function isBlob(v: unknown): v is InterviewBlob {
  if (typeof v !== "object" || v === null) return false;
  const b = v as Record<string, unknown>;
  return (
    typeof b.questionIndex === "number" &&
    Number.isFinite(b.questionIndex) &&
    Array.isArray(b.partialPath) &&
    typeof b.world === "object" &&
    b.world !== null
  );
}

// ── The adapter ──────────────────────────────────────────────────────────────

export const BUILDING_ID = "cafe";

/** A write that may wait. Debounced and coalesced by the layer below. */
export function saveInterview(s: Interview): void {
  writeSession(BUILDING_ID, toBlob(s));
}

/**
 * A write that must not wait — a beat committing. An answer the server never
 * heard about is an answer that did not happen.
 */
export function saveInterviewNow(s: Interview): void {
  writeSessionNow(BUILDING_ID, toBlob(s));
}

/**
 * The way out. Goes by `sendBeacon`, which is the only thing a browser reliably
 * runs while the page is going away.
 */
export function flushInterview(s: Interview): void {
  flushSession(BUILDING_ID, toBlob(s));
}

/**
 * Synchronous, and reads whatever the framework last mirrored. The interior
 * hydrates from the server behind its own door-opening line, so by the time the
 * room boots this is the current sitting.
 */
export function loadInterview(): Interview | null {
  const raw = readSession(BUILDING_ID);
  return raw == null ? null : fromBlob(raw);
}

export function clearInterview(): void {
  writeSessionNow(BUILDING_ID, null);
  saveJson(LEGACY_KEY, null);
}

/** A sitting nobody has started. */
export function freshInterview(): Interview {
  return {
    progress: INTERVIEW_START,
    // Level B opens with the awning already up across the road, so the room the
    // interview happens in is the room that track's questions are about.
    world: openingWorldFor(trackOrDefault()),
    taken: {},
    unsent: [],
    answered: [],
    pendingFollowupId: null,
  };
}

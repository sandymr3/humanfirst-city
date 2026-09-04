/**
 * The career, saved (ADR-007 §6, and ADR-006 §11 for the layer underneath).
 *
 * One blob per player, written in the shape the server stores opaquely, and put
 * there by the framework's session layer — which owns the revision, the
 * debounce, the localStorage mirror and the exit beacon. The Café still does not
 * call fetch and still does not know what a `rev` is.
 *
 * The blob has now described three different games: a nine-week season, then a
 * single sitting, and now a career. **None of them migrates into another**, and
 * `fromBlob` rejects what it does not recognise rather than guessing. Handing a
 * player a half-understood save is worse than handing them a fresh start: they
 * would carry on inside a state nothing in the code agrees about.
 */

import { flushSession, readSession, writeSession, writeSessionNow } from "@/framework/session/sync";
import { applyPatch, openingWorldFor, type World } from "./world";
import { trackOrDefault } from "@/framework/city/track";
import { START_STAGE, stageById, type Role } from "./journey";
import type { WorldPatch } from "./world";

export const BUILDING_ID = "cafe";

/** One decision, as it goes on the wire: a unit and a letter, and no more. */
export interface Decision {
  unitId: string;
  /** "a" | "b" | "c", or a composed "a.c" for a two-beat CEO scene. */
  choice: string;
}

/** A typed answer, held until its stage closes. */
export interface Answer {
  unitId: string;
  text: string;
}

/** A stage close the server has not taken yet, kept so a retry still counts it. */
export interface UnsentStage {
  stageId: string;
  units: Decision[];
  answers: Answer[];
}

export interface JourneyBlob {
  /** The server's handle for this run. Null until the first stage closes. */
  runId: string | null;
  stageId: string;
  role: Role;
  /** How far into the current stage's scenes or questions. */
  index: number;
  /**
   * A two-beat CEO scene in progress: the letters taken so far, and the
   * option id of the third beat (ADR-007 §16) once that one is answered too.
   */
  taken: { seed?: string; follow?: string; transfer?: string };
  /** Everything decided across the whole journey, for the per-competency submits. */
  decided: Decision[];
  /** Typed answers not yet sent, for the stage in progress. */
  answers: Answer[];
  /** Unit ids of questions already answered and closed. */
  qaDone: string[];
  world: World;
  /** The business as of the last stage boundary. Never derived on the client. */
  revenue: number;
  /** Stage closes the backend has not taken yet. */
  unsent: UnsentStage[];
}

export interface Journey {
  runId: string | null;
  stageId: string;
  role: Role;
  index: number;
  taken: { seed?: string; follow?: string; transfer?: string };
  decided: Decision[];
  answers: Answer[];
  qaDone: string[];
  world: World;
  revenue: number;
  unsent: UnsentStage[];
}

// ── Validation ────────────────────────────────────────────────────────────────
//
// Every field is checked. A stale save is the normal case here, not the
// exceptional one: the Café has changed shape twice already and a player who was
// mid-interview when this shipped has a blob describing a game that no longer
// exists.

const ROLES: readonly Role[] = ["candidate", "employee", "branch_manager", "ceo"];

function isDecision(v: unknown): v is Decision {
  if (typeof v !== "object" || v === null) return false;
  const d = v as Record<string, unknown>;
  return typeof d.unitId === "string" && typeof d.choice === "string";
}

function isAnswer(v: unknown): v is Answer {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Record<string, unknown>;
  return typeof a.unitId === "string" && typeof a.text === "string";
}

function isUnsent(v: unknown): v is UnsentStage {
  if (typeof v !== "object" || v === null) return false;
  const u = v as Record<string, unknown>;
  return (
    typeof u.stageId === "string" &&
    Array.isArray(u.units) &&
    u.units.every(isDecision) &&
    Array.isArray(u.answers) &&
    u.answers.every(isAnswer)
  );
}

function isBlob(v: unknown): v is JourneyBlob {
  if (typeof v !== "object" || v === null) return false;
  const b = v as Record<string, unknown>;
  return (
    typeof b.stageId === "string" &&
    // The discriminator against the two older shapes. A season blob has
    // `missionOrder`, a sitting has `questionIndex`, and neither has a stage id
    // this journey knows — so an unrecognised stage is a foreign save.
    stageById(b.stageId) !== undefined &&
    typeof b.role === "string" &&
    ROLES.includes(b.role as Role) &&
    typeof b.index === "number" &&
    Number.isFinite(b.index) &&
    Array.isArray(b.decided) &&
    typeof b.world === "object" &&
    b.world !== null
  );
}

// ── The adapter ───────────────────────────────────────────────────────────────

function toBlob(j: Journey): JourneyBlob {
  return {
    runId: j.runId,
    stageId: j.stageId,
    role: j.role,
    index: j.index,
    taken: j.taken,
    decided: j.decided,
    answers: j.answers,
    qaDone: j.qaDone,
    world: j.world,
    revenue: j.revenue,
    unsent: j.unsent,
  };
}

/**
 * A tab closed between the follow beat and the third beat (ADR-007 §16)
 * resumes past it: the tree unit's real decision is already in `decided`
 * before the third beat is ever asked, so there is nothing to reconstruct on
 * reload — only something safe to skip.
 */
function normalizeTaken(taken: Journey["taken"]): Journey["taken"] {
  return taken.seed && taken.follow ? {} : taken;
}

function fromBlob(raw: unknown): Journey | null {
  if (!isBlob(raw)) return null;
  const b = raw;
  return {
    runId: typeof b.runId === "string" ? b.runId : null,
    stageId: b.stageId,
    role: b.role,
    index: Math.max(0, Math.floor(b.index)),
    taken: normalizeTaken(typeof b.taken === "object" && b.taken !== null ? b.taken : {}),
    decided: (b.decided as unknown[]).filter(isDecision),
    answers: Array.isArray(b.answers) ? (b.answers as unknown[]).filter(isAnswer) : [],
    qaDone: Array.isArray(b.qaDone)
      ? (b.qaDone as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    // A world written by an older build may carry keys this one has dropped.
    // applyPatch filters against the closed enum, so anything unrecognised is
    // discarded rather than rendered as a prop variant that does not exist.
    world: applyPatch(openingWorldFor(trackOrDefault()), b.world as WorldPatch),
    revenue: typeof b.revenue === "number" && Number.isFinite(b.revenue) ? b.revenue : 0,
    unsent: Array.isArray(b.unsent) ? (b.unsent as unknown[]).filter(isUnsent) : [],
  };
}

/** A write that may wait. Debounced and coalesced by the layer below. */
export function saveJourney(j: Journey): void {
  writeSession(BUILDING_ID, toBlob(j));
}

/**
 * A write that must not wait — a decision committing, or a stage closing. A
 * decision the server never heard about is a decision that did not happen.
 */
export function saveJourneyNow(j: Journey): void {
  writeSessionNow(BUILDING_ID, toBlob(j));
}

/** The way out, by `sendBeacon` — the only thing a browser reliably runs while the page goes away. */
export function flushJourney(j: Journey): void {
  flushSession(BUILDING_ID, toBlob(j));
}

/** Synchronous, over whatever the framework last mirrored. */
export function loadJourney(): Journey | null {
  const raw = readSession(BUILDING_ID);
  return raw == null ? null : fromBlob(raw);
}

export function clearJourney(): void {
  writeSessionNow(BUILDING_ID, null);
}

/** A career nobody has started. */
export function freshJourney(): Journey {
  return {
    runId: null,
    stageId: START_STAGE,
    role: "candidate",
    index: 0,
    taken: {},
    decided: [],
    answers: [],
    qaDone: [],
    world: openingWorldFor(trackOrDefault()),
    revenue: 0,
    unsent: [],
  };
}

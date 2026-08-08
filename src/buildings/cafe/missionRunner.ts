// The mission runner — when an objective is satisfied, and what happens next.
//
// Pure, and a reducer rather than a subscriber: the room reports what happened
// and this decides whether it mattered. That keeps the two properties that make
// the season a season testable without a renderer —
//
//   * exactly one objective is live at a time, and
//   * mission n+1 does not exist until n closes.
//
// The tracker renders `line` and nothing else. There is no score in this file
// and there must never be one: it is the most tempting surface in the building
// to put a number on, which is exactly why it is written down here that it isn't
// (PRD §11.1).
import type { Cell } from "@/lib/pathfinding";
import { MISSIONS, beatsDone, missionByOrder, type Mission, type Objective } from "./missions";

/** What the room tells the runner. Facts, never judgements. */
export type RoomEvent =
  | { kind: "moved"; cell: Cell }
  | { kind: "spoke_to"; id: string }
  | { kind: "inspected"; id: string }
  | { kind: "decided"; beat: string }
  | { kind: "arrived"; id: string };

export interface Progress {
  /** 1..9, or 10 once the season is over. */
  missionOrder: number;
  objectiveIndex: number;
}

export const SEASON_START: Progress = { missionOrder: 1, objectiveIndex: 0 };

/** Where the player has to stand for a `go_to`, keyed by target id. */
export type CellLookup = (targetId: string) => Cell | null;

export function currentMission(p: Progress): Mission | null {
  return missionByOrder(p.missionOrder);
}

export function currentObjective(p: Progress): Objective | null {
  const m = currentMission(p);
  if (!m) return null;
  return m.objectives[p.objectiveIndex] ?? null;
}

export function seasonIsOver(p: Progress): boolean {
  return p.missionOrder > MISSIONS.length;
}

/** How many of the three beats this mission has behind it. */
export function beatsBehind(p: Progress): number {
  const m = currentMission(p);
  return m ? beatsDone(m, p.objectiveIndex) : 0;
}

const manhattan = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/**
 * Does this event satisfy this objective?
 *
 * `go_to` is satisfied within one cell rather than on the cell itself, matching
 * every other proximity rule in the building — the prompt to read the board
 * fires from beside it, so standing beside it has to count as being there.
 */
export function satisfies(objective: Objective, event: RoomEvent, cellOf: CellLookup): boolean {
  switch (objective.kind) {
    case "go_to": {
      if (event.kind !== "moved") return false;
      const target = cellOf(objective.target);
      return target !== null && manhattan(event.cell, target) <= 1;
    }
    case "wait_for":
      return event.kind === "arrived" && event.id === objective.target;
    case "talk_to":
    case "report":
      return event.kind === "spoke_to" && event.id === objective.target;
    case "inspect":
      return event.kind === "inspected" && event.id === objective.target;
    case "decide":
      return event.kind === "decided" && event.beat === objective.target;
  }
}

export interface Advance {
  next: Progress;
  /** The objective that just closed, if any. */
  completed: Objective | null;
  /** True when this event closed the last objective of the mission. */
  missionClosed: Mission | null;
}

/**
 * Feed the runner one thing that happened. Returns the same Progress object when
 * nothing moved, so a caller can tell a real advance from a no-op by identity —
 * the ticker reports movement every time the player changes cell and almost none
 * of it is an objective.
 */
export function advance(p: Progress, event: RoomEvent, cellOf: CellLookup): Advance {
  const mission = currentMission(p);
  const objective = currentObjective(p);
  if (!mission || !objective || !satisfies(objective, event, cellOf)) {
    return { next: p, completed: null, missionClosed: null };
  }

  const objectiveIndex = p.objectiveIndex + 1;
  if (objectiveIndex < mission.objectives.length) {
    return {
      next: { missionOrder: p.missionOrder, objectiveIndex },
      completed: objective,
      missionClosed: null,
    };
  }

  // Chain finished: the season moves on. Nothing is on a timer — the next
  // mission's first objective is simply available, and the player is free until
  // they go and do it (PRD §8.1).
  return {
    next: { missionOrder: p.missionOrder + 1, objectiveIndex: 0 },
    completed: objective,
    missionClosed: mission,
  };
}

/**
 * The one line the tracker shows, or null when the season is done. Never a
 * count, never a tick, never a quality marker — the ordinal below is pacing
 * information and is the only progress the player is given.
 */
export function trackerLine(p: Progress): string | null {
  return currentObjective(p)?.line ?? null;
}

/** "mission 4 of 9". Pacing, not quality. */
export function trackerOrdinal(p: Progress): string | null {
  if (seasonIsOver(p)) return null;
  return `mission ${p.missionOrder} of ${MISSIONS.length}`;
}

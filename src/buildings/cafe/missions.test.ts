import { describe, it, expect } from "vitest";
import { findPath, type Cell } from "@/lib/pathfinding";
import { GATES, GUIDE, HOTSPOTS, SPAWN, STATIONS, makeRoomGrid, type GateId } from "./room";
import { CAST, type CastId } from "./cast";
import { isLegal, isWorldKey, type WorldKey } from "./world";
import { MISSIONS, beatsDone, decideBeats, missionByOrder } from "./missions";
import {
  SEASON_START,
  advance,
  beatsBehind,
  currentMission,
  currentObjective,
  satisfies,
  seasonIsOver,
  trackerLine,
  trackerOrdinal,
} from "./missionRunner";

const open = makeRoomGrid(new Set(GATES.map((g) => g.id)) as ReadonlySet<GateId>);
const castIds = new Set(CAST.map((m) => m.id as string));
const placeIds = new Set([...STATIONS.map((s) => s.id), ...HOTSPOTS.map((h) => h.id)]);

const cellOf = (id: string): Cell | null =>
  STATIONS.find((s) => s.id === id)?.cell ?? HOTSPOTS.find((h) => h.id === id)?.cell ?? null;

describe("the season", () => {
  it("is nine missions, one per competency, strictly ordered", () => {
    expect(MISSIONS).toHaveLength(9);
    expect(MISSIONS.map((m) => m.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(MISSIONS.map((m) => m.competency)).toEqual([
      "C1",
      "C2",
      "C3",
      "C4",
      "C5",
      "C6",
      "C7",
      "C8",
      "C9",
    ]);
    expect(new Set(MISSIONS.map((m) => m.activityId)).size).toBe(9);
  });

  it("runs the weeks forward", () => {
    const weeks = MISSIONS.map((m) => m.week);
    expect(weeks).toEqual([...weeks].sort((a, b) => a - b));
    expect(new Set(weeks).size).toBe(weeks.length);
  });

  it("ends every mission with the three beats, in order", () => {
    for (const m of MISSIONS) {
      const beats = decideBeats(m);
      expect(
        beats.map((b) => b.target),
        `${m.activityId}`,
      ).toEqual(["seed", "follow", "transfer"]);
      // They are the last three, or something has been appended after the
      // decision that is really part of it.
      const tail = m.objectives.slice(-4);
      expect(tail.filter((o) => o.kind === "decide").length, `${m.activityId}`).toBeGreaterThan(2);
    }
  });

  it("makes you do something in the room before it asks you anything", () => {
    // The failure mode this whole structure exists to prevent: decisions as
    // modals in a nice backdrop (PRD §18.4).
    for (const m of MISSIONS) {
      const firstDecide = m.objectives.findIndex((o) => o.kind === "decide");
      expect(firstDecide, `${m.activityId} opens on a decision`).toBeGreaterThan(0);
      const before = m.objectives.slice(0, firstDecide);
      expect(
        before.some((o) => ["go_to", "wait_for", "talk_to", "inspect"].includes(o.kind)),
        `${m.activityId} asks nothing of the room first`,
      ).toBe(true);
    }
  });

  it("leaves every mission with something the player can point at", () => {
    for (const m of MISSIONS) {
      const keys = Object.keys(m.closeWorldState);
      expect(keys.length, `${m.activityId} closes changing nothing`).toBeGreaterThan(0);
      for (const [k, v] of Object.entries(m.closeWorldState)) {
        expect(isWorldKey(k), `${m.activityId} closes on unknown key ${k}`).toBe(true);
        expect(isLegal(k as WorldKey, v as string), `${m.activityId}: ${k}=${v}`).toBe(true);
      }
    }
  });

  it("only lets the generated beat write legal world state", () => {
    // Anything else and the model can invent a value that silently stops
    // rendering (PRD §9.6.3, gate 8).
    for (const m of MISSIONS) {
      expect(m.aiWorldCandidates.length, `${m.activityId} offers no writes`).toBeGreaterThan(0);
      for (const patch of m.aiWorldCandidates) {
        for (const [k, v] of Object.entries(patch)) {
          expect(isWorldKey(k), `${m.activityId} candidate key ${k}`).toBe(true);
          expect(isLegal(k as WorldKey, v as string), `${m.activityId}: ${k}=${v}`).toBe(true);
        }
      }
    }
  });

  it("points every objective at something that exists", () => {
    for (const m of MISSIONS) {
      for (const o of m.objectives) {
        const where = `${m.activityId} ${o.kind} ${o.target}`;
        if (o.kind === "decide") {
          expect(["seed", "follow", "transfer"], where).toContain(o.target);
        } else if (o.kind === "talk_to" || o.kind === "report" || o.kind === "wait_for") {
          expect(castIds.has(o.target), where).toBe(true);
        } else {
          expect(placeIds.has(o.target), where).toBe(true);
        }
      }
    }
  });

  it("keeps every go_to reachable, and in the guided-nav list", () => {
    // An objective you cannot reach without a mouse is a blocked season.
    const guideIds = new Set(GUIDE.map((p) => p.id));
    for (const m of MISSIONS) {
      for (const o of m.objectives.filter((x) => x.kind === "go_to")) {
        const cell = cellOf(o.target);
        expect(cell, `${m.activityId} sends you to unknown ${o.target}`).toBeTruthy();
        expect(findPath(open, SPAWN, cell!).length, `${o.target} unreachable`).toBeGreaterThan(0);
        expect(guideIds.has(o.target), `${o.target} is not in the guided-nav list`).toBe(true);
      }
    }
  });

  it("writes every tracker line in the room's own words", () => {
    for (const m of MISSIONS) {
      for (const o of m.objectives) {
        expect(o.line.trim(), `${m.activityId} has a blank line`).toBeTruthy();
        expect(o.line, `${m.activityId}: "${o.line}"`).not.toMatch(/objective|step \d|task/i);
        // No score, no count, no quality marker — the tracker is the most
        // tempting surface in the building to put a number on.
        expect(o.line, `${m.activityId}: "${o.line}"`).not.toMatch(
          /\d\s*\/\s*\d|proficiency|pts?/i,
        );
      }
    }
  });

  it("gives the three host-less missions to the room rather than to nobody", () => {
    const hostless = MISSIONS.filter((m) => m.host === null).map((m) => m.order);
    // The night beat, the sample bag, and the awning: alone on purpose, an
    // object on a counter, and a thing seen through glass.
    expect(hostless).toEqual([4, 8, 9]);
  });

  it("never asks a mission to report to nobody", () => {
    for (const m of MISSIONS) {
      for (const o of m.objectives.filter((x) => x.kind === "report")) {
        expect(castIds.has(o.target), `${m.activityId} reports to ${o.target}`).toBe(true);
      }
    }
  });

  it("finds a mission by its order and nothing by a bad one", () => {
    expect(missionByOrder(1)?.activityId).toBe("C1-SCA-01");
    expect(missionByOrder(9)?.activityId).toBe("C9-SCA-01");
    expect(missionByOrder(10)).toBeNull();
  });
});

describe("running a mission", () => {
  it("opens on the first objective of the first mission", () => {
    expect(currentMission(SEASON_START)?.order).toBe(1);
    expect(currentObjective(SEASON_START)?.target).toBe("st_counter");
    expect(trackerLine(SEASON_START)).toBe("take the counter");
    expect(trackerOrdinal(SEASON_START)).toBe("mission 1 of 9");
  });

  it("shows exactly one line at a time", () => {
    // There is no API here that could return two, and that is the point.
    expect(typeof trackerLine(SEASON_START)).toBe("string");
  });

  it("ignores an event that is not the live objective", () => {
    const spoke = advance(SEASON_START, { kind: "spoke_to", id: "priya" }, cellOf);
    expect(spoke.next).toBe(SEASON_START); // same object: nothing moved
    expect(spoke.completed).toBeNull();
  });

  it("advances on the live objective and only on it", () => {
    const at = cellOf("st_counter")!;
    const moved = advance(SEASON_START, { kind: "moved", cell: at }, cellOf);
    expect(moved.next.objectiveIndex).toBe(1);
    expect(moved.completed?.target).toBe("st_counter");
    expect(trackerLine(moved.next)).toBe("8:05 — the bell");
  });

  it("counts a go_to from one cell away, like every other prompt in the room", () => {
    const at = cellOf("st_counter")!;
    const beside = { x: at.x, y: at.y + 1 };
    expect(advance(SEASON_START, { kind: "moved", cell: beside }, cellOf).next.objectiveIndex).toBe(
      1,
    );
  });

  it("will not let mission two exist until mission one closes", () => {
    let p = SEASON_START;
    const m1 = MISSIONS[0];
    for (const [i, o] of m1.objectives.entries()) {
      expect(currentMission(p)?.order, `still on mission 1 at objective ${i}`).toBe(1);
      p = advance(p, eventFor(o.kind, o.target), cellOf).next;
    }
    expect(p.missionOrder).toBe(2);
    expect(p.objectiveIndex).toBe(0);
    expect(trackerLine(p)).toBe("read the board");
  });

  it("reports the mission closing exactly once, on its last objective", () => {
    let p = SEASON_START;
    const m1 = MISSIONS[0];
    const closes: number[] = [];
    for (const [i, o] of m1.objectives.entries()) {
      const step = advance(p, eventFor(o.kind, o.target), cellOf);
      if (step.missionClosed) closes.push(i);
      p = step.next;
    }
    expect(closes).toEqual([m1.objectives.length - 1]);
  });

  it("plays the whole season through and then stops", () => {
    let p = SEASON_START;
    for (const m of MISSIONS) {
      for (const o of m.objectives) p = advance(p, eventFor(o.kind, o.target), cellOf).next;
    }
    expect(seasonIsOver(p)).toBe(true);
    expect(currentMission(p)).toBeNull();
    expect(trackerLine(p)).toBeNull();
    expect(trackerOrdinal(p)).toBeNull();
    // And nothing further moves it.
    expect(advance(p, { kind: "spoke_to", id: "priya" }, cellOf).next).toBe(p);
  });

  it("counts the beats behind you, three per mission and never four", () => {
    let p = SEASON_START;
    const m1 = MISSIONS[0];
    const seen: number[] = [];
    for (const o of m1.objectives) {
      seen.push(beatsBehind(p));
      p = advance(p, eventFor(o.kind, o.target), cellOf).next;
    }
    expect(Math.max(...seen)).toBeLessThanOrEqual(3);
    expect(beatsDone(m1, m1.objectives.length)).toBe(3);
  });

  it("matches each objective kind to its own event and no other", () => {
    const inspect = { kind: "inspect" as const, target: "ht_chalkboard", line: "x" };
    expect(satisfies(inspect, { kind: "inspected", id: "ht_chalkboard" }, cellOf)).toBe(true);
    expect(satisfies(inspect, { kind: "spoke_to", id: "ht_chalkboard" }, cellOf)).toBe(false);

    const talk = { kind: "talk_to" as const, target: "priya", line: "x" };
    expect(satisfies(talk, { kind: "spoke_to", id: "priya" }, cellOf)).toBe(true);
    expect(satisfies(talk, { kind: "spoke_to", id: "marcus" }, cellOf)).toBe(false);

    const wait = { kind: "wait_for" as const, target: "nadia", line: "x" };
    expect(satisfies(wait, { kind: "arrived", id: "nadia" }, cellOf)).toBe(true);
    expect(satisfies(wait, { kind: "spoke_to", id: "nadia" }, cellOf)).toBe(false);

    const beat = { kind: "decide" as const, target: "follow", line: "decide" };
    expect(satisfies(beat, { kind: "decided", beat: "follow" }, cellOf)).toBe(true);
    expect(satisfies(beat, { kind: "decided", beat: "seed" }, cellOf)).toBe(false);
  });
});

/** The event that would satisfy an objective of this kind. */
function eventFor(kind: string, target: string): Parameters<typeof advance>[1] {
  switch (kind) {
    case "go_to":
      return { kind: "moved", cell: cellOf(target) ?? { x: 0, y: 0 } };
    case "wait_for":
      return { kind: "arrived", id: target };
    case "talk_to":
    case "report":
      return { kind: "spoke_to", id: target as CastId };
    case "inspect":
      return { kind: "inspected", id: target };
    default:
      return { kind: "decided", beat: target };
  }
}

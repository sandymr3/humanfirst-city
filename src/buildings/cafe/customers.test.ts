import { describe, it, expect } from "vitest";
import {
  DOOR,
  INSIDE,
  ORDER_AT,
  QUEUE,
  SEATS,
  everyRouteCell,
  goalFor,
  nextBell,
  nextPhase,
  sitFor,
  staysIn,
  type Phase,
} from "./customers";
import { FURNITURE, NO_GATES_OPEN, makeRoomGrid } from "./room";
import { CAST } from "./cast";
import { OPENING_WORLD, type World } from "./world";
import { findPath } from "@/lib/pathfinding";

const grid = makeRoomGrid(NO_GATES_OPEN);
const worldWith = (regulars: World["regulars"]): World => ({ ...OPENING_WORLD, regulars });

describe("where the loop puts people", () => {
  it("never routes anybody into a wall or a chair", () => {
    // The whole reason this file has no Pixi in it: "is that cell walkable" is a
    // layout question, and layout questions should fail in CI rather than as a
    // customer standing inside the four-top.
    for (const cell of everyRouteCell()) {
      expect(grid.isWalkable(cell.x, cell.y), `(${cell.x},${cell.y}) is blocked`).toBe(true);
    }
  });

  it("routes the whole loop with the flap down, because customers never go behind the bar", () => {
    const legs: [string, typeof INSIDE, typeof INSIDE][] = [
      ["door → inside", INSIDE, QUEUE[QUEUE.length - 1]],
      ["queue → till", QUEUE[0], ORDER_AT],
      ...SEATS.map((s, i): [string, typeof INSIDE, typeof INSIDE] => [
        `till → seat ${i}`,
        ORDER_AT,
        s,
      ]),
      ...SEATS.map((s, i): [string, typeof INSIDE, typeof INSIDE] => [
        `seat ${i} → door`,
        s,
        INSIDE,
      ]),
    ];
    for (const [where, from, to] of legs) {
      expect(findPath(grid, from, to).length, `${where} has no route`).toBeGreaterThan(0);
    }
  });

  it("queues toward the counter, nearest slot first", () => {
    for (let i = 1; i < QUEUE.length; i++) {
      const ahead = QUEUE[i - 1];
      const behind = QUEUE[i];
      expect(
        Math.abs(ahead.y - ORDER_AT.y) + Math.abs(ahead.x - ORDER_AT.x),
        `slot ${i} is not behind slot ${i - 1}`,
      ).toBeLessThan(Math.abs(behind.y - ORDER_AT.y) + Math.abs(behind.x - ORDER_AT.x));
    }
  });

  it("keeps its seats off the cast's chairs and out of the cast's way", () => {
    // Marcus's chair at (9,6) is his. A customer in it on the week his being
    // gone is the beat would wreck the only non-verbal consequence in the
    // building (PRD §15).
    const taken = new Set(CAST.map((m) => `${m.anchor.x},${m.anchor.y}`));
    for (const seat of SEATS) {
      expect(taken.has(`${seat.x},${seat.y}`), `seat (${seat.x},${seat.y}) is somebody's`).toBe(
        false,
      );
    }
  });

  it("comes in and goes out through the player's own door", () => {
    expect(goalFor("leaving", 0, null)).toEqual(DOOR);
    expect(goalFor("entering", 0, null)).toEqual(INSIDE);
  });

  it("stands still when it is standing still", () => {
    expect(goalFor("away", 0, SEATS[0])).toBeNull();
    expect(goalFor("seated", 0, SEATS[0])).toBeNull();
  });

  it("clamps an over-long queue onto the last slot rather than off the end", () => {
    expect(goalFor("queueing", 99, null)).toEqual(QUEUE[QUEUE.length - 1]);
  });

  it("has furniture at every table it seats somebody beside", () => {
    const tables = FURNITURE.filter((p) => p.kind === "table").map((p) => p.cell);
    for (const seat of SEATS) {
      const near = tables.some((t) => Math.abs(t.x - seat.x) + Math.abs(t.y - seat.y) <= 2);
      expect(near, `seat (${seat.x},${seat.y}) is not beside a table`).toBe(true);
    }
  });
});

describe("the loop itself", () => {
  it("always comes back round to away, from anywhere", () => {
    for (const start of [
      "away",
      "entering",
      "queueing",
      "ordering",
      "seating",
      "seated",
    ] as const) {
      let phase: Phase = start;
      let steps = 0;
      while (phase !== "away" && steps < 12) {
        phase = nextPhase(phase, true);
        steps++;
      }
      expect(phase, `${start} never finishes`).toBe("away");
    }
  });

  it("sends a takeaway order straight back out of the door", () => {
    expect(nextPhase("ordering", false)).toBe("leaving");
    expect(nextPhase("ordering", true)).toBe("seating");
  });

  it("never sits somebody down when there is nowhere to sit", () => {
    expect(staysIn(0, 0)).toBe(false);
    expect(staysIn(0.99, 4)).toBe(false);
    expect(staysIn(0.1, 4)).toBe(true);
  });
});

describe("the schedule", () => {
  it("rings sooner in a busy room than in a thin one", () => {
    expect(nextBell(worldWith("full"), false, 0.5)).toBeLessThan(
      nextBell(worldWith("thin"), false, 0.5),
    );
  });

  it("stretches the gaps out under reduced motion", () => {
    expect(nextBell(OPENING_WORLD, true, 0.5)).toBeGreaterThan(nextBell(OPENING_WORLD, false, 0.5));
  });

  it("stays inside its own bounds however bad the random number is", () => {
    for (const rand of [-3, 0, 0.5, 1, 9]) {
      expect(nextBell(OPENING_WORLD, false, rand)).toBeGreaterThanOrEqual(25 * 0.75);
      expect(nextBell(OPENING_WORLD, false, rand)).toBeLessThanOrEqual(45);
      expect(sitFor(rand)).toBeGreaterThanOrEqual(26);
      expect(sitFor(rand)).toBeLessThanOrEqual(70);
    }
  });
});

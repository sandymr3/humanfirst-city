import { describe, it, expect } from "vitest";
import { findPath, type Cell } from "@/lib/pathfinding";
import { GATES, GUIDE, ROOM_H, ROOM_W, SPAWN, makeRoomGrid, type GateId } from "./room";
import {
  CAST,
  OPENING_CAST,
  atAnchors,
  castById,
  castNear,
  castPresent,
  castFor,
  facingFrom,
  guideWithCast,
} from "./cast";
import { OPENING_WORLD, WORLD_KEYS } from "./world";

const ALL_OPEN: ReadonlySet<GateId> = new Set(GATES.map((g) => g.id));
const open = makeRoomGrid(ALL_OPEN);

const at = (c: Cell) => `(${c.x},${c.y})`;
const inBounds = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < ROOM_W && c.y < ROOM_H;
const manhattan = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Every cell in the room, walkable or not. */
function everyCell(): Cell[] {
  const out: Cell[] = [];
  for (let y = 0; y < ROOM_H; y++) for (let x = 0; x < ROOM_W; x++) out.push({ x, y });
  return out;
}

describe("the Café cast", () => {
  it("keeps everybody inside the room", () => {
    for (const m of CAST) {
      expect(inBounds(m.anchor), `${m.id} is anchored at ${at(m.anchor)}, outside the room`).toBe(
        true,
      );
      for (const p of m.patrol) {
        expect(inBounds(p), `${m.id} patrols through ${at(p)}, outside the room`).toBe(true);
      }
    }
  });

  it("stands the standing ones on floor and sits the seated ones on furniture", () => {
    for (const m of CAST) {
      const walkable = open.isWalkable(m.anchor.x, m.anchor.y);
      if (m.seated) {
        // Nothing to sit on is the bug this catches: a seated character on a
        // free cell reads as squatting in the middle of the room.
        expect(walkable, `${m.id} is seated at ${at(m.anchor)} with no furniture under them`).toBe(
          false,
        );
      } else {
        expect(walkable, `${m.id} stands at ${at(m.anchor)}, which is blocked`).toBe(true);
      }
    }
  });

  it("gives nobody a patrol they cannot walk", () => {
    for (const m of CAST) {
      if (m.seated) {
        expect(m.patrol, `${m.id} is seated but patrols`).toHaveLength(0);
        continue;
      }
      for (const p of m.patrol) {
        expect(open.isWalkable(p.x, p.y), `${m.id} patrols to ${at(p)}, which is blocked`).toBe(
          true,
        );
      }
      for (let i = 1; i < m.patrol.length; i++) {
        expect(
          findPath(open, m.patrol[i - 1], m.patrol[i]).length,
          `${m.id} cannot get from ${at(m.patrol[i - 1])} to ${at(m.patrol[i])}`,
        ).toBeGreaterThan(0);
      }
      if (m.patrol.length > 0) {
        expect(m.patrol[0], `${m.id}'s patrol should start where they stand`).toEqual(m.anchor);
      }
    }
  });

  it("lets you get within speaking distance of everyone", () => {
    for (const m of CAST) {
      const spots = everyCell().filter(
        (c) => open.isWalkable(c.x, c.y) && manhattan(c, m.anchor) <= m.talkRadius,
      );
      expect(spots.length, `there is nowhere to stand to talk to ${m.id}`).toBeGreaterThan(0);
      const reachable = spots.some((c) => findPath(open, SPAWN, c).length > 0);
      expect(reachable, `${m.id} cannot be reached from the door`).toBe(true);
    }
  });

  it("gives everyone a distinct id, name and place to be", () => {
    expect(new Set(CAST.map((m) => m.id)).size).toBe(CAST.length);
    expect(new Set(CAST.map((m) => m.name)).size).toBe(CAST.length);
    const anchors = CAST.map((m) => at(m.anchor));
    expect(new Set(anchors).size, `two people share a cell: ${anchors.join(", ")}`).toBe(
      CAST.length,
    );
  });

  it("notices you from at least as far away as it lets you speak", () => {
    // A character you can talk to but who has not looked up yet is the uncanny
    // one — the prompt appears and the person is still facing the wall.
    for (const m of CAST) {
      expect(
        m.noticesAt,
        `${m.id} can be spoken to at ${m.talkRadius} but only notices at ${m.noticesAt}`,
      ).toBeGreaterThanOrEqual(m.talkRadius);
    }
  });

  it("opens the season with Priya and Marcus, and Priya is never absent", () => {
    // Priya is the anchor: every mission whose host is missing falls back to her,
    // so a room without her is a room where a beat has no speaker.
    expect(OPENING_CAST).toContain("priya");
    expect(OPENING_CAST).toContain("marcus");
    for (const id of OPENING_CAST) {
      expect(castById(id), `${id} is in the opening cast but not in CAST`).toBeTruthy();
    }
    expect(castPresent(OPENING_CAST).map((m) => m.id)).toEqual(["priya", "marcus"]);
  });
});

describe("standing near the cast", () => {
  it("finds the person you are standing next to", () => {
    const priya = castById("priya")!;
    expect(castNear(priya.anchor, atAnchors(["priya"]))?.id).toBe("priya");
  });

  it("finds nobody when you are on the other side of the room", () => {
    expect(castNear({ x: 4, y: 8 }, atAnchors(OPENING_CAST))).toBeNull();
  });

  it("ignores people who are not in the room", () => {
    const ray = castById("ray")!;
    expect(castNear(ray.anchor, atAnchors([]))).toBeNull();
    expect(castNear(ray.anchor, atAnchors(["ray"]))?.id).toBe("ray");
  });

  it("lets you speak to Priya across the counter", () => {
    // The counter is a cell deep and she works behind it. If this fails, the
    // only way to talk to your own head barista is to lift the flap first.
    const acrossTheCounter = { x: 4, y: 3 };
    expect(open.isWalkable(acrossTheCounter.x, acrossTheCounter.y)).toBe(true);
    expect(castNear(acrossTheCounter, atAnchors(["priya"]))?.id).toBe("priya");
  });

  it("picks the nearer of two people rather than the first one declared", () => {
    // Standing at the four-top with both Ellery and Marcus at it.
    const marcus = castById("marcus")!;
    expect(castNear(marcus.anchor, atAnchors(["marcus", "ellery"]))?.id).toBe("marcus");
  });
});

describe("what the cast says", () => {
  it("gives everyone something to say", () => {
    for (const m of CAST) {
      expect(m.ambientLines.length, `${m.id} has no lines`).toBeGreaterThan(0);
      for (const line of m.ambientLines) {
        expect(line.trim(), `${m.id} has an empty line`).toBeTruthy();
      }
    }
  });

  it("never lets anybody pass judgement on the player", () => {
    // The silent-tier contract, applied to idle chatter. A character who says
    // "good call" has told the player their score, and this is the cheapest
    // place in the building for that to leak in unnoticed.
    const verdicts =
      /\b(well done|good (call|job|choice)|nice one|mistake|you should have|the better|the right (call|choice)|wisely|unfortunately|correct)\b/i;
    for (const m of CAST) {
      for (const line of m.ambientLines) {
        expect(verdicts.test(line), `${m.id} passes judgement: "${line}"`).toBe(false);
      }
    }
  });
});

describe("the guided-navigation list with people in it", () => {
  it("adds whoever is in the room, by name and role", () => {
    const list = guideWithCast(atAnchors(OPENING_CAST));
    const labels = list.map((p) => p.label);
    expect(labels).toContain("Priya, head barista");
    expect(labels).toContain("Marcus, the regular");
  });

  it("keeps the places, and keeps them first", () => {
    const list = guideWithCast(atAnchors(OPENING_CAST));
    expect(list.slice(0, GUIDE.length).map((p) => p.id)).toEqual(GUIDE.map((p) => p.id));
    expect(list).toHaveLength(GUIDE.length + OPENING_CAST.length);
  });

  it("sends you to where somebody actually is, not where they started", () => {
    // Priya walks her loop, so the list has to be built from live positions or
    // it walks you to an empty patch of floor by the machine.
    const priya = castById("priya")!;
    const moved = { x: 6, y: 1 };
    const entry = guideWithCast([{ member: priya, cell: moved }]).find((p) => p.id === "priya");
    expect(entry?.cell).toEqual(moved);
  });

  it("is empty of people when the room is empty of people", () => {
    expect(guideWithCast([])).toHaveLength(GUIDE.length);
  });
});

describe("which way someone turns to look at you", () => {
  const here = { x: 5, y: 5 };

  it("turns on the dominant map axis", () => {
    expect(facingFrom(here, { x: 8, y: 5 })).toBe("E");
    expect(facingFrom(here, { x: 1, y: 5 })).toBe("W");
    expect(facingFrom(here, { x: 5, y: 9 })).toBe("S");
    expect(facingFrom(here, { x: 5, y: 1 })).toBe("N");
  });

  it("prefers the x axis when the two are equal, matching the player's own rule", () => {
    expect(facingFrom(here, { x: 7, y: 7 })).toBe("E");
  });

  it("faces the camera when there is nowhere to turn", () => {
    expect(facingFrom(here, here)).toBe("S");
  });
});

describe("who is in the room", () => {
  it("keeps Priya in it whatever the world says", () => {
    // An acceptance criterion, not a convention: she is the anchor every beat
    // falls back to, so a world state without her is a beat with no speaker.
    for (const regulars of WORLD_KEYS.regulars) {
      expect(castFor({ ...OPENING_WORLD, regulars })).toContain("priya");
    }
  });

  it("empties Marcus's chair exactly when the regulars thin out", () => {
    expect(castFor({ ...OPENING_WORLD, regulars: "full" })).toContain("marcus");
    expect(castFor({ ...OPENING_WORLD, regulars: "steady" })).toContain("marcus");
    expect(castFor({ ...OPENING_WORLD, regulars: "returning" })).toContain("marcus");
    expect(castFor({ ...OPENING_WORLD, regulars: "thin" })).not.toContain("marcus");
  });

  it("opens the season with exactly the opening cast", () => {
    expect(castFor(OPENING_WORLD).sort()).toEqual([...OPENING_CAST].sort());
  });

  it("drops him from the guided-nav list when he is not there", () => {
    // Otherwise the list offers to walk you to an empty chair.
    const thin = { ...OPENING_WORLD, regulars: "thin" as const };
    const labels = guideWithCast(atAnchors(castFor(thin))).map((p) => p.label);
    expect(labels.some((l) => l.startsWith("Marcus"))).toBe(false);
    expect(labels.some((l) => l.startsWith("Priya"))).toBe(true);
  });
});

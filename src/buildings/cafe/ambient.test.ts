import { describe, it, expect } from "vitest";
import {
  BEATS,
  DUCK_S,
  REDUCED_FACTOR,
  createSchedule,
  type BeatId,
  type RoomNow,
} from "./ambient";
import { OPENING_WORLD, type World } from "./world";

const now = (over: Partial<RoomNow> = {}): RoomNow => ({
  world: OPENING_WORLD,
  seated: 2,
  atMachine: true,
  ...over,
});

/** A schedule with the dice pinned, so "what fires when" is a fact. */
const pinned = (reduced = false, r = 0.5) => createSchedule(reduced, () => r);

/** Run the clock forward and collect everything that fired. */
function run(schedule: ReturnType<typeof pinned>, seconds: number, at = now()): BeatId[] {
  const out: BeatId[] = [];
  for (let t = 0; t < seconds; t += 0.5) out.push(...schedule.tick(0.5, at));
  return out;
}

describe("the beat table", () => {
  it("covers every row of §6 that this file owns", () => {
    // The door bell lives in customersView, because a bell with nobody coming
    // through the door is a sound effect rather than a beat; the street bed is a
    // continuous crossfade rather than a beat at all.
    expect(BEATS.map((b) => b.id).sort()).toEqual([
      "cup",
      "grinder",
      "page",
      "pigeon",
      "steam",
      "wipe",
    ]);
  });

  it("keeps every interval inside §6's published budget", () => {
    const budget: Record<BeatId, [number, number]> = {
      steam: [8, 20],
      grinder: [30, 60],
      cup: [12, 30],
      wipe: [40, 90],
      page: [45, 120],
      pigeon: [90, 180],
    };
    for (const beat of BEATS) {
      expect(beat.every, beat.id).toEqual(budget[beat.id]);
    }
  });

  it("stays inside the eight-active-beats ceiling", () => {
    // PRD §16: "Ambient beats active ≤ 8". Six here plus the bell and the
    // street bed is exactly eight, which is why there is no room for a seventh.
    expect(BEATS.length + 2).toBeLessThanOrEqual(8);
  });
});

describe("when a beat means nothing, it does not fire", () => {
  it("never steams an unattended machine", () => {
    const fired = run(pinned(), 240, now({ atMachine: false }));
    expect(fired).not.toContain("steam");
  });

  it("never clinks a cup in an empty room", () => {
    const fired = run(pinned(), 240, now({ seated: 0 }));
    expect(fired).not.toContain("cup");
  });

  it("never turns Marcus's page once Marcus has stopped coming in", () => {
    // His chair going quiet is the building's most important non-verbal beat
    // (PRD §15) and the ambient layer must not paper over it.
    const thin: World = { ...OPENING_WORLD, regulars: "thin" };
    const fired = run(pinned(), 400, now({ world: thin }));
    expect(fired).not.toContain("page");
    expect(run(pinned(), 400, now())).toContain("page");
  });

  it("comes back when the room does, rather than discharging what it owed", () => {
    // A beat that has been ineligible for two minutes must not fire four times
    // the moment its condition returns.
    const s = pinned();
    run(s, 300, now({ seated: 0 }));
    const back = run(s, 12, now());
    expect(back.filter((b) => b === "cup").length).toBeLessThanOrEqual(1);
  });
});

describe("the grinder's duck", () => {
  it("holds the room for a second and a half", () => {
    const s = pinned();
    let ducked = 0;
    for (let t = 0; t < 120; t += 0.5) {
      const fired = s.tick(0.5, now());
      if (fired.includes("grinder")) ducked = s.duckedFor();
    }
    expect(ducked).toBe(DUCK_S);
  });

  it("lets nothing else through while it is running", () => {
    const s = pinned();
    for (let t = 0; t < 200; t += 0.5) {
      const fired = s.tick(0.5, now());
      if (fired.includes("grinder")) {
        expect(fired, "something spoke over the grinder").toEqual(["grinder"]);
      }
    }
  });

  it("holds beats rather than dropping them, so the room comes back after", () => {
    // The point of the duck is the return. A beat swallowed by it would make
    // the grinder a way of making the room quieter, which is the opposite.
    const s = pinned();
    let firstGrinderAt: number | null = null;
    let cameBackAt: number | null = null;
    for (let t = 0; t < 300; t += 0.5) {
      const fired = s.tick(0.5, now());
      if (firstGrinderAt === null && fired.includes("grinder")) firstGrinderAt = t;
      else if (firstGrinderAt !== null && cameBackAt === null && fired.length > 0) cameBackAt = t;
    }
    expect(firstGrinderAt, "the grinder never ran").not.toBeNull();
    expect(cameBackAt, "the room never came back after the grinder").not.toBeNull();
    expect(cameBackAt! - firstGrinderAt!).toBeLessThanOrEqual(25);
  });
});

describe("reduced motion", () => {
  it("thins the decorative beats and leaves the grinder alone", () => {
    // §14.5. A player who asked for less movement has not asked for less
    // warning, and the grinder is what precedes a hard line.
    const normal = run(pinned(false), 600);
    const calm = run(pinned(true), 600);
    const count = (list: BeatId[], id: BeatId) => list.filter((b) => b === id).length;

    expect(count(calm, "steam")).toBeLessThan(count(normal, "steam"));
    expect(count(calm, "pigeon")).toBeLessThanOrEqual(count(normal, "pigeon"));
    expect(count(calm, "grinder")).toBe(count(normal, "grinder"));
  });

  it("thins by roughly the factor it says it does", () => {
    const normal = run(pinned(false), 1200).filter((b) => b === "steam").length;
    const calm = run(pinned(true), 1200).filter((b) => b === "steam").length;
    expect(calm * REDUCED_FACTOR).toBeGreaterThanOrEqual(normal - REDUCED_FACTOR);
  });
});

describe("the room on a normal morning", () => {
  it("does not fire everything on the first frame the player walks in", () => {
    // Staggered on purpose: six beats landing at once and then a minute of
    // silence is worse than no ambient layer at all.
    const s = pinned();
    expect(s.tick(0.5, now()).length).toBeLessThanOrEqual(1);
  });

  it("keeps the room alive over a few minutes", () => {
    const fired = run(pinned(), 240);
    expect(new Set(fired).size).toBeGreaterThanOrEqual(4);
  });
});

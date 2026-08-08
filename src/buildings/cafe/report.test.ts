import { describe, it, expect } from "vitest";
import { TIERS_PENDING, letter, nextPlaces, shape, trail, type Decided } from "./report";
import { MISSIONS } from "./missions";
import { TREES } from "./trees";
import { FOLLOWUPS } from "./followups";
import { OPENING_WORLD, WORLD_KEYS, type World, type WorldKey } from "./world";

const words = (s: string) => s.trim().split(/\s+/).length;

/** Every legal world, one key at a time off the opening state. */
function everyWorld(): { where: string; world: World }[] {
  const out: { where: string; world: World }[] = [{ where: "opening", world: OPENING_WORLD }];
  for (const key of Object.keys(WORLD_KEYS) as WorldKey[]) {
    for (const value of WORLD_KEYS[key]) {
      out.push({ where: `${key}=${value}`, world: { ...OPENING_WORLD, [key]: value } });
    }
  }
  return out;
}

/** A season where every mission was played through to the end. */
function playedThrough(seed = "a", follow = "b"): Decided[] {
  return MISSIONS.map((m) => ({
    activityId: m.activityId,
    seed,
    follow,
    transfer: FOLLOWUPS[m.activityId]?.options[0]?.id ?? null,
  }));
}

describe("Priya's letter", () => {
  it("comes out at about the length §13 asks for, in every world", () => {
    for (const { where, world } of everyWorld()) {
      const n = words(letter(world).join(" "));
      expect(n, `${where}: ${n} words`).toBeGreaterThan(120);
      expect(n, `${where}: ${n} words`).toBeLessThan(320);
    }
  });

  it("is written from the room rather than from a template", () => {
    // §13: "built from the world-state trail". Two different seasons must not
    // produce the same letter, or the payoff is a form letter with the player's
    // name left out of it.
    const seen = new Map<string, string>();
    for (const { where, world } of everyWorld()) {
      const text = letter(world).join(" ");
      const prior = seen.get(text);
      if (prior && prior !== "opening") continue;
      seen.set(text, where);
    }
    expect(seen.size, "the letter barely moves across the whole world space").toBeGreaterThan(12);
  });

  it("notices the board, because the board is the season", () => {
    const oat = letter({ ...OPENING_WORLD, chalkboard: "beans_story" }).join(" ");
    const base = letter(OPENING_WORLD).join(" ");
    expect(oat).not.toBe(base);
    expect(oat.toLowerCase()).toContain("board");
  });

  it("says the four-top is quiet when it is, without softening it", () => {
    const thin = letter({ ...OPENING_WORLD, regulars: "thin" }).join(" ");
    expect(thin).toContain("quiet");
    expect(thin).toMatch(/not going to pretend/i);
  });

  it("grades nobody", () => {
    // §13's tone rule: a debrief from somebody who worked the bar next to you,
    // not a scorecard. The tier block below is the only place any of this is
    // allowed, and the letter is not the tier block.
    const banned =
      /\b(developing|strong|advanced|proficiency|score|well done|good (call|job|choice)|mistake|you should have|the right (call|choice)|failed|passed|unfortunately)\b/i;
    for (const { where, world } of everyWorld()) {
      for (const para of letter(world)) {
        expect(banned.test(para), `${where}: "${para}"`).toBe(false);
      }
    }
  });

  it("signs off as a person, not as a system", () => {
    for (const { where, world } of everyWorld()) {
      expect(letter(world).at(-1), where).toMatch(/— P\.$/);
    }
  });
});

describe("the consequence trail", () => {
  it("has a row for every week of the season, played or not", () => {
    expect(trail([]).map((r) => r.week)).toEqual(MISSIONS.map((m) => m.week));
    expect(trail(playedThrough()).map((r) => r.week)).toEqual(MISSIONS.map((m) => m.week));
  });

  it("quotes the leaf actually taken rather than summarising it", () => {
    // The summary is where an opinion would creep in. Two lines per competency,
    // both authored (§13.2).
    const rows = trail(playedThrough("c", "a"));
    for (const mission of MISSIONS) {
      const row = rows.find((r) => r.competency === mission.competency)!;
      const leaf = TREES[mission.activityId].follow["c"].choices.find((c) => c.id === "a")!;
      expect(row.chose, mission.activityId).toBe(leaf.text);
      expect(row.happened, mission.activityId).toBe(leaf.consequence);
    }
  });

  it("falls back to the seed when the week was left half-finished", () => {
    const half: Decided[] = [{ activityId: "C1-HARD-01", seed: "b", follow: null, transfer: null }];
    const row = trail(half).find((r) => r.competency === "C1")!;
    expect(row.chose).toBe(TREES["C1-HARD-01"].seed.find((c) => c.id === "b")!.text);
  });

  it("leaves a week blank rather than inventing one", () => {
    for (const row of trail([])) {
      expect(row.chose, `week ${row.week}`).toBeNull();
      expect(row.happened, `week ${row.week}`).toBeNull();
    }
  });

  it("survives a record naming an option that no longer exists", () => {
    // A save sitting in a browser across a content change is the normal case.
    const stale: Decided[] = [{ activityId: "C1-HARD-01", seed: "z", follow: "z", transfer: "z" }];
    expect(() => trail(stale)).not.toThrow();
    expect(trail(stale).find((r) => r.competency === "C1")!.chose).toBeNull();
  });
});

describe("the shape of a season", () => {
  it("lays out all three beats, in order, for every week", () => {
    const rows = shape(playedThrough("a", "c"));
    expect(rows).toHaveLength(MISSIONS.length);
    for (const row of rows) {
      expect(row.sawIt, `week ${row.week}`).toBeTruthy();
      expect(row.thenDid, `week ${row.week}`).toBeTruthy();
      expect(row.andThen, `week ${row.week}`).toBeTruthy();
    }
  });

  it("carries no reading of the pattern, because the reading needs the tiers", () => {
    // §13.3's sentence ends on §10.2's arithmetic over two server-side tiers.
    // Laying the choices side by side is the part that can ship honestly.
    const banned = /\b(you see|you tend|you reach for|pattern|consistent(ly)?|always|typical)\b/i;
    for (const row of shape(playedThrough())) {
      for (const text of [row.sawIt, row.thenDid, row.andThen]) {
        if (text) expect(banned.test(text), `week ${row.week}: "${text}"`).toBe(false);
      }
    }
  });
});

describe("where to go next", () => {
  it("names at most three places, because a list of nine is a syllabus", () => {
    for (const { where, world } of everyWorld()) {
      expect(nextPlaces(world).length, where).toBeLessThanOrEqual(3);
    }
  });

  it("names real buildings in the city, never a competency code", () => {
    const rough: World = {
      ...OPENING_WORLD,
      till: "strained",
      staff: "strained",
      regulars: "thin",
      rival: "promo",
    };
    const places = nextPlaces(rough);
    expect(places.length).toBeGreaterThan(0);
    for (const place of places) {
      expect(place.name, "a code leaked into a place name").not.toMatch(/^C\d/);
      expect(place.name.trim()).toBeTruthy();
      expect(place.why.trim()).toBeTruthy();
    }
  });

  it("never names the same building twice", () => {
    for (const { where, world } of everyWorld()) {
      const names = nextPlaces(world).map((p) => p.name);
      expect(new Set(names).size, where).toBe(names.length);
    }
  });

  it("says why in the room's own terms, never as remediation", () => {
    const rough: World = { ...OPENING_WORLD, till: "strained", staff: "strained" };
    const banned = /\b(weak|improve|practice|remedial|score|low|struggl|need to work)\b/i;
    for (const place of nextPlaces(rough)) {
      expect(banned.test(place.why), place.why).toBe(false);
    }
  });
});

describe("the half that is not here yet", () => {
  it("says so plainly rather than inventing a grade", () => {
    // The one place tier vocabulary is allowed is the one place a fabricated
    // tier would carry the building's full authority.
    expect(TIERS_PENDING).toMatch(/still being worked out/i);
    expect(TIERS_PENDING).not.toMatch(/\b(developing|strong|advanced)\b/i);
  });
});

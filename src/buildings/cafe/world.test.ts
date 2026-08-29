import { describe, it, expect } from "vitest";
import {
  OPENING_WORLD,
  WORLD_KEYS,
  announcementFor,
  applyPatch,
  changedKeys,
  isLegal,
  isWorldKey,
  type WorldKey,
} from "./world";

const KEYS = Object.keys(WORLD_KEYS) as WorldKey[];

describe("the world-state keys", () => {
  it("is exactly the ten the room can show", () => {
    expect(KEYS).toHaveLength(10);
    expect(KEYS.sort()).toEqual(
      [
        "beans",
        "board",
        "chalkboard",
        "machine",
        "regulars",
        "rival",
        "season",
        "staff",
        "till",
        "truck",
      ].sort(),
    );
  });

  it("opens on a legal value for every key", () => {
    for (const k of KEYS) {
      expect(isLegal(k, OPENING_WORLD[k]), `${k} opens on ${OPENING_WORLD[k]}`).toBe(true);
    }
  });

  it("gives every key at least two values, or it is not state", () => {
    for (const k of KEYS) {
      expect(WORLD_KEYS[k].length, `${k} has nothing to change to`).toBeGreaterThan(1);
      expect(new Set(WORLD_KEYS[k]).size, `${k} repeats a value`).toBe(WORLD_KEYS[k].length);
    }
  });
});

describe("writing to the world", () => {
  it("applies a legal write", () => {
    const next = applyPatch(OPENING_WORLD, { chalkboard: "oat_asked" });
    expect(next.chalkboard).toBe("oat_asked");
    expect(next.regulars).toBe(OPENING_WORLD.regulars);
  });

  it("applies several at once", () => {
    const next = applyPatch(OPENING_WORLD, { chalkboard: "oat_plus", till: "tight" });
    expect(next.chalkboard).toBe("oat_plus");
    expect(next.till).toBe("tight");
  });

  it("drops a value that is not in the key's set rather than storing it", () => {
    // A decision writing a typo would otherwise leave the room rendering
    // nothing at all for that prop, and silently.
    const next = applyPatch(OPENING_WORLD, { chalkboard: "oat-ish" } as never);
    expect(next.chalkboard).toBe(OPENING_WORLD.chalkboard);
  });

  it("drops a key that does not exist", () => {
    const next = applyPatch(OPENING_WORLD, { mood: "cheerful" } as never);
    expect(next).toBe(OPENING_WORLD);
    expect("mood" in next).toBe(false);
  });

  it("returns the very same object when nothing moved", () => {
    // Identity is the signal the room uses to decide whether to redress itself.
    expect(applyPatch(OPENING_WORLD, {})).toBe(OPENING_WORLD);
    expect(applyPatch(OPENING_WORLD, { chalkboard: "base" })).toBe(OPENING_WORLD);
  });

  it("never mutates what it was given", () => {
    const before = { ...OPENING_WORLD };
    applyPatch(OPENING_WORLD, { chalkboard: "oat" });
    expect(OPENING_WORLD).toEqual(before);
  });

  it("reports only the keys that actually moved", () => {
    expect(changedKeys(OPENING_WORLD, { chalkboard: "oat", regulars: "full" })).toEqual([
      "chalkboard",
    ]);
    expect(changedKeys(OPENING_WORLD, { chalkboard: "nope" } as never)).toEqual([]);
  });

  it("knows its own keys", () => {
    expect(isWorldKey("chalkboard")).toBe(true);
    expect(isWorldKey("vibe")).toBe(false);
  });
});

describe("what the room says when something changes", () => {
  it("announces the board and the table, which are the two the season turns on", () => {
    expect(announcementFor("chalkboard", "oat")).toMatch(/board/i);
    expect(announcementFor("regulars", "thin")).toMatch(/empty/i);
  });

  it("says nothing about keys with no visible consequence", () => {
    // `season` moves with the week and is carried by the light, not by a line.
    expect(announcementFor("season", "night")).toBeNull();
  });

  it("never passes judgement in an announcement", () => {
    const verdicts =
      /\b(well done|good (call|job|choice)|mistake|you should have|the better|the right (call|choice)|wisely|unfortunately|sadly|correct)\b/i;
    for (const k of KEYS) {
      for (const v of WORLD_KEYS[k]) {
        const said = announcementFor(k, v as never);
        if (said) expect(verdicts.test(said), `${k}=${v}: "${said}"`).toBe(false);
      }
    }
  });
});

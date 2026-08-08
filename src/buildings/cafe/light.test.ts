import { describe, it, expect } from "vitest";
import {
  AFTER_LIGHT,
  MAX_GRADE,
  OPEN_LIGHT,
  cooled,
  lightForMission,
  lightForWeek,
  mixLight,
} from "./light";
import { MISSIONS } from "./missions";

describe("the season's light", () => {
  it("gives every week of the season its own light", () => {
    const seen = new Set<string>();
    for (const m of MISSIONS) {
      const light = lightForWeek(m.week);
      const key = `${light.tint}:${light.grade}:${light.glow}`;
      expect(seen.has(key), `week ${m.week} looks identical to an earlier week`).toBe(false);
      seen.add(key);
    }
  });

  it("says something about every week, so the cut is not only visual", () => {
    // A time-of-day change a sighted player sees and nobody else does is exactly
    // the failure §15 is written to prevent.
    const said = new Set<string>();
    for (const m of MISSIONS) {
      const { says } = lightForWeek(m.week);
      expect(says.trim(), `week ${m.week} says nothing`).toBeTruthy();
      expect(said.has(says), `week ${m.week} repeats an earlier line`).toBe(false);
      said.add(says);
    }
  });

  it("never grades the room past the point it stays readable", () => {
    for (const m of MISSIONS) {
      expect(lightForWeek(m.week).grade, `week ${m.week}`).toBeLessThanOrEqual(MAX_GRADE);
    }
    expect(cooled(lightForWeek(8)).grade).toBeLessThanOrEqual(MAX_GRADE);
  });

  it("makes week 8 the darkest thing in the year, because it is the night beat", () => {
    const night = lightForWeek(8);
    for (const m of MISSIONS) {
      if (m.week === 8) continue;
      expect(lightForWeek(m.week).grade, `week ${m.week} is darker than the night`).toBeLessThan(
        night.grade,
      );
    }
  });

  it("opens on the morning and ends after the season, not on a missing week", () => {
    expect(lightForMission(1)).toEqual(OPEN_LIGHT);
    expect(lightForMission(MISSIONS.length + 1)).toEqual(AFTER_LIGHT);
    expect(lightForWeek(999)).toEqual(OPEN_LIGHT);
  });

  it("cools Level B by a stop without making it a different room", () => {
    // PRD §14: "one stop cooler; the night beat is darker and longer." Same
    // geometry, same board, different weight.
    for (const m of MISSIONS) {
      const a = lightForWeek(m.week);
      const b = cooled(a);
      expect(b.grade, `week ${m.week}`).toBeGreaterThanOrEqual(a.grade);
      expect(b.glow, `week ${m.week}`).toBeLessThanOrEqual(a.glow);
      expect(b.tint & 0xff, `week ${m.week} blue`).toBeGreaterThanOrEqual(a.tint & 0xff);
      expect((b.tint >> 16) & 0xff, `week ${m.week} red`).toBeLessThanOrEqual(
        (a.tint >> 16) & 0xff,
      );
      expect(b.says, "the week reads the same to a screen reader either way").toBe(a.says);
    }
  });
});

describe("the cut between weeks", () => {
  it("ends exactly on the light it was going to", () => {
    const from = lightForWeek(1);
    const to = lightForWeek(8);
    expect(mixLight(from, to, 1)).toEqual(to);
    expect(mixLight(from, to, 0).tint).toBe(from.tint);
  });

  it("clamps rather than overshooting when a frame runs long", () => {
    // The ticker's dt is whatever the browser gives it, and a tab that was
    // backgrounded hands over a very large one.
    const from = lightForWeek(1);
    const to = lightForWeek(14);
    expect(mixLight(from, to, 4)).toEqual(mixLight(from, to, 1));
    expect(mixLight(from, to, -2).grade).toBe(from.grade);
  });

  it("passes through a plausible middle rather than through a colour neither end has", () => {
    // Channel-wise, so morning cream to grey afternoon never goes via purple.
    const from = lightForWeek(1);
    const to = lightForWeek(14);
    const mid = mixLight(from, to, 0.5);
    for (const shift of [16, 8, 0]) {
      const a = (from.tint >> shift) & 0xff;
      const b = (to.tint >> shift) & 0xff;
      const m = (mid.tint >> shift) & 0xff;
      expect(m).toBeGreaterThanOrEqual(Math.min(a, b));
      expect(m).toBeLessThanOrEqual(Math.max(a, b));
    }
  });

  it("only claims the new week once it has arrived", () => {
    // The announcement is driven off `says`, so a half-finished fade must not
    // yet be reading out a week the room has not got to.
    const from = lightForWeek(1);
    const to = lightForWeek(8);
    expect(mixLight(from, to, 0.99).says).toBe(from.says);
    expect(mixLight(from, to, 1).says).toBe(to.says);
  });
});

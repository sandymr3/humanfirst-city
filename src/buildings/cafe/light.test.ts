import { describe, it, expect } from "vitest";
import { lightForWeek, mixLight } from "./light";

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

import { describe, it, expect, beforeEach } from "vitest";
import {
  activeTrack,
  activityIdFor,
  forgetTrack,
  setTrack,
  trackOrDefault,
} from "@/framework/city/track";
import { QUESTIONS, activityAt } from "./interview";
import { openingWorldFor } from "./world";
import { cooled, lightForWeek } from "./light";

beforeEach(() => {
  forgetTrack();
});

// The question itself is asked at the city gate now, not here — see
// src/ui/EnterCity.test.tsx. What the Café still owns is everything downstream
// of the answer: which nine questions get asked, and what the room looks like
// while they are.
describe("the answer, once it is given", () => {
  it("is unanswered until it is answered", () => {
    expect(activeTrack()).toBeNull();
    setTrack("SCB");
    expect(activeTrack()).toBe("SCB");
  });

  it("answers Level A for anybody who has never been asked", () => {
    // Every pure lookup in the building calls this. A null track must never
    // reach an activity id.
    expect(trackOrDefault()).toBe("SCA");
  });

  it("is stored city-wide, so the next building finds it already answered", () => {
    // ADR-006 §11.1. One choice for the whole city — the Café reads it, it does
    // not own it.
    setTrack("SCB");
    expect(localStorage.getItem("city.track")).toContain("SCB");
  });
});

describe("the eighteen registry rows", () => {
  it("names them in exactly one place", () => {
    expect(activityIdFor("C1", "SCA")).toBe("C1-SCA-01");
    expect(activityIdFor("C4", "SCB")).toBe("C4-SCB-01");
  });

  it("gives every competency a row on both tracks, all eighteen distinct", () => {
    const ids = (["SCA", "SCB"] as const).flatMap((t) => QUESTIONS.map((c) => activityIdFor(c, t)));
    expect(ids).toHaveLength(18);
    expect(new Set(ids).size).toBe(18);
  });

  it("asks the nine in the blueprint's order, on whichever track was answered", () => {
    setTrack("SCB");
    expect(QUESTIONS.map((_, i) => activityAt(i))).toEqual(
      QUESTIONS.map((c) => activityIdFor(c, "SCB")),
    );
    setTrack("SCA");
    expect(activityAt(0)).toBe("C1-SCA-01");
    expect(activityAt(8)).toBe("C9-SCA-01");
  });

  it("has nothing to ask past the ninth", () => {
    expect(activityAt(9)).toBeNull();
  });
});

describe("the Level B room", () => {
  it("has the rival's awning already up across the road", () => {
    expect(openingWorldFor("SCB").rival).toBe("open");
    expect(openingWorldFor("SCA").rival).toBe("none");
  });

  it("runs a stop cooler without going dark", () => {
    // The week table outlived the season it was written for — the later stages
    // will want a time of day of their own — so the cooling still has to hold
    // for every entry in it, not just the one the interview uses.
    for (const week of [1, 3, 5, 8, 11, 14, 18]) {
      const b = cooled(lightForWeek(week));
      expect(b.grade, `week ${week}`).toBeGreaterThanOrEqual(lightForWeek(week).grade);
    }
  });
});

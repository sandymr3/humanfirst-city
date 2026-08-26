import { describe, it, expect } from "vitest";
import { ASK } from "./EnterCity";

describe("the question at the gate", () => {
  // It is the first thing that happens to a new player and it is a modal.
  // Anything about it that only exists visually locks somebody out at minute
  // one of the whole city.
  it("is fully carried by text", () => {
    expect(ASK.stage.trim()).toBeTruthy();
    expect(ASK.prompt.trim()).toBeTruthy();
    for (const option of ASK.options) {
      expect(option.text.trim(), option.track).toBeTruthy();
      expect(option.says.trim(), option.track).toBeTruthy();
    }
  });

  it("offers both tracks, once each", () => {
    expect(ASK.options.map((o) => o.track).sort()).toEqual(["SCA", "SCB"]);
  });

  // The silent-tier contract starts here. A difficulty word on either button
  // turns a question about who the player is into a difficulty select, and the
  // season's whole register goes with it — including the part where the learner
  // is never told which of three plausible answers was the good one.
  it("never labels a track as harder, more advanced, or age-banded", () => {
    const shown = [ASK.stage, ASK.prompt, ...ASK.options.flatMap((o) => [o.text, o.says])]
      .join(" ")
      .toLowerCase();
    for (const word of [
      "level a",
      "level b",
      "sca",
      "scb",
      "beginner",
      "advanced",
      "expert",
      "easy",
      "hard",
      "difficulty",
      "recommended",
      "16",
      "21",
      "35",
      "50",
    ]) {
      expect(shown, `"${word}" is on screen at the gate`).not.toContain(word);
    }
  });
});

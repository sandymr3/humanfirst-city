import { describe, it, expect, beforeEach } from "vitest";
import {
  clearInterview,
  freshInterview,
  fromBlob,
  loadInterview,
  saveInterviewNow,
  toBlob,
  type Interview,
} from "./session";
import { OPENING_WORLD } from "./world";
import { QUESTIONS } from "./interview";

const played: Interview = {
  progress: { index: 3, beat: "follow" },
  world: { ...OPENING_WORLD, chalkboard: "oat_asked", regulars: "thin", till: "healthy" },
  taken: { seed: "c" },
  unsent: [{ activityId: "C1-SCA-01", taken: { seed: "c", follow: "b" }, durationSec: 412 }],
  answered: [
    { activityId: "C1-SCA-01", competency: "C1", seed: "c", follow: "b", transfer: "o_c1a" },
  ],
  pendingFollowupId: "fu_01J8ZQ0S8N4T1V6M",
};

beforeEach(() => {
  clearInterview();
});

describe("the interview's save format", () => {
  it("is the document the server is going to want", () => {
    const blob = toBlob(played);
    expect(Object.keys(blob).sort()).toEqual(
      [
        "answered",
        "beat",
        "partialPath",
        "pendingFollowupId",
        "questionIndex",
        "unsent",
        "world",
      ].sort(),
    );
  });

  it("fits inside the 16 KB the server allows, with the whole sitting in it", () => {
    // Nine questions answered and nine unsent is the worst case anybody reaches.
    const full: Interview = {
      ...played,
      answered: QUESTIONS.map((c, i) => ({
        activityId: `${c}-SCA-01`,
        competency: c,
        seed: "c",
        follow: "b",
        transfer: `o_${i}`,
      })),
      unsent: QUESTIONS.map((c) => ({
        activityId: `${c}-SCA-01`,
        taken: { seed: "c", follow: "b", transfer: "o_1" },
        durationSec: 400,
      })),
    };
    expect(JSON.stringify(toBlob(full)).length).toBeLessThan(16 * 1024);
  });

  it("puts the letters on the wire in the order they were answered", () => {
    const blob = toBlob({ ...played, taken: { seed: "c", follow: "b", transfer: "o_x" } });
    expect(blob.partialPath).toEqual(["c", "b", "o_x"]);
  });

  it("round-trips a half-answered question", () => {
    const back = fromBlob(toBlob(played));
    expect(back?.progress).toEqual({ index: 3, beat: "follow" });
    expect(back?.taken).toEqual({ seed: "c" });
    expect(back?.world.chalkboard).toBe("oat_asked");
    expect(back?.pendingFollowupId).toBe("fu_01J8ZQ0S8N4T1V6M");
    expect(back?.unsent).toHaveLength(1);
    expect(back?.answered).toHaveLength(1);
  });
});

describe("a save that has been sitting in a browser", () => {
  // The blob the season wrote is not an interview blob. It has to be rejected
  // rather than half-loaded: a resume into a mission index that no longer means
  // anything is worse than starting the interview again.
  it("does not read a season blob as an interview", () => {
    expect(
      fromBlob({
        missionOrder: 4,
        objectiveIndex: 2,
        partialPath: ["c"],
        world: OPENING_WORLD,
        visitors: [],
        decided: [],
        unsent: [],
        pendingFollowupId: null,
      }),
    ).toBeNull();
  });

  it("rejects anything that is not a blob at all", () => {
    for (const junk of [null, 42, "nope", {}, { questionIndex: "four" }]) {
      expect(fromBlob(junk)).toBeNull();
    }
  });

  it("clamps a question index that has gone out of range", () => {
    const back = fromBlob({ ...toBlob(played), questionIndex: 99 });
    expect(back?.progress.index).toBe(9);
  });

  it("drops a beat name it does not recognise rather than trusting it", () => {
    const back = fromBlob({ ...toBlob(played), beat: "interrogation" });
    expect(back?.progress.beat).toBeNull();
  });

  it("drops world values the room cannot render", () => {
    const back = fromBlob({ ...toBlob(played), world: { chalkboard: "neon", regulars: "thin" } });
    expect(back?.world.chalkboard).toBe(OPENING_WORLD.chalkboard);
    expect(back?.world.regulars).toBe("thin");
  });
});

describe("the adapter", () => {
  it("gives back what it was handed", () => {
    saveInterviewNow(played);
    const back = loadInterview();
    expect(back?.progress.index).toBe(3);
    expect(back?.answered).toHaveLength(1);
  });

  it("starts a fresh sitting at the first question with nothing answered", () => {
    const s = freshInterview();
    expect(s.progress).toEqual({ index: 0, beat: null });
    expect(s.answered).toEqual([]);
    expect(s.unsent).toEqual([]);
    expect(s.pendingFollowupId).toBeNull();
  });
});

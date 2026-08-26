import { describe, it, expect, vi, afterEach } from "vitest";
import { openBeat, submitDecision } from "./dialogue";
import { MISSIONS } from "./missions";
import { OPENING_WORLD } from "./world";
import { api } from "@/framework/api";

const mission = MISSIONS[0];
const present = ["priya", "nadia"];

const GENERATED = {
  followupId: "fu_1",
  speakerId: "nadia",
  speakerName: "Nadia",
  prompt: "Six weeks on, the station café opens at seven. You going to keep chasing them?",
  options: [
    { id: "o_1", text: "one" },
    { id: "o_2", text: "two" },
    { id: "o_3", text: "three" },
  ],
};

const submitted = () =>
  vi.spyOn(api, "submit").mockResolvedValue({
    proficiency: 3,
    bestProficiency: 3,
    passed: true,
    status: "COMPLETED",
    feedback: "",
    badgesAwarded: [],
    coinsEarned: 25,
    coinBalance: 125,
  });

afterEach(() => vi.restoreAllMocks());

describe("the third beat on screen", () => {
  it("uses the generated question when one arrived", () => {
    const beat = openBeat(
      mission.activityId,
      "transfer",
      { seed: "c", follow: "b" },
      mission,
      present,
      OPENING_WORLD,
      GENERATED,
    );
    expect(beat?.prompt).toBe(GENERATED.prompt);
    expect(beat?.options.map((o) => o.id)).toEqual(["o_1", "o_2", "o_3"]);
  });

  it("uses the building's own when none did", () => {
    const beat = openBeat(
      mission.activityId,
      "transfer",
      { seed: "c", follow: "b" },
      mission,
      present,
      OPENING_WORLD,
      null,
    );
    expect(beat).not.toBeNull();
    expect(beat?.prompt).not.toBe(GENERATED.prompt);
  });

  // A player must not be able to tell which pen wrote the question. Same shape,
  // same three look-alike options, same speaker resolution, no marker of any
  // kind — if these two diverged in structure the beat would announce itself.
  it("is the same shape either way", () => {
    const args = ["transfer", { seed: "c", follow: "b" }, mission, present, OPENING_WORLD] as const;
    const generated = openBeat(mission.activityId, ...args, GENERATED)!;
    const banked = openBeat(mission.activityId, ...args, null)!;
    expect(Object.keys(generated).sort()).toEqual(Object.keys(banked).sort());
    expect(generated.options).toHaveLength(banked.options.length);
    expect(JSON.stringify(generated)).not.toMatch(/tier|developing|strong|advanced/i);
  });

  // Nadia always leaves. A question from somebody who has gone is worse than the
  // same question from Priya, so who is in the room wins over who wrote it.
  it("hands the question to somebody who is actually there", () => {
    const beat = openBeat(
      mission.activityId,
      "transfer",
      { seed: "c", follow: "b" },
      mission,
      ["priya"],
      OPENING_WORLD,
      GENERATED,
    );
    expect(beat?.speaker).not.toBe("nadia");
  });
});

describe("what the submit carries", () => {
  // This is what makes the third beat count: 0.42 seed / 0.28 follow / 0.30
  // transfer instead of the authored terminal alone.
  it("names the generated beat and the option taken", async () => {
    const submit = submitted();
    await submitDecision(mission.activityId, { seed: "c", follow: "b", transfer: "o_2" }, 412, {
      id: "fu_1",
      choice: "o_2",
    });
    expect(submit.mock.calls[0][1].result).toEqual({
      trace: {
        path: ["C1-SCA-01.seed", "C1-SCA-01.c", "C1-SCA-01.c.follow", "C1-SCA-01.c.b"],
        followupId: "fu_1",
        followupChoice: "o_2",
      },
    });
  });

  // A beat served from the bank has no server-side tier to resolve, so it scores
  // on the authored terminal alone — which is what aiBeat.required: false is for.
  it("omits them when the beat came from the bank", async () => {
    const submit = submitted();
    await submitDecision(mission.activityId, { seed: "c", follow: "b" }, 412, null);
    const trace = submit.mock.calls[0][1].result as { trace: Record<string, unknown> };
    expect(trace.trace).not.toHaveProperty("followupId");
    expect(trace.trace).not.toHaveProperty("followupChoice");
  });

  it("hands back the score so the coins can be credited", async () => {
    submitted();
    const res = await submitDecision(mission.activityId, { seed: "c", follow: "b" }, 412);
    expect(res?.coinsEarned).toBe(25);
    expect(res?.coinBalance).toBe(125);
  });

  it("says nothing landed rather than throwing when the server is unreachable", async () => {
    vi.spyOn(api, "submit").mockRejectedValue(new Error("offline"));
    await expect(
      submitDecision(mission.activityId, { seed: "c", follow: "b" }, 412),
    ).resolves.toBeNull();
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { advance, choose, resetJourney, useJourneyStore } from "./journeyStore";

// Everything about these tests is the state machine, not the network, so the
// client is stubbed and each test decides what the server said.
vi.mock("@/framework/api", () => ({
  api: {
    aiConsequence: vi.fn().mockRejectedValue(new Error("offline")),
    aiFollowup: vi.fn().mockRejectedValue(new Error("offline")),
    commitFollowup: vi.fn().mockRejectedValue(new Error("offline")),
    journeyFollowup: vi.fn().mockResolvedValue({ done: true }),
    journeyStage: vi.fn().mockRejectedValue(new Error("offline")),
    submit: vi.fn().mockRejectedValue(new Error("offline")),
  },
}));

import { api } from "@/framework/api";

const question = (id: string, prompt: string) => ({
  done: false,
  question: {
    followupId: id,
    speaker: { id: "nadia", name: "Nadia", role: "the morning barista" },
    prompt,
    options: [
      { id: "o_1", text: "Log it with context." },
      { id: "o_2", text: "Mention it at shift change." },
      { id: "o_3", text: "Let it go for now." },
    ],
  },
});

beforeEach(() => {
  localStorage.clear();
  resetJourney();
  vi.clearAllMocks();
  useJourneyStore.setState({ stageId: "cafe.l1", index: 0, decided: [], sceneBeat: null });
});

describe("a scenario scene's generated questions", () => {
  // The question is asked for while the consequence is still being read, so it
  // has already landed by the time the player clicks on. Asking at the moment
  // they arrive would put a network round trip in front of the next screen.
  it("is fetched as the authored decision is answered, not when it is shown", async () => {
    vi.mocked(api.journeyFollowup).mockResolvedValue(question("f1", "And the next one?"));

    await choose("a");

    expect(api.journeyFollowup).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.journeyFollowup).mock.calls[0][1]).toMatchObject({
      unitId: "cafe.l1.s1",
      choice: "a",
    });
    // It is held, not shown: the consequence still owns the screen.
    expect(useJourneyStore.getState().sceneBeat).not.toBeNull();
    expect(useJourneyStore.getState().consequence).not.toBeNull();
  });

  // The bug this guards is the one the two-beat scenes already had: moving on
  // from the consequence skipping straight past a question that was waiting.
  it("holds the scene open while a question is waiting", async () => {
    vi.mocked(api.journeyFollowup).mockResolvedValue(question("f1", "And the next one?"));
    const startIndex = useJourneyStore.getState().index;

    await choose("a");
    advance();

    expect(useJourneyStore.getState().index).toBe(startIndex);
    expect(useJourneyStore.getState().consequence).toBeNull();
    expect(useJourneyStore.getState().sceneBeat?.prompt).toBe("And the next one?");
  });

  // `done` is the ordinary end of a scene AND the shape of every failure. Both
  // must leave the player exactly where they were before these existed.
  it.each([
    ["the scene has finished asking", { done: true }],
    ["the server could not generate one", null],
  ])("moves on when %s", async (_name, response) => {
    if (response) {
      vi.mocked(api.journeyFollowup).mockResolvedValue(response as never);
    } else {
      vi.mocked(api.journeyFollowup).mockRejectedValue(new Error("offline"));
    }
    const startIndex = useJourneyStore.getState().index;

    await choose("a");
    expect(useJourneyStore.getState().sceneBeat).toBeNull();

    advance();
    expect(useJourneyStore.getState().index).toBe(startIndex + 1);
  });

  // Committing is what releases the consequence — all three were never shipped
  // up front, because a player who could read them could infer the ranking.
  it("answers by committing, and asks the next one straight away", async () => {
    vi.mocked(api.journeyFollowup)
      .mockResolvedValueOnce(question("f1", "First follow-up?"))
      .mockResolvedValueOnce(question("f2", "Second follow-up?"));
    vi.mocked(api.commitFollowup).mockResolvedValue({
      consequence: "Three weeks later the log shows four of them.",
      world: {},
    });

    await choose("a");
    advance();

    const { answerSceneBeat } = await import("./journeyStore");
    await answerSceneBeat("o_2");

    expect(api.commitFollowup).toHaveBeenCalledWith("f1", "o_2");
    expect(useJourneyStore.getState().consequence).toBe(
      "Three weeks later the log shows four of them.",
    );
    // And the next question was asked for while this consequence is on screen.
    expect(api.journeyFollowup).toHaveBeenCalledTimes(2);
    expect(useJourneyStore.getState().sceneBeat?.prompt).toBe("Second follow-up?");
  });

  // A second click on a different option would commit twice against one
  // question. Clearing it as the commit starts is what makes that impossible.
  it("takes the question off screen the moment it is answered", async () => {
    vi.mocked(api.journeyFollowup).mockResolvedValue(question("f1", "Which way?"));
    vi.mocked(api.commitFollowup).mockResolvedValue({ consequence: "It lands.", world: {} });

    await choose("a");
    advance();
    const { answerSceneBeat } = await import("./journeyStore");
    const pending = answerSceneBeat("o_1");
    expect(useJourneyStore.getState().sceneBeat).toBeNull();
    await pending;
  });

  // A commit that never reaches the server must not strand the player on a
  // question they have already answered.
  it("keeps the room moving when the commit fails", async () => {
    vi.mocked(api.journeyFollowup)
      .mockResolvedValueOnce(question("f1", "Which way?"))
      // The scene has nothing further to ask, so a failed commit leaves the
      // player with an empty sheet they can move on from — not a question.
      .mockResolvedValue({ done: true });
    vi.mocked(api.commitFollowup).mockRejectedValue(new Error("offline"));

    await choose("a");
    advance();
    const { answerSceneBeat } = await import("./journeyStore");
    await answerSceneBeat("o_1");

    expect(useJourneyStore.getState().sceneBeat).toBeNull();
    // Nothing to show, but the sheet is on screen and `advance` still works.
    expect(useJourneyStore.getState().consequence).toBe("");
  });

  // Leaving a scene must not carry a half-fetched question into the next one.
  it("drops a waiting question when the scene is left", async () => {
    vi.mocked(api.journeyFollowup)
      .mockResolvedValueOnce(question("f1", "Waiting."))
      .mockResolvedValue({ done: true });

    await choose("a");
    advance(); // shows the question
    expect(useJourneyStore.getState().sceneBeat).not.toBeNull();

    // Answering it clears it; the next fetch says done, so the scene ends.
    const { answerSceneBeat } = await import("./journeyStore");
    await answerSceneBeat("o_1");
    advance();

    expect(useJourneyStore.getState().sceneBeat).toBeNull();
    expect(useJourneyStore.getState().index).toBe(1);
  });
});

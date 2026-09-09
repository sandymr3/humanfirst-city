import { describe, it, expect, beforeEach, vi } from "vitest";
import { advance, answerScene, resetJourney, useJourneyStore } from "./journeyStore";

// Everything about these tests is the state machine, not the network, so the
// client is stubbed and each test decides what the server said.
vi.mock("@/framework/api", () => ({
  api: {
    aiConsequence: vi.fn().mockRejectedValue(new Error("offline")),
    aiFollowup: vi.fn().mockRejectedValue(new Error("offline")),
    answerFollowup: vi.fn().mockResolvedValue({}),
    commitFollowup: vi.fn().mockRejectedValue(new Error("offline")),
    journeyFollowup: vi.fn().mockResolvedValue({ done: true }),
    journeyStage: vi.fn().mockRejectedValue(new Error("offline")),
    submit: vi.fn().mockRejectedValue(new Error("offline")),
  },
}));

import { api } from "@/framework/api";

/** An OPEN generated question: a prompt, and nothing to pick from. */
const openQuestion = (id: string, prompt: string) => ({
  done: false,
  question: {
    followupId: id,
    speaker: { id: "nadia", name: "Nadia", role: "the morning barista" },
    prompt,
    options: [],
  },
});

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

    await answerScene("I would ask her what she actually wanted, and write it down.");

    expect(api.journeyFollowup).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.journeyFollowup).mock.calls[0][1]).toMatchObject({
      unitId: "cafe.l1.s1",
      choice: "open",
    });
    // It is held, not shown: the consequence still owns the screen. For an open
    // scene that is the one authored fallback line, not a per-letter one.
    expect(useJourneyStore.getState().sceneBeat).not.toBeNull();
    expect(useJourneyStore.getState().consequence).not.toBeNull();
  });

  // The bug this guards is the one the two-beat scenes already had: moving on
  // from the consequence skipping straight past a question that was waiting.
  it("holds the scene open while a question is waiting", async () => {
    vi.mocked(api.journeyFollowup).mockResolvedValue(question("f1", "And the next one?"));
    const startIndex = useJourneyStore.getState().index;

    await answerScene("I would ask her what she actually wanted, and write it down.");
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

    await answerScene("I would ask her what she actually wanted, and write it down.");
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

    await answerScene("I would ask her what she actually wanted, and write it down.");
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

    await answerScene("I would ask her what she actually wanted, and write it down.");
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

    await answerScene("I would ask her what she actually wanted, and write it down.");
    advance();
    const { answerSceneBeat } = await import("./journeyStore");
    await answerSceneBeat("o_1");

    expect(useJourneyStore.getState().sceneBeat).toBeNull();
    // Nothing to read, so no sheet at all. `""` used to render here as a lone
    // "Back to the room" button floating over the room, which is the bug.
    expect(useJourneyStore.getState().consequence).toBeNull();
    // And with nothing to read and nothing further to ask, the room moves on by
    // itself rather than stranding the player with no sheet and no way forward.
    expect(useJourneyStore.getState().index).toBe(1);
  });

  // The shape the Café actually ships: the scene is answered in prose, so the
  // questions it generates are answered in prose too.
  it("answers an open question with what was typed, and asks the next one", async () => {
    vi.mocked(api.journeyFollowup)
      .mockResolvedValueOnce(openQuestion("f1", "What did you write down?"))
      .mockResolvedValueOnce(openQuestion("f2", "And who reads that board?"));

    await answerScene("I would ask her what she actually wanted, and write it down.");
    advance();

    const { answerSceneBeatText } = await import("./journeyStore");
    await answerSceneBeatText("  The drink and the date, so a pattern would show.  ");

    expect(api.answerFollowup).toHaveBeenCalledWith(
      "f1",
      "The drink and the date, so a pattern would show.",
    );
    // Nothing is released by answering one: there was no option, so there was
    // never a consequence being withheld until one was picked.
    expect(useJourneyStore.getState().consequence).toBeNull();
    expect(useJourneyStore.getState().sceneBeat?.prompt).toBe("And who reads that board?");
  });

  // Nothing to read and nothing further to ask must not leave a blank panel
  // over the room with no way past it.
  it("moves on when an open question was the scene's last", async () => {
    vi.mocked(api.journeyFollowup)
      .mockResolvedValueOnce(openQuestion("f1", "What did you write down?"))
      .mockResolvedValue({ done: true });
    const startIndex = useJourneyStore.getState().index;

    await answerScene("I would ask her what she actually wanted, and write it down.");
    advance();
    const { answerSceneBeatText } = await import("./journeyStore");
    await answerSceneBeatText("The drink and the date.");

    expect(useJourneyStore.getState().sceneBeat).toBeNull();
    expect(useJourneyStore.getState().consequence).toBeNull();
    expect(useJourneyStore.getState().index).toBe(startIndex + 1);
  });

  // An empty box is not an answer. Sending one would spend the beat and record
  // nothing, which is the worst of both.
  it("ignores an empty open answer and keeps the question on screen", async () => {
    vi.mocked(api.journeyFollowup).mockResolvedValue(
      openQuestion("f1", "What did you write down?"),
    );

    await answerScene("I would ask her what she actually wanted, and write it down.");
    advance();
    const { answerSceneBeatText } = await import("./journeyStore");
    await answerSceneBeatText("   ");

    expect(api.answerFollowup).not.toHaveBeenCalled();
    expect(useJourneyStore.getState().sceneBeat?.prompt).toBe("What did you write down?");
  });

  // A generated consequence that arrives after the player has moved on belongs
  // to a scene they have already left. Setting it re-opens a sheet over whatever
  // is on screen now — the gate, the report, or the room itself.
  it("drops a consequence that arrives after the player has moved on", async () => {
    let release: (() => void) | null = null;
    const late = new Promise<{ consequence: string; world: Record<string, string> }>((r) => {
      release = () => r({ consequence: "A late line nobody should read.", world: {} });
    });
    vi.mocked(api.aiConsequence).mockReturnValue(late as never);
    vi.mocked(api.journeyFollowup).mockResolvedValue({ done: true });

    const pending = answerScene("I would ask her what she actually wanted, and write it down.");
    // The player reads the authored line and walks on before the server answers.
    advance();
    const movedTo = useJourneyStore.getState().index;

    release!();
    await pending;

    expect(useJourneyStore.getState().index).toBe(movedTo);
    expect(useJourneyStore.getState().consequence).not.toBe("A late line nobody should read.");
  });

  // Leaving a scene must not carry a half-fetched question into the next one.
  it("drops a waiting question when the scene is left", async () => {
    vi.mocked(api.journeyFollowup)
      .mockResolvedValueOnce(question("f1", "Waiting."))
      .mockResolvedValue({ done: true });

    await answerScene("I would ask her what she actually wanted, and write it down.");
    advance(); // shows the question
    expect(useJourneyStore.getState().sceneBeat).not.toBeNull();

    // Answering it clears it; the next fetch says done, so the scene ends. The
    // commit is stubbed to fail here, so there is nothing to read either and the
    // room advances itself — no second `advance()` is owed, and calling one
    // would skip the following scene.
    const { answerSceneBeat } = await import("./journeyStore");
    await answerSceneBeat("o_1");

    expect(useJourneyStore.getState().sceneBeat).toBeNull();
    expect(useJourneyStore.getState().index).toBe(1);
  });
});

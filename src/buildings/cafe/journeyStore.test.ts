import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetTransfers } from "@/framework/interior/transfer";
import { STAGES, stageById } from "./journey";
import {
  itemsOf,
  itemAt,
  useJourneyStore,
  resetJourney,
  takeRoad,
  goToNextStage,
  advance,
  answer,
  pickSuccessor,
  takeBeat,
  chooseTransferBeat,
  stageIsDone,
  currentStage,
} from "./journeyStore";

// The store reaches the network only through the framework client, and none of
// these tests are about the network. Stubbing it keeps them about the machine.
vi.mock("@/framework/api", () => ({
  api: {
    aiConsequence: vi.fn().mockRejectedValue(new Error("offline")),
    aiFollowup: vi.fn().mockRejectedValue(new Error("offline")),
    commitFollowup: vi.fn().mockRejectedValue(new Error("offline")),
    journeyStage: vi.fn().mockRejectedValue(new Error("offline")),
    submit: vi.fn().mockRejectedValue(new Error("offline")),
  },
}));

beforeEach(() => {
  localStorage.clear();
  resetJourney();
  // requestTransfer's in-flight map is module-level, not store state, and
  // outlives resetJourney — a stale entry from an earlier test would make a
  // later request for the same activity join it instead of firing fresh.
  resetTransfers();
});

describe("what a stage asks, and in what order", () => {
  it("puts the successor pick before the questions about them", () => {
    // The bug this exists to prevent: index arithmetic that assumed one kind of
    // item per stage skipped the pick entirely — the last decision of the
    // journey, and the only one with no follow-up and no undo.
    const succession = stageById("cafe.succession")!;
    const items = itemsOf(succession);
    expect(items[0]).toEqual({ kind: "pick", unitId: "cafe.succession.pick" });
    expect(items).toHaveLength(3);
    expect(items.slice(1).every((i) => i.kind === "scene")).toBe(true);
  });

  it("asks every unit of every stage exactly once", () => {
    for (const stage of STAGES) {
      const items = itemsOf(stage);
      const expected =
        (stage.pickUnitId ? 1 : 0) +
        (stage.questions?.length ?? 0) +
        (stage.scenes?.length ?? 0) +
        (stage.trees?.length ?? 0);
      expect(items.length, stage.id).toBe(expected);
      expect(itemAt(stage, items.length), `${stage.id} past the end`).toBeNull();
    }
  });

  it("knows when a stage has nothing left to ask", () => {
    const l1 = itemsOf(stageById("cafe.l1")!).length;
    useJourneyStore.setState({ stageId: "cafe.l1", index: l1 - 1 });
    expect(stageIsDone()).toBe(false);
    advance();
    expect(stageIsDone()).toBe(true);
  });
});

describe("gates", () => {
  it("promotes on accept", () => {
    useJourneyStore.setState({ stageId: "cafe.gate1" });
    takeRoad("accept");
    expect(useJourneyStore.getState().stageId).toBe("cafe.l1");
    expect(useJourneyStore.getState().role).toBe("employee");
  });

  it("sends a retry back to the sitting it came from, with a clean slate", () => {
    useJourneyStore.setState({
      stageId: "cafe.gate1",
      index: 4,
      answers: [{ unitId: "cafe.interview.q1", text: "first go" }],
    });
    takeRoad("retry");
    const s = useJourneyStore.getState();
    expect(s.stageId).toBe("cafe.interview");
    expect(s.index).toBe(0);
    // The previous answers do not carry into the new attempt; the server keeps
    // attempt 1 on the record, which is what makes improvement measurable.
    expect(s.answers).toEqual([]);
    // And retrying does not promote you.
    expect(s.role).toBe("candidate");
  });

  it("lets a player leave, without that being a failure", () => {
    useJourneyStore.setState({ stageId: "cafe.gate2", role: "employee" });
    takeRoad("exit");
    const s = useJourneyStore.getState();
    expect(s.stageId).toBe("cafe.exit");
    // Walking out of the door promotes nobody. An employee who leaves at the
    // second gate left as an employee.
    expect(s.role).toBe("employee");
  });

  it("never walks a posting backwards", () => {
    useJourneyStore.setState({ stageId: "cafe.l3", role: "ceo", index: 0 });
    goToNextStage(); // succession, also ceo
    expect(useJourneyStore.getState().role).toBe("ceo");

    // Replaying the counter must not demote someone who already ran the place.
    useJourneyStore.setState({ stageId: "cafe.gate1" });
    takeRoad("accept"); // → cafe.l1, whose role is employee
    expect(useJourneyStore.getState().role).toBe("ceo");
  });
});

describe("deciding", () => {
  it("records a two-beat CEO scene as one composed path", () => {
    useJourneyStore.setState({ stageId: "cafe.l3", index: 0, decided: [] });
    takeBeat("seed", "a");
    // Nothing is decided until the pair is complete — a half-played tree is not
    // a decision the server can score.
    expect(useJourneyStore.getState().decided).toEqual([]);
    expect(useJourneyStore.getState().taken).toEqual({ seed: "a" });

    takeBeat("follow", "c");
    expect(useJourneyStore.getState().decided).toEqual([{ unitId: "cafe.l3.s1", choice: "a.c" }]);
    // The decision is on the record the instant the pair completes — but
    // `taken` stays populated a beat longer than that, because the third beat
    // (ADR-007 §16) is still owed on this same item.
    expect(useJourneyStore.getState().taken).toEqual({ seed: "a", follow: "c" });
  });

  it("records the successor pick as a decision like any other", () => {
    useJourneyStore.setState({ stageId: "cafe.succession", index: 0, decided: [] });
    pickSuccessor("b");
    expect(useJourneyStore.getState().decided).toEqual([
      { unitId: "cafe.succession.pick", choice: "b" },
    ]);
  });

  it("keeps one answer per question, not one per keystroke", () => {
    useJourneyStore.setState({ stageId: "cafe.interview", index: 0 });
    answer("cafe.interview.q1", "first draft");
    answer("cafe.interview.q1", "second draft");
    answer("cafe.interview.q2", "another");
    const { answers } = useJourneyStore.getState();
    expect(answers).toHaveLength(2);
    expect(answers.find((a) => a.unitId === "cafe.interview.q1")?.text).toBe("second draft");
  });
});

describe("the third beat of a two-beat CEO scene (ADR-007 §16)", () => {
  it("pops the bank's version the instant the follow beat commits, offline or not", () => {
    useJourneyStore.setState({ stageId: "cafe.l3", index: 0, decided: [] });
    takeBeat("seed", "a");
    takeBeat("follow", "c");

    // Not a spinner and not a gap — the fallback bank answers with no round
    // trip, so there is something on screen before any network call could
    // possibly have returned.
    const beat = useJourneyStore.getState().transferBeat;
    expect(beat).not.toBeNull();
    expect(beat!.activityId).toBe("C2-SCA-01");
    expect(beat!.followupId).toBeNull();
    expect(beat!.options.length).toBeGreaterThan(0);
  });

  it("holds the room on the same item until the third beat is also answered", () => {
    useJourneyStore.setState({ stageId: "cafe.l3", index: 0, decided: [] });
    const startIndex = useJourneyStore.getState().index;
    takeBeat("seed", "a");
    takeBeat("follow", "c");

    // Dismissing the follow beat's own consequence must not skip past the
    // third beat — the bug this whole feature exists to fix was exactly this
    // step going missing.
    advance();
    expect(useJourneyStore.getState().index).toBe(startIndex);
    expect(useJourneyStore.getState().transferBeat).not.toBeNull();
  });

  it("answers from the fallback bank when nothing was generated, then moves on", async () => {
    useJourneyStore.setState({ stageId: "cafe.l3", index: 0, decided: [] });
    const startIndex = useJourneyStore.getState().index;
    takeBeat("seed", "a");
    takeBeat("follow", "c");

    const optionId = useJourneyStore.getState().transferBeat!.options[0].id;
    await chooseTransferBeat(optionId);

    // Its own consequence, same sheet, same shape as the two beats before it.
    expect(useJourneyStore.getState().consequence).toBeTruthy();
    expect(useJourneyStore.getState().taken.transfer).toBe(optionId);

    advance();
    expect(useJourneyStore.getState().index).toBe(startIndex + 1);
    expect(useJourneyStore.getState().transferBeat).toBeNull();
    expect(useJourneyStore.getState().taken).toEqual({});
  });

  it("swaps in a generated beat that lands before the player answers", async () => {
    const generated = {
      followupId: "f1",
      speaker: { id: "priya", name: "Priya", role: "counter" },
      prompt: "Generated, for this exact path.",
      options: [{ id: "g1", text: "Go with the generated one." }],
    };
    const { api } = await import("@/framework/api");
    vi.mocked(api.aiFollowup).mockResolvedValueOnce(generated);
    vi.mocked(api.commitFollowup).mockResolvedValueOnce({
      consequence: "It went the way the generated line said.",
      world: {},
    });

    useJourneyStore.setState({ stageId: "cafe.l3", index: 0, decided: [] });
    takeBeat("seed", "a");
    takeBeat("follow", "c");
    // Let the fire-and-forget request resolve and swap in.
    await vi.waitFor(() => {
      expect(useJourneyStore.getState().transferBeat?.followupId).toBe("f1");
    });

    const beat = useJourneyStore.getState().transferBeat!;
    expect(beat.prompt).toBe(generated.prompt);
    expect(beat.speakerName).toBe("Priya");

    await chooseTransferBeat("g1");
    expect(api.commitFollowup).toHaveBeenCalledWith("f1", "g1");
    expect(useJourneyStore.getState().consequence).toBe("It went the way the generated line said.");
  });

  it("has nothing to add for a decision that isn't a two-beat scene", () => {
    // A plain scene, and the successor pick, never touch `transferBeat` at
    // all — the third beat is a tree-item concept only.
    useJourneyStore.setState({ stageId: "cafe.l1", index: 0, decided: [] });
    expect(useJourneyStore.getState().transferBeat).toBeNull();
  });
});

describe("the silent-tier contract, in state", () => {
  it("never derives revenue on the client", () => {
    // The client holds a number it cannot compute. If a decision ever moved it
    // locally, a player would be able to read the tier off a single choice.
    useJourneyStore.setState({ stageId: "cafe.succession", index: 0, revenue: 500 });
    pickSuccessor("a");
    expect(useJourneyStore.getState().revenue).toBe(500);

    useJourneyStore.setState({ stageId: "cafe.l3", index: 0 });
    takeBeat("seed", "a");
    takeBeat("follow", "a");
    expect(useJourneyStore.getState().revenue).toBe(500);
  });

  it("carries no tier or score anywhere in its state", () => {
    useJourneyStore.setState({ stageId: "cafe.l1", index: 0 });
    const blob = JSON.stringify(useJourneyStore.getState());
    for (const word of ["tier", "developing", "advanced", "proficiency"]) {
      expect(blob.toLowerCase().includes(word), `state contains ${word}`).toBe(false);
    }
  });
});

describe("when the network is not there", () => {
  it("still moves the room, and keeps what it could not send", async () => {
    const { closeStage } = await import("./journeyStore");
    useJourneyStore.setState({
      stageId: "cafe.interview",
      index: 0,
      answers: [{ unitId: "cafe.interview.q1", text: "an answer" }],
    });

    const outcome = await closeStage();
    // No outcome to show, and that is honest — nothing graded it.
    expect(outcome).toBeNull();
    const s = useJourneyStore.getState();
    // But the sitting is queued, the answer is not lost, and the player is not
    // stuck at a gate they cannot walk through.
    expect(s.unsent).toHaveLength(1);
    expect(s.unsent[0].stageId).toBe("cafe.interview");
    expect(s.unsent[0].answers[0].text).toBe("an answer");
    expect(s.closing).toBe(false);
    expect(currentStage().id).toBe("cafe.interview");
  });
});

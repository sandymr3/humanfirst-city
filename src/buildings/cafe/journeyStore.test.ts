import { describe, it, expect, beforeEach, vi } from "vitest";
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
  stageIsDone,
  currentStage,
} from "./journeyStore";

// The store reaches the network only through the framework client, and none of
// these tests are about the network. Stubbing it keeps them about the machine.
vi.mock("@/framework/api", () => ({
  api: {
    aiConsequence: vi.fn().mockRejectedValue(new Error("offline")),
    journeyStage: vi.fn().mockRejectedValue(new Error("offline")),
    submit: vi.fn().mockRejectedValue(new Error("offline")),
  },
}));

beforeEach(() => {
  localStorage.clear();
  resetJourney();
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
    expect(useJourneyStore.getState().taken).toEqual({});
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

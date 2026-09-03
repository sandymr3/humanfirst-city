import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QA } from "./QA";
import { Gate } from "./Gate";
import { Report } from "./Report";
import { Decision } from "./Decision";
import { stageById } from "./journey";
import { useJourneyStore, resetJourney } from "./journeyStore";

vi.mock("@/framework/api", () => ({
  api: {
    aiConsequence: vi.fn().mockRejectedValue(new Error("offline")),
    journeyStage: vi.fn().mockRejectedValue(new Error("offline")),
    submit: vi.fn().mockRejectedValue(new Error("offline")),
  },
}));

/**
 * The rule this file exists for, from ADR-005 §11 as amended by ADR-007 §12:
 * feedback is permitted where there are no options to pattern-match against, and
 * forbidden everywhere else. These are the three surfaces where it would be
 * easiest to break — a gate is literally reporting a score, and a report is the
 * one screen allowed the vocabulary at all.
 *
 * The check is against rendered DOM rather than source, because that is what a
 * player can screenshot.
 */
const FORBIDDEN =
  /\b(developing|advanced|proficiency|tier|passed|failed|incorrect|well done)\b|\b\d\s*\/\s*3\b/i;

beforeEach(() => {
  localStorage.clear();
  resetJourney();
});

describe("the typed question", () => {
  it("asks, and says how much of the sitting is left", () => {
    useJourneyStore.setState({ stageId: "cafe.interview", index: 0 });
    render(<QA />);
    expect(screen.getByText(/Start me off/)).toBeInTheDocument();
    // The ordinal is pacing information a player legitimately needs. It says
    // nothing about how they are doing.
    expect(screen.getByText(/1 of 5/)).toBeInTheDocument();
  });

  it("will not send an empty answer", async () => {
    useJourneyStore.setState({ stageId: "cafe.interview", index: 0 });
    render(<QA />);
    const send = screen.getByRole("button");
    expect(send).toBeDisabled();

    await userEvent.type(screen.getByRole("textbox"), "Two years on counters.");
    expect(send).toBeEnabled();
    await userEvent.click(send);

    const { answers, index } = useJourneyStore.getState();
    expect(answers[0]?.text).toBe("Two years on counters.");
    expect(index).toBe(1);
  });

  it("starts each question with an empty box", async () => {
    useJourneyStore.setState({ stageId: "cafe.interview", index: 0 });
    const { unmount } = render(<QA />);
    await userEvent.type(screen.getByRole("textbox"), "first answer");
    await userEvent.click(screen.getByRole("button"));
    unmount();

    render(<QA />);
    // Inheriting the previous answer's text would have people editing the last
    // one instead of answering this one.
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("leaks nothing", () => {
    useJourneyStore.setState({ stageId: "cafe.review1", index: 0 });
    const { container } = render(<QA />);
    expect(FORBIDDEN.test(container.textContent ?? "")).toBe(false);
  });
});

describe("the gate", () => {
  it("offers all three roads, with leaving as one of them", () => {
    useJourneyStore.setState({ stageId: "cafe.gate1" });
    render(<Gate />);
    expect(screen.getByText(/Take it/)).toBeInTheDocument();
    expect(screen.getByText("Go again")).toBeInTheDocument();
    expect(screen.getByText("Leave the café")).toBeInTheDocument();
  });

  it("says something honest when nothing graded the sitting", () => {
    useJourneyStore.setState({ stageId: "cafe.gate1", outcome: null });
    render(<Gate />);
    // Better than silence, and better than inventing a verdict.
    expect(screen.getByText(/Nothing came back on the record/)).toBeInTheDocument();
  });

  it("shows the band and the feedback when there is some", () => {
    useJourneyStore.setState({
      stageId: "cafe.gate1",
      outcome: {
        stageId: "cafe.interview",
        attemptNo: 1,
        bestAttemptNo: 1,
        rawScore: 22,
        questionScores: [{ unitId: "cafe.interview.q1", score: 5 }],
        band: "Great job!",
        feedback: "You gave a real example, and you owned the part that was yours.",
        revenue: 0,
        revenueDelta: 0,
        coinsBanked: 0,
      },
    });
    const { container } = render(<Gate />);
    expect(screen.getByText("Great job!")).toBeInTheDocument();
    expect(screen.getByText(/a real example/)).toBeInTheDocument();
    // And the raw score is NOT rendered as a total. Five numbers beside five
    // questions is a grade sheet, which is what asking in a room is meant not
    // to be.
    expect(container.textContent).not.toMatch(/\b22\b/);
    expect(FORBIDDEN.test(container.textContent ?? "")).toBe(false);
  });

  it("takes the road that was clicked", async () => {
    useJourneyStore.setState({ stageId: "cafe.gate2", role: "employee" });
    render(<Gate />);
    await userEvent.click(screen.getByText("Leave the café"));
    const s = useJourneyStore.getState();
    expect(s.stageId).toBe("cafe.exit");
    // Leaving is not a promotion and not a failure.
    expect(s.role).toBe("employee");
  });
});

describe("the report", () => {
  it("reports where you got to, and does not overclaim", () => {
    useJourneyStore.setState({
      stageId: "cafe.exit",
      role: "branch_manager",
      revenue: 1240,
      decided: [
        { unitId: "cafe.l1.s1", choice: "a" },
        { unitId: "cafe.l2.s1", choice: "c" },
      ],
      qaDone: ["cafe.interview.q1"],
    });
    render(<Report onClose={() => {}} />);
    expect(screen.getByText(/left as a Branch Manager/)).toBeInTheDocument();
    expect(screen.getByText(/1,240 better off/)).toBeInTheDocument();
    // The gap is named rather than papered over.
    expect(screen.getByText(/scored but not yet shown/)).toBeInTheDocument();
  });

  it("says plainly when the business went backwards", () => {
    useJourneyStore.setState({ stageId: "cafe.exit", role: "ceo", revenue: -800 });
    render(<Report onClose={() => {}} />);
    expect(screen.getByText(/800 down on/)).toBeInTheDocument();
  });

  it("tells a player what never reached the server", () => {
    useJourneyStore.setState({
      stageId: "cafe.exit",
      unsent: [{ stageId: "cafe.review1", units: [], answers: [] }],
    });
    render(<Report onClose={() => {}} />);
    expect(screen.getByText(/One sitting/)).toBeInTheDocument();
  });

  it("leaks no tier vocabulary either, for now", () => {
    // The report is the ONE screen ADR-005 §13 allows the words on — but it
    // cannot use them until there is an endpoint handing a learner their own
    // results back. Until then it must not imply them, and this fails loudly
    // the day someone adds the words without the data behind them.
    useJourneyStore.setState({ stageId: "cafe.exit", role: "ceo", revenue: 100 });
    const { container } = render(<Report onClose={() => {}} />);
    expect(FORBIDDEN.test(container.textContent ?? "")).toBe(false);
  });
});

describe("the decision", () => {
  it("moves on when the consequence is read", async () => {
    // The bug an end-to-end run found: clearing the sheet without advancing
    // re-opened the scene that had just been decided, so a level never ended and
    // the same decision came round forever. Reading what happened and moving on
    // are one act.
    useJourneyStore.setState({ stageId: "cafe.l1", index: 0, decided: [] });
    render(<Decision />);

    const before = useJourneyStore.getState().index;
    await userEvent.click(screen.getAllByRole("button")[0]);
    expect(useJourneyStore.getState().decided).toHaveLength(1);

    await userEvent.click(await screen.findByRole("button", { name: "Back to the room" }));
    expect(useJourneyStore.getState().index).toBe(before + 1);
    expect(useJourneyStore.getState().consequence).toBeNull();
  });

  it("shuffles the trio so the weak option is not always first", () => {
    // Authored trios are written weakest-first because that is the readable
    // order to review in. Shipping that order would make "pick the first one"
    // learnable in two beats.
    useJourneyStore.setState({ stageId: "cafe.l1", index: 0 });
    const { container } = render(<Decision />);
    const shown = Array.from(container.querySelectorAll("li button")).map((b) => b.textContent);
    const authored = Object.values(stageById("cafe.l1")!.scenes![0].choices);
    expect(new Set(shown)).toEqual(new Set(authored));
    expect(shown).not.toEqual(authored);
  });
});

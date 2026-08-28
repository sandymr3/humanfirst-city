import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  BEATS,
  INTERVIEWER,
  INTERVIEW_START,
  QUESTIONS,
  activityAt,
  advance,
  isOver,
  ordinal,
  type InterviewProgress,
} from "./interview";
import {
  beginInterview,
  chooseOption,
  closeConsequence,
  openDialogue,
  useCafeStore,
} from "./cafeStore";
import { clearInterview, loadInterview, saveInterviewNow, freshInterview } from "./session";
import { forgetTrack, setTrack } from "@/framework/city/track";
import { resetTransfers } from "@/framework/interior/transfer";
import { api } from "@/framework/api";

beforeEach(() => {
  clearInterview();
  resetTransfers();
  forgetTrack();
  setTrack("SCA");
  useCafeStore.setState(useCafeStore.getState());
  vi.spyOn(api, "submit").mockResolvedValue({
    proficiency: 2,
    bestProficiency: 2,
    passed: true,
    status: "COMPLETED",
    feedback: "",
    badgesAwarded: [],
    coinsEarned: 15,
    coinBalance: 15,
  });
  vi.spyOn(api, "aiFollowup").mockRejectedValue(new Error("no model in tests"));
});
afterEach(() => vi.restoreAllMocks());

describe("the shape of the sitting", () => {
  it("asks nine questions", () => {
    expect(QUESTIONS).toHaveLength(9);
    expect(new Set(QUESTIONS).size).toBe(9);
  });

  it("asks them in the blueprint's order", () => {
    expect([...QUESTIONS]).toEqual(["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"]);
  });

  // Three beats per question, twenty-seven in a sitting, and the interview is
  // over exactly once — not one beat early and not one late.
  it("runs twenty-seven beats and then stops", () => {
    let p: InterviewProgress = INTERVIEW_START;
    const seen: string[] = [];
    for (let i = 0; i < 100 && !isOver(p); i++) {
      p = advance(p);
      if (p.beat) seen.push(`${p.index}:${p.beat}`);
    }
    expect(seen).toHaveLength(QUESTIONS.length * BEATS.length);
    expect(isOver(p)).toBe(true);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("runs the three beats of a question in order before moving on", () => {
    let p: InterviewProgress = advance(INTERVIEW_START);
    expect(p).toEqual({ index: 0, beat: "seed" });
    p = advance(p);
    expect(p).toEqual({ index: 0, beat: "follow" });
    p = advance(p);
    expect(p).toEqual({ index: 0, beat: "transfer" });
    p = advance(p);
    expect(p).toEqual({ index: 1, beat: "seed" });
  });

  // A null beat is a state with nothing on screen and nothing to press. It is
  // allowed before she starts and after she finishes, and nowhere else.
  it("never leaves a gap with no question in it", () => {
    let p: InterviewProgress = advance(INTERVIEW_START);
    while (!isOver(p)) {
      expect(p.beat, `question ${p.index}`).not.toBeNull();
      p = advance(p);
    }
    expect(p.beat).toBeNull();
  });

  it("has nothing left to ask once it is over", () => {
    expect(activityAt(9)).toBeNull();
    expect(advance({ index: 9, beat: null })).toEqual({ index: 9, beat: null });
  });

  it("counts from one and never past nine", () => {
    expect(ordinal({ index: 0, beat: "seed" })).toBe(1);
    expect(ordinal({ index: 8, beat: "transfer" })).toBe(9);
    expect(ordinal({ index: 9, beat: null })).toBe(9);
  });
});

describe("sitting down", () => {
  it("opens the first question and not before", () => {
    useCafeStore.setState({ ...freshInterview(), interviewing: false, progress: INTERVIEW_START });
    expect(useCafeStore.getState().progress.beat).toBeNull();
    beginInterview();
    expect(useCafeStore.getState().interviewing).toBe(true);
    expect(useCafeStore.getState().progress).toEqual({ index: 0, beat: "seed" });
  });

  it("is idempotent, because two ways in come through it", () => {
    useCafeStore.setState({ interviewing: false, progress: INTERVIEW_START });
    beginInterview();
    const after = useCafeStore.getState().progress;
    beginInterview();
    expect(useCafeStore.getState().progress).toEqual(after);
  });

  it("shows her decision instead of starting over once the nine are done", () => {
    useCafeStore.setState({ interviewing: false, progress: { index: 9, beat: null } });
    beginInterview();
    expect(useCafeStore.getState().offerOpen).toBe(true);
    expect(useCafeStore.getState().interviewing).toBe(false);
  });
});

describe("she asks all of them", () => {
  /** Answer whatever is on screen, then dismiss the consequence. */
  async function answerOne() {
    const beat = useCafeStore.getState().progress.beat;
    if (!beat) return;
    await openDialogue(beat);
    const open = useCafeStore.getState().dialogue;
    expect(open, `no beat on screen at ${beat}`).toBeTruthy();
    chooseOption(open!.options[0].id);
    // The transfer beat settles through a promise even when it falls back.
    await Promise.resolve();
    await Promise.resolve();
    closeConsequence();
  }

  it("puts the interviewer's name on every one of the twenty-seven", async () => {
    useCafeStore.setState({ ...freshInterview(), interviewing: false, progress: INTERVIEW_START });
    beginInterview();

    const speakers = new Set<string>();
    for (let i = 0; i < QUESTIONS.length * BEATS.length; i++) {
      const beat = useCafeStore.getState().progress.beat;
      if (!beat) break;
      await openDialogue(beat);
      const open = useCafeStore.getState().dialogue;
      if (open) speakers.add(open.speaker);
      if (open) chooseOption(open.options[0].id);
      await Promise.resolve();
      await Promise.resolve();
      closeConsequence();
    }

    expect([...speakers]).toEqual([INTERVIEWER]);
  }, 30_000);

  it("reaches her decision, and records every question on the way", async () => {
    useCafeStore.setState({ ...freshInterview(), interviewing: false, progress: INTERVIEW_START });
    beginInterview();
    for (let i = 0; i < QUESTIONS.length * BEATS.length + 2; i++) {
      if (isOver(useCafeStore.getState().progress)) break;
      await answerOne();
    }

    const s = useCafeStore.getState();
    expect(isOver(s.progress)).toBe(true);
    expect(s.offerOpen).toBe(true);
    expect(s.answered).toHaveLength(QUESTIONS.length);
    expect(s.answered.map((a) => a.competency)).toEqual([...QUESTIONS]);
    // Nothing derived from the answers is kept — the record is letters only.
    expect(JSON.stringify(s.answered)).not.toMatch(/tier|developing|strong|advanced|proficiency/i);
  }, 60_000);
});

describe("coming back", () => {
  // Walk out on question six and you sit back down on question six, with the
  // beat you were looking at still the beat that is due.
  it("resumes on the question and the beat it was left on", () => {
    saveInterviewNow({
      ...freshInterview(),
      progress: { index: 5, beat: "follow" },
      taken: { seed: "c" },
      pendingFollowupId: "fu_held",
    });
    const loaded = loadInterview()!;
    expect(loaded.progress).toEqual({ index: 5, beat: "follow" });
    expect(loaded.taken).toEqual({ seed: "c" });
    expect(loaded.pendingFollowupId).toBe("fu_held");
  });
});

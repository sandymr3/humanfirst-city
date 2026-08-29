// The room has one thing in it to do, and this is the wiring that makes it the
// one thing: you walk up to Owen, and talking to him *is* the interview. It used
// to be a tile you had to find behind the counter plus a button that was always
// on screen — neither of which is a person, and one of which was a to-do list.
import { describe, it, expect, beforeEach } from "vitest";
import { presentCast, resetCafeState, speakTo, useCafeStore } from "./cafeStore";
import { INTERVIEWER } from "./interview";
import { clearInterview } from "./session";

beforeEach(() => {
  clearInterview();
  resetCafeState();
});

describe("speaking to the interviewer", () => {
  it("has him in the room whatever else is going on", () => {
    expect(presentCast()).toContain(INTERVIEWER);
  });

  it("opens the first question rather than a line of small talk", () => {
    expect(useCafeStore.getState().interviewing).toBe(false);
    speakTo(INTERVIEWER);
    const s = useCafeStore.getState();
    expect(s.interviewing).toBe(true);
    expect(s.progress).toEqual({ index: 0, beat: "seed" });
    // The ambient path is the thing this must not fall into: a speech bubble
    // over his head and no question on screen.
    expect(s.speakingToId).toBeNull();
  });

  it("says out loud that you have sat down", () => {
    // A player who cannot see the room gets the sitting-down or they get a
    // question from nowhere.
    speakTo(INTERVIEWER);
    expect(useCafeStore.getState().announcement.text).toMatch(/Owen/);
  });

  it("does not restart an interview already under way", () => {
    speakTo(INTERVIEWER);
    const first = useCafeStore.getState().progress;
    speakTo(INTERVIEWER);
    expect(useCafeStore.getState().progress).toEqual(first);
  });
});

describe("speaking to anybody else", () => {
  it("is still just talking", () => {
    speakTo("priya");
    const s = useCafeStore.getState();
    expect(s.interviewing).toBe(false);
    expect(s.speakingToId).toBe("priya");
    expect(s.spokenLine).toBeTruthy();
  });
});

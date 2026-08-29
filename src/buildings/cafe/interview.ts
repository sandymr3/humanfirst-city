// The interview.
//
// The Café used to run a season of nine missions: a tracker in the corner, a
// chain of objectives per mission, someone arriving through the door, a walk
// across the room to report where you landed. It has one job now, and this is
// it — you sit down with the area manager and he asks you nine questions.
//
// Each question is the same three beats it always was: the authored scenario,
// the authored follow-up that branches on what you chose, and the third one
// written on the server from both. Nothing about the content changes. What goes
// away is everything that made you walk between them.
//
// Pure data and four small functions. Nothing here knows about Pixi, the store,
// or the clock.
import { activityIdFor, trackOrDefault, type Track } from "@/framework/city/track";

/**
 * The three beats every question has. The third is generated (ADR-006 §7).
 *
 * Lived in missions.ts, which is gone; it was never about missions.
 */
export type Beat = "seed" | "follow" | "transfer";

/** In order, and the order is the blueprint's own. */
export const QUESTIONS = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"] as const;

/**
 * Owen asks all nine.
 *
 * Priya asked them while the interview was the only thing that had been built —
 * she is the Café's anchor and she was already in the room — but the person
 * interviewing you cannot also be the person pulling your shot. Owen is the area
 * manager: he does not work in this café, he is here for the morning with a
 * laptop on the four-top, and that is the whole reason he reads as an assessor
 * rather than as a colleague being odd with you.
 *
 * **The backend has to hold the matching persona card.** `FollowupService.Issue`
 * resolves the speaker id the client sends against `followups/cafe.json`, and an
 * id it does not know falls back to the speaker of the fallback beat — silently.
 * Change this constant without adding the card and the generated third beat
 * comes back in Nadia's voice.
 */
export const INTERVIEWER = "owen" as const;

export interface InterviewProgress {
  /** 0…8 while he is still asking. 9 once he has made his decision. */
  index: number;
  /**
   * Which beat of the current question is on screen, or null in the gap between
   * committing one and him asking the next.
   */
  beat: Beat | null;
}

export const INTERVIEW_START: InterviewProgress = { index: 0, beat: null };

/**
 * One question, answered. Three option letters and nothing derived from them —
 * no tier, no score, nothing that decides one. It is what the offer at the end
 * is written from, and it is the only memory the building keeps of the sitting.
 */
export interface Answered {
  activityId: string;
  competency: string;
  seed: string | null;
  follow: string | null;
  transfer: string | null;
}

/** The three beats, in the order they are asked. */
export const BEATS: readonly Beat[] = ["seed", "follow", "transfer"];

/**
 * The registry row the question at this point scores against, or null once the
 * interview is over. Assembled in exactly one place, because an id built at the
 * call site is an id that goes wrong at one call site.
 */
export function activityAt(index: number, track: Track = trackOrDefault()): string | null {
  const competency = QUESTIONS[index];
  return competency ? activityIdFor(competency, track) : null;
}

/** He has asked all nine and has nothing left to ask. */
export function isOver(p: InterviewProgress): boolean {
  return p.index >= QUESTIONS.length;
}

/** Which question he is on, 1-based, for the one ordinal the panel shows. */
export function ordinal(p: InterviewProgress): number {
  return Math.min(p.index + 1, QUESTIONS.length);
}

/**
 * The beat that is due next.
 *
 * `null` in, and he opens the current question. A committed beat in, and he
 * moves to the next one — or, after the third, straight to the next question.
 * Returning the whole progress rather than mutating means the caller can persist
 * it before anything is rendered, which is what makes a closed tab resumable.
 *
 * `beat` is therefore null in exactly two places: before he has started, and
 * after he has finished. Everywhere else there is a question on screen.
 */
export function advance(p: InterviewProgress): InterviewProgress {
  if (isOver(p)) return p;
  if (p.beat === null) return { ...p, beat: "seed" };

  const next = BEATS[BEATS.indexOf(p.beat) + 1];
  if (next) return { ...p, beat: next };

  // Straight into the next question rather than through a null gap. He does not
  // pause between them, and a gap here would be a state the room could sit in
  // with nothing on screen and nothing to press.
  const index = p.index + 1;
  return index >= QUESTIONS.length ? { index, beat: null } : { index, beat: "seed" };
}

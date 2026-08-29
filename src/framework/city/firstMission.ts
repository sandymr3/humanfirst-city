// The one thing the city asks of you.
//
// Deliberately not a quest system. There are no chains, no branches, no board
// to open and no progress bar — there is one line, it names one place, and it
// goes away when you have been there. The later stages of the career will each
// replace it with their own line; none of them needs anything more than that.
//
// It reads its answer from state that already exists rather than inventing
// somewhere new to keep it: the Café's session blob carries `questionIndex`, and
// that blob is on the server, so the objective survives a reload and follows the
// player to another device without a second source of truth to drift.
import { readSession } from "@/framework/session/sync";

export interface CityObjective {
  /** One line, in the city's own voice. */
  line: string;
  /** The venue it points at — the marker sits on this. */
  venueId: string;
}

const FIRST: CityObjective = {
  line: "Go to the Café on Market Street. Owen is expecting you at ten.",
  venueId: "cafe",
};

/**
 * Whether the interview has been started at all.
 *
 * Started, not finished, on purpose: the objective is "go and attend the
 * interview", and once a player has sat down and answered the first question
 * they have done that. Leaving it up until the ninth would keep telling somebody
 * to go somewhere they are already sitting.
 */
function interviewBegun(): boolean {
  const blob = readSession("cafe") as { questionIndex?: unknown } | null;
  return typeof blob?.questionIndex === "number" && blob.questionIndex > 0;
}

/** The objective, or null once there is nothing left to ask of them. */
export function currentObjective(): CityObjective | null {
  return interviewBegun() ? null : FIRST;
}

/** Whether this venue is the one the objective is pointing at. */
export function isObjectiveVenue(venueId: string): boolean {
  return currentObjective()?.venueId === venueId;
}

// Which track you are on — Level A (`HARD`) or Level B (`PRO`), PRD §14.
//
// Asked once for the whole city (ADR-005 §10.7), by Priya, the first time you
// walk into the Café. The Café asks it because the Café is building 01 and is
// where a new player arrives; the answer is stored under a city-wide key rather
// than a Café one, so the next building to want it finds it already answered.
//
// **Level B is not Level A with longer sentences.** Same geometry, same
// chalkboard, same nine weeks. What changes is that every option has a
// defensible case and a real price, and the follow-up is where the price
// arrives. The room reflects that from the first minute: Tomas is on the floor
// because the staffing problem is already in it, the supplier's letter is
// pinned by the hatch, the rival's awning is already up across the road, and
// the light is a stop cooler all year.
//
// The active track is module state rather than store state on purpose. It is
// answered once and then it is a fact about the player, not about this visit,
// and half the pure modules in this building need it without wanting a store.
import { loadJson, saveJson } from "@/lib/persist";

export type Track = "HARD" | "PRO";

/** City-wide, not Café-owned. The next building reads the same answer. */
const KEY = "city.track";

/**
 * Priya's question, on first entry. It is a question about you, asked plainly by
 * somebody who is about to work next to you, and neither answer is the harder
 * one to admit to — that is the whole reason it can be asked at all.
 */
export const THRESHOLD = {
  speakerId: "priya" as const,
  stage:
    "She has the keys in one hand and a cloth in the other, and she has clearly decided to get this out of the way before the first customer.",
  prompt: "Is this your first place, or have you done this before?",
  options: [
    {
      track: "HARD" as Track,
      text: "First one. The bank manager took a chance on me and I have been awake since four thinking about it.",
      says: "Right. Then we work it out as we go, and you ask me things, and I will not be precious about it.",
    },
    {
      track: "PRO" as Track,
      text: "I have done this before. Which is exactly why the last six flat weeks are bothering me more than they should.",
      says: "Thought so. Then I will stop explaining and start telling you what I think, and you can tell me when I am wrong.",
    },
  ],
} as const;

let active: Track | null = null;
let loaded = false;

interface Stored {
  track: Track;
}

const isStored = (v: unknown): v is Stored =>
  typeof v === "object" &&
  v !== null &&
  ((v as Stored).track === "HARD" || (v as Stored).track === "PRO");

/**
 * The track this player is on, or null when they have never been asked. Reads
 * through once and caches: this is called from pure lookups on the frame path.
 */
export function activeTrack(): Track | null {
  if (!loaded) {
    active = loadJson<Stored>(KEY, isStored)?.track ?? null;
    loaded = true;
  }
  return active;
}

/** The track, defaulting to Level A. Anything that must answer today uses this. */
export function trackOrDefault(): Track {
  return activeTrack() ?? "HARD";
}

/** Whether the player still has to answer. Read once, when the room opens. */
export function thresholdIsDue(): boolean {
  return activeTrack() === null;
}

export function setTrack(track: Track): void {
  active = track;
  loaded = true;
  saveJson(KEY, { track });
}

/** Ask again. Only the tests and a fresh browser ever want this. */
export function forgetTrack(): void {
  active = null;
  loaded = true;
  saveJson(KEY, null);
}

/**
 * The registry row a competency scores against on this track (PRD §10.1). One
 * function so the eighteen ids exist in exactly one place — an id assembled at
 * the call site is an id that goes wrong in one call site.
 */
export function activityIdFor(competency: string, track: Track): string {
  return `${competency}-${track}-01`;
}

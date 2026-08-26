// Which track this player is on — Level A (`SCA`) or Level B (`SCB`).
//
// **One choice for the whole city** (ADR-005 §10.7, ADR-006 §11.1). It used to
// be asked by Priya on the Café's threshold and kept in the Café's own module,
// which worked exactly as long as the Café was the only building anybody could
// walk into. It is a fact about the player, not about this visit or this room,
// so it is asked at the gate and it lives here.
//
// **Level B is not Level A with longer sentences.** Same geometry, same nine
// weeks. What changes is that every option has a defensible case and a real
// price, and the follow-up is where the price arrives — which is why the rooms
// read the track when they lay themselves out.
//
// Module state rather than store state, on purpose: half the pure modules in a
// building need it and none of them should want a store to get it.
import { loadJson, saveJson } from "@/lib/persist";

export type Track = "SCA" | "SCB";

/** The local mirror. The server's copy is authoritative — see cityState.ts. */
const KEY = "city.track";

let active: Track | null = null;
let loaded = false;

interface Stored {
  track: Track;
}

const isStored = (v: unknown): v is Stored =>
  typeof v === "object" &&
  v !== null &&
  ((v as Stored).track === "SCA" || (v as Stored).track === "SCB");

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
  return activeTrack() ?? "SCA";
}

/** Whether the player still has to be asked. Read once, at the city gate. */
export function trackIsDue(): boolean {
  return activeTrack() === null;
}

/** Remember it locally. Pushing it to the server is cityState.ts's job. */
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
 * The registry row a competency scores against on this track.
 *
 * One function so the eighteen ids per building exist in exactly one place — an
 * id assembled at the call site is an id that goes wrong in one call site.
 */
export function activityIdFor(competency: string, track: Track, slot = "01"): string {
  return `${competency}-${track}-${slot}`;
}

// MAISON's season store — the track you chose and the house it produced.
//
// Client-side flavour state ONLY, exactly like eggStore: it never touches the
// server-authoritative economy, and it never influences scoring (docs/maison.md
// §12). Persisted best-effort so a season survives a reload, which is the whole
// point of a rail that remembers.
//
// The backend has no city-state endpoint yet (master PRD §11.3), so localStorage
// is the whole of persistence. When one lands, this store is what syncs.
import { create } from "zustand";
import { activeTrack } from "@/framework/city/track";
import { loadJson, saveJson } from "@/lib/persist";
import { events } from "@/framework/events";
import { worldDeltaAlong, type DecisionTreeContent } from "@/lib/decisionTree";
import { applyDelta, initialWorld, WORLD_KEYS, type MaisonWorld } from "./world";
import { maisonContent } from "./content";
import { countdownFor } from "./beats";
import type { Track } from "./season";

const STORAGE_KEY = "city.maison.v1";

/** One decided beat: which activity, and the path through it. */
export interface Decision {
  id: string;
  /** The trace the player submitted — the lookbook reads the season off this. */
  path: string[];
}

interface Season {
  /** null until the player answers the threshold question (§14). */
  track: Track | null;
  /** Where the collection started, so the lookbook can show the diff (§13). */
  opening: MaisonWorld;
  world: MaisonWorld;
  /** Beats decided this season, in the order they were decided. */
  decided: Decision[];
}

const isDecision = (d: unknown): d is Decision =>
  !!d &&
  typeof d === "object" &&
  typeof (d as Decision).id === "string" &&
  Array.isArray((d as Decision).path) &&
  (d as Decision).path.every((p) => typeof p === "string");

const isWorld = (w: unknown): w is MaisonWorld =>
  !!w &&
  typeof w === "object" &&
  WORLD_KEYS.every((k) => typeof (w as Record<string, unknown>)[k] === "string");

function isSeason(v: unknown): v is Season {
  if (!v || typeof v !== "object") return false;
  const s = v as Partial<Season>;
  if (s.track !== null && s.track !== "A" && s.track !== "B") return false;
  if (!Array.isArray(s.decided) || !s.decided.every(isDecision)) return false;
  // A stored season from an older shape is discarded rather than half-loaded.
  return isWorld(s.world) && isWorld(s.opening);
}

const freshSeason = (track: Track | null = null): Season => {
  const opening = initialWorld(track ?? "A");
  return { track, opening, world: opening, decided: [] };
};

interface MaisonState extends Season {
  /** Answer the threshold question and start the season on that track. */
  chooseTrack: (track: Track) => void;
  /** Record a decided beat and move the house (§12). One entry per activity. */
  recordDecision: (activityId: string, path: string[], delta: Record<string, string>) => void;
  /** Start the collection over. */
  resetSeason: () => void;
}

function persist(state: Season): void {
  saveJson(STORAGE_KEY, {
    track: state.track,
    opening: state.opening,
    world: state.world,
    decided: state.decided,
  });
}

/**
 * The track is one choice for the whole city, made at the gate (ADR-006 §11.1).
 * MAISON keeps its own A/B naming and its own season, but it must not ask a
 * question the city has already answered — so a fresh season here starts on the
 * answer the player already gave.
 */
function cityTrack(): Track | null {
  const city = activeTrack();
  return city === "SCA" ? "A" : city === "SCB" ? "B" : null;
}

export const useMaisonStore = create<MaisonState>((set, get) => ({
  ...(loadJson(STORAGE_KEY, isSeason) ?? freshSeason(cityTrack())),

  chooseTrack: (track) => {
    const next = freshSeason(track);
    set(next);
    persist(next);
  },

  recordDecision: (activityId, path, delta) => {
    const prev = get();
    // Re-deciding a beat replaces its entry rather than adding a second one —
    // the lookbook shows the season you ended up with, not every draft of it.
    const decided = prev.decided.some((d) => d.id === activityId)
      ? prev.decided.map((d) => (d.id === activityId ? { id: activityId, path } : d))
      : [...prev.decided, { id: activityId, path }];
    // The column is chalked with the beat you are ON, so finishing one advances
    // it (§3.5). The countdown does the pressure work; nothing is ever on a
    // real timer, and this is the only thing that moves it.
    const world = applyDelta(prev.world, delta);
    const next: Season = {
      track: prev.track,
      opening: prev.opening,
      world: prev.track ? { ...world, countdown: countdownFor(prev.track, decided) } : world,
      decided,
    };
    set(next);
    persist(next);
  },

  resetSeason: () => {
    const next = freshSeason(get().track);
    set(next);
    persist(next);
  },
}));

/**
 * The house moves on what you decided, not on what the server said about it.
 *
 * This listens at module scope rather than inside MaisonPanel because the panel
 * is unmounted while the activity player is open — which is exactly when the
 * submit happens. The store outlives every panel, so the subscription lives with
 * the store. It reads the trace the player actually sent and walks it back
 * through the tree to the world delta that path owes (§12).
 */
export function attachMaisonWorldSync(): () => void {
  return events.on("activity_submitted", ({ activityId, result }) => {
    const content = maisonContent[activityId] as DecisionTreeContent | undefined;
    if (!content || content.kind !== "decision_tree" || !("trace" in result)) return;
    const path = result.trace.path;
    useMaisonStore.getState().recordDecision(activityId, path, worldDeltaAlong(content, path));
  });
}

attachMaisonWorldSync();

// Building-owned world state for the Café interior. Mirrors the split the city
// proved in world/worldStore.ts: the Pixi ticker writes through `getState()`,
// React reads through selectors, and nothing about the room re-renders React
// except the handful of fields the DOM actually shows.
//
// Setters are identity-guarded — they return the same state object when nothing
// changed — because the ticker calls them every frame.
import { create } from "zustand";
import type { Cell } from "@/lib/pathfinding";
import { audio } from "@/framework/audio/audioManager";
import { GATES, HOTSPOTS, SPAWN, zoneAt, type GateId, type ZoneId } from "./room";
import { castById, castFor, type CastId } from "./cast";
import { HOTSPOTS as SPOTS, STATIONS as STNS } from "./room";
import {
  SEASON_START,
  advance,
  currentMission,
  currentObjective,
  type Progress,
  type RoomEvent,
} from "./missionRunner";
import type { Beat } from "./missions";
import { freshSeason, loadSeason, saveSeason, type Season } from "./session";
import type { Decided } from "./report";
import {
  openBeat,
  resolve,
  submitDecision,
  type DecisionSoFar,
  type DialogueState,
} from "./dialogue";
import {
  OPENING_WORLD,
  announcementFor,
  applyPatch,
  changedKeys,
  hotspotBody,
  type World,
  type WorldPatch,
} from "./world";

export interface Announcement {
  text: string;
  /** Bumped on every push so repeating the same text still re-announces. */
  seq: number;
}

interface CafeState {
  charCell: Cell;
  zoneId: ZoneId;
  /** Standing on or beside the door. */
  nearExit: boolean;
  /** The gate you are close enough to work, if any. */
  nearGateId: GateId | null;
  /** The hotspot you are close enough to read, if any. */
  nearHotspotId: string | null;
  /** The person you are close enough to speak to, if any. */
  nearCastId: CastId | null;
  /** The hotspot whose panel is open, if any. */
  openHotspotId: string | null;
  /** Who you are mid-conversation with, if anyone. */
  speakingToId: CastId | null;
  /** What they just said. Held here so the DOM and the live region agree. */
  spokenLine: string;
  flapOpen: boolean;
  /**
   * A request from the DOM for the room to walk somewhere — the keyboard station
   * list. The canvas paths there and clears it, the same shape `flapOpen` uses.
   */
  walkTo: Cell | null;
  /**
   * The ten keys of PRD §12. Presentation only — nothing here reaches the
   * submitted trace, and nothing here decides a proficiency.
   */
  world: World;
  /** Which mission, and how far into its chain. */
  progress: Progress;
  /** The beat on screen, if one is. */
  dialogue: DialogueState | null;
  /** The room's answer to what you just chose, shown before the room returns. */
  consequence: string | null;
  /** The letters taken so far this mission — what goes on the wire. */
  taken: DecisionSoFar;
  /**
   * Decisions whose submit failed, kept to retry. The Café's registry rows are
   * backend content that has not been seeded, so this is the normal case today.
   */
  unsent: { activityId: string; taken: DecisionSoFar; durationSec: number }[];
  /**
   * People the live mission has brought into the room on top of whoever the
   * world state says lives here. Nadia comes in at 8:05 and leaves again.
   */
  visitors: CastId[];
  /**
   * Every week that has closed and what was taken in it. The end-of-season
   * report is built from this (PRD §13.2) and nothing else reads it — no part of
   * the room's behaviour depends on what you decided nine weeks ago.
   */
  decided: Decided[];
  /** The letter by the pass-through is open. Only ever after week eighteen. */
  reportOpen: boolean;
  /**
   * Priya's question at the door is on screen. True exactly once per player, on
   * their first entry into the first building that asks it (PRD §14).
   */
  /** True while a DOM panel is up — the room ignores clicks and WASD. */
  inputLocked: boolean;
  announcement: Announcement;

  setCharCell: (cell: Cell) => void;
  setNearExit: (near: boolean) => void;
  setNearGate: (id: GateId | null) => void;
  setNearHotspot: (id: string | null) => void;
  setNearCast: (id: CastId | null) => void;
  setOpenHotspot: (id: string | null) => void;
  setSpeaking: (id: CastId | null, line: string) => void;
  setFlapOpen: (open: boolean) => void;
  setWalkTo: (cell: Cell | null) => void;
  setInputLocked: (locked: boolean) => void;
  announce: (text: string) => void;
}

export const useCafeStore = create<CafeState>((set) => ({
  charCell: { ...SPAWN },
  zoneId: zoneAt(SPAWN).id,
  nearExit: false,
  nearGateId: null,
  nearHotspotId: null,
  nearCastId: null,
  openHotspotId: null,
  speakingToId: null,
  spokenLine: "",
  world: { ...OPENING_WORLD },
  progress: SEASON_START,
  dialogue: null,
  consequence: null,
  taken: {},
  unsent: [],
  visitors: [],
  decided: [],
  reportOpen: false,
  flapOpen: false,
  walkTo: null,
  inputLocked: false,
  announcement: { text: "", seq: 0 },

  setCharCell: (charCell) =>
    set((s) => {
      if (s.charCell.x === charCell.x && s.charCell.y === charCell.y) return s;
      const zoneId = zoneAt(charCell).id;
      return zoneId === s.zoneId ? { charCell } : { charCell, zoneId };
    }),
  setNearExit: (nearExit) => set((s) => (s.nearExit === nearExit ? s : { nearExit })),
  setNearGate: (nearGateId) => set((s) => (s.nearGateId === nearGateId ? s : { nearGateId })),
  setNearHotspot: (nearHotspotId) =>
    set((s) => (s.nearHotspotId === nearHotspotId ? s : { nearHotspotId })),
  setNearCast: (nearCastId) => set((s) => (s.nearCastId === nearCastId ? s : { nearCastId })),
  setOpenHotspot: (openHotspotId) =>
    set((s) =>
      s.openHotspotId === openHotspotId
        ? s
        : { openHotspotId, inputLocked: openHotspotId !== null },
    ),
  setSpeaking: (speakingToId, spokenLine) =>
    set({ speakingToId, spokenLine, inputLocked: speakingToId !== null }),
  setWalkTo: (walkTo) => set({ walkTo }),
  setFlapOpen: (flapOpen) => set((s) => (s.flapOpen === flapOpen ? s : { flapOpen })),
  setInputLocked: (inputLocked) =>
    set((s) => (s.inputLocked === inputLocked ? s : { inputLocked })),
  announce: (text) => set((s) => ({ announcement: { text, seq: s.announcement.seq + 1 } })),
}));

/**
 * Work the counter flap. Both call sites — clicking the flap in the room and
 * pressing E beside it — come through here, so the guard and the feedback are
 * identical either way.
 *
 * Closing it while you are standing on it is refused: the cell becomes a wall the
 * moment it shuts, and the player would be inside the counter.
 */
export function toggleFlap(): boolean {
  const s = useCafeStore.getState();
  const gate = GATES[0];
  const standingOnIt = s.charCell.x === gate.cell.x && s.charCell.y === gate.cell.y;

  if (s.flapOpen && standingOnIt) {
    audio.play("ui_error");
    s.announce("Step off the flap before you lower it.");
    return false;
  }

  const next = !s.flapOpen;
  s.setFlapOpen(next);
  audio.play(next ? "ui_open" : "ui_close");
  s.announce(next ? gate.openedSays : gate.closedSays);
  return true;
}

/**
 * Start a visit. The *room* always starts the same way — at the door, flap down,
 * nothing open — because the canvas boots with no gates open and a stale
 * `flapOpen: true` here would desync the two. The *season* is whatever you left
 * behind, which is the whole point: you walk back into the café you made.
 */
export function resetCafeState(): void {
  resetSpoken();
  const season = loadSeason() ?? freshSeason();
  useCafeStore.setState({
    charCell: { ...SPAWN },
    zoneId: zoneAt(SPAWN).id,
    nearExit: false,
    nearGateId: null,
    nearHotspotId: null,
    nearCastId: null,
    openHotspotId: null,
    speakingToId: null,
    spokenLine: "",
    world: season.world,
    progress: season.progress,
    dialogue: null,
    consequence: null,
    taken: season.taken,
    unsent: season.unsent,
    visitors: season.visitors,
    decided: season.decided,
    reportOpen: false,
    flapOpen: false,
    walkTo: null,
    inputLocked: false,
    announcement: { text: "", seq: 0 },
  });
}

// ── Saving ───────────────────────────────────────────────────────────────────

/** The season as the save format sees it. */
function snapshot(): Season {
  const s = useCafeStore.getState();
  return {
    progress: s.progress,
    world: s.world,
    taken: s.taken,
    visitors: s.visitors,
    playerCell: s.charCell,
    unsent: s.unsent,
    decided: s.decided,
  };
}

let debounce: number | null = null;

/**
 * Save, on the schedule PRD §19.3 sets out. Objectives completing, world writes
 * and wandering around are cheap and frequent and coalesce into one write;
 * a committed beat and leaving the building are immediate, because a decision
 * that vanishes is the worst bug this building can have.
 */
export function saveNow(): void {
  if (debounce !== null) {
    window.clearTimeout(debounce);
    debounce = null;
  }
  saveSeason(snapshot());
}

export function saveSoon(): void {
  if (debounce !== null) return;
  debounce = window.setTimeout(() => {
    debounce = null;
    saveSeason(snapshot());
  }, SAVE_DEBOUNCE_MS);
}

/** Five objectives inside a second produce one write. */
const SAVE_DEBOUNCE_MS = 800;

/**
 * Open a hotspot's panel. Locks the room's input while it is up, exactly as the
 * world does behind its own panels, so a click on the modal cannot also order
 * the player to walk somewhere.
 */
export function openHotspot(id: string): void {
  const s = useCafeStore.getState();
  const spot = HOTSPOTS.find((h) => h.id === id);
  if (!spot) return;
  audio.play("ui_open");
  s.setOpenHotspot(id);
  s.announce(`${spot.title}. ${hotspotBody(id, s.world)}`);
  noteEvent({ kind: "inspected", id });
}

export function closeHotspot(): void {
  audio.play("ui_close");
  useCafeStore.getState().setOpenHotspot(null);
}

/**
 * The letter propped against the pass-through hatch, where the rota usually is
 * (PRD §13). It only exists once the ninth week has closed, and reading it is
 * the last thing there is to do in the building.
 */
export function openReport(): void {
  audio.play("ui_open");
  useCafeStore.setState({ reportOpen: true, inputLocked: true });
  useCafeStore
    .getState()
    .announce(
      "An envelope propped against the hatch, in Priya's handwriting. The year at the corner.",
    );
}

export function closeReport(): void {
  audio.play("ui_close");
  useCafeStore.setState({ reportOpen: false, inputLocked: false });
}

// ── The season ───────────────────────────────────────────────────────────────

const cellOf = (id: string) =>
  STNS.find((s) => s.id === id)?.cell ?? SPOTS.find((h) => h.id === id)?.cell ?? null;

/** Everyone in the room: whoever lives here, plus whoever this week brought in. */
export function presentCast(): CastId[] {
  const s = useCafeStore.getState();
  return [...new Set([...castFor(s.world), ...s.visitors])];
}

/**
 * Tell the runner something happened. Most of what the room reports is not an
 * objective — the ticker says "moved" every time the player changes cell — so
 * the runner returns the same Progress when nothing landed and this returns
 * early on identity.
 */
export function noteEvent(event: RoomEvent): void {
  const s = useCafeStore.getState();
  const step = advance(s.progress, event, cellOf);
  if (step.next === s.progress) return;

  useCafeStore.setState({ progress: step.next });

  saveSoon();

  if (step.missionClosed) {
    // The season moves on. Nothing is on a timer: the next mission's first
    // objective is simply available, and the player is free until they go to it.
    useCafeStore.setState({ visitors: [] });
    writeWorld(step.missionClosed.closeWorldState);
    s.announce(`That's week ${step.missionClosed.week} done.`);
  }

  // Whatever is live now says its piece, if it has one.
  const opened = currentObjective(useCafeStore.getState().progress);
  if (opened?.cue) s.announce(opened.cue);
}

// ── The decision ─────────────────────────────────────────────────────────────

let missionStartedAt = Date.now();

/**
 * Put the due beat on screen. Called when a `decide` objective goes live.
 *
 * If nothing is authored for this mission the beat is skipped rather than the
 * chain being stuck: a season with only some of its content written should still
 * be walkable, and a mission you cannot leave is worse than one you cannot
 * finish properly.
 */
export function openDialogue(beat: Beat): void {
  const s = useCafeStore.getState();
  const mission = currentMission(s.progress);
  if (!mission) return;
  if (beat === "seed") missionStartedAt = Date.now();

  const next = openBeat(mission.activityId, beat, s.taken, mission, presentCast(), s.world);
  if (!next) {
    noteEvent({ kind: "decided", beat });
    return;
  }
  useCafeStore.setState({ dialogue: next, consequence: null, inputLocked: true });
  s.announce(`${next.stage ? next.stage + " " : ""}${next.prompt}`);
}

/**
 * Take an option. The consequence plays, the world moves, and then the player is
 * simply free to walk again. There is no panel telling them how that went, and
 * there is no "next" implying a score was computed.
 */
export function chooseOption(optionId: string): void {
  const s = useCafeStore.getState();
  const mission = currentMission(s.progress);
  const open = s.dialogue;
  if (!mission || !open) return;

  const outcome = resolve(mission.activityId, open.beat, s.taken, optionId);
  const taken: DecisionSoFar = { ...s.taken, [open.beat]: optionId };

  audio.play("ui_confirm");
  useCafeStore.setState({ taken, dialogue: null, consequence: outcome?.consequence ?? null });
  if (outcome?.consequence) s.announce(outcome.consequence);
  if (outcome?.world) writeWorld(outcome.world);
  // Immediate, not debounced. This is the one write that must never be lost.
  saveNow();
}

/**
 * Dismiss the consequence and let the chain move on. Kept separate from taking
 * the option so the room gets its four to six seconds before the tracker line
 * changes under the player.
 */
export function closeConsequence(): void {
  const s = useCafeStore.getState();
  const beat = s.dialogue?.beat ?? lastBeatTaken(s.taken);
  useCafeStore.setState({ consequence: null, inputLocked: false });
  if (!beat) return;

  // Read the mission before advancing: noteEvent below can close this mission
  // and move the season on, and then we would be submitting the next week's
  // activity id with this week's path.
  const activityId = currentMission(s.progress)?.activityId ?? "";
  const taken = s.taken;

  noteEvent({ kind: "decided", beat });

  if (beat !== "transfer") return;

  const durationSec = (Date.now() - missionStartedAt) / 1000;
  // The week goes into the record before `taken` is cleared. This is the only
  // memory the building keeps of what you decided, and the only thing that reads
  // it is the letter by the pass-through nine weeks later (PRD §13.2).
  useCafeStore.setState({
    taken: {},
    decided: [
      ...useCafeStore.getState().decided.filter((d) => d.activityId !== activityId),
      {
        activityId,
        seed: taken.seed ?? null,
        follow: taken.follow ?? null,
        transfer: taken.transfer ?? null,
      },
    ],
  });
  void submitDecision(activityId, taken, durationSec).then((sent) => {
    if (sent) return;
    // The room has already moved. The score can catch up whenever the backend
    // has rows for these activities to score against.
    const q = useCafeStore.getState().unsent;
    useCafeStore.setState({ unsent: [...q, { activityId, taken, durationSec }] });
  });
}

function lastBeatTaken(taken: DecisionSoFar): Beat | null {
  if (taken.transfer) return "transfer";
  if (taken.follow) return "follow";
  if (taken.seed) return "seed";
  return null;
}

/**
 * Somebody arrives for a `wait_for`. They join the room first and the objective
 * closes second, so the beat reads as a person coming through the door rather
 * than as a tracker line ticking over on its own.
 */
export function arrive(id: CastId): void {
  const s = useCafeStore.getState();
  if (!s.visitors.includes(id)) useCafeStore.setState({ visitors: [...s.visitors, id] });
  noteEvent({ kind: "arrived", id });
}

/**
 * Change something about the room.
 *
 * Every key that actually moves is announced, because a consequence that exists
 * only in the picture is a consequence half the audience never receives (PRD
 * §15). Illegal writes are dropped by the reducer and therefore announce
 * nothing, which is the right failure: a typo in a decision's world write costs
 * a change, never a crash and never a wrong line.
 */
export function writeWorld(patch: WorldPatch): void {
  const s = useCafeStore.getState();
  const moved = changedKeys(s.world, patch);
  if (moved.length === 0) return;

  const next = applyPatch(s.world, patch);
  useCafeStore.setState({ world: next });
  saveSoon();

  const said = moved
    .map((k) => announcementFor(k, next[k] as never))
    .filter((line): line is string => line !== null);
  if (said.length > 0) s.announce(said.join(" "));
}

/**
 * Say hello. Which line comes out is a plain rotation rather than a random pick:
 * a room where the same person says the same random thing twice running reads as
 * broken, and cycling means a player who talks to Priya four times hears four
 * different things and then a repeat they can predict.
 */
const spokenCount = new Map<CastId, number>();

export function speakTo(id: CastId): void {
  const member = castById(id);
  if (!member || member.ambientLines.length === 0) return;
  const n = spokenCount.get(id) ?? 0;
  spokenCount.set(id, n + 1);
  const line = member.ambientLines[n % member.ambientLines.length];
  const s = useCafeStore.getState();
  audio.play("ui_open");
  s.setSpeaking(id, line);
  s.announce(`${member.name}. ${line}`);
  noteEvent({ kind: "spoke_to", id });
}

export function stopSpeaking(): void {
  audio.play("ui_close");
  useCafeStore.getState().setSpeaking(null, "");
}

/** Fresh rotation for a fresh visit, so re-entering starts the room over. */
function resetSpoken(): void {
  spokenCount.clear();
}

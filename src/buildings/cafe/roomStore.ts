/**
 * Where you are standing, and what is within reach.
 *
 * This is the half of the old `cafeStore` that was always about the room rather
 * than about the game being played in it: position, proximity, the flap, who is
 * talking, the live region. It is deliberately separate from `journeyStore` —
 * the career has now replaced a season and then an interview, and each time the
 * room survived unchanged. Keeping the two apart means the next change to what
 * happens here does not touch the code that knows where the counter is.
 *
 * The world state lives here rather than in the journey, because it is what the
 * *room* looks like: props read it, the canvas draws it, and it is presentation
 * only. Nothing in it reaches a submitted decision and nothing in it decides a
 * proficiency.
 */

import { create } from "zustand";
import { audio } from "@/framework/audio/audioManager";
import type { Cell } from "@/lib/pathfinding";
import { GATES, SPAWN, zoneAt, type GateId, type ZoneId } from "./room";
import { castById, type CastId } from "./cast";
import {
  announcementFor,
  applyPatch,
  changedKeys,
  OPENING_WORLD,
  type World,
  type WorldPatch,
} from "./world";

/** A line for the live region, with a sequence so a repeat still announces. */
export interface Announcement {
  text: string;
  seq: number;
}

interface RoomState {
  charCell: Cell;
  zoneId: ZoneId;
  /** Standing on or beside the door. */
  nearExit: boolean;
  /** The gate you are close enough to work, if any. */
  nearGateId: GateId | null;
  /** The person you are close enough to speak to, if any. */
  nearCastId: CastId | null;
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
  /** What the room looks like. Presentation only. */
  world: World;
  /** True while a DOM panel is up — the room ignores clicks and WASD. */
  inputLocked: boolean;
  announcement: Announcement;

  setCharCell: (cell: Cell) => void;
  setNearExit: (near: boolean) => void;
  setNearGate: (id: GateId | null) => void;
  setNearCast: (id: CastId | null) => void;
  setSpeaking: (id: CastId | null, line: string) => void;
  setFlapOpen: (open: boolean) => void;
  setWalkTo: (cell: Cell | null) => void;
  setInputLocked: (locked: boolean) => void;
  announce: (text: string) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  charCell: { ...SPAWN },
  zoneId: zoneAt(SPAWN).id,
  nearExit: false,
  nearGateId: null,
  nearCastId: null,
  speakingToId: null,
  spokenLine: "",
  world: { ...OPENING_WORLD },
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
  setNearCast: (nearCastId) => set((s) => (s.nearCastId === nearCastId ? s : { nearCastId })),
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
 * Closing it while you are standing on it is refused: the cell becomes a wall
 * the moment it shuts, and the player would be inside the counter.
 */
export function toggleFlap(): boolean {
  const s = useRoomStore.getState();
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
 * Start a visit.
 *
 * The room always starts the same way — at the door, flap down, nothing open —
 * because the canvas boots with no gates open and a stale `flapOpen: true` here
 * would desync the two. Where you are in your *career* is whatever you left
 * behind, and that is `journeyStore`'s to restore.
 */
export function resetRoomState(world: World): void {
  resetSpoken();
  useRoomStore.setState({
    charCell: { ...SPAWN },
    zoneId: zoneAt(SPAWN).id,
    nearExit: false,
    nearGateId: null,
    nearCastId: null,
    speakingToId: null,
    spokenLine: "",
    flapOpen: false,
    walkTo: null,
    inputLocked: false,
    world,
    announcement: { text: "", seq: 0 },
  });
}

/**
 * Change something about the room.
 *
 * Every key that actually moves is announced, because a consequence that exists
 * only in the picture is a consequence half the audience never receives. Illegal
 * writes are dropped by the reducer and therefore announce nothing, which is the
 * right failure: a typo in a decision's world write costs a change, never a
 * crash and never a wrong line.
 */
export function writeWorld(patch: WorldPatch): void {
  const s = useRoomStore.getState();
  const moved = changedKeys(s.world, patch);
  if (moved.length === 0) return;

  const next = applyPatch(s.world, patch);
  useRoomStore.setState({ world: next });

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
  const s = useRoomStore.getState();
  audio.play("ui_open");
  s.setSpeaking(id, line);
  s.announce(`${member.name}. ${line}`);
}

export function stopSpeaking(): void {
  audio.play("ui_close");
  useRoomStore.getState().setSpeaking(null, "");
}

/** Fresh rotation for a fresh visit, so re-entering starts the room over. */
function resetSpoken(): void {
  spokenCount.clear();
}

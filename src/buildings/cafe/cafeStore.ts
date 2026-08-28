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
import { events } from "@/framework/events";
import { GATES, HOTSPOTS, SPAWN, zoneAt, type GateId, type ZoneId } from "./room";
import { castById, castFor, type CastId } from "./cast";
import {
  INTERVIEWER,
  INTERVIEW_START,
  QUESTIONS,
  activityAt,
  advance,
  isOver,
  type Answered,
  type Beat,
  type InterviewProgress,
} from "./interview";
import {
  BUILDING_ID,
  flushInterview,
  freshInterview,
  loadInterview,
  saveInterview,
  saveInterviewNow,
  type Interview,
} from "./session";
import {
  awaitTransfer,
  commitTransfer,
  forgetTransfer,
  requestTransfer,
} from "@/framework/interior/transfer";
import { trackOrDefault } from "@/framework/city/track";
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
  /** Which question she is on, and which of its three beats. */
  progress: InterviewProgress;
  /** She has started. False while the player is still crossing the room. */
  interviewing: boolean;
  /** The beat on screen, if one is. */
  dialogue: DialogueState | null;
  /** The room's answer to what you just chose, shown before the room returns. */
  consequence: string | null;
  /** The letters taken so far on this question — what goes on the wire. */
  taken: DecisionSoFar;
  /**
   * Decisions whose submit failed, kept to retry. The Café's registry rows are
   * backend content that has not been seeded, so this is the normal case today.
   */
  unsent: Interview["unsent"];
  /**
   * Every question that has closed and what was taken on it. The offer at the
   * end is written from this and nothing else reads it — no part of the room's
   * behaviour depends on what you answered four questions ago.
   */
  answered: Answered[];
  /** Her decision is on screen. Only ever after the ninth question. */
  offerOpen: boolean;
  /**
   * The server's handle for the third beat currently on screen, or null when it
   * came from the building's own bank. It is what makes the beat count at submit
   * time, and it is persisted so that walking out mid-question and coming back
   * finds the same question rather than a new one (ADR-006 §7.5).
   */
  transferId: string | null;
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
  progress: INTERVIEW_START,
  interviewing: false,
  dialogue: null,
  consequence: null,
  taken: {},
  unsent: [],
  answered: [],
  offerOpen: false,
  transferId: null,
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
 * `flapOpen: true` here would desync the two. The *interview* is whatever you
 * left behind: walk out on question six and you sit back down on question six.
 */
export function resetCafeState(): void {
  resetSpoken();
  const sitting = loadInterview() ?? freshInterview();
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
    world: sitting.world,
    progress: sitting.progress,
    // Sitting back down is deliberate every time. A resumed interview that
    // started asking the moment the door opened would put a question on screen
    // before the player had looked at the room.
    interviewing: false,
    dialogue: null,
    consequence: null,
    taken: sitting.taken,
    unsent: sitting.unsent,
    transferId: sitting.pendingFollowupId,
    answered: sitting.answered,
    offerOpen: false,
    flapOpen: false,
    walkTo: null,
    inputLocked: false,
    announcement: { text: "", seq: 0 },
  });
}

// ── Saving ───────────────────────────────────────────────────────────────────

/** The sitting as the save format sees it. */
function snapshot(): Interview {
  const s = useCafeStore.getState();
  return {
    progress: s.progress,
    world: s.world,
    taken: s.taken,
    unsent: s.unsent,
    answered: s.answered,
    pendingFollowupId: s.transferId,
  };
}

/**
 * Send the answers the backend never heard.
 *
 * An interview taken through a dropped connection is an interview the player is
 * owed coins for. The trace is the record and it survived; this is what turns it back
 * into a score. Called when the door opens, which is the moment a connection is
 * most likely to be back.
 *
 * Each submit is idempotent server-side, so a double send costs nothing and a
 * partial drain is safe to repeat.
 */
export async function retryUnsent(): Promise<void> {
  const queued = useCafeStore.getState().unsent;
  if (queued.length === 0) return;

  const stuck: Interview["unsent"] = [];
  for (const item of queued) {
    const result = await submitDecision(
      item.activityId,
      item.taken,
      item.durationSec,
      item.followup ?? null,
    );
    if (result) {
      events.emit("activity_completed", { response: result, silent: true });
    } else {
      stuck.push(item);
    }
  }
  useCafeStore.setState({ unsent: stuck });
  saveSoon();
}

/**
 * Save, on the schedule ADR-006 §11.2 sets out. World writes and wandering
 * around are cheap and frequent and coalesce into one write; a committed beat
 * and leaving the building are immediate, because an answer that vanishes is
 * the worst bug this building can have.
 *
 * The coalescing lives one layer down now, with the thing that owns the
 * revision — two debounces in a row would only mean the room's idea of "soon"
 * and the network's could drift apart.
 */
export function saveNow(): void {
  saveInterviewNow(snapshot());
}

export function saveSoon(): void {
  saveInterview(snapshot());
}

/**
 * The way out — the door, the tab closing, the interior being taken away.
 *
 * Distinct from `saveNow` because this is the write that has to survive the page
 * going away, and the only thing a browser reliably runs then is `sendBeacon`.
 */
export function flushNow(): void {
  flushInterview(snapshot());
}

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
}

export function closeHotspot(): void {
  audio.play("ui_close");
  useCafeStore.getState().setOpenHotspot(null);
}

/**
 * Her decision. Only exists once the ninth question has closed, and it is the
 * last thing there is to do in the building.
 */
export function openOffer(): void {
  audio.play("ui_open");
  useCafeStore.setState({ offerOpen: true, inputLocked: true });
  useCafeStore.getState().announce("Priya puts the notepad down and turns it over.");
}

export function closeOffer(): void {
  audio.play("ui_close");
  useCafeStore.setState({ offerOpen: false, inputLocked: false });
}

// ── The interview ────────────────────────────────────────────────────────────

/** Everyone in the room. Nobody arrives mid-interview; it is a conversation. */
export function presentCast(): CastId[] {
  return castFor(useCafeStore.getState().world);
}

/**
 * Sit down.
 *
 * Deliberate rather than automatic: walking into a room and being asked a
 * question is an ambush, and a player who wants to look at the café first should
 * be allowed to. Idempotent, because both the station prompt and the always-on
 * button come through here.
 */
export function beginInterview(): void {
  const s = useCafeStore.getState();
  if (s.interviewing) return;
  if (isOver(s.progress)) {
    openOffer();
    return;
  }
  audio.play("ui_open");
  useCafeStore.setState({ interviewing: true, progress: advance(s.progress) });
  s.announce("Priya sits down opposite you with a notepad she does not open.");
  saveSoon();
}

let questionStartedAt = Date.now();

/**
 * Put the due beat on screen.
 *
 * If nothing is authored for this question the beat is skipped rather than the
 * interview being stuck: a question you cannot leave is worse than one that is
 * missing.
 */
export async function openDialogue(beat: Beat): Promise<void> {
  const s = useCafeStore.getState();
  const activityId = activityAt(s.progress.index);
  if (!activityId) return;
  if (beat === "seed") questionStartedAt = Date.now();

  // The third beat was asked for the moment the second one committed, and has
  // been generating behind that consequence ever since. Collecting it here is
  // usually instant; when it is not, `awaitTransfer` gives up at four seconds
  // and the bank answers instead. There is deliberately nothing on screen that
  // marks the difference — no spinner, and no wait the player can attribute.
  const generated = beat === "transfer" ? await awaitTransfer(activityId) : null;

  // `[INTERVIEWER]` and not `presentCast()`: who else happens to be in the café
  // does not get to conduct the interview. The fallback bank names a speaker per
  // beat — Nadia for one, Ray for another — and openBeat honours that name only
  // when the person is present, so passing the room's real population had Marcus
  // asking question four from the chair he was sitting in.
  const next = openBeat(activityId, beat, s.taken, INTERVIEWER, [INTERVIEWER], s.world, generated);
  if (!next) {
    step(beat);
    return;
  }
  useCafeStore.setState({
    dialogue: next,
    consequence: null,
    inputLocked: true,
    transferId: beat === "transfer" ? (generated?.followupId ?? null) : null,
  });
  // The question the player is looking at survives the tab closing.
  if (beat === "transfer") saveNow();
  useCafeStore.getState().announce(`${next.stage ? next.stage + " " : ""}${next.prompt}`);
}

/**
 * Take an option. The consequence plays, the world moves, and then the player is
 * simply free to walk again. There is no panel telling them how that went, and
 * there is no "next" implying a score was computed.
 */
export function chooseOption(optionId: string): void {
  const s = useCafeStore.getState();
  const activityId = activityAt(s.progress.index);
  const open = s.dialogue;
  if (!activityId || !open) return;

  const taken: DecisionSoFar = { ...s.taken, [open.beat]: optionId };
  audio.play("ui_confirm");

  if (open.beat === "transfer") {
    // The generated beat's consequence lives on the server: shipping all three
    // with the options would be shipping three hints at which option is which.
    useCafeStore.setState({ taken, dialogue: null });
    void settleTransfer(activityId, s.transferId, optionId, taken);
    return;
  }

  const outcome = resolve(activityId, open.beat, s.taken, optionId);
  useCafeStore.setState({ taken, dialogue: null, consequence: outcome?.consequence ?? null });
  if (outcome?.consequence) s.announce(outcome.consequence);
  if (outcome?.world) writeWorld(outcome.world);
  // Immediate, not debounced. This is the one write that must never be lost.
  saveNow();

  if (open.beat === "follow") {
    // Ask for the third beat NOW, while the second one's consequence is being
    // read. Four to six seconds of reading is the budget the generation runs
    // inside, and it is the whole reason the question can be personalised
    // without the conversation stopping to wait for it (ADR-006 §7.4).
    requestTransfer({
      activityId,
      track: trackOrDefault(),
      buildingId: BUILDING_ID,
      path: [taken.seed ?? "", optionId],
      speakerId: open.speaker === "room" ? undefined : open.speaker,
      worldState: useCafeStore.getState().world,
    });
  }

  // A beat with nothing authored behind it would otherwise leave the room
  // locked with no panel to dismiss — the interview moves on instead.
  if (!outcome?.consequence) closeConsequence();
}

/**
 * Commit the third beat and play what came back.
 *
 * If the server cannot be reached the question still closes: the interview moves
 * on the trace and never on the score, and an answer the player has given is not
 * something a dropped connection gets to take back.
 */
async function settleTransfer(
  activityId: string,
  transferId: string | null,
  optionId: string,
  taken: DecisionSoFar,
): Promise<void> {
  const settled = transferId
    ? await commitTransfer(transferId, optionId)
    : resolve(activityId, "transfer", taken, optionId);

  if (settled?.consequence) {
    useCafeStore.setState({ consequence: settled.consequence });
    useCafeStore.getState().announce(settled.consequence);
  }
  if (settled?.world) writeWorld(settled.world as WorldPatch);
  saveNow();
  if (!settled?.consequence) closeConsequence();
}

/**
 * Dismiss the consequence and let her ask the next one. Kept separate from
 * taking the option so the room gets its four to six seconds before the
 * question changes under the player.
 */
export function closeConsequence(): void {
  const s = useCafeStore.getState();
  const beat = s.dialogue?.beat ?? lastBeatTaken(s.taken);
  useCafeStore.setState({ consequence: null, inputLocked: false });
  if (beat) step(beat);
}

/**
 * Move the interview on by one beat.
 *
 * The first two beats just advance. The third closes the question: it goes into
 * the record, it is submitted for scoring, and `taken` is cleared before the
 * next question can put anything in it. Reading the activity id BEFORE
 * advancing matters — a beat later and we would be submitting the next
 * question's id with this question's path.
 */
function step(beat: Beat): void {
  const s = useCafeStore.getState();
  const activityId = activityAt(s.progress.index) ?? "";
  const competency = QUESTIONS[s.progress.index] ?? "";
  const taken = s.taken;
  const transferId = s.transferId;
  const next = advance(s.progress);

  if (beat !== "transfer") {
    useCafeStore.setState({ progress: next });
    saveSoon();
    return;
  }

  forgetTransfer(activityId);
  const durationSec = (Date.now() - questionStartedAt) / 1000;

  // The question goes into the record before `taken` is cleared. This is the
  // only memory the building keeps of what you answered, and the only thing
  // that reads it is her decision at the end.
  useCafeStore.setState({
    progress: next,
    taken: {},
    transferId: null,
    answered: [
      ...s.answered.filter((a) => a.activityId !== activityId),
      {
        activityId,
        competency,
        seed: taken.seed ?? null,
        follow: taken.follow ?? null,
        transfer: taken.transfer ?? null,
      },
    ],
  });
  saveNow();

  const followup = transferId && taken.transfer ? { id: transferId, choice: taken.transfer } : null;

  void submitDecision(activityId, taken, durationSec, followup).then((result) => {
    if (!result) {
      // The interview has already moved. The score can catch up on the next
      // visit — the trace is the record, and it is the thing that was persisted.
      const q = useCafeStore.getState().unsent;
      useCafeStore.setState({ unsent: [...q, { activityId, taken, durationSec, followup }] });
      return;
    }
    // Coins are computed server-side and credited once. `silent: true` is the
    // whole point: the coin tick and any badge still happen, because those are
    // the platform's, but nothing congratulates the player. A burst that fires
    // on `passed` and not otherwise IS a verdict, and this building does not
    // deliver verdicts (ADR-005 §11.1).
    events.emit("activity_completed", { response: result, silent: true });
  });

  if (isOver(next)) openOffer();
}

function lastBeatTaken(taken: DecisionSoFar): Beat | null {
  if (taken.transfer) return "transfer";
  if (taken.follow) return "follow";
  if (taken.seed) return "seed";
  return null;
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
}

export function stopSpeaking(): void {
  audio.play("ui_close");
  useCafeStore.getState().setSpeaking(null, "");
}

/** Fresh rotation for a fresh visit, so re-entering starts the room over. */
function resetSpoken(): void {
  spokenCount.clear();
}

/**
 * The Café's career, as a stage machine (ADR-007 §6).
 *
 * Rewritten from `cafeStore.ts`, which ran one interview through three beats.
 * The shape that changed is the spine: this one branches at a gate and loops on
 * a retry, so "what happens next" is a lookup rather than an increment.
 *
 * Two rules the file exists to hold, both of them the kind that are easy to
 * break by accident and expensive to notice:
 *
 *   - **Revenue is never derived here.** The client holds a number it is
 *     incapable of computing and renders whatever the server last handed back at
 *     a stage boundary. A delta visible after one choice is a directional
 *     readout of the tier, and a continuous one (ADR-007 §11.1).
 *   - **The room moves on the decision, never on the score.** Every network call
 *     can fail and none of them blocks the next beat. A stage close that does
 *     not land is queued and retried; the player carries on.
 */

import { create } from "zustand";
import { api } from "@/framework/api";
import { events } from "@/framework/events";
import { CLIENT_VERSION } from "@/framework/config/appConfig";
import { activityIdFor, trackOrDefault } from "@/framework/city/track";
import {
  awaitTransfer,
  commitTransfer,
  forgetTransfer,
  requestTransfer,
  type TransferBeat,
} from "@/framework/interior/transfer";
import { castById } from "./cast";
import {
  START_STAGE,
  evidenceByCompetency,
  gateRoads,
  outranks,
  sceneOf,
  stageById,
  treeOf,
  worldFor,
  type Role,
  type Scene,
  type Stage,
} from "./journey";
import {
  flushJourney,
  freshJourney,
  loadJourney,
  saveJourney,
  saveJourneyNow,
  type Answer,
  type Decision,
  type Journey,
  type UnsentStage,
} from "./journeySession";
import { followupFor } from "./followups";
import { applyPatch, type World, type WorldPatch } from "./world";
import { treeFor } from "./trees";

/** What a gate offers. Leaving is one of the three, not a failure state. */
export type Road = "accept" | "retry" | "exit";

/** The result of a stage close, as far as the player is concerned. */
export interface StageOutcome {
  stageId: string;
  attemptNo: number;
  bestAttemptNo: number;
  rawScore: number;
  questionScores: { unitId: string; score: number }[];
  band: string;
  feedback: string;
  /** The business after the stage. Revealed here and nowhere else. */
  revenue: number;
  revenueDelta: number;
  coinsBanked: number;
}

/**
 * The third beat on screen for a two-beat CEO scene, or null (ADR-007 §16).
 *
 * `followupId` is null for the authored fallback bank, and set for a beat the
 * server actually generated — the one thing `chooseTransferBeat` needs to know
 * which way to resolve an answer, and nothing else reads it.
 */
export interface TransferBeatVM {
  activityId: string;
  followupId: string | null;
  /** Null for "the room" — no name prefix, matching how a scene renders one. */
  speakerName: string | null;
  prompt: string;
  options: ReadonlyArray<{ id: string; text: string }>;
}

interface JourneyState extends Journey {
  /** The consequence sheet on screen, or null. */
  consequence: string | null;
  /** The stage outcome on screen after a close, or null. */
  outcome: StageOutcome | null;
  /** True while a stage close is in flight, so a double-click cannot double-send. */
  closing: boolean;
  /** The third beat on screen, once a two-beat scene's follow beat lands. */
  transferBeat: TransferBeatVM | null;
}

const start = (): JourneyState => ({
  ...(loadJourney() ?? freshJourney()),
  consequence: null,
  outcome: null,
  closing: false,
  transferBeat: null,
});

export const useJourneyStore = create<JourneyState>(() => start());

// ── Reading ──────────────────────────────────────────────────────────────────

export function currentStage(): Stage {
  return stageById(useJourneyStore.getState().stageId) ?? stageById(START_STAGE)!;
}

/**
 * What is at one position in a stage.
 *
 * One lookup rather than three accessors, because the succession stage holds a
 * pick *and* two scenes and index arithmetic that assumed one kind per stage
 * silently skipped the pick — the single most consequential decision in the
 * journey, and the one with no follow-up and no undo.
 */
export type StageItem =
  | { kind: "pick"; unitId: string }
  | { kind: "scene"; scene: Scene }
  | { kind: "tree"; tree: NonNullable<Stage["trees"]>[number] }
  | { kind: "question"; question: NonNullable<Stage["questions"]>[number] };

/** Everything a stage asks, in the order it asks it. */
export function itemsOf(stage: Stage): StageItem[] {
  const out: StageItem[] = [];
  // The pick comes first: you choose who to hand it to, then you interview them.
  if (stage.pickUnitId) out.push({ kind: "pick", unitId: stage.pickUnitId });
  for (const question of stage.questions ?? []) out.push({ kind: "question", question });
  for (const scene of stage.scenes ?? []) out.push({ kind: "scene", scene });
  for (const tree of stage.trees ?? []) out.push({ kind: "tree", tree });
  return out;
}

export function itemAt(stage: Stage, index: number): StageItem | null {
  return itemsOf(stage)[index] ?? null;
}

/** What the player is looking at now. */
export function currentItem(): StageItem | null {
  return itemAt(currentStage(), useJourneyStore.getState().index);
}

/** The scene on screen, if the current item is one. */
export function currentScene(): Scene | undefined {
  const item = currentItem();
  return item?.kind === "scene" ? item.scene : undefined;
}

/** The typed question on screen, if the current item is one. */
export function currentQuestion() {
  const item = currentItem();
  return item?.kind === "question" ? item.question : undefined;
}

function snapshot(): Journey {
  const s = useJourneyStore.getState();
  return {
    runId: s.runId,
    stageId: s.stageId,
    role: s.role,
    index: s.index,
    taken: s.taken,
    decided: s.decided,
    answers: s.answers,
    qaDone: s.qaDone,
    world: s.world,
    revenue: s.revenue,
    unsent: s.unsent,
  };
}

const saveNow = () => saveJourneyNow(snapshot());
const saveSoon = () => saveJourney(snapshot());

/** The way out. Immediate, and by beacon — the door is the last chance to write. */
export function leave(): void {
  flushJourney(snapshot());
}

// ── Deciding ─────────────────────────────────────────────────────────────────

/**
 * Commit a choice on the scene in front of the player.
 *
 * The consequence is asked for and raced against a short deadline; the authored
 * line serves the moment that deadline passes. There is no spinner and no tell
 * that one beat was written and another was not — a player who could tell would
 * treat those beats differently.
 */
export async function choose(letter: string): Promise<void> {
  const scene = currentScene();
  if (!scene) return;

  const s = useJourneyStore.getState();
  const decision: Decision = { unitId: scene.unitId, choice: letter };

  // The world write is authored and applies immediately: the room answers the
  // decision, not the network.
  const patch = worldFor(scene, letter);
  const world = patch ? applyPatch(s.world, patch) : s.world;

  useJourneyStore.setState({
    decided: [...s.decided, decision],
    world,
    consequence: scene.consequences[letter] ?? "",
  });
  saveNow();

  const written = await writeConsequence(scene, letter, world);
  if (written) {
    useJourneyStore.setState((cur) => ({
      consequence: written.consequence,
      world: written.world ? applyPatch(cur.world, written.world as WorldPatch) : cur.world,
    }));
  }
}

/**
 * Ask the server what happened. Never throws and never blocks: the caller has
 * already put the authored line on screen, and this replaces it only if a better
 * one arrives in time.
 */
async function writeConsequence(
  scene: Scene,
  letter: string,
  world: World,
): Promise<{ consequence: string; world?: Record<string, string> } | null> {
  try {
    return await api.aiConsequence({
      buildingId: "cafe",
      stageId: currentStage().id,
      unitId: scene.unitId,
      choice: letter,
      speakerId: scene.speaker,
      worldState: { ...world },
    });
  } catch {
    return null;
  }
}

/**
 * Commit one beat of a two-beat CEO scene, with its consequence.
 *
 * The CEO scenes are the existing authored decision trees played whole, so their
 * prose and their branch-specific follow-up come from `trees.ts` unchanged. Only
 * the composed path — "a.c" — goes on the wire.
 */
export function chooseTreeBeat(beat: "seed" | "follow", letter: string): void {
  const s = useJourneyStore.getState();
  const item = itemAt(currentStage(), s.index);
  if (item?.kind !== "tree") return;
  const tree = treeFor(item.tree.activityId);
  if (!tree) return;

  const choice =
    beat === "seed"
      ? tree.seed.find((c) => c.id === letter)
      : tree.follow[s.taken.seed ?? ""]?.choices.find((c) => c.id === letter);
  if (!choice) return;

  takeBeat(beat, letter);
  useJourneyStore.setState((cur) => ({
    consequence: choice.consequence,
    world: choice.world ? applyPatch(cur.world, choice.world) : cur.world,
  }));
  saveNow();
}

/**
 * Commit one beat of a two-beat CEO scene. The wire sees the composed path.
 *
 * The follow beat also fires the third beat's request (ADR-007 §16): the seed
 * and follow measure judgment and consistency, and the third measures whether
 * that reasoning survives a shape the player has not read before. Firing it
 * here — rather than when the player reaches the screen — is what lets it be
 * generated while the follow's own consequence is still on screen to read,
 * exactly the race `framework/interior/transfer.ts` is built for.
 *
 * `taken` deliberately keeps `seed`/`follow` set rather than clearing them:
 * that is what tells `advance` and the room there is a third beat still owed
 * on this item before it is done, the same way `seed` alone tells it the
 * follow-up is still owed.
 */
export function takeBeat(beat: "seed" | "follow", letter: string): void {
  const s = useJourneyStore.getState();
  const taken = { ...s.taken, [beat]: letter };
  if (beat === "seed") {
    useJourneyStore.setState({ taken });
    saveNow();
    return;
  }
  const item = itemAt(currentStage(), s.index);
  if (item?.kind !== "tree" || !taken.seed || !taken.follow) return;
  const tree = item.tree;
  useJourneyStore.setState({
    taken,
    decided: [...s.decided, { unitId: tree.unitId, choice: `${taken.seed}.${taken.follow}` }],
    transferBeat: fallbackTransferBeat(tree.activityId),
  });
  saveNow();
  requestThirdBeat(tree.activityId, taken.seed, taken.follow);
}

/** The authored bank's answer for this activity, ready with no round trip. */
function fallbackTransferBeat(activityId: string): TransferBeatVM | null {
  const bank = followupFor(activityId);
  if (!bank) return null;
  const speaker = bank.speakerId === "room" ? null : castById(bank.speakerId as never);
  return {
    activityId,
    followupId: null,
    speakerName: speaker?.name ?? null,
    prompt: bank.prompt(useJourneyStore.getState().world),
    options: bank.options.map((o) => ({ id: o.id, text: o.text })),
  };
}

function generatedTransferBeat(activityId: string, beat: TransferBeat): TransferBeatVM {
  return {
    activityId,
    followupId: beat.followupId,
    speakerName: beat.speakerName,
    prompt: beat.prompt,
    options: beat.options,
  };
}

/**
 * Ask for the third beat, and swap it in if it lands before the player
 * reaches the screen that shows it. Never awaited by the caller — the bank
 * answer is already on screen the instant this returns, and it is a perfectly
 * good question (ADR-006 §7).
 */
function requestThirdBeat(activityId: string, seed: string, follow: string): void {
  requestTransfer({
    activityId,
    track: trackOrDefault(),
    buildingId: "cafe",
    path: [seed, follow],
    speakerId: followupFor(activityId)?.speakerId,
    worldState: { ...useJourneyStore.getState().world },
  });
  void awaitTransfer(activityId).then((beat) => {
    if (!beat) return;
    const cur = useJourneyStore.getState();
    // A player who has already answered the bank's version, or moved off this
    // beat entirely, must not have a generated one land under them.
    if (cur.transferBeat?.activityId !== activityId || cur.taken.transfer) return;
    useJourneyStore.setState({ transferBeat: generatedTransferBeat(activityId, beat) });
  });
}

/**
 * Answer the third beat. Its own consequence uses the same sheet as the two
 * authored beats — there is no tell, on screen, that this one might have been
 * written by a generator (ADR-006 §7).
 *
 * A commit that cannot be confirmed reads the same as an activity with no
 * bank entry at all: nothing to show, straight through. The room moves on the
 * decision and never on the score.
 */
export async function chooseTransferBeat(optionId: string): Promise<void> {
  const s = useJourneyStore.getState();
  const beat = s.transferBeat;
  if (!beat) return;

  useJourneyStore.setState((cur) => ({ taken: { ...cur.taken, transfer: optionId } }));
  saveNow();

  const written = beat.followupId
    ? await commitTransfer(beat.followupId, optionId)
    : resolveFallback(beat.activityId, optionId);
  forgetTransfer(beat.activityId);

  if (!written) {
    advance();
    return;
  }
  useJourneyStore.setState((cur) => ({
    consequence: written.consequence,
    world: written.world ? applyPatch(cur.world, written.world as WorldPatch) : cur.world,
  }));
  saveNow();
}

function resolveFallback(
  activityId: string,
  optionId: string,
): { consequence: string; world?: WorldPatch } | null {
  const option = followupFor(activityId)?.options.find((o) => o.id === optionId);
  return option ? { consequence: option.consequence, world: option.world } : null;
}

/** Record a typed answer. Held until the stage closes; graded there, not here. */
export function answer(unitId: string, text: string): void {
  const s = useJourneyStore.getState();
  const answers: Answer[] = [
    ...s.answers.filter((a) => a.unitId !== unitId),
    { unitId, text: text.trim() },
  ];
  useJourneyStore.setState({ answers });
  saveSoon();
}

/**
 * Move on from whatever is on screen.
 *
 * A two-beat scene mid-tree is the exception, twice over: committing its seed
 * leaves the follow-up waiting on the same unit, so clearing the consequence
 * there means "ask me the second half", not "next scene" — and committing the
 * follow-up is the same shape one beat later, leaving the third beat waiting
 * on the same unit when the activity has one to ask (ADR-007 §16).
 */
export function advance(): void {
  const s = useJourneyStore.getState();
  if (s.taken.seed && !s.taken.follow) {
    useJourneyStore.setState({ consequence: null });
    saveSoon();
    return;
  }
  if (s.taken.seed && s.taken.follow && !s.taken.transfer && s.transferBeat) {
    useJourneyStore.setState({ consequence: null });
    saveSoon();
    return;
  }
  useJourneyStore.setState({
    index: s.index + 1,
    consequence: null,
    taken: {},
    transferBeat: null,
  });
  saveSoon();
}

/** Choose a successor. The last decision of the journey, and the only one with no undo. */
export function pickSuccessor(key: string): void {
  const stage = currentStage();
  if (!stage.pickUnitId) return;
  useJourneyStore.setState((s) => ({
    decided: [...s.decided, { unitId: stage.pickUnitId!, choice: key }],
  }));
  saveNow();
}

/**
 * Clear the consequence sheet WITHOUT moving on.
 *
 * Almost never what you want: reading what happened and moving on are the same
 * act, so the sheet's own button calls `advance`. This exists for the paths that
 * abandon a scene rather than finish it — leaving the building mid-decision, and
 * a gate resetting the stage under it.
 */
export function dismissConsequence(): void {
  useJourneyStore.setState({ consequence: null });
}

/** Whether the current stage has anything left to ask. */
export function stageIsDone(): boolean {
  return useJourneyStore.getState().index >= itemsOf(currentStage()).length;
}

// ── Closing a stage ──────────────────────────────────────────────────────────

/**
 * Settle the stage: grade what was typed, reveal what the business did, and
 * settle the evidence into the registry rows.
 *
 * The revenue reveal and the per-competency submits are two separate round
 * trips on purpose. `SubmitResponse` is frozen — every new field on a scored
 * response is a new place for a tier to leak — so the stage's own outcome comes
 * back from its own endpoint.
 */
export async function closeStage(): Promise<StageOutcome | null> {
  const s = useJourneyStore.getState();
  if (s.closing) return null;
  useJourneyStore.setState({ closing: true });

  const stage = currentStage();
  const units = unitsDecidedIn(stage, s.decided);
  const pending: UnsentStage = { stageId: stage.id, units, answers: s.answers };

  let outcome: StageOutcome | null = null;
  try {
    const res = await api.journeyStage("cafe", {
      runId: s.runId ?? undefined,
      stageId: stage.id,
      track: trackOrDefault(),
      answers: s.answers.length ? s.answers : undefined,
      units: units.length ? units : undefined,
    });
    outcome = {
      stageId: res.stageId,
      attemptNo: res.attemptNo ?? 0,
      bestAttemptNo: res.bestAttemptNo ?? 0,
      rawScore: res.rawScore ?? 0,
      questionScores: res.questionScores,
      band: res.band,
      feedback: res.feedback,
      revenue: res.revenue,
      revenueDelta: res.revenueDelta,
      coinsBanked: res.coinsBanked,
    };
    useJourneyStore.setState({
      runId: res.runId,
      revenue: res.revenue,
      // The server applies the same exclusion, so this is its answer,
      // not a second opinion.
      role: ROLES.includes(res.roleReached as Role) ? (res.roleReached as Role) : s.role,
      qaDone: [...s.qaDone, ...s.answers.map((a) => a.unitId)],
      answers: [],
      outcome,
      closing: false,
    });
  } catch {
    // The room moves on the decision, never on the score. Queue it and carry on:
    // a gate the player cannot walk through because the network is down is a
    // worse failure than a gate that says nothing.
    useJourneyStore.setState({
      unsent: [...s.unsent, pending],
      qaDone: [...s.qaDone, ...s.answers.map((a) => a.unitId)],
      answers: [],
      closing: false,
    });
  }

  saveNow();
  void settle();
  return outcome;
}

/** The decisions taken in one stage, in play order. */
function unitsDecidedIn(stage: Stage, decided: readonly Decision[]): Decision[] {
  const own = new Set<string>();
  for (const sc of stage.scenes ?? []) own.add(sc.unitId);
  for (const t of stage.trees ?? []) own.add(t.unitId);
  if (stage.pickUnitId) own.add(stage.pickUnitId);
  return decided.filter((d) => own.has(d.unitId));
}

/**
 * Settle the evidence so far into the nine registry rows the building owns.
 *
 * Runs at every level close rather than once at the end. A player may leave at
 * any of three gates, and if this only ran at the door then the most common real
 * session — an interview and one level in a sitting — would be the one that
 * measured nothing (ADR-007 §8.3).
 *
 * Idempotent by construction: it re-sends the full unit list for a competency
 * each time, the server recomputes from scratch, and `bestProficiency` does the
 * rest.
 */
export async function settle(): Promise<void> {
  const s = useJourneyStore.getState();
  if (!s.runId) return;
  const track = trackOrDefault();

  for (const [competency, evidence] of evidenceByCompetency(s.decided, s.qaDone)) {
    if (evidence.units.length === 0 && evidence.qa.length === 0) continue;
    try {
      const res = await api.submit(activityIdFor(competency, track), {
        clientVersion: CLIENT_VERSION,
        durationSec: 0,
        hintsUsed: 0,
        result: {
          journey: {
            buildingId: "cafe",
            runId: s.runId,
            units: evidence.units,
            qa: evidence.qa,
          },
        },
      });
      // Silent: the coins tick, and nothing congratulates. A verdict delivered
      // before the player has read the room they changed is a §11 violation.
      events.emit("activity_completed", { response: res, silent: true });
    } catch {
      // Nothing to queue. The decisions are already saved, and the next stage
      // close re-sends this competency's whole list anyway.
    }
  }
}

/** Drain the stage closes that never landed. Called when the door opens. */
export async function retryUnsent(): Promise<void> {
  const s = useJourneyStore.getState();
  if (s.unsent.length === 0) return;

  const stuck: UnsentStage[] = [];
  for (const item of s.unsent) {
    try {
      const res = await api.journeyStage("cafe", {
        runId: useJourneyStore.getState().runId ?? undefined,
        stageId: item.stageId,
        track: trackOrDefault(),
        answers: item.answers.length ? item.answers : undefined,
        units: item.units.length ? item.units : undefined,
      });
      useJourneyStore.setState({ runId: res.runId, revenue: res.revenue });
    } catch {
      stuck.push(item);
    }
  }
  useJourneyStore.setState({ unsent: stuck });
  saveNow();
  void settle();
}

// ── Gates ────────────────────────────────────────────────────────────────────

/**
 * Take one of a gate's three roads.
 *
 * Retry re-enters the stage it came from with a clean index, and appends an
 * attempt rather than replacing one. Attempt 1 is the baseline the report
 * measures improvement from; overwriting it would make "how are they
 * progressing" unanswerable, silently.
 */
export function takeRoad(road: Road): void {
  const stage = currentStage();
  const roads = gateRoads(stage);
  if (!roads) return;

  const next = roads[road];
  const nextStage = stageById(next);
  useJourneyStore.setState((s) => ({
    stageId: next,
    index: 0,
    taken: {},
    answers: road === "retry" ? [] : s.answers,
    outcome: null,
    consequence: null,
    role: roleOnEntering(nextStage, s.role),
  }));
  saveNow();
}

/** Walk on to whatever follows a stage that is not a gate. */
export function goToNextStage(): void {
  const stage = currentStage();
  if (!stage.next) return;
  const next = stageById(stage.next);
  useJourneyStore.setState((s) => ({
    stageId: stage.next!,
    index: 0,
    taken: {},
    outcome: null,
    consequence: null,
    role: roleOnEntering(next, s.role),
  }));
  saveNow();
}

/**
 * A posting is a high-water mark. Replaying an earlier stage must not demote
 * someone who already ran the place — and the exit is walked by everybody, at
 * whatever rank they hold, so it promotes nobody.
 */
const ROLES: readonly Role[] = ["candidate", "employee", "branch_manager", "ceo"];

/**
 * The posting a player holds on entering a stage.
 *
 * A posting is a high-water mark, so an earlier stage never demotes someone who
 * already ran the place. And **the exit promotes nobody**: everybody leaves by
 * the same door, the stage is written from the CEO's point of view, and taking
 * its role would hand the top job to an employee who walked out at the second
 * gate. The server makes the same exclusion for the same reason; this is the
 * client half of one rule, and it was wrong here first.
 */
function roleOnEntering(stage: Stage | undefined, current: Role): Role {
  if (!stage || stage.kind === "exit") return current;
  if (!ROLES.includes(stage.role)) return current;
  return outranks(stage.role, current) ? stage.role : current;
}

/** Reset to a career nobody has started. Used by tests and by a hard restart. */
export function resetJourney(): void {
  useJourneyStore.setState({
    ...freshJourney(),
    consequence: null,
    outcome: null,
    closing: false,
    transferBeat: null,
  });
  saveNow();
}

export { sceneOf, treeOf };

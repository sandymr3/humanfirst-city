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
  recordStage,
  loadJourney,
  saveJourney,
  saveJourneyNow,
  type Answer,
  type Decision,
  type Journey,
  type UnsentStage,
} from "./journeySession";
import { transcriptFor } from "./history";
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

/**
 * A generated question on a scenario scene (L1/L2), and the scene it belongs to.
 *
 * Distinct from TransferBeatVM even though the shape rhymes: that one is the
 * third beat of an authored decision tree, this one is any of the two or three a
 * scenario scene asks, and they arrive by different routes. Keeping them apart
 * means neither flow can quietly break the other.
 */
export interface SceneBeatVM {
  unitId: string;
  /** The authored letter this question follows — the server keys the chain on it. */
  choice: string;
  followupId: string;
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
  /**
   * The next generated question for the scenario scene in front of the player,
   * fetched while its consequence is still being read and shown when they move
   * on from it. Null means the scene has nothing further to ask — which is also
   * what every failure looks like, deliberately.
   */
  sceneBeat: SceneBeatVM | null;
}

const start = (): JourneyState => ({
  ...(loadJourney() ?? freshJourney()),
  consequence: null,
  outcome: null,
  closing: false,
  transferBeat: null,
  sceneBeat: null,
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
    history: s.history,
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
    // Null rather than "" — every one-beat scene is required to carry all three
    // authored consequences (validate_registry blocks a missing one), so this
    // is defensive, and an empty sheet is worse than no sheet.
    consequence: scene.consequences?.[letter] ?? null,
  });
  saveNow();

  // The generated question is asked for HERE rather than when the player
  // reaches it, so it is written while the consequence is still on screen being
  // read — the same race the two-beat scenes use for their third beat. By the
  // time they click on, it has either landed or it never will.
  void fetchSceneBeat(scene.unitId, letter, world);

  // Where the player was standing when this was asked for. A generated
  // consequence that arrives after they have moved on belongs to a scene they
  // have already left, and setting it would re-open a sheet over whatever is on
  // screen now — the gate, the report, or the room itself.
  const askedAt = { stageId: s.stageId, index: s.index };

  const written = await writeConsequence(scene, letter, world);
  if (!written || !written.consequence.trim()) return;

  const now = useJourneyStore.getState();
  if (now.stageId !== askedAt.stageId || now.index !== askedAt.index) return;

  useJourneyStore.setState((cur) => ({
    consequence: written.consequence,
    world: written.world ? applyPatch(cur.world, written.world as WorldPatch) : cur.world,
  }));
}

/**
 * Ask the server for the next generated question on this scene, and hold it.
 *
 * Never throws and never blocks. `done` — for a finished scene, an unreachable
 * model, a spent budget, or a draft that could not clear its gates — all land
 * here as "no question", and the scene simply ends on its authored consequence
 * exactly as it did before these existed.
 */
async function fetchSceneBeat(
  unitId: string,
  choice: string,
  world: World,
  answer?: string,
): Promise<void> {
  try {
    const res = await api.journeyFollowup("cafe", {
      stageId: currentStage().id,
      unitId,
      choice,
      worldState: { ...world },
      answer,
      background: backgroundForCurrentLevel(),
    });
    if (res.done || !res.question) return;
    const q = res.question;
    useJourneyStore.setState({
      sceneBeat: {
        unitId,
        choice,
        followupId: q.followupId,
        speakerName: q.speaker.id === "room" ? null : q.speaker.name,
        prompt: q.prompt,
        options: q.options.map((o) => ({ id: o.id, text: o.text })),
      },
    });
  } catch {
    // No question. The scene ends where it would have anyway.
  }
}

/**
 * Answer a generated question.
 *
 * Committing is what releases its consequence — the three were never shipped up
 * front, because a player who could read all three could infer the ranking. The
 * next question is then asked for immediately, so it is being written while this
 * one's consequence is on screen.
 */
export async function answerSceneBeat(optionId: string): Promise<void> {
  const beat = useJourneyStore.getState().sceneBeat;
  if (!beat) return;

  // Clear it first: the question is answered, and leaving it on screen while the
  // commit is in flight invites a second click on a different option.
  useJourneyStore.setState({ sceneBeat: null });

  let consequence = "";
  let patch: WorldPatch | undefined;
  try {
    const res = await api.commitFollowup(beat.followupId, optionId);
    consequence = (res.consequence ?? "").trim();
    patch = res.world as WorldPatch | undefined;
  } catch {
    // The answer is recorded server-side or it is not; either way the room must
    // keep moving, so fall through with nothing to show.
  }

  // Null, not "". A sheet whose only content is an empty paragraph renders as a
  // bare "Back to the room" button floating over the room — which is exactly
  // what a failed commit used to put on screen.
  useJourneyStore.setState((cur) => ({
    consequence: consequence || null,
    world: patch ? applyPatch(cur.world, patch) : cur.world,
  }));
  saveNow();

  const world = useJourneyStore.getState().world;
  await fetchSceneBeat(beat.unitId, beat.choice, world);

  // Awaiting the fetch does not make the player wait — the consequence sheet is
  // already on screen from the setState above. It is awaited so that, when there
  // is nothing to read AND nothing further to ask, the room moves on by itself
  // instead of stranding them with no sheet and no way forward.
  if (!consequence && !useJourneyStore.getState().sceneBeat) advance();
}

/**
 * Answer an open generated question in the player's own words.
 *
 * The sibling of `answerSceneBeat`, and it differs in what comes back: nothing.
 * A chosen option had a consequence withheld until it was picked; an open
 * question never had one, so there is nothing to release and nothing to read.
 * The next question is asked for straight away, and if there is not one the
 * room moves on by itself rather than leaving an empty sheet on screen.
 */
export async function answerSceneBeatText(text: string): Promise<void> {
  const beat = useJourneyStore.getState().sceneBeat;
  if (!beat) return;
  const trimmed = text.trim();
  if (!trimmed) return;

  // Off screen the moment it is answered, for the same reason the option path
  // clears it: a second submission against one question is a second answer to
  // something already answered.
  useJourneyStore.setState({ sceneBeat: null, consequence: null });

  try {
    await api.answerFollowup(beat.followupId, trimmed);
  } catch {
    // Recorded server-side or not; either way the room keeps moving. The next
    // fetch will see whatever the server actually holds.
  }
  saveNow();

  const world = useJourneyStore.getState().world;
  await fetchSceneBeat(beat.unitId, beat.choice, world);

  // Nothing to read and nothing further to ask: the scene is over, so move on
  // rather than stranding the player with a blank panel.
  if (!useJourneyStore.getState().sceneBeat) advance();
}

/**
 * Answer an open scene in the player's own words.
 *
 * The sibling of `choose`, and the difference is what settles it: a lettered
 * scene is priced by the letter, an open one by the mark its text is graded at
 * when the stage closes. Nothing here scores anything — the room moves on the
 * decision and never on the score, so the answer is recorded and the player
 * carries on.
 *
 * The authored fallback goes on screen straight away for the same reason the
 * lettered path shows its authored line first: a room that waits for a network
 * round trip to say what happened is a room that can stall.
 */
export async function answerScene(text: string): Promise<void> {
  const scene = currentScene();
  if (!scene?.open) return;
  const trimmed = text.trim();
  if (!trimmed) return;

  const s = useJourneyStore.getState();
  useJourneyStore.setState({
    answers: [
      ...s.answers.filter((a) => a.unitId !== scene.unitId),
      { unitId: scene.unitId, text: trimmed },
    ],
    consequence: scene.fallbackConsequence ?? null,
  });
  saveNow();

  // The scene's generated questions, asked for the moment the authored decision
  // is answered — the same race the lettered path uses, so the next question is
  // written while this consequence is being read.
  //
  // There is no letter to key the chain on, so the marker stands in for one. The
  // server keys a chain on (user, unit, choice, beat); an open scene has exactly
  // one chain per unit, which is what this says.
  void fetchSceneBeat(scene.unitId, OPEN_CHOICE, s.world, trimmed);

  // And what happened, written from the same words. Raced exactly like the
  // lettered path: the authored line is already on screen, and this replaces it
  // only if a better one arrives before the player has moved on.
  const askedAt = { stageId: s.stageId, index: s.index };
  const written = await writeConsequence(scene, OPEN_CHOICE, s.world, trimmed);
  if (!written || !written.consequence.trim()) return;

  const now = useJourneyStore.getState();
  if (now.stageId !== askedAt.stageId || now.index !== askedAt.index) return;

  useJourneyStore.setState((cur) => ({
    consequence: written.consequence,
    world: written.world ? applyPatch(cur.world, written.world as WorldPatch) : cur.world,
  }));
}

/**
 * What goes on the wire in place of a letter for an open scene.
 *
 * Deliberately a constant rather than a hash of the answer: re-answering a scene
 * must continue the same chain rather than start a second one, or a player who
 * edits their answer gets a fresh set of follow-ups and the earlier ones are
 * orphaned mid-scene.
 */
export const OPEN_CHOICE = "open";

/**
 * What the player said in the sitting that got them this posting.
 *
 * The client's ask, in their words: "Consequence for Level 1 (employee) should
 * be layered on user answers in interview process followed by the option they
 * chose in the scenario based question. Level 2 (branch manager) should be
 * layered on user answers in review session."
 *
 * So: the most recent typed sitting before the level in progress. That is the
 * interview for L1 and review #1 for L2 without either being named here, which
 * matters because a stage inserted between them should not silently make this
 * point at the wrong conversation.
 *
 * Empty when there is nothing — a run resumed from a save written before the
 * transcript existed, or a level reached with the sitting queued offline. The
 * scene still gets its consequence; it is just written from the scene alone.
 */
function backgroundForCurrentLevel(): string[] {
  const s = useJourneyStore.getState();
  for (let i = s.history.length - 1; i >= 0; i--) {
    const rec = s.history[i];
    if (stageById(rec.stageId)?.kind !== "qa") continue;
    return rec.entries.map((e) => e.answer);
  }
  return [];
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
  answer?: string,
): Promise<{ consequence: string; world?: Record<string, string> } | null> {
  try {
    return await api.aiConsequence({
      buildingId: "cafe",
      stageId: currentStage().id,
      unitId: scene.unitId,
      choice: letter,
      speakerId: scene.speaker,
      worldState: { ...world },
      answer,
      background: backgroundForCurrentLevel(),
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

  // The CEO round's own generated questions, asked from the composed path the
  // player actually took through the tree. Fired here for the same reason the
  // one-beat scenes fire theirs at `choose`: it is written while the transfer
  // beat's consequence is being read, so it costs no visible wait.
  const item = currentItem();
  if (item?.kind === "tree" && s.taken.seed && s.taken.follow) {
    void fetchSceneBeat(
      item.tree.unitId,
      `${s.taken.seed}.${s.taken.follow}`,
      useJourneyStore.getState().world,
    );
  }

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
  // A scenario scene with a generated question waiting is not finished: clearing
  // the consequence here means "ask me the next one", not "next scene".
  if (s.sceneBeat) {
    useJourneyStore.setState({ consequence: null });
    saveSoon();
    return;
  }
  useJourneyStore.setState({
    index: s.index + 1,
    consequence: null,
    taken: {},
    transferBeat: null,
    sceneBeat: null,
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
  // What the player put against each question in this phase, captured BEFORE
  // the close clears `answers` — this is the only moment the typed text and the
  // stage it belongs to are both in hand.
  const transcript = transcriptFor(stage, s.answers, units);

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
      history: [
        ...s.history,
        recordStage(stage.id, outcome.attemptNo, transcript, {
          band: outcome.band,
          feedback: outcome.feedback,
        }),
      ],
    });
  } catch {
    // The room moves on the decision, never on the score. Queue it and carry on:
    // a gate the player cannot walk through because the network is down is a
    // worse failure than a gate that says nothing.
    // The phase still happened, and the player should still be able to look
    // back at it. It is recorded without a band or feedback, because there
    // genuinely is none — the server never took the close.
    useJourneyStore.setState({
      unsent: [...s.unsent, pending],
      qaDone: [...s.qaDone, ...s.answers.map((a) => a.unitId)],
      answers: [],
      closing: false,
      history: [...s.history, recordStage(stage.id, 0, transcript)],
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
    // A beat owed on the stage being left must not follow the player into the
    // next one. Only `advance` cleared these, so a gate walked through mid-scene
    // carried a question across and rendered it on top of the new stage's panel.
    sceneBeat: null,
    transferBeat: null,
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
    // Same reason as `takeRoad`: a beat still owed on the stage being left would
    // otherwise render on top of the next stage's own panel.
    sceneBeat: null,
    transferBeat: null,
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

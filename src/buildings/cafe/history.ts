/**
 * Walking back through a finished phase.
 *
 * The client asked to be able to "go back to previous phases alone and see what
 * questions and what are the answers we have chosen". Two words there decide the
 * design: *previous*, and *see*.
 *
 * **Previous** — only phases that have closed. A stage in progress is not
 * history, it is the game.
 *
 * **See** — read-only, by construction rather than by discipline. Re-answering a
 * closed stage would rewrite an attempt the report measures improvement from,
 * and the journey already has a way to sit a stage again: the gate's `retry`
 * road, which appends a second attempt and leaves the first standing. A history
 * view that could edit would quietly undo the one property the whole evidence
 * ledger rests on.
 *
 * The record itself is written at stage close (`journeyStore.closeStage`) into
 * the save blob, because nothing else keeps it: `JourneyAttempt` on the server
 * stores scores, band and feedback but not a word of what was written, and the
 * store empties `answers` the moment a stage settles.
 */

import { ROLE_LABEL, stageById, type Scene, type Stage } from "./journey";
import { treeFor } from "./trees";
import type { Answer, Decision, StageRecord, TranscriptEntry } from "./journeySession";

/** One question as the history panel shows it. */
export interface HistoryQuestion {
  unitId: string;
  /** The scene or question title, where the content carries one. */
  title?: string;
  prompt: string;
  /** What the player wrote, or the option they took, in the words they read. */
  answer: string;
}

/** One finished phase, resolved against the content for display. */
export interface HistoryPhase {
  stageId: string;
  title: string;
  role: string;
  attemptNo: number;
  band?: string;
  feedback?: string;
  questions: HistoryQuestion[];
}

/**
 * What the player put against each question in a stage, at the moment it closes.
 *
 * Typed answers come from `answers`; a lettered decision is resolved back to the
 * text the player actually read, because "c" is not a record of anything a
 * person would recognise a week later.
 */
export function transcriptFor(
  stage: Stage,
  answers: readonly Answer[],
  units: readonly Decision[],
): TranscriptEntry[] {
  const out: TranscriptEntry[] = [];
  const byUnit = new Map(answers.map((a) => [a.unitId, a.text]));

  // The stage's own order, so the panel reads the way the phase played.
  for (const q of stage.questions ?? []) {
    const text = byUnit.get(q.unitId);
    if (text) out.push({ unitId: q.unitId, answer: text });
  }
  for (const sc of stage.scenes ?? []) {
    const typed = byUnit.get(sc.unitId);
    if (typed) {
      out.push({ unitId: sc.unitId, answer: typed });
      continue;
    }
    const choice = units.find((u) => u.unitId === sc.unitId)?.choice;
    const text = choice ? sceneChoiceText(sc, choice) : "";
    if (text) out.push({ unitId: sc.unitId, answer: text });
  }
  for (const t of stage.trees ?? []) {
    const choice = units.find((u) => u.unitId === t.unitId)?.choice;
    const text = choice ? treeChoiceText(t.activityId, choice) : "";
    if (text) out.push({ unitId: t.unitId, answer: text });
  }
  return out;
}

/** The option text behind a letter on a one-beat scene. Empty if it is open. */
function sceneChoiceText(scene: Scene, choice: string): string {
  return scene.choices?.[choice] ?? "";
}

/**
 * The option texts behind a composed `seed.follow` path on a CEO tree.
 *
 * Both beats, joined, because a tree scene is one decision made in two moves and
 * showing only the second would misreport what happened.
 */
function treeChoiceText(activityId: string, path: string): string {
  const tree = treeFor(activityId);
  if (!tree) return "";
  const [seed, follow] = path.split(".");
  const seedText = tree.seed.find((c) => c.id === seed)?.text ?? "";
  const followText = follow
    ? (tree.follow[seed]?.choices.find((c) => c.id === follow)?.text ?? "")
    : "";
  return [seedText, followText].filter(Boolean).join(" Then: ");
}

/**
 * Resolve the saved records against the content, newest phase last.
 *
 * A record whose stage the content no longer knows is DROPPED rather than shown
 * with a missing title. The Café has changed shape twice, and a panel that
 * renders half a stage from a build that no longer exists is a bug report
 * waiting to be filed about content nobody can find.
 */
export function historyPhases(records: readonly StageRecord[]): HistoryPhase[] {
  const out: HistoryPhase[] = [];
  for (const rec of records) {
    const stage = stageById(rec.stageId);
    if (!stage) continue;

    const questions: HistoryQuestion[] = [];
    for (const entry of rec.entries) {
      // A generated follow-up carries its own prompt, because there is nothing
      // to look it up in — it was written for this player and this run.
      const found = entry.prompt
        ? { title: "Follow-up", prompt: entry.prompt }
        : promptFor(stage, entry.unitId);
      if (!found) continue;
      questions.push({ unitId: entry.unitId, ...found, answer: entry.answer });
    }
    if (questions.length === 0) continue;

    out.push({
      stageId: rec.stageId,
      title: stage.title,
      role: ROLE_LABEL[stage.role],
      attemptNo: rec.attemptNo,
      band: rec.band,
      feedback: rec.feedback,
      questions,
    });
  }
  return out;
}

function promptFor(stage: Stage, unitId: string): { title?: string; prompt: string } | null {
  for (const q of stage.questions ?? []) {
    if (q.unitId === unitId) return { prompt: q.prompt };
  }
  for (const sc of stage.scenes ?? []) {
    if (sc.unitId === unitId) return { title: sc.title, prompt: sc.prompt };
  }
  for (const t of stage.trees ?? []) {
    if (t.unitId !== unitId) continue;
    const tree = treeFor(t.activityId);
    return { title: t.title, prompt: tree?.prompt ?? "" };
  }
  return null;
}

// The decision, as a small state machine over the store.
//
// Three beats, each the same shape: a question, three options that look alike,
// one consequence, and then the room again. Nothing between them tells the
// player how they are doing, and there is deliberately no result view anywhere
// in this file — the Café does not route through PlayerShell, whose ResultView
// prints "Passed!" and a proficiency, and §11 forbids both.
//
// The third beat comes from the fallback bank rather than from the generator.
// `POST /api/v1/ai/followup` is backend work that has not landed and the
// framework client is maintainer-owned, so this is the degraded path PRD §2
// describes: the bank serves every beat and nothing the player sees differs.
import { api } from "@/framework/api";
import { CLIENT_VERSION } from "@/framework/config/appConfig";
import type { Beat } from "./missions";
import { resolveSpeaker } from "./missions";
import { followupFor } from "./followups";
import { tracePath, treeFor } from "./trees";
import type { WorldPatch } from "./world";

/** One option on screen. Text only — never a tier, never a rank, never a hint. */
export interface DialogueOption {
  id: string;
  text: string;
}

export interface DialogueState {
  beat: Beat;
  /** Who is asking, or "room" when the register is narration. */
  speaker: string;
  /** Set on the first beat only: the scene before anybody speaks. */
  stage?: string;
  prompt: string;
  options: readonly DialogueOption[];
}

/** What the room does about the option you took. */
export interface Resolution {
  consequence: string;
  world?: WorldPatch;
}

export interface DecisionSoFar {
  seed?: string;
  follow?: string;
  transfer?: string;
}

/**
 * Build the beat that is due. Returns null when there is nothing authored for
 * this mission yet, which is how a season with only some of its content written
 * degrades: the beat is skipped rather than the mission being stuck.
 */
export function openBeat(
  activityId: string,
  beat: Beat,
  taken: DecisionSoFar,
  mission: Parameters<typeof resolveSpeaker>[0],
  present: readonly string[],
  world: Parameters<NonNullable<ReturnType<typeof followupFor>>["prompt"]>[0],
): DialogueState | null {
  const speaker = resolveSpeaker(mission, present as never);

  if (beat === "transfer") {
    const bank = followupFor(activityId);
    if (!bank) return null;
    return {
      beat,
      // The bank names a speaker, but who is actually in the room wins: Nadia
      // always leaves, and a question from somebody who has gone is worse than
      // the same question from Priya.
      speaker: present.includes(bank.speakerId) ? bank.speakerId : speaker,
      prompt: bank.prompt(world),
      options: bank.options.map((o) => ({ id: o.id, text: o.text })),
    };
  }

  const tree = treeFor(activityId);
  if (!tree) return null;

  if (beat === "seed") {
    return {
      beat,
      speaker,
      stage: tree.stage,
      prompt: tree.prompt,
      options: tree.seed.map((c) => ({ id: c.id, text: c.text })),
    };
  }

  const branch = taken.seed ? tree.follow[taken.seed] : undefined;
  if (!branch) return null;
  return {
    beat,
    speaker,
    prompt: branch.prompt,
    options: branch.choices.map((c) => ({ id: c.id, text: c.text })),
  };
}

/** What happens when an option is taken. */
export function resolve(
  activityId: string,
  beat: Beat,
  taken: DecisionSoFar,
  optionId: string,
): Resolution | null {
  if (beat === "transfer") {
    const option = followupFor(activityId)?.options.find((o) => o.id === optionId);
    return option ? { consequence: option.consequence, world: option.world } : null;
  }
  const tree = treeFor(activityId);
  if (!tree) return null;
  const choices =
    beat === "seed" ? tree.seed : (taken.seed && tree.follow[taken.seed]?.choices) || [];
  const choice = choices.find((c) => c.id === optionId);
  return choice ? { consequence: choice.consequence, world: choice.world } : null;
}

/**
 * Send the decision for scoring.
 *
 * `followupId` and `followupChoice` are not on the wire: the framework's
 * TraceResult schema has no room for them and is maintainer-owned, so the
 * submission carries the authored path alone. That is exactly the degraded path
 * the rubric's `aiBeat.required: false` exists for — the mission scores on its
 * terminal and the transfer beat counts for nothing yet.
 *
 * Failure is expected rather than exceptional: the Café's registry rows are
 * backend content that has not been seeded, so this 404s today. The caller keeps
 * the trace and retries later. **The room moves on the trace, never on the
 * score** (PRD §19.7).
 */
export async function submitDecision(
  activityId: string,
  taken: DecisionSoFar,
  durationSec: number,
): Promise<boolean> {
  if (!taken.seed || !taken.follow) return false;
  try {
    await api.submit(activityId, {
      clientVersion: CLIENT_VERSION,
      durationSec: Math.max(0, Math.round(durationSec)),
      hintsUsed: 0,
      result: { trace: { path: tracePath(activityId, taken.seed, taken.follow) } },
    });
    return true;
  } catch {
    return false;
  }
}

// The decision, as a small state machine over the store.
//
// Three beats, each the same shape: a question, three options that look alike,
// one consequence, and then the room again. Nothing between them tells the
// player how they are doing, and there is deliberately no result view anywhere
// in this file — the Café does not route through PlayerShell, whose ResultView
// prints "Passed!" and a proficiency, and §11 forbids both.
//
// The third beat is written on the server, about the path this player actually
// took (ADR-006 §7). It is asked for the instant the second beat commits, so it
// generates while that consequence is still being read, and it is abandoned at
// four seconds — past that the building's own authored bank serves it, and
// nothing the player sees differs. That is not a degraded path; it is the same
// question from a different pen.
import { api, type SubmitResponse } from "@/framework/api";
import { CLIENT_VERSION } from "@/framework/config/appConfig";
import type { Beat } from "./missions";
import { resolveSpeaker } from "./missions";
import { followupFor } from "./followups";
import type { TransferBeat } from "@/framework/interior/transfer";
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
  generated?: TransferBeat | null,
): DialogueState | null {
  const speaker = resolveSpeaker(mission, present as never);

  if (beat === "transfer") {
    // Generated, when one arrived in time. Rendered by the same dialogue layer,
    // in the same shape, with the same three look-alike options — there is
    // deliberately no presentation that marks it out.
    if (generated) {
      return {
        beat,
        speaker: present.includes(generated.speakerId) ? generated.speakerId : speaker,
        prompt: generated.prompt,
        options: generated.options.map((o) => ({ id: o.id, text: o.text })),
      };
    }
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
 * `followupId` and `followupChoice` are what make the third beat count. With
 * them the mission scores 0.42 seed / 0.28 follow / 0.30 transfer; without them
 * it scores on the authored terminal alone, which is what the rubric's
 * `aiBeat.required: false` exists for and is exactly right when the beat came
 * from the bank. Either way the client learns nothing: the tier is resolved from
 * the option id on the server and never leaves it.
 *
 * Failure is not exceptional — a flaky connection, an expired session. The
 * caller keeps the trace and retries later. **The room moves on the trace, never
 * on the score** (PRD §19.7).
 */
export async function submitDecision(
  activityId: string,
  taken: DecisionSoFar,
  durationSec: number,
  followup?: { id: string; choice: string } | null,
): Promise<SubmitResponse | null> {
  if (!taken.seed || !taken.follow) return null;
  try {
    return await api.submit(activityId, {
      clientVersion: CLIENT_VERSION,
      durationSec: Math.max(0, Math.round(durationSec)),
      hintsUsed: 0,
      result: {
        trace: {
          path: tracePath(activityId, taken.seed, taken.follow),
          ...(followup ? { followupId: followup.id, followupChoice: followup.choice } : {}),
        },
      },
    });
  } catch {
    return null;
  }
}

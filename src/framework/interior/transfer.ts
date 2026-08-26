// The third beat — the one written for this player, about the path this player
// actually took (ADR-006 §7).
//
// Two authored beats ask *what do you do* and *now that the world has answered,
// what do you do*. They measure judgment and consistency. Neither measures
// **transfer**: whether the reasoning survives contact with a shape the learner
// has not read before. This is the beat that does, and it cannot be pre-read or
// looked up, because it did not exist until they answered the second one.
//
// Everything about it that matters is on the server: the prompt template, the
// personas, the tiers, the rationale, the key. What arrives here is three
// sentences and three opaque ids.
//
// **A player must never be able to tell which beat was generated.** That rules
// out a spinner, a badge, a different animation, a "thinking…" line, and any
// wording that treats this beat as special. It is why the request is fired the
// instant the second beat commits — so it generates while that consequence is
// still being read — and why it is abandoned at four seconds rather than waited
// on. A question that arrives late is a broken conversation, and the building's
// own authored bank is a perfectly good question.
import { api, ApiError } from "@/framework/api";

/** How long a generated beat has to arrive before the bank is served instead. */
const DEADLINE_MS = 4000;

export interface TransferBeat {
  /** The server's handle for this question. Needed to commit and to score. */
  followupId: string;
  speakerId: string;
  speakerName: string;
  prompt: string;
  options: ReadonlyArray<{ id: string; text: string }>;
}

export interface TransferRequest {
  activityId: string;
  track: "SCA" | "SCB";
  buildingId: string;
  /** The seed choice and the follow-up choice, in that order. */
  path: [string, string];
  speakerId?: string;
  worldState?: Record<string, string>;
}

/** One in flight, or one in hand, per activity. */
const inflight = new Map<string, Promise<TransferBeat | null>>();

/**
 * Ask for the beat. Fire-and-forget: call it the moment the second beat commits,
 * and collect it later with `awaitTransfer`.
 *
 * Calling twice for the same activity is harmless — the second call joins the
 * first, and the server re-serves a question already waiting on this path rather
 * than writing a new one.
 */
export function requestTransfer(req: TransferRequest): void {
  if (inflight.has(req.activityId)) return;
  inflight.set(req.activityId, fetchWithin(req));
}

/**
 * The beat, or null when the room should use its own.
 *
 * Never rejects. Every failure — no network, an expired session, a deadline, a
 * server that has no aiBeat block for this activity — is the same answer to the
 * caller: use the bank, and say nothing.
 */
export function awaitTransfer(activityId: string): Promise<TransferBeat | null> {
  return inflight.get(activityId) ?? Promise.resolve(null);
}

/**
 * Commit a choice and receive its consequence.
 *
 * The three consequences are not shipped with the options on purpose: three
 * consequences in one payload are three hints at which option is which, and a
 * player reading the network tab would have the answer key.
 *
 * Returns null when the server cannot be reached, which the room reads as "close
 * the mission anyway". The room moves on the trace and never on the score.
 */
export async function commitTransfer(
  followupId: string,
  optionId: string,
): Promise<{ consequence: string; world?: Record<string, string> } | null> {
  try {
    const res = await api.commitFollowup(followupId, optionId);
    return { consequence: res.consequence, world: res.world };
  } catch (e) {
    // A decision is a decision: committing the same option twice returns the
    // original, and the server says so with a 409 rather than a body we can use.
    // Anything else is a network or auth failure and reads the same way here.
    if (e instanceof ApiError && e.httpStatus === 409) {
      const body = e.body as { consequence?: string; world?: Record<string, string> } | null;
      if (body?.consequence) return { consequence: body.consequence, world: body.world };
    }
    return null;
  }
}

/** Drop the held beat — the mission closed, or the season was reset. */
export function forgetTransfer(activityId: string): void {
  inflight.delete(activityId);
}

/** Tests only. */
export function resetTransfers(): void {
  inflight.clear();
}

async function fetchWithin(req: TransferRequest): Promise<TransferBeat | null> {
  let timer: number | undefined;
  const deadline = new Promise<null>((resolve) => {
    timer = window.setTimeout(() => resolve(null), DEADLINE_MS);
  });

  try {
    const beat = await Promise.race([call(req), deadline]);
    return beat;
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}

async function call(req: TransferRequest): Promise<TransferBeat | null> {
  try {
    const res = await api.aiFollowup(req);
    return {
      followupId: res.followupId,
      speakerId: res.speaker.id,
      speakerName: res.speaker.name,
      prompt: res.prompt,
      options: res.options.map((o) => ({ id: o.id, text: o.text })),
    };
  } catch {
    return null;
  }
}

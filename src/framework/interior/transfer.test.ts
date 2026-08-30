import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { awaitTransfer, commitTransfer, requestTransfer, resetTransfers } from "./transfer";
import { api, ApiError } from "@/framework/api";
import { events } from "@/framework/events";

const REQ = {
  activityId: "C1-SCA-01",
  track: "SCA" as const,
  buildingId: "cafe",
  path: ["c", "b"] as [string, string],
  speakerId: "nadia",
};

const BEAT = {
  followupId: "fu_1",
  speaker: { id: "nadia", name: "Nadia", role: "the commuter" },
  prompt: "You going to keep doing this every time they move?",
  options: [
    { id: "o_1", text: "one" },
    { id: "o_2", text: "two" },
    { id: "o_3", text: "three" },
  ],
};

beforeEach(() => resetTransfers());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("asking for the third beat", () => {
  it("hands back what the server wrote", async () => {
    vi.spyOn(api, "aiFollowup").mockResolvedValue(BEAT);
    requestTransfer(REQ);
    const beat = await awaitTransfer(REQ.activityId);
    expect(beat?.followupId).toBe("fu_1");
    expect(beat?.speakerName).toBe("Nadia");
    expect(beat?.options).toHaveLength(3);
  });

  // The whole reason it is fired on beat two's commit rather than awaited on
  // beat three's opening: one request, generating behind a consequence.
  it("joins a request already in flight rather than starting a second", async () => {
    const call = vi.spyOn(api, "aiFollowup").mockResolvedValue(BEAT);
    requestTransfer(REQ);
    requestTransfer(REQ);
    await awaitTransfer(REQ.activityId);
    expect(call).toHaveBeenCalledTimes(1);
  });

  // A question that arrives late is a broken conversation. Past the deadline the
  // room uses its own, and the player is never told either happened.
  it("gives up at four seconds", async () => {
    vi.useFakeTimers();
    vi.spyOn(api, "aiFollowup").mockImplementation(() => new Promise(() => {}));
    requestTransfer(REQ);
    const pending = awaitTransfer(REQ.activityId);
    await vi.advanceTimersByTimeAsync(4100);
    await expect(pending).resolves.toBeNull();
    vi.useRealTimers();
  });

  it("answers null rather than throwing when the server cannot be reached", async () => {
    vi.spyOn(api, "aiFollowup").mockRejectedValue(new Error("offline"));
    requestTransfer(REQ);
    await expect(awaitTransfer(REQ.activityId)).resolves.toBeNull();
  });

  it("answers null for an activity nobody asked about", async () => {
    await expect(awaitTransfer("C9-SCB-01")).resolves.toBeNull();
  });
});

describe("committing a choice", () => {
  it("returns the consequence and the world write", async () => {
    vi.spyOn(api, "commitFollowup").mockResolvedValue({
      consequence: "The card comes down and nobody mentions it.",
      world: { chalkboard: "oat" },
    });
    await expect(commitTransfer("fu_1", "o_2")).resolves.toEqual({
      consequence: "The card comes down and nobody mentions it.",
      world: { chalkboard: "oat" },
    });
  });

  // A decision is a decision. Committing twice — a double click, a retry after a
  // dropped response — must show the same thing, not an error.
  it("takes the original back on a second commit", async () => {
    vi.spyOn(api, "commitFollowup").mockRejectedValue(
      new ApiError("HTTP_ERROR", "already committed", 409, "", {
        consequence: "Eleven regular early-trainers, mostly midweek.",
        world: { regulars: "steady" },
      }),
    );
    const res = await commitTransfer("fu_1", "o_2");
    expect(res?.consequence).toContain("early-trainers");
  });

  // The room moves on the trace, never on the score: a dropped connection does
  // not get to take back a decision the player has made.
  it("answers null rather than throwing when the commit cannot land", async () => {
    vi.spyOn(api, "commitFollowup").mockRejectedValue(new Error("offline"));
    await expect(commitTransfer("fu_1", "o_2")).resolves.toBeNull();
  });
});

// Every test above mocks api.aiFollowup/api.commitFollowup directly, which
// bypasses ApiClient.perform() entirely — including its retry loop and the
// "Reconnecting…" toast on each attempt. That's exactly the boundary a
// production incident lived on, so this drives the real api singleton against
// a stubbed fetch instead.
describe("under a real, hard backend failure", () => {
  it("falls back to the bank within its own retry budget, and never tells the player", async () => {
    const serverError = { error: { code: "SERVER_ERROR", message: "down" } };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        text: async () => JSON.stringify(serverError),
      })),
    );
    const toasts: string[] = [];
    const offToast = events.on("toast", ({ message }) => toasts.push(message));

    vi.useFakeTimers();
    requestTransfer(REQ);
    const pending = awaitTransfer(REQ.activityId);
    // The retry backoff (500 ms + 1000 ms) is well inside the 4 s deadline. If
    // this needed the full 4100 ms to resolve — the figure the "gives up at
    // four seconds" test above advances by — it would mean the retries are no
    // longer exhausting on their own and this is resolving via the deadline
    // timer instead, which is a different (and slower) code path than the one
    // under test here.
    await vi.advanceTimersByTimeAsync(2000);
    await expect(pending).resolves.toBeNull();
    vi.useRealTimers();

    offToast();
    expect(toasts).toEqual([]);
  });
});

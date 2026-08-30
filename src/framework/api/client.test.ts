import { describe, it, expect, vi, afterEach } from "vitest";
import { ApiClient } from "./client";

const tokens = { getIdToken: async () => "tok" };

/** One canned response per call, in order. */
function stubFetch(...responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    // Real fetch rejects immediately, before any network activity, when handed
    // an already-aborted signal — mirror that so the abort tests are honest.
    if (init.signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
    calls.push({
      url,
      method: init.method ?? "GET",
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });
    const r = responses.shift() ?? { status: 200, body: {} };
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      text: async () => JSON.stringify(r.body),
    } as Response;
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("state writes", () => {
  it("returns the ack when the write lands", async () => {
    stubFetch({ status: 200, body: { rev: 4, updatedAt: "2026-08-26T10:00:00Z" } });
    const res = await new ApiClient(tokens).putCityState(3, { track: "SCA" });
    expect(res).toEqual({ ok: true, rev: 4, updatedAt: "2026-08-26T10:00:00Z" });
  });

  // The case two tabs in the same building produce. A 409 is not something a
  // player should ever see: it carries the server's current document so the
  // caller can resolve in one round trip, and throwing it would cost a second.
  it("returns the server's document on a lost race instead of throwing", async () => {
    stubFetch({
      status: 409,
      body: {
        error: { code: "STALE_REVISION", message: "stale" },
        rev: 9,
        blob: { missionOrder: 4 },
        updatedAt: "2026-08-26T11:00:00Z",
      },
    });
    const res = await new ApiClient(tokens).putBuildingState("cafe", 3, { missionOrder: 2 }, "SCA");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.rev).toBe(9);
    expect(res.blob).toEqual({ missionOrder: 4 });
  });

  it("still throws on a real failure", async () => {
    stubFetch({ status: 400, body: { error: { code: "BAD_REQUEST", message: "no" } } });
    await expect(new ApiClient(tokens).putCityState(0, {})).rejects.toThrow();
  });
});

// A production incident traced to exactly this gap: the retry budget below is
// correct in isolation (bounded, backs off), but nothing distinguished a call
// that is allowed to tell the player it's struggling from one that isn't —
// so a hard-down backend meant a "Reconnecting…" toast on every save and every
// follow-up fetch, which is precisely what ADR-006 §7.4/§11 forbid.
describe("retrying a hard failure", () => {
  const serverError = { status: 500, body: { error: { code: "SERVER_ERROR", message: "down" } } };
  const attempts = () => [serverError, serverError, serverError]; // initial + MAX_RETRIES

  it("retries with backoff and toasts on each attempt, by default", async () => {
    const calls = stubFetch(...attempts());
    const onRetryToast = vi.fn();
    vi.useFakeTimers();
    const pending = new ApiClient(tokens, { onRetryToast }).getWallet();
    const assertion = expect(pending).rejects.toThrow();
    await vi.runAllTimersAsync();
    await assertion;
    vi.useRealTimers();
    expect(calls).toHaveLength(3);
    expect(onRetryToast).toHaveBeenCalledTimes(2);
  });

  it("retries the same way but never toasts for a path with its own fallback", async () => {
    // putCityState (session state, ADR-006 §11) — same bounded retry, no toast.
    const calls = stubFetch(...attempts());
    const onRetryToast = vi.fn();
    vi.useFakeTimers();
    const pending = new ApiClient(tokens, { onRetryToast }).putCityState(0, {});
    const assertion = expect(pending).rejects.toThrow();
    await vi.runAllTimersAsync();
    await assertion;
    vi.useRealTimers();
    expect(calls).toHaveLength(3);
    expect(onRetryToast).not.toHaveBeenCalled();
  });

  it("never toasts the AI follow-up either, and honours an abort without retrying", async () => {
    const calls = stubFetch(...attempts());
    const onRetryToast = vi.fn();
    const controller = new AbortController();
    const client = new ApiClient(tokens, { onRetryToast });
    const pending = client.aiFollowup(
      { activityId: "C1-SCA-01", track: "SCA", buildingId: "cafe", path: ["c", "b"] },
      controller.signal,
    );
    controller.abort();
    await expect(pending).rejects.toThrow();
    // No network attempt at all, and certainly not three: an abort must not
    // spend the retry budget re-fetching something the caller (the transfer
    // beat's own deadline) has already stopped waiting for.
    expect(calls).toHaveLength(0);
    expect(onRetryToast).not.toHaveBeenCalled();
  });
});

describe("the transfer beat", () => {
  it("sends the path and parses three options", async () => {
    const calls = stubFetch({
      status: 200,
      body: {
        followupId: "fu_1",
        speaker: { id: "nadia", name: "Nadia", role: "the commuter" },
        prompt: "You going to keep doing this every time they move?",
        options: [
          { id: "o_1", text: "one" },
          { id: "o_2", text: "two" },
          { id: "o_3", text: "three" },
        ],
      },
    });
    const beat = await new ApiClient(tokens).aiFollowup({
      activityId: "C1-SCA-01",
      track: "SCA",
      buildingId: "cafe",
      path: ["c", "b"],
      speakerId: "nadia",
    });
    expect(beat.options).toHaveLength(3);
    expect(calls[0].body).toMatchObject({ path: ["c", "b"], activityId: "C1-SCA-01" });
  });

  // The silent-tier contract, held at the boundary. If a tier ever appears in a
  // payload it must not reach a store, a component, or a devtools panel.
  it("drops anything the server should not have sent", async () => {
    stubFetch({
      status: 200,
      body: {
        followupId: "fu_1",
        speaker: { id: "nadia", name: "Nadia", role: "the commuter" },
        prompt: "…",
        options: [
          { id: "o_1", text: "one", tier: "advanced", consequence: "leaked" },
          { id: "o_2", text: "two", tier: "strong" },
          { id: "o_3", text: "three", tier: "developing" },
        ],
      },
    });
    const beat = await new ApiClient(tokens).aiFollowup({
      activityId: "C1-SCA-01",
      track: "SCA",
      buildingId: "cafe",
      path: ["c", "b"],
    });
    expect(JSON.stringify(beat)).not.toContain("advanced");
    expect(JSON.stringify(beat)).not.toContain("leaked");
  });
});

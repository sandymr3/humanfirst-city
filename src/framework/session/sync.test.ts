import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  armBeacon,
  flushSession,
  hydrateSession,
  readSession,
  resetSessionSync,
  writeSession,
  writeSessionNow,
} from "./sync";
import { api } from "@/framework/api";

const CAFE = "cafe";

beforeEach(() => {
  resetSessionSync();
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("hydrating a season", () => {
  it("takes the server's copy when it is the newer one", async () => {
    vi.spyOn(api, "getBuildingState").mockResolvedValue({
      rev: 5,
      blob: { missionOrder: 6 },
      updatedAt: "2026-08-26T12:00:00Z",
      buildingId: CAFE,
      track: "SCA",
    });
    vi.spyOn(api, "getBeaconToken").mockResolvedValue({ beaconToken: "t", expiresAt: "" });

    await hydrateSession(CAFE);
    expect(readSession(CAFE)).toEqual({ missionOrder: 6 });
  });

  // A backend that is not there degrades to exactly the behaviour this had
  // before it existed: localStorage, pushed on the next good load.
  it("keeps the local season when the server cannot be reached", async () => {
    vi.spyOn(api, "putBuildingState").mockResolvedValue({ ok: true, rev: 1, updatedAt: "" });
    writeSessionNow(CAFE, { missionOrder: 3 });

    vi.spyOn(api, "getBuildingState").mockRejectedValue(new Error("offline"));
    vi.spyOn(api, "getBeaconToken").mockRejectedValue(new Error("offline"));

    await expect(hydrateSession(CAFE)).resolves.toBeUndefined();
    expect(readSession(CAFE)).toEqual({ missionOrder: 3 });
  });
});

describe("the write schedule", () => {
  it("coalesces a walk across the room into one request", async () => {
    const put = vi
      .spyOn(api, "putBuildingState")
      .mockResolvedValue({ ok: true, rev: 1, updatedAt: "" });

    writeSession(CAFE, { objectiveIndex: 1 });
    writeSession(CAFE, { objectiveIndex: 2 });
    writeSession(CAFE, { objectiveIndex: 3 });
    expect(put).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(900);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][2]).toEqual({ objectiveIndex: 3 });
  });

  // A decision the server never heard about is a decision that did not happen.
  it("sends a committed beat immediately, cancelling anything queued", async () => {
    const put = vi
      .spyOn(api, "putBuildingState")
      .mockResolvedValue({ ok: true, rev: 1, updatedAt: "" });

    writeSession(CAFE, { objectiveIndex: 1 });
    writeSessionNow(CAFE, { partialPath: ["c", "b"] });
    expect(put).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(900);
    expect(put).toHaveBeenCalledTimes(1);
  });

  // The 409 storm. `rev` is only accurate between requests, so two pushes in
  // flight together both read the same one, and the second is stale the moment
  // the first lands. Production was running a ~40% conflict rate on this
  // endpoint; every one of them was this, and the retry underneath hid it.
  it("never sends a revision the previous write has already superseded", async () => {
    let served = 0;
    const seen: number[] = [];
    const put = vi.spyOn(api, "putBuildingState").mockImplementation(async (_b, rev) => {
      seen.push(rev);
      // The server's rule, exactly: anything below the stored revision loses.
      if (rev < served) return { ok: false as const, rev: served, blob: null, updatedAt: "" };
      served += 1;
      return { ok: true as const, rev: served, updatedAt: "" };
    });

    // A beat commits while the walk that preceded it is still on the wire.
    writeSessionNow(CAFE, { step: 1 });
    writeSessionNow(CAFE, { step: 2 });
    writeSessionNow(CAFE, { step: 3 });
    await vi.advanceTimersByTimeAsync(0);
    await vi.waitFor(() => expect(put).toHaveBeenCalled());

    // Every write carried a revision the server accepted: no conflicts, and so
    // no retries either.
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(put.mock.results.length).toBe(seen.length);
    for (const rev of seen) expect(rev).toBeGreaterThanOrEqual(0);
    const conflicts = await Promise.all(put.mock.results.map((r) => r.value));
    expect(conflicts.filter((r) => !(r as { ok: boolean }).ok)).toHaveLength(0);
  });

  // Coalescing has to survive the in-flight guard: writes that pile up behind
  // one request collapse into a single follow-up, because the blob is a whole
  // snapshot and the newest one describes everything the older ones did.
  it("collapses everything that piles up behind one request", async () => {
    let release: (() => void) | null = null;
    const first = new Promise<void>((r) => (release = r));
    let call = 0;
    const put = vi.spyOn(api, "putBuildingState").mockImplementation(async (_b, _rev, blob) => {
      call += 1;
      if (call === 1) await first;
      return { ok: true as const, rev: call, updatedAt: "", blob } as never;
    });

    writeSessionNow(CAFE, { step: 1 }); // goes on the wire, and blocks there
    writeSessionNow(CAFE, { step: 2 }); // both of these queue behind it,
    writeSessionNow(CAFE, { step: 3 }); // and only the newest survives
    expect(put).toHaveBeenCalledTimes(1);

    release!();
    await vi.waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(put.mock.calls[1][2]).toEqual({ step: 3 });
  });
});

describe("the way out", () => {
  it("goes by sendBeacon, carrying the token in the body", async () => {
    vi.spyOn(api, "getBuildingState").mockResolvedValue({
      rev: 2,
      blob: null,
      updatedAt: "",
      buildingId: CAFE,
    });
    vi.spyOn(api, "getBeaconToken").mockResolvedValue({ beaconToken: "beacon-1", expiresAt: "" });
    await hydrateSession(CAFE);

    const sent: Array<{ url: string; body: string }> = [];
    vi.stubGlobal("navigator", {
      sendBeacon: (url: string, blob: Blob) => {
        // Blob.text() is async; the body is read from the constructor argument
        // in the stub below instead.
        sent.push({ url, body: (blob as Blob & { __body?: string }).__body ?? "" });
        return true;
      },
    });
    vi.stubGlobal(
      "Blob",
      class {
        __body: string;
        type: string;
        constructor(parts: string[], opts?: { type?: string }) {
          this.__body = parts.join("");
          this.type = opts?.type ?? "";
        }
      },
    );

    flushSession(CAFE, { missionOrder: 4 });

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toContain("/api/v1/city/buildings/cafe/state");
    const body = JSON.parse(sent[0].body);
    expect(body).toMatchObject({ rev: 2, beaconToken: "beacon-1", blob: { missionOrder: 4 } });
  });

  // No token, or a browser that refuses the beacon: the season still has to
  // land. An ordinary authed write is the fallback, and it is not optional.
  it("falls back to an authed write when there is no beacon to send", async () => {
    const put = vi
      .spyOn(api, "putBuildingState")
      .mockResolvedValue({ ok: true, rev: 1, updatedAt: "" });
    vi.spyOn(api, "getBeaconToken").mockRejectedValue(new Error("no token"));
    await armBeacon(CAFE);

    flushSession(CAFE, { missionOrder: 4 });
    await vi.advanceTimersByTimeAsync(0);
    expect(put).toHaveBeenCalledTimes(1);
  });
});

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

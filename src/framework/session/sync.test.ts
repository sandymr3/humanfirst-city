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
import { auth } from "@/framework/auth/firebase";

// Every key in sync.ts is scoped by the signed-in uid — see currentUid()'s own
// comment for why. Mocked here so a test can play two different accounts in
// one "tab"; every test not in the describe block below runs as `asUser(null)`,
// which is the same "anon" bucket the whole file used before that scoping
// existed, so it changes nothing for them.
vi.mock("@/framework/auth/firebase", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/framework/auth/firebase")>();
  return { ...actual, auth: vi.fn() };
});
vi.mock("@/framework/config/appConfig", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/framework/config/appConfig")>();
  return { ...actual, isConfigured: () => true };
});

const CAFE = "cafe";
const asUser = (uid: string | null) =>
  vi.mocked(auth).mockReturnValue({ currentUser: uid ? { uid } : null } as ReturnType<typeof auth>);

beforeEach(() => {
  resetSessionSync();
  localStorage.clear();
  vi.useFakeTimers();
  asUser(null);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// The bug this locks down: every key here used to be keyed on buildingId
// alone, so two different accounts signed into the same browser shared
// exactly one `city.cafe.session` entry — in memory and in localStorage
// alike. The second account's very first hydrate saw the first account's
// blob as "newer than nothing the server has for me", adopted it, and
// hydrateSession's own "ours is newer, push it" branch then wrote it onto
// the second account's own server row: a finished CEO run, appearing under
// a brand-new account, permanently.
describe("scoping the mirror to whoever is actually signed in", () => {
  it("never lets one account's local mirror answer for a different account's hydrate", async () => {
    const put = vi
      .spyOn(api, "putBuildingState")
      .mockResolvedValue({ ok: true, rev: 1, updatedAt: "" });
    vi.spyOn(api, "getBeaconToken").mockResolvedValue({ beaconToken: "t", expiresAt: "" });

    // User A finishes a run; it lands in the mirror under their own uid. Let
    // the write's own fire-and-forget push settle before moving on — this is
    // a prior, already-closed session's leftovers, not a request racing the
    // account switch itself.
    asUser("user-a");
    writeSessionNow(CAFE, { role: "ceo", revenue: 6050 });
    await vi.advanceTimersByTimeAsync(0);
    expect(readSession(CAFE)).toEqual({ role: "ceo", revenue: 6050 });

    // Same tab, no reload — a different account signs in. The server
    // genuinely has nothing for them yet.
    asUser("user-b");
    put.mockClear();
    vi.spyOn(api, "getBuildingState").mockResolvedValue({
      rev: 0,
      blob: null,
      updatedAt: "",
      buildingId: CAFE,
    });

    await hydrateSession(CAFE);

    // User B starts clean. Not user A's run, and nothing pushed to the
    // server claiming it as theirs.
    expect(readSession(CAFE)).toBeNull();
    expect(put).not.toHaveBeenCalled();
  });

  it("keeps each account's in-memory write schedule separate too", async () => {
    // Not just the localStorage mirror: the in-memory Live cache (timers,
    // pending writes) was keyed on buildingId alone as well, so a debounced
    // write queued as user A would still be sitting there — and would fire
    // under user B's identity — if only the storage key were fixed.
    const put = vi
      .spyOn(api, "putBuildingState")
      .mockResolvedValue({ ok: true, rev: 1, updatedAt: "" });

    asUser("user-a");
    writeSession(CAFE, { objectiveIndex: 1 });

    asUser("user-b");
    writeSession(CAFE, { objectiveIndex: 99 });

    await vi.advanceTimersByTimeAsync(900);

    // Both fire — they are different accounts' timers, not one coalesced
    // into the other's — and neither is user B's blob read back for user A.
    expect(put).toHaveBeenCalledTimes(2);
    const bodies = put.mock.calls.map((c) => c[2]);
    expect(bodies).toContainEqual({ objectiveIndex: 1 });
    expect(bodies).toContainEqual({ objectiveIndex: 99 });
  });
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

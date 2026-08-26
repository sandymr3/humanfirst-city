import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { hydrateCityState, chooseTrack, resetCityState } from "./cityState";
import { activeTrack, forgetTrack } from "./track";
import { api } from "@/framework/api";

beforeEach(() => {
  resetCityState();
  forgetTrack();
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("the track follows the player, not the browser", () => {
  it("adopts the server's answer on a device that has never been asked", async () => {
    vi.spyOn(api, "getCityState").mockResolvedValue({
      rev: 3,
      blob: { track: "SCB" },
      updatedAt: "",
    });
    await hydrateCityState();
    expect(activeTrack()).toBe("SCB");
  });

  // An answer given while the backend was unreachable is still an answer. It
  // goes up on the next good boot rather than being asked again.
  it("pushes a local answer the server has never seen", async () => {
    vi.spyOn(api, "getCityState").mockResolvedValue({ rev: 0, blob: null, updatedAt: "" });
    const put = vi
      .spyOn(api, "putCityState")
      .mockResolvedValue({ ok: true, rev: 1, updatedAt: "" });

    await chooseTrack("SCA");
    resetCityState();
    await hydrateCityState();

    expect(put).toHaveBeenCalled();
    expect(activeTrack()).toBe("SCA");
  });

  // A city you cannot reach is a city you can still walk around.
  it("survives a backend that is not there", async () => {
    vi.spyOn(api, "getCityState").mockRejectedValue(new Error("offline"));
    vi.spyOn(api, "putCityState").mockRejectedValue(new Error("offline"));
    await expect(hydrateCityState()).resolves.toBeUndefined();
    await expect(chooseTrack("SCB")).resolves.toBeUndefined();
    expect(activeTrack()).toBe("SCB");
  });

  // Two tabs answering the same question should agree rather than fight.
  it("re-applies its answer over a document that landed first", async () => {
    const put = vi
      .spyOn(api, "putCityState")
      .mockResolvedValueOnce({
        ok: false,
        rev: 7,
        blob: { ftue: { walked: true } },
        updatedAt: "",
      })
      .mockResolvedValueOnce({ ok: true, rev: 8, updatedAt: "" });

    await chooseTrack("SCB");

    expect(put).toHaveBeenCalledTimes(2);
    expect(put.mock.calls[1][0]).toBe(7);
    expect(put.mock.calls[1][1]).toMatchObject({ track: "SCB", ftue: { walked: true } });
  });
});

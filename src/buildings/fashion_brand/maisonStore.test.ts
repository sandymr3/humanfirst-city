import { describe, it, expect, beforeEach } from "vitest";
import { useMaisonStore } from "./maisonStore";
import { INITIAL_WORLD } from "./world";

const STORAGE_KEY = "city.maison.v1";

describe("MAISON season store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useMaisonStore.setState({
      track: null,
      opening: { ...INITIAL_WORLD },
      world: { ...INITIAL_WORLD },
      decided: [],
    });
  });

  it("starts with no track chosen — the threshold question comes first (§14)", () => {
    expect(useMaisonStore.getState().track).toBeNull();
    expect(useMaisonStore.getState().decided).toEqual([]);
  });

  it("starts a fresh season on the chosen track and persists it", () => {
    useMaisonStore.getState().chooseTrack("B");
    expect(useMaisonStore.getState().track).toBe("B");
    expect(useMaisonStore.getState().world.cash).toBe("tight"); // the inherited house
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('"track":"B"');
  });

  it("moves the house when a beat is decided, and keeps the path", () => {
    useMaisonStore.getState().chooseTrack("A");
    useMaisonStore.getState().recordDecision("C2-SCA-03", ["c", "b"], {
      rail: "thin",
      cash: "tight",
    });

    const s = useMaisonStore.getState();
    expect(s.world.rail).toBe("thin");
    expect(s.world.cash).toBe("tight");
    expect(s.decided).toEqual([{ id: "C2-SCA-03", path: ["c", "b"] }]);
  });

  it("remembers where the collection opened, so the lookbook can show the diff", () => {
    useMaisonStore.getState().chooseTrack("A");
    useMaisonStore.getState().recordDecision("C2-SCA-03", ["c", "b"], { rail: "thin" });

    expect(useMaisonStore.getState().opening.rail).toBe("bold");
    expect(useMaisonStore.getState().world.rail).toBe("thin");
  });

  it("replaces a re-decided beat rather than logging both drafts", () => {
    useMaisonStore.getState().chooseTrack("A");
    useMaisonStore.getState().recordDecision("C2-SCA-03", ["b", "a"], { rail: "mixed" });
    useMaisonStore.getState().recordDecision("C2-SCA-03", ["a", "c"], { rail: "neutral" });

    expect(useMaisonStore.getState().decided).toEqual([{ id: "C2-SCA-03", path: ["a", "c"] }]);
    expect(useMaisonStore.getState().world.rail).toBe("neutral");
  });

  it("ignores a delta the world model does not recognise", () => {
    useMaisonStore.getState().chooseTrack("A");
    const before = { ...useMaisonStore.getState().world };
    useMaisonStore.getState().recordDecision("C1-SCA-03", ["a", "a"], {
      rail: "tartan",
      vibes: "ominous",
    });

    // The beat still counts as decided and the season still advances — the
    // countdown is chalked from the spine, not from the leaf — but nothing the
    // house shows moved on a delta it does not understand.
    const after = useMaisonStore.getState();
    expect({ ...after.world, countdown: before.countdown }).toEqual(before);
    expect(after.decided.map((d) => d.id)).toEqual(["C1-SCA-03"]);
  });

  it("advances the countdown as the season is decided (§3.5)", () => {
    useMaisonStore.getState().chooseTrack("A");
    expect(useMaisonStore.getState().world.countdown).toBe("11w");

    useMaisonStore.getState().recordDecision("C1-SCA-03", ["a", "a"], { rail: "capsule" });
    expect(useMaisonStore.getState().world.countdown).toBe("9w");

    useMaisonStore.getState().recordDecision("C2-SCA-03", ["b", "a"], { rail: "mixed" });
    expect(useMaisonStore.getState().world.countdown).toBe("8w");
  });

  it("resets the collection but keeps the track you are on", () => {
    useMaisonStore.getState().chooseTrack("B");
    useMaisonStore.getState().recordDecision("C5-SCB-03", ["c", "a"], { rail: "collab" });
    useMaisonStore.getState().resetSeason();

    const s = useMaisonStore.getState();
    expect(s.track).toBe("B");
    expect(s.world.rail).toBe("bold");
    expect(s.decided).toEqual([]);
  });

  it("survives a storage write failing — persistence is best-effort", () => {
    const original = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(() => useMaisonStore.getState().chooseTrack("A")).not.toThrow();
    expect(useMaisonStore.getState().track).toBe("A");
    window.localStorage.setItem = original;
  });
});

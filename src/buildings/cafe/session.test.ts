import { describe, it, expect, beforeEach } from "vitest";
import {
  clearSeason,
  freshSeason,
  fromBlob,
  loadSeason,
  saveSeason,
  toBlob,
  type Season,
} from "./session";
import { OPENING_WORLD } from "./world";
import { MISSIONS } from "./missions";

const played: Season = {
  progress: { missionOrder: 3, objectiveIndex: 4 },
  world: { ...OPENING_WORLD, chalkboard: "oat_asked", regulars: "thin", till: "healthy" },
  taken: { seed: "c" },
  visitors: ["nadia"],
  playerCell: { x: 9, y: 4 },
  unsent: [{ activityId: "C1-HARD-01", taken: { seed: "c", follow: "b" }, durationSec: 412 }],
  decided: [{ activityId: "C1-HARD-01", seed: "c", follow: "b", transfer: "o_c1a" }],
};

beforeEach(() => {
  clearSeason();
});

describe("the season's save format", () => {
  it("is the document the server is going to want", () => {
    // PRD §19.2. Written in the server's shape now so the swap to BE-15/16 is
    // one implementation rather than a migration across save formats.
    //
    // `decided` is the one Café extension to that document: the end-of-season
    // report is built from the trail (§13.2), and a trail that does not survive
    // leaving is a report only somebody who played nine missions without ever
    // shutting the laptop would ever see.
    const blob = toBlob(played);
    expect(Object.keys(blob).sort()).toEqual(
      [
        "missionOrder",
        "objectiveIndex",
        "partialPath",
        "pendingFollowupId",
        "playerCell",
        "unsent",
        "visitors",
        "world",
        "decided",
      ].sort(),
    );
    expect(blob.missionOrder).toBe(3);
    expect(blob.objectiveIndex).toBe(4);
    expect(blob.partialPath).toEqual(["c"]);
    expect(blob.playerCell).toEqual([9, 4]);
    expect(Object.keys(blob.world)).toHaveLength(10);
  });

  it("stays comfortably inside the server's 16 KB cap", () => {
    const bytes = JSON.stringify(toBlob(played)).length;
    expect(bytes, `${bytes} bytes`).toBeLessThan(16 * 1024);
  });

  it("survives a round trip with everything intact", () => {
    const back = fromBlob(toBlob(played));
    expect(back).toEqual(played);
  });

  it("keeps the partial path in beat order, not in whatever order it was written", () => {
    const mid = { ...played, taken: { seed: "a", follow: "c" } };
    expect(toBlob(mid).partialPath).toEqual(["a", "c"]);
    expect(fromBlob(toBlob(mid))?.taken).toEqual({ seed: "a", follow: "c" });
  });
});

// A save sitting in a browser across a content change is the normal case, not
// the exotic one. The failure to avoid is a resume into a mission that no longer
// exists holding a world state that no longer renders.
describe("resuming from a save that has gone stale", () => {
  it("refuses anything that is not a blob", () => {
    for (const junk of [null, undefined, 42, "season", [], {}, { missionOrder: 1 }]) {
      expect(fromBlob(junk), JSON.stringify(junk)).toBeNull();
    }
  });

  it("drops world values it no longer recognises rather than storing them", () => {
    const blob = {
      ...toBlob(played),
      world: { ...played.world, chalkboard: "gone_from_the_enum" },
    };
    const back = fromBlob(blob);
    expect(back?.world.chalkboard).toBe(OPENING_WORLD.chalkboard);
    // and keeps the ones it does
    expect(back?.world.regulars).toBe("thin");
  });

  it("clamps a mission order that no longer exists", () => {
    expect(fromBlob({ ...toBlob(played), missionOrder: 99 })?.progress.missionOrder).toBe(
      MISSIONS.length + 1,
    );
    expect(fromBlob({ ...toBlob(played), missionOrder: -3 })?.progress.missionOrder).toBe(1);
  });

  it("never resumes into a negative objective", () => {
    expect(fromBlob({ ...toBlob(played), objectiveIndex: -5 })?.progress.objectiveIndex).toBe(0);
  });

  it("ignores a partial path longer than a decision has beats", () => {
    const back = fromBlob({ ...toBlob(played), partialPath: ["a", "b", "c", "d", "e"] });
    expect(Object.keys(back!.taken)).toHaveLength(3);
  });
});

describe("saving and loading", () => {
  it("gives back nothing when nothing has been played", () => {
    expect(loadSeason()).toBeNull();
  });

  it("walks you back into the café you made", () => {
    saveSeason(played);
    const back = loadSeason();
    expect(back?.progress).toEqual(played.progress);
    expect(back?.world.chalkboard).toBe("oat_asked");
    expect(back?.visitors).toEqual(["nadia"]);
    expect(back?.unsent).toHaveLength(1);
  });

  it("keeps the decision you had already committed this mission", () => {
    // Quitting between beats must not cost the beats already taken.
    saveSeason(played);
    expect(loadSeason()?.taken).toEqual({ seed: "c" });
  });

  it("opens a fresh season at week one with nothing decided", () => {
    const s = freshSeason();
    expect(s.progress).toEqual({ missionOrder: 1, objectiveIndex: 0 });
    expect(s.world).toEqual(OPENING_WORLD);
    expect(s.taken).toEqual({});
    expect(s.unsent).toEqual([]);
  });
});

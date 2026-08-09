import { describe, it, expect } from "vitest";
import { VENUES } from "@/world/cityMap";
import {
  BEATS,
  MAISON_ACTIVITY_IDS,
  MAISON_LEVELS,
  TRACK_LEVEL,
  STATION_NAME,
  beatForActivity,
} from "./season";

// The spine is data the whole venue is derived from — the board, the fetch list
// and the venue record all read it. If it drifts, MAISON silently loses a beat.
describe("MAISON season spine", () => {
  it("runs nine beats, C1 through C9, in order", () => {
    expect(BEATS).toHaveLength(9);
    expect(BEATS.map((b) => b.competency)).toEqual([
      "C1",
      "C2",
      "C3",
      "C4",
      "C5",
      "C6",
      "C7",
      "C8",
      "C9",
    ]);
    expect(BEATS.map((b) => b.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("names a real station and a host for every beat", () => {
    for (const b of BEATS) {
      expect(STATION_NAME[b.station], `${b.competency} station`).toBeTruthy();
      expect(b.host.length, `${b.competency} host`).toBeGreaterThan(0);
      expect(b.staging.length, `${b.competency} staging`).toBeGreaterThan(40);
    }
  });

  it("counts down, and only the last beat is after the show", () => {
    const weeks = BEATS.slice(0, 8).map((b) => Number.parseInt(b.countdown, 10));
    expect(weeks).toEqual([11, 9, 8, 7, 5, 4, 2, 1]);
    for (let i = 1; i < weeks.length; i++) expect(weeks[i]).toBeLessThan(weeks[i - 1]);
    expect(BEATS[8].countdown).toBe("after the show");
  });

  it("derives eighteen unique activity ids in the canonical slot-03 shape", () => {
    expect(MAISON_ACTIVITY_IDS).toHaveLength(18);
    expect(new Set(MAISON_ACTIVITY_IDS).size).toBe(18);
    for (const id of MAISON_ACTIVITY_IDS) expect(id).toMatch(/^C[1-9]-(HARD|PRO)-03$/);
    for (const b of BEATS) {
      expect(b.A.id).toBe(`${b.competency}-${TRACK_LEVEL.A}-03`);
      expect(b.B.id).toBe(`${b.competency}-${TRACK_LEVEL.B}-03`);
    }
  });

  it("gives every beat a distinct title on each track", () => {
    const titles = BEATS.flatMap((b) => [b.A.title, b.B.title]);
    expect(new Set(titles).size).toBe(18);
  });

  it("lists the eighteen (competency, level) pairs the board must fetch", () => {
    expect(MAISON_LEVELS).toHaveLength(18);
    expect(new Set(MAISON_LEVELS.map((l) => `${l.competency}/${l.level}`)).size).toBe(18);
  });

  it("maps an activity id back to its beat, and rejects a stranger", () => {
    expect(beatForActivity("C5-SCB-03")?.competency).toBe("C5");
    expect(beatForActivity("C2-SCA-03")?.host).toBe("Élise");
    expect(beatForActivity("C4-BEG-01")).toBeUndefined();
  });

  it("is the exact activity list the city venue hosts", () => {
    const maison = VENUES.find((v) => v.id === "fashion_brand");
    expect(maison, "fashion_brand is placed in the city").toBeDefined();
    expect(maison!.kind).toBe("scenario");
    expect(maison!.displayName).toBe("MAISON");
    expect(maison!.district).toBe("market");
    expect(maison!.hostedActivities).toEqual(MAISON_ACTIVITY_IDS);
    // A scenario venue spans nine competencies, so a single competency/level
    // pair would be a lie — ActivityListPanel must never be handed this venue.
    expect(maison!.competency).toBeUndefined();
    expect(maison!.level).toBeUndefined();
  });
});

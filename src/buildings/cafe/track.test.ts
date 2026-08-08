import { describe, it, expect, beforeEach } from "vitest";
import {
  THRESHOLD,
  activeTrack,
  activityIdFor,
  forgetTrack,
  setTrack,
  trackOrDefault,
} from "./track";
import { MISSIONS, PRO_MISSIONS, seasonFor, missionByOrder } from "./missions";
import { castFor } from "./cast";
import { OPENING_WORLD, openingWorldFor, passThroughBody } from "./world";
import { cooled, lightForWeek } from "./light";

const words = (s: string) => s.trim().split(/\s+/).length;

beforeEach(() => {
  forgetTrack();
});

describe("Priya's question at the door", () => {
  it("is asked once, and is unanswered until it is answered", () => {
    expect(activeTrack()).toBeNull();
    setTrack("PRO");
    expect(activeTrack()).toBe("PRO");
  });

  it("answers Level A for anybody who has never been asked", () => {
    // Every pure lookup in the building calls this. A null track must never
    // reach a season table.
    expect(trackOrDefault()).toBe("HARD");
  });

  it("offers exactly two answers, one per track", () => {
    expect(THRESHOLD.options).toHaveLength(2);
    expect(THRESHOLD.options.map((o) => o.track).sort()).toEqual(["HARD", "PRO"]);
  });

  it("marks neither answer as the ambitious one", () => {
    // A "Level B" badge here turns a question about experience into a difficulty
    // select, and takes the season's register with it.
    const banned = /\b(level|advanced|hard|pro|expert|beginner|easy|difficult|recommended)\b/i;
    for (const option of THRESHOLD.options) {
      expect(banned.test(option.text), option.text).toBe(false);
      expect(banned.test(option.says), option.says).toBe(false);
    }
  });

  it("keeps the two answers the same length, for the same reason the options are", () => {
    // Choice parity (PRD §9.2). It is the tier leak nobody looks for, and it
    // applies to the one question that is not a decision too.
    const lengths = THRESHOLD.options.map((o) => words(o.text));
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(8);
  });

  it("is stored city-wide, so the next building finds it already answered", () => {
    // ADR-005 §10.7. The Café asks it because the Café is where a new player
    // arrives, not because the answer belongs to the Café.
    setTrack("PRO");
    expect(localStorage.getItem("city.track")).toContain("PRO");
  });
});

describe("the eighteen registry rows", () => {
  it("names them in exactly one place", () => {
    expect(activityIdFor("C1", "HARD")).toBe("C1-HARD-01");
    expect(activityIdFor("C4", "PRO")).toBe("C4-PRO-01");
  });

  it("gives every competency a row on both tracks, all eighteen distinct", () => {
    const ids = [...MISSIONS, ...PRO_MISSIONS].map((m) => m.activityId);
    expect(ids).toHaveLength(18);
    expect(new Set(ids).size).toBe(18);
    for (const m of PRO_MISSIONS) {
      expect(m.activityId).toBe(activityIdFor(m.competency, "PRO"));
    }
  });
});

describe("the Level B season", () => {
  it("runs the same nine weeks in the same order", () => {
    // Same geometry, same chalkboard, different weight (PRD §14). A track that
    // reordered the season would be a second building wearing this one's name.
    expect(PRO_MISSIONS.map((m) => m.order)).toEqual(MISSIONS.map((m) => m.order));
    expect(PRO_MISSIONS.map((m) => m.week)).toEqual(MISSIONS.map((m) => m.week));
    expect(PRO_MISSIONS.map((m) => m.competency)).toEqual(MISSIONS.map((m) => m.competency));
  });

  it("ends every chain on the same three beats", () => {
    for (const m of PRO_MISSIONS) {
      const beats = m.objectives.filter((o) => o.kind === "decide").map((o) => o.target);
      expect(beats, m.activityId).toEqual(["seed", "follow", "transfer"]);
      expect(
        m.objectives.slice(-4).some((o) => o.kind === "decide"),
        m.activityId,
      ).toBe(true);
    }
  });

  it("opens every chain on something you have to go to, wait for or talk to", () => {
    // The failure mode this structure exists to avoid: decisions as modals in a
    // nice backdrop (PRD §18.4). It holds on both tracks or it holds on neither.
    for (const m of PRO_MISSIONS) {
      expect(["go_to", "wait_for", "talk_to", "inspect"], m.activityId).toContain(
        m.objectives[0].kind,
      );
    }
  });

  it("stages every week differently from Level A", () => {
    for (const pro of PRO_MISSIONS) {
      const a = MISSIONS.find((m) => m.competency === pro.competency)!;
      expect(pro.staging, `${pro.activityId} reuses Level A's staging`).not.toBe(a.staging);
    }
  });

  it("is what missionByOrder returns once the player has answered", () => {
    setTrack("PRO");
    expect(missionByOrder(1)?.activityId).toBe("C1-PRO-01");
    setTrack("HARD");
    expect(missionByOrder(1)?.activityId).toBe("C1-HARD-01");
    expect(seasonFor("PRO")).toBe(PRO_MISSIONS);
  });
});

describe("the Level B room", () => {
  it("puts Tomas on the floor from week one", () => {
    // The staffing problem is in the room from the start rather than arriving in
    // week 14, and that is most of what makes the same nine weeks read heavier.
    expect(castFor(OPENING_WORLD, "PRO")).toContain("tomas");
    expect(castFor(OPENING_WORLD, "HARD")).not.toContain("tomas");
  });

  it("keeps Priya unremovable on both tracks", () => {
    for (const track of ["HARD", "PRO"] as const) {
      for (const regulars of ["full", "steady", "thin", "returning"] as const) {
        expect(castFor({ ...OPENING_WORLD, regulars }, track), track).toContain("priya");
      }
    }
  });

  it("has the rival's awning already up across the road", () => {
    expect(openingWorldFor("PRO").rival).toBe("open");
    expect(openingWorldFor("HARD").rival).toBe("none");
  });

  it("pins the supplier's letter and the corrected rota by the hatch", () => {
    const pro = passThroughBody(OPENING_WORLD, "PRO");
    const hard = passThroughBody(OPENING_WORLD, "HARD");
    expect(pro).toContain("supplier");
    expect(pro).toContain("rota");
    expect(hard).not.toContain("supplier");
  });

  it("runs a stop cooler all year without going dark", () => {
    for (const week of MISSIONS.map((m) => m.week)) {
      const b = cooled(lightForWeek(week));
      expect(b.grade, `week ${week}`).toBeGreaterThanOrEqual(lightForWeek(week).grade);
    }
  });
});

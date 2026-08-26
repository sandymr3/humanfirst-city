import { describe, it, expect, beforeEach } from "vitest";
import {
  activeTrack,
  activityIdFor,
  forgetTrack,
  setTrack,
  trackOrDefault,
} from "@/framework/city/track";
import { MISSIONS, PRO_MISSIONS, seasonFor, missionByOrder } from "./missions";
import { castFor } from "./cast";
import { OPENING_WORLD, openingWorldFor, passThroughBody } from "./world";
import { cooled, lightForWeek } from "./light";

beforeEach(() => {
  forgetTrack();
});

// The question itself is asked at the city gate now, not here — see
// src/ui/EnterCity.test.tsx. What the Café still owns is everything downstream
// of the answer: which season runs, and what the room looks like on it.
describe("the answer, once it is given", () => {
  it("is unanswered until it is answered", () => {
    expect(activeTrack()).toBeNull();
    setTrack("SCB");
    expect(activeTrack()).toBe("SCB");
  });

  it("answers Level A for anybody who has never been asked", () => {
    // Every pure lookup in the building calls this. A null track must never
    // reach a season table.
    expect(trackOrDefault()).toBe("SCA");
  });

  it("is stored city-wide, so the next building finds it already answered", () => {
    // ADR-006 §11.1. One choice for the whole city — the Café reads it, it does
    // not own it.
    setTrack("SCB");
    expect(localStorage.getItem("city.track")).toContain("SCB");
  });
});

describe("the eighteen registry rows", () => {
  it("names them in exactly one place", () => {
    expect(activityIdFor("C1", "SCA")).toBe("C1-SCA-01");
    expect(activityIdFor("C4", "SCB")).toBe("C4-SCB-01");
  });

  it("gives every competency a row on both tracks, all eighteen distinct", () => {
    const ids = [...MISSIONS, ...PRO_MISSIONS].map((m) => m.activityId);
    expect(ids).toHaveLength(18);
    expect(new Set(ids).size).toBe(18);
    for (const m of PRO_MISSIONS) {
      expect(m.activityId).toBe(activityIdFor(m.competency, "SCB"));
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
    setTrack("SCB");
    expect(missionByOrder(1)?.activityId).toBe("C1-SCB-01");
    setTrack("SCA");
    expect(missionByOrder(1)?.activityId).toBe("C1-SCA-01");
    expect(seasonFor("SCB")).toBe(PRO_MISSIONS);
  });
});

describe("the Level B room", () => {
  it("puts Tomas on the floor from week one", () => {
    // The staffing problem is in the room from the start rather than arriving in
    // week 14, and that is most of what makes the same nine weeks read heavier.
    expect(castFor(OPENING_WORLD, "SCB")).toContain("tomas");
    expect(castFor(OPENING_WORLD, "SCA")).not.toContain("tomas");
  });

  it("keeps Priya unremovable on both tracks", () => {
    for (const track of ["SCA", "SCB"] as const) {
      for (const regulars of ["full", "steady", "thin", "returning"] as const) {
        expect(castFor({ ...OPENING_WORLD, regulars }, track), track).toContain("priya");
      }
    }
  });

  it("has the rival's awning already up across the road", () => {
    expect(openingWorldFor("SCB").rival).toBe("open");
    expect(openingWorldFor("SCA").rival).toBe("none");
  });

  it("pins the supplier's letter and the corrected rota by the hatch", () => {
    const pro = passThroughBody(OPENING_WORLD, "SCB");
    const hard = passThroughBody(OPENING_WORLD, "SCA");
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

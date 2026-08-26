// The accessibility pass (PRD §15). Not a checklist tacked on at the end — every
// assertion here is a property of content that already exists, and it exists
// because a consequence that lives only in the picture is a consequence half the
// audience never receives.
//
// What cannot be checked here is what happens in a browser: focus order, the
// live region actually firing, contrast against the rendered grade. Those are
// named at the bottom of the file so the gap is written down rather than
// implied.
import { describe, it, expect } from "vitest";
import { GUIDE, HOTSPOTS, ZONES } from "./room";
import { CAST, guideWithCast, atAnchors } from "./cast";
import { MISSIONS, PRO_MISSIONS } from "./missions";
import { WORLD_KEYS, announcementFor, hotspotBody, OPENING_WORLD, type WorldKey } from "./world";
import { lightForWeek, MAX_GRADE } from "./light";

const SEASONS = [...MISSIONS, ...PRO_MISSIONS];

describe("guided navigation", () => {
  it("names every place in the room's own words", () => {
    // §15: "the counter · the counter flap · the jukebox · the tables · by the
    // window · the door", plus the hotspots. Never "object_04", and never a verb
    // — the list is places, so it reads beside the cast without changing voice.
    for (const place of GUIDE) {
      expect(place.label, place.id).toMatch(/^[a-z]/);
      expect(place.label, `${place.id} is an instruction, not a place`).not.toMatch(
        /^(read|open|check|look|go|press|use) /,
      );
      expect(place.label, place.id).not.toMatch(/[_\d]/);
    }
  });

  it("carries the six stations and the four standing hotspots", () => {
    expect(GUIDE.filter((g) => g.id.startsWith("st_"))).toHaveLength(6);
    expect(GUIDE.filter((g) => g.id.startsWith("ht_"))).toHaveLength(4);
  });

  it("introduces the cast by name and role", () => {
    // §15: "Priya, head barista". A list entry reading only "Priya" tells a
    // player who cannot see the room nothing about why they would walk over.
    const present = atAnchors(CAST.map((m) => m.id));
    const withCast = guideWithCast(present);
    for (const member of CAST) {
      const entry = withCast.find((g) => g.id === member.id);
      expect(entry, `${member.id} is not reachable from the list`).toBeTruthy();
      expect(entry!.label).toContain(member.name);
      expect(entry!.label).toContain(member.role);
    }
  });

  it("can reach every place the season sends you, on both tracks", () => {
    // A place only a mouse can get to is a mission a keyboard player cannot
    // finish. Seasonal hotspots are the exception and are handled by the runner
    // putting the live one at the front of the list.
    const reachable = new Set([...GUIDE.map((g) => g.id), ...CAST.map((m) => m.id)]);
    const seasonal = new Set(HOTSPOTS.filter((h) => h.seasonal).map((h) => h.id));
    for (const mission of SEASONS) {
      for (const objective of mission.objectives) {
        if (objective.kind === "decide") continue;
        expect(
          reachable.has(objective.target) || seasonal.has(objective.target),
          `${mission.activityId}: nothing in the guide reaches ${objective.target}`,
        ).toBe(true);
      }
    }
  });

  it("keeps the seasonal places out of the standing list", () => {
    // A button reading "the sample bag" in week one is a promise about week
    // sixteen.
    for (const hotspot of HOTSPOTS.filter((h) => h.seasonal)) {
      expect(
        GUIDE.some((g) => g.id === hotspot.id),
        hotspot.id,
      ).toBe(false);
    }
  });
});

describe("what gets said out loud", () => {
  it("announces every world change a sighted player would see", () => {
    // The four keys that redress the room. `season` is announced by the week
    // transition instead, since the light changes with it; `staff` and `till`
    // change prose rather than pixels and are read when you go and look.
    const visible: WorldKey[] = ["chalkboard", "regulars", "truck", "board", "machine", "beans"];
    for (const key of visible) {
      const values = WORLD_KEYS[key] as readonly string[];
      const said = values.filter((v) => announcementFor(key, v as never) !== null);
      expect(
        said.length,
        `${key}: only ${said.length} of ${values.length} states say anything`,
      ).toBeGreaterThanOrEqual(values.length - 1);
    }
  });

  it("announces Marcus's chair emptying, which is the beat that is only a picture", () => {
    // §15 names this one specifically: the single most important non-verbal beat
    // in the building. It is said twice — once by the world key and once by the
    // week-18 objective's own cue.
    expect(announcementFor("regulars", "thin")).toContain("empty");
    const week18 = MISSIONS.find((m) => m.week === 18)!;
    const cues = week18.objectives.map((o) => o.cue ?? "").join(" ");
    expect(cues).toContain("empty");
  });

  it("says something about every week's light, so the season shift is not only visual", () => {
    for (const mission of MISSIONS) {
      expect(lightForWeek(mission.week).says.trim(), `week ${mission.week}`).toBeTruthy();
    }
  });

  it("names the pass-through's privacy in the text as well as in the audio", () => {
    // §15 wants it in three channels. Two of them are here: the prompt text and
    // the body a screen reader gets. The third is the duck, which is audio.
    expect(hotspotBody("ht_pass", OPENING_WORLD)).toContain("earshot");
    for (const mission of SEASONS) {
      const quiet = mission.objectives.find((o) => o.cue?.includes("earshot"));
      if (mission.competency === "C7") {
        expect(quiet, `${mission.activityId} never says it is out of earshot`).toBeTruthy();
      }
    }
  });

  it("gives the room a name for wherever you are standing", () => {
    for (const zone of ZONES) {
      expect(zone.label, zone.id).toMatch(/^[a-z]/);
      expect(zone.label.trim(), zone.id).toBeTruthy();
    }
  });
});

describe("the tracker and the question at the door", () => {
  it("shows one line, in the room's own words, with no quality marker in it", () => {
    // §11.1. The tracker is the most tempting surface in the building to put a
    // number on, which is exactly why it is checked here as well as there.
    const banned = /\b(score|points?|correct|complete[d]?%|\d+\s*\/\s*\d+|rating|grade)\b/i;
    for (const mission of SEASONS) {
      for (const objective of mission.objectives) {
        expect(objective.line, `${mission.activityId}: "${objective.line}"`).toMatch(/^[a-z0-9]/);
        expect(banned.test(objective.line), objective.line).toBe(false);
        expect(objective.line.length, objective.line).toBeLessThan(48);
      }
    }
  });
});

describe("the night beat stays navigable", () => {
  it("never grades the room past the point a low-vision player can cross it", () => {
    // §15: the scene's minimum luminance is floored so the room never becomes
    // unreadable. A dramatic week 8 nobody can walk through is a wall.
    expect(lightForWeek(8).grade).toBeLessThanOrEqual(MAX_GRADE);
    expect(MAX_GRADE).toBeLessThan(0.7);
  });

  it("puts nothing behind the darkness that is not also in the DOM", () => {
    // Everything the night beat asks of you is an objective with a line, and
    // every line is DOM text over the canvas rather than anything drawn into it.
    const night = MISSIONS.find((m) => m.week === 8)!;
    for (const objective of night.objectives) {
      expect(objective.line.trim(), night.activityId).toBeTruthy();
    }
  });
});

// Not checkable without a browser, and therefore still open:
//
//   * focus order through the nav, the dialogue and the report;
//   * the live region actually firing on objective change and only then;
//   * text contrast measured against the rendered grade at week 8 and week 14;
//   * the grinder duck never being the sole carrier of a beat, which is true by
//     construction here but is a thing to listen for once the sounds land.
//
// §18.2's blocking criterion — a fresh reader failing to spot the weak option
// across 54 seeds and 162 leaves — is a human's job and no test substitutes.

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
import { GUIDE, guideFor, ZONES } from "./room";
import { CAST, guideWithCast, atAnchors } from "./cast";
import { WORLD_KEYS, announcementFor, type WorldKey } from "./world";
import { lightForWeek, MAX_GRADE } from "./light";

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

  it("carries the places there are to go, and no leftovers", () => {
    // Six stations and four hotspots used to be in here, which is a to-do list
    // read aloud. The career works at three places and leaves by a fourth, so
    // that is what the list carries — and still nothing prefixed ht_, because
    // those places are gone rather than merely dropped from the list.
    expect(GUIDE.map((g) => g.id)).toEqual(["st_counter", "st_pass", "st_tables", "st_door"]);
    expect(GUIDE.filter((g) => g.id.startsWith("ht_"))).toHaveLength(0);
  });

  it("offers a posting only the places it may stand", () => {
    // The keyboard path and the flap have to agree. A chip that sends a
    // candidate behind a counter they cannot pass is a dead end read aloud,
    // which is worse for the player who depends on the list than for the one
    // who can see the room.
    expect(guideFor("candidate").map((g) => g.id)).toEqual(["st_tables", "st_door"]);
    expect(guideFor("ceo").map((g) => g.id)).toEqual(GUIDE.map((g) => g.id));
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

  it("gives the room a name for wherever you are standing", () => {
    for (const zone of ZONES) {
      expect(zone.label, zone.id).toMatch(/^[a-z]/);
      expect(zone.label.trim(), zone.id).toBeTruthy();
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

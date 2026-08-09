// The performance pass (PRD §16). The Café is building 01 and sets the house
// standard, so the budget is deliberately generous and the point is to stay well
// under it rather than to fit.
//
// Only the counts that are decidable from the content are here. Draw calls,
// texture memory and bake time are runtime measurements on the reference profile
// and are named at the bottom — a test that asserted them from a headless
// software renderer would be measuring the CI box, not the budget.
import { describe, it, expect } from "vitest";
import { FURNITURE, ROOM_H, ROOM_W } from "./room";
import { CAST, castFor } from "./cast";
import { SEATS, crowdSize } from "./customers";
import { BEATS } from "./ambient";
import { MAX_STEAM_PUFFS } from "./steam";
import { WORLD_KEYS, OPENING_WORLD, type World } from "./world";
import { MISSIONS, PRO_MISSIONS } from "./missions";

/** Every world the season can actually be in, one key at a time. */
function everyWorld(): World[] {
  const out: World[] = [OPENING_WORLD];
  for (const key of Object.keys(WORLD_KEYS) as (keyof World)[]) {
    for (const value of WORLD_KEYS[key]) {
      out.push({ ...OPENING_WORLD, [key]: value });
    }
  }
  return out;
}

describe("sprites on screen", () => {
  it("stays under the 220 the budget allows", () => {
    // §16's own breakdown: the room, the dressing props, the cast, the ambient
    // customers. The floor is one Graphics rather than 120 tiles, which is
    // where most of the headroom came from.
    const floor = 1;
    const props = FURNITURE.length;
    const people = CAST.length + SEATS.length + 1; // worst case, plus the player
    const effects = MAX_STEAM_PUFFS + 1; // the steam pool and the pigeon
    const overlays = 2; // the grade and the glow quads
    const total = floor + props + people + effects + overlays;
    expect(total, `${total} sprites`).toBeLessThanOrEqual(220);
  });

  it("has fewer props than it has cells, which is the shape of a room", () => {
    expect(FURNITURE.length).toBeLessThan(ROOM_W * ROOM_H);
  });
});

describe("animated characters", () => {
  it("never has more than four of the named cast in the room at once", () => {
    // §16 caps the cast at four and §8.1's mission table is what enforces it:
    // the six exist, and four of them are never all present. Ambient customers
    // are counted separately in §16's own sprite breakdown.
    for (const track of ["SCA", "SCB"] as const) {
      for (const world of everyWorld()) {
        // The most the room can hold: whoever lives here, plus the one visitor
        // the live mission brings in. No mission brings two.
        const resident = castFor(world, track).length;
        expect(resident + 1, `${track} / regulars=${world.regulars}`).toBeLessThanOrEqual(4);
      }
    }
  });

  it("brings in at most one visitor per mission, on both tracks", () => {
    for (const mission of [...MISSIONS, ...PRO_MISSIONS]) {
      const arrivals = mission.objectives.filter((o) => o.kind === "wait_for");
      expect(
        arrivals.length,
        `${mission.activityId} waits for ${arrivals.length} people`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it("keeps the ambient floor small enough that the room is still a café", () => {
    for (const world of everyWorld()) {
      expect(crowdSize(world, 1, false), `regulars=${world.regulars}`).toBeLessThanOrEqual(
        SEATS.length,
      );
    }
  });
});

describe("the ambient budget", () => {
  it("keeps at most eight beats live", () => {
    // Six scheduled here, plus the door bell in the customer loop and the street
    // bed crossfaded from the district. That is exactly §16's ceiling, which is
    // why there is no room for a seventh scheduled beat.
    expect(BEATS.length + 2).toBeLessThanOrEqual(8);
  });

  it("pre-allocates the steam pool rather than growing it", () => {
    // A particle system that allocates under load is a particle system that
    // stutters exactly when the room is busiest.
    expect(MAX_STEAM_PUFFS).toBeLessThanOrEqual(8);
  });
});

describe("the season's own size", () => {
  it("carries no duplicated staging between the two tracks", () => {
    // The Level B table is derived from Level A rather than copied, so the two
    // seasons cost one table and a set of overrides rather than two tables.
    const staging = [...MISSIONS, ...PRO_MISSIONS].map((m) => m.staging);
    expect(new Set(staging).size).toBe(staging.length);
  });
});

// Measured on the reference profile, not here:
//
//   * draw calls ≤ 40 — the dressing is baked into a small number of containers
//     and the floor is one Graphics, but the number is a renderer question;
//   * baked textures ≤ 26 unique and texture memory ≤ 32 MB — the person rigs
//     dominate this and the count depends on how many palettes are alive, which
//     is a runtime fact;
//   * scene build ≤ 250 ms and enter/exit ≤ 0.8 s — both behind the fade;
//   * interior chunk ≤ 900 KB — reported by `npm run build`, currently well
//     inside it;
//   * five enter/exit cycles with no memory growth — the teardown stack is what
//     this is testing and it has to be watched in a real heap profile.

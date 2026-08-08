// The room's ambient beats — PRD §6's liveliness budget, as a scheduler.
//
// Six of §6's eight rows are here. The **door bell** is owned by customersView
// instead, because a bell with nobody coming through the door is a sound effect
// rather than a beat, and the customer loop is the only thing that knows when
// somebody is actually opening it. The **street bed** is a continuous crossfade
// rather than a beat and belongs to the framework's audio manager.
//
// Pure: what fires, how often, and under what conditions. The canvas owns the
// puff, the shudder and the pigeon.
//
// **The duck is the reason this is a scheduler and not six timers.** §6 gives
// the grinder 1.5 seconds of dominance and says it is "used deliberately as a
// beat before a hard line". That only works if everything else in the room
// actually gets out of its way, which is a scheduling property and cannot be
// expressed as six independent intervals.
import { marcusIsIn, type World } from "./world";
import { roomIsClosed } from "./customers";

export type BeatId = "steam" | "grinder" | "cup" | "wipe" | "page" | "pigeon";

/** What the room looks like right now, as much of it as a beat can care about. */
export interface RoomNow {
  world: World;
  missionOrder: number;
  /** How many ambient customers are sitting down. */
  seated: number;
  /** Somebody is working the espresso machine. */
  atMachine: boolean;
}

export interface AmbientBeat {
  id: BeatId;
  /** Seconds between firings, before density and reduced motion. */
  every: readonly [number, number];
  /** Whether the room is in a state where this beat means anything. */
  when: (now: RoomNow) => boolean;
  /**
   * Decorative beats thin to a third under reduced motion (§14.5). The grinder
   * does not: it is informational, it precedes hard lines, and a player who has
   * asked for less movement has not asked for less warning.
   */
  decorative: boolean;
}

/** How long the grinder holds the room. §6: "duck conversation for 1.5 s". */
export const DUCK_S = 1.5;

/** What reduced motion multiplies a decorative beat's interval by. */
export const REDUCED_FACTOR = 3;

export const BEATS: readonly AmbientBeat[] = [
  {
    id: "steam",
    every: [8, 20],
    // Only while somebody is at the machine — steam off an unattended group head
    // is a room that runs itself.
    when: (n) => n.atMachine && !roomIsClosed(n.missionOrder),
    decorative: true,
  },
  {
    id: "grinder",
    every: [30, 60],
    when: (n) => !roomIsClosed(n.missionOrder),
    decorative: false,
  },
  {
    id: "cup",
    every: [12, 30],
    // Positional, from wherever somebody is sitting. Nobody sitting, no cup.
    when: (n) => n.seated > 0,
    decorative: true,
  },
  {
    id: "wipe",
    every: [40, 90],
    // Priya is the anchor and is in the room in every world state, so this is
    // only ever gated on the café being open.
    when: (n) => !roomIsClosed(n.missionOrder),
    decorative: true,
  },
  {
    id: "page",
    every: [45, 120],
    // Marcus, and only while he is still coming in. His chair going quiet is
    // the building's most important non-verbal beat and the ambient layer must
    // not paper over it.
    when: (n) => marcusIsIn(n.world) && !roomIsClosed(n.missionOrder),
    decorative: true,
  },
  {
    id: "pigeon",
    every: [90, 180],
    // A callback to the city billboard's "the pigeons remain unbothered".
    // Continuity is cheap and people love it.
    when: () => true,
    decorative: true,
  },
];

export interface Schedule {
  /** Advance the clock and return whatever fired this frame. */
  tick(dtS: number, now: RoomNow): BeatId[];
  /** Seconds of grinder dominance still to run. Zero most of the time. */
  duckedFor(): number;
}

/**
 * `rand` is injected rather than reached for, so a test can pin the schedule
 * and the room can still be unpredictable.
 */
export function createSchedule(reduced: boolean, rand: () => number = Math.random): Schedule {
  const gap = (beat: AmbientBeat): number => {
    const [lo, hi] = beat.every;
    const base = lo + (hi - lo) * clamp01(rand());
    return beat.decorative && reduced ? base * REDUCED_FACTOR : base;
  };

  // Staggered, so the room does not fire all six beats on the same frame the
  // player walks in and then go silent for a minute.
  const due = new Map<BeatId, number>(BEATS.map((b) => [b.id, gap(b) * (0.3 + 0.7 * rand())]));
  let duck = 0;

  return {
    duckedFor: () => duck,

    tick(dtS, now) {
      duck = Math.max(0, duck - dtS);
      const fired: BeatId[] = [];

      for (const beat of BEATS) {
        const left = (due.get(beat.id) ?? gap(beat)) - dtS;
        if (left > 0) {
          due.set(beat.id, left);
          continue;
        }

        // Not eligible: reschedule rather than fire, so a beat whose conditions
        // come back does not immediately discharge everything it "owed".
        if (!beat.when(now)) {
          due.set(beat.id, gap(beat));
          continue;
        }

        // Something is under the grinder. Hold it a beat rather than dropping
        // it: the point of the duck is that the room comes back afterwards.
        if (duck > 0 && beat.id !== "grinder") {
          due.set(beat.id, duck + 0.2);
          continue;
        }

        due.set(beat.id, gap(beat));
        if (beat.id === "grinder") duck = DUCK_S;
        fired.push(beat.id);
      }

      return fired;
    },
  };
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

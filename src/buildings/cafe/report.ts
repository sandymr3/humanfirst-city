// "The Year at the Corner" — the end-of-journey report (PRD §13).
//
// A letter, in an envelope, propped against the pass-through hatch where the
// rota usually is. Priya wrote it. It unlocks when all nine competencies are
// closed and it is the last thing in the building.
//
// Two rules, and the second is the one that is easy to get wrong.
//
// **This is the only place in the building where tier vocabulary is allowed.**
// Everywhere else it is forbidden (§11); here it is the point. The tiers are
// server-side and are resolved from the submitted trace, so this file renders
// the record it has and says plainly what is still coming rather than inventing
// a grade to fill the space — a fabricated tier is worse than an absent one.
//
// **The letter is derived, never written down once.** It is built from the world
// state the season ended in, which is what makes it a debrief from somebody who
// worked the bar next to you rather than a template with your name in it. Nine
// weeks of decisions produce a letter nobody else gets.
//
// Tone throughout: no shame framing. Nothing is failed; some things are not yet.
import { VENUES } from "@/world/cityMap";
import { MISSIONS } from "./missions";
import { TREES } from "./trees";
import { FOLLOWUPS } from "./followups";
import { chalkboardBody, type World } from "./world";

/** What the player did in one week. Written when the transfer beat closes. */
export interface Decided {
  activityId: string;
  /** The option letters taken, in beat order. */
  seed: string | null;
  follow: string | null;
  transfer: string | null;
}

// ── The letter ───────────────────────────────────────────────────────────────

/**
 * Priya's letter, in paragraphs. Around two hundred words, built from the world
 * state trail: which decisions the café is visibly still living with, what the
 * board says now, whether Marcus is in his chair.
 */
export function letter(world: World): string[] {
  const paras: string[] = [];

  paras.push(
    "I'm not good at this so I'll do it the way I'd say it. A year ago you came " +
      "in through that door with the keys in your hand and no idea, and the two " +
      "of us stood behind a counter that smelled of somebody else's coffee.",
  );

  // The board is §3.3's unforgettable thing and is the first thing she'd point
  // at, because it is the physical diff of the whole season.
  paras.push(
    world.chalkboard === "base"
      ? "The board still says what it said when we took it on. I've stopped " +
          "correcting the cortado. Some things you leave."
      : `Look at the board. ${boardLine(world)} That's not nothing — that's nine ` +
          "months of you deciding something and then living with it in front of " +
          "everybody who comes in.",
  );

  paras.push(regularsLine(world));

  const room = [tillLine(world), staffLine(world), beansLine(world), outsideLine(world)].filter(
    (line): line is string => line !== null,
  );
  if (room.length > 0) paras.push(room.join(" "));

  paras.push(
    "Next year I want to do the thing with the roaster properly, and I want a " +
      "second machine, and I want you to take an actual holiday. In that order, " +
      "probably. — P.",
  );

  return paras;
}

function boardLine(world: World): string {
  // Her sentence about it is the board's own copy, cut down to the clause she
  // would actually say out loud.
  const body = chalkboardBody(world);
  const first = body.split(". ")[0];
  return `${first}.`;
}

function regularsLine(world: World): string {
  switch (world.regulars) {
    case "full":
      return (
        "Marcus is in his chair. He was in it the week we opened and he was in " +
        "it yesterday, and I don't think he's ever once said the coffee was good, " +
        "which is how you know."
      );
    case "returning":
      return (
        // No verdict on why he came back. He came back; the room noticed; that
        // is the whole beat, and report.test.ts caught the first draft of this
        // line calling it "the right call from everyone".
        "Marcus is back in his chair. He didn't say anything about having been " +
        "away and neither did we, and the paper's folded the same way it always was."
      );
    case "steady":
      return (
        "The four-top's got people at it most mornings. Not the same people every " +
        "morning any more, but people, and they come back."
      );
    case "thin":
      return (
        "The four-top's quiet. I'm not going to pretend it isn't. Some of them " +
        "went across the road and some of them just stopped, and that's a thing " +
        "that happened this year and we both watched it happen."
      );
  }
}

function tillLine(world: World): string | null {
  switch (world.till) {
    case "healthy":
      return "There's money in the drawer at the end of the month, which there was not in May.";
    case "strained":
      return "The drawer's tighter than it was and we both know exactly which month did that.";
    case "tight":
      return null;
  }
}

function staffLine(world: World): string | null {
  switch (world.staff) {
    case "trusting":
      return "The rota sorts itself out now. Nobody asks me to sign anything.";
    case "strained":
      return "The rota's got pencil all over it. We'll get there.";
    case "easy":
      return null;
  }
}

function beansLine(world: World): string | null {
  return world.beans === "cheap"
    ? "The beans are the beans. I've stopped saying it."
    : "We still buy the good stuff, which cost us something and I noticed.";
}

function outsideLine(world: World): string | null {
  if (world.rival === "promo") {
    return "The place opposite has a board out on the pavement every morning now.";
  }
  if (world.rival === "open") return "The awning's still up across the road.";
  if (world.truck === "parked") return "Ray's truck is still at the kerb on Saturdays.";
  return null;
}

// ── The record ───────────────────────────────────────────────────────────────

export interface TrailRow {
  week: number;
  competency: string;
  title: string;
  /** What you chose, in your own words. */
  chose: string | null;
  /** What happened, in the room's. */
  happened: string | null;
}

/**
 * The consequence trail — what you chose, what happened, two lines per
 * competency (§13.2). Read straight off the authored content rather than
 * summarised, because the summary is where an opinion would creep in.
 */
export function trail(decided: readonly Decided[]): TrailRow[] {
  return MISSIONS.map((mission) => {
    const done = decided.find((d) => d.activityId === mission.activityId) ?? null;
    const leaf = leafOf(mission.activityId, done);
    return {
      week: mission.week,
      competency: mission.competency,
      title: mission.title,
      chose: leaf?.text ?? null,
      happened: leaf?.consequence ?? null,
    };
  });
}

/** The follow-up leaf actually taken, which is the decision that scores. */
function leafOf(
  activityId: string,
  done: Decided | null,
): { text: string; consequence: string } | null {
  if (!done?.seed) return null;
  const tree = TREES[activityId];
  if (!tree) return null;
  if (done.follow) {
    const choice = tree.follow[done.seed]?.choices.find((c) => c.id === done.follow);
    if (choice) return { text: choice.text, consequence: choice.consequence };
  }
  const seed = tree.seed.find((c) => c.id === done.seed);
  return seed ? { text: seed.text, consequence: seed.consequence } : null;
}

export interface ShapeRow {
  week: number;
  competency: string;
  /** What you did when the question arrived. */
  sawIt: string | null;
  /** What you did once you knew what you were dealing with. */
  thenDid: string | null;
  /** What you did the Tuesday after, when it came back. */
  andThen: string | null;
}

/**
 * §13.3's consistency section — the seed/follow shape made legible.
 *
 * The PRD's exemplar sentence ends on a reading of the pattern ("You see
 * clearly and then reach for the obvious move"), and that reading is §10.2's
 * arithmetic over the two tiers. The tiers are server-side, so what ships is the
 * pattern itself, laid out beat by beat, and the reading arrives with the
 * scores. Laying the choices side by side is most of the value: a player who
 * reads nine weeks of "found the real thing, then did the easy thing" has been
 * told something true without anybody having graded them.
 */
export function shape(decided: readonly Decided[]): ShapeRow[] {
  return MISSIONS.map((mission) => {
    const done = decided.find((d) => d.activityId === mission.activityId) ?? null;
    const tree = TREES[mission.activityId];
    const beat = FOLLOWUPS[mission.activityId];
    const seed = done?.seed ? (tree?.seed.find((c) => c.id === done.seed) ?? null) : null;
    const follow =
      done?.seed && done.follow
        ? (tree?.follow[done.seed]?.choices.find((c) => c.id === done.follow) ?? null)
        : null;
    const transfer = done?.transfer
      ? (beat?.options.find((o) => o.id === done.transfer) ?? null)
      : null;
    return {
      week: mission.week,
      competency: mission.competency,
      sawIt: seed?.text ?? null,
      thenDid: follow?.text ?? null,
      andThen: transfer?.text ?? null,
    };
  });
}

// ── Where to go next ─────────────────────────────────────────────────────────

export interface NextPlace {
  /** The building's name in the city, so it reads as a place and not a course. */
  name: string;
  competency: string;
  /** Why here, in the room's own terms. Never "you scored low on this". */
  why: string;
}

/**
 * §13.4 names the city buildings that draw hardest on your lowest competencies.
 * The tiers those would be ranked from are server-side, so this reads the room
 * instead: the café ended the year in a particular state, and the state points
 * at what the year was hardest about. It is a weaker signal than the tiers and
 * it is an honest one, and it keeps the section's real job — naming places
 * rather than remediation.
 */
export function nextPlaces(world: World): NextPlace[] {
  const wants: { competency: string; why: string }[] = [];

  if (world.till !== "healthy") {
    wants.push({
      competency: "C4",
      why: "The month you counted on the counter is the one you still think about.",
    });
  }
  if (world.staff === "strained") {
    wants.push({
      competency: "C7",
      why: "There is pencil on the rota, and the conversation by the hatch is not finished.",
    });
  }
  if (world.regulars === "thin") {
    wants.push({
      competency: "C9",
      why: "The four-top emptied out over a fortnight and it took the rest of the year to feel it.",
    });
  }
  if (world.rival !== "none") {
    wants.push({
      competency: "C5",
      why: "There is an awning across the road that was not there in the spring.",
    });
  }
  if (world.chalkboard === "base") {
    wants.push({
      competency: "C1",
      why: "The board never changed, and boards are where a year shows.",
    });
  }

  const named = new Set<string>();
  const out: NextPlace[] = [];
  for (const want of wants) {
    const venue = VENUES.find((v) => v.competency === want.competency && !named.has(v.id));
    if (!venue) continue;
    named.add(venue.id);
    out.push({ name: venue.displayName, competency: want.competency, why: want.why });
    // Two or three, per §13.4. A list of nine is a syllabus, not a suggestion.
    if (out.length === 3) break;
  }
  return out;
}

// ── The half that is not here yet ────────────────────────────────────────────

/**
 * Shown where §13.1's nine tiers go. The tiers come from the registry rubric via
 * the submitted trace and the Café's rows are not seeded, so every decision this
 * season is queued rather than scored (§19.7). Saying so is the only honest
 * option: a made-up tier in the one place tier vocabulary is allowed would be a
 * lie told with the building's full authority.
 */
export const TIERS_PENDING =
  "The rest of this — how each of the nine went, and what the pattern across them says — is still being worked out from what you sent in. It will be here when it is.";

/** True when the report has something real to put under §13.1's heading. */
export function tiersAvailable(): boolean {
  return false;
}

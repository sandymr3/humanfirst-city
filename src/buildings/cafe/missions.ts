// The season — nine missions, strictly ordered, one per competency (PRD §8).
//
// A mission is a chain of typed objectives with exactly one of them live at a
// time, and the live one is the only thing the tracker ever shows. Every chain
// ends with the same three `decide` beats — seed, follow, transfer — and begins
// with at least one thing you have to walk to, wait for, or talk to, because a
// room where decisions are modals in a nice backdrop is the failure mode this
// whole structure exists to avoid (PRD §18.4).
//
// Pure data. missionRunner.ts decides when an objective is satisfied; nothing
// here knows about Pixi, the store, or the clock.
import type { CastId } from "./cast";
import type { WorldPatch } from "./world";
import { activityIdFor, trackOrDefault, type Track } from "./track";

export type ObjectiveKind = "go_to" | "wait_for" | "talk_to" | "inspect" | "decide" | "report";

/** The three beats every decision has. The third is generated (PRD §9.6). */
export type Beat = "seed" | "follow" | "transfer";

export interface Objective {
  kind: ObjectiveKind;
  /** A station or hotspot id, a cast id, or a beat name — by `kind`. */
  target: string;
  /**
   * What the tracker shows while this is the live one. The room's own words,
   * lower case, never "Objective 3: interact with NPC" (PRD §11.1).
   */
  line: string;
  /** Said to the live region when the objective opens, if anything is. */
  cue?: string;
}

export interface Mission {
  /** 1..9. Mission n+1 does not exist until n closes. */
  order: number;
  week: number;
  competency: string;
  /** The registry row this scores against. */
  activityId: string;
  title: string;
  /** The scene-setting line, kept from v1.0's staging table. */
  staging: string;
  /**
   * Whose mission it is. Null is deliberate for three of them and is the
   * register rather than an edge case: the night beat is alone on purpose, the
   * sample bag is an object on a counter, and the awning is a thing you see
   * through glass.
   */
  host: CastId | null;
  /**
   * Who speaks when the host is absent, before falling back to the anchor. Only
   * two missions need one: week 12 hands the beat to Marcus, who is standing
   * there holding his paper, and week 8 hands it to the room, because being
   * alone is the point of that night.
   */
  standIn?: CastId | "room";
  objectives: readonly Objective[];
  /** Applied when the mission closes, whatever was decided. */
  closeWorldState: WorldPatch;
  /** The only writes the generated beat is allowed to ask for (PRD §9.6.3). */
  aiWorldCandidates: readonly WorldPatch[];
}

const decide: readonly Objective[] = [
  { kind: "decide", target: "seed", line: "decide" },
  { kind: "decide", target: "follow", line: "decide" },
  { kind: "decide", target: "transfer", line: "decide" },
];

export const MISSIONS: readonly Mission[] = [
  {
    order: 1,
    week: 1,
    competency: "C1",
    activityId: "C1-HARD-01",
    title: "The Dairy-Free Question",
    staging:
      "8:05. The bell goes. Nadia's already reaching for her card before she's at the counter, the way she is every morning.",
    host: "nadia",
    objectives: [
      { kind: "go_to", target: "st_counter", line: "take the counter" },
      {
        kind: "wait_for",
        target: "nadia",
        line: "8:05 — the bell",
        cue: "The bell. Nadia comes in fast, phone in one hand.",
      },
      { kind: "talk_to", target: "nadia", line: "serve Nadia" },
      ...decide,
      {
        kind: "report",
        target: "priya",
        line: "tell Priya where you landed",
        cue: "Priya, not looking up: “So what are we doing?”",
      },
    ],
    closeWorldState: { season: "spring" },
    aiWorldCandidates: [{ chalkboard: "oat" }, { chalkboard: "oat_plus" }, { regulars: "steady" }],
  },
  {
    order: 2,
    week: 3,
    competency: "C2",
    activityId: "C2-HARD-01",
    title: "The Iced Drink",
    staging:
      "Two weeks in. Priya has the numbers on the back of a docket and has clearly been waiting for you to ask.",
    host: "priya",
    objectives: [
      { kind: "inspect", target: "ht_chalkboard", line: "read the board" },
      { kind: "go_to", target: "st_flap", line: "get behind the counter" },
      { kind: "talk_to", target: "priya", line: "ask Priya how it's going" },
      ...decide,
      { kind: "inspect", target: "ht_chalkboard", line: "change the board — or don't" },
    ],
    closeWorldState: { staff: "easy" },
    aiWorldCandidates: [
      { chalkboard: "iced_renamed" },
      { chalkboard: "iced" },
      { staff: "trusting" },
    ],
  },
  {
    order: 3,
    week: 5,
    competency: "C3",
    activityId: "C3-HARD-01",
    title: "The Truck",
    staging: "The hottest day of the year. Ray's truck is at the kerb before he is at the door.",
    host: "ray",
    objectives: [
      // He is visible through the glass before he is in the room. Worth stealing
      // for every other building: the offer arrives from outside first.
      { kind: "inspect", target: "ht_window", line: "something's parked outside" },
      {
        kind: "wait_for",
        target: "ray",
        line: "he's coming in",
        cue: "The bell, and Ray filling the doorway.",
      },
      { kind: "talk_to", target: "ray", line: "hear Ray out" },
      ...decide,
      { kind: "report", target: "priya", line: "tell Priya about Saturday" },
    ],
    closeWorldState: { truck: "parked" },
    aiWorldCandidates: [{ truck: "parked" }, { truck: "gone_rival" }, { regulars: "steady" }],
  },
  {
    order: 4,
    week: 8,
    competency: "C4",
    activityId: "C4-HARD-01",
    title: "The Good Month",
    staging:
      "22:30. Chairs up, machine cooling and ticking as it goes. One pendant on over the counter. The month's takings are stacked in front of you.",
    // Nobody. This is the only mission in the season that ends with you alone in
    // the room, and it carries the money decision on purpose.
    host: null,
    standIn: "room",
    objectives: [
      { kind: "go_to", target: "st_door", line: "lock up" },
      { kind: "inspect", target: "ht_chalkboard", line: "look at what you sell now" },
      { kind: "go_to", target: "st_counter", line: "count the month" },
      ...decide,
      // No `report`. There is nobody to report to, and that is the mission.
    ],
    closeWorldState: { season: "autumn" },
    aiWorldCandidates: [{ till: "healthy" }, { till: "strained" }, { machine: "upgraded" }],
  },
  {
    order: 5,
    week: 10,
    competency: "C5",
    activityId: "C5-HARD-01",
    title: "The App",
    staging:
      "A promo card on the community board you didn't pin. Nadia mentions she's been ordering through it. She means it kindly.",
    host: "nadia",
    objectives: [
      { kind: "inspect", target: "ht_board", line: "something's on the noticeboard" },
      { kind: "wait_for", target: "nadia", line: "8:05" },
      { kind: "talk_to", target: "nadia", line: "ask Nadia about the card" },
      ...decide,
      { kind: "inspect", target: "ht_board", line: "deal with the card" },
    ],
    closeWorldState: { board: "app_card" },
    aiWorldCandidates: [{ board: "app_card" }, { board: "direct_card" }, { chalkboard: "app" }],
  },
  {
    order: 6,
    week: 12,
    competency: "C6",
    activityId: "C6-HARD-01",
    title: "Forty Off",
    staging:
      "She's taken Marcus's table. Laptop open, coffee she bought herself, a number already decided.",
    host: "ellery",
    standIn: "marcus",
    objectives: [
      { kind: "wait_for", target: "ellery", line: "someone's taken the four-top" },
      { kind: "go_to", target: "st_tables", line: "go over" },
      { kind: "talk_to", target: "ellery", line: "hear the offer" },
      ...decide,
      // The whole mission. Ellery took his table; whatever you agreed at it, he
      // was standing up while you did.
      {
        kind: "report",
        target: "marcus",
        line: "say something to Marcus",
        cue: "Marcus is standing, holding his paper, waiting.",
      },
    ],
    closeWorldState: { regulars: "steady" },
    aiWorldCandidates: [{ till: "healthy" }, { regulars: "thin" }, { staff: "strained" }],
  },
  {
    order: 7,
    week: 14,
    competency: "C7",
    activityId: "C7-HARD-01",
    title: "Late",
    staging:
      "First grey day. She's been late four times in two weeks and it's landing on everyone else.",
    host: "priya",
    objectives: [
      { kind: "inspect", target: "ht_pass", line: "check the rota" },
      { kind: "talk_to", target: "priya", line: "ask her to step through" },
      {
        kind: "go_to",
        target: "ht_pass",
        line: "out of earshot",
        cue: "The floor goes quiet behind you. Out of earshot, by about two metres.",
      },
      ...decide,
      { kind: "report", target: "priya", line: "say what you decided, to her face" },
    ],
    closeWorldState: { staff: "strained" },
    aiWorldCandidates: [{ staff: "trusting" }, { staff: "strained" }, { staff: "easy" }],
  },
  {
    order: 8,
    week: 16,
    competency: "C8",
    activityId: "C8-HARD-01",
    title: "The Sample Bag",
    staging:
      "A bag of the cheaper beans on the counter end and a number on the invoice that would fix this month. Marcus is in his chair behind you, reading.",
    // The object carries it. Speaking resolves to Priya, who is standing there.
    host: null,
    objectives: [
      { kind: "go_to", target: "st_flap", line: "the delivery's in" },
      { kind: "inspect", target: "ht_sample", line: "open the sample bag" },
      { kind: "talk_to", target: "priya", line: "pull a shot of it with Priya" },
      ...decide,
      { kind: "report", target: "marcus", line: "take Marcus his coffee" },
    ],
    closeWorldState: { beans: "good" },
    aiWorldCandidates: [{ beans: "good" }, { beans: "cheap" }, { chalkboard: "beans_story" }],
  },
  {
    order: 9,
    week: 18,
    competency: "C9",
    activityId: "C9-HARD-01",
    title: "The New Awning",
    staging:
      "A new café across the road, open a fortnight. Through two panes of glass you can see two of your regulars sitting in it.",
    host: null,
    objectives: [
      { kind: "inspect", target: "ht_window", line: "there's a new awning across the road" },
      {
        kind: "go_to",
        target: "st_tables",
        line: "the four-top",
        // Announced explicitly, because a consequence that exists only in the
        // picture is one half the audience never receives (PRD §15).
        cue: "The four-top by the window is empty.",
      },
      { kind: "talk_to", target: "priya", line: "ask Priya what she's hearing" },
      ...decide,
      { kind: "inspect", target: "ht_chalkboard", line: "write next week" },
    ],
    closeWorldState: { rival: "open" },
    aiWorldCandidates: [{ regulars: "returning" }, { regulars: "thin" }, { rival: "promo" }],
  },
];

// ── Level B ──────────────────────────────────────────────────────────────────
//
// Same nine weeks, same room, same chain shape. What changes is the weight: in
// Level B every option has a defensible case and a real price, and the follow-up
// is where the price arrives (PRD §14). The overrides below are the staging and
// the routing; the decisions themselves are in trees.ts.
//
// Derived from the Level A table rather than written out again, so the season's
// shape — nine orders, nine weeks, the three `decide` beats at the end of every
// chain — cannot drift between the two tracks. Anything a track really does
// differently has to be named here, which is the point.

type ProOverride = Partial<Pick<Mission, "title" | "staging" | "host" | "standIn" | "objectives">>;

const PRO_OVERRIDES: Readonly<Record<string, ProOverride>> = {
  C1: {
    staging:
      "8:05, and you have stood behind a counter at this hour before. Nadia's already reaching for her card. Tomas is on the bar because Priya cannot do six mornings, which is a problem you have not solved yet and can hear behind you.",
  },
  C2: {
    title: "The Drink You Championed",
    staging:
      "You told the team to get behind it. They did. It isn't working, and they are watching to see what you do about having been wrong.",
  },
  C3: {
    title: "Thirty Per Cent",
    staging:
      "A bulk offer at thirty per cent off, placed today or not at all. The saving is real. It would take most of your spare cash, and you have no idea what the quarter after next looks like.",
    // The supplier's letter is pinned by the hatch from week one on this track,
    // so the offer arrives as paper before it arrives as a person.
    objectives: [
      { kind: "inspect", target: "ht_pass", line: "read the supplier's letter" },
      {
        kind: "wait_for",
        target: "ray",
        line: "he said he'd come by",
        cue: "The bell, and Ray with a folder under his arm.",
      },
      { kind: "talk_to", target: "ray", line: "hear the offer" },
      ...decide,
      { kind: "report", target: "priya", line: "tell Priya what you've committed to" },
    ],
  },
  C4: {
    staging:
      "22:30. Chairs up, machine cooling and ticking as it goes. The month's takings are the best four weeks since you took the place on. It is also August, and you have run a room long enough to know what September looks like.",
  },
  C5: {
    title: "Forty Per Cent of You",
    staging:
      "The app drives forty per cent of your orders and has just raised its commission. Leaving costs you that volume overnight; staying costs you the margin. Whatever you decide today you will be living inside for two years.",
  },
  C6: {
    title: "The Account",
    staging:
      "Steady revenue, a year's commitment, and terms that would leave you working at roughly nothing. She mentions, pleasantly, that she has other options.",
  },
  C7: {
    title: "The Best One",
    staging:
      "Tomas is the fastest pair of hands you have and the reason two other people are miserable. Cracking down risks losing him. Not cracking down risks losing them.",
    // The conversation is with Tomas, and it happens where the floor cannot hear
    // it — which on this track is the whole mechanism rather than the setting.
    objectives: [
      { kind: "inspect", target: "ht_pass", line: "check the rota" },
      { kind: "talk_to", target: "priya", line: "ask Priya what she's seeing" },
      { kind: "talk_to", target: "tomas", line: "ask Tomas to step through" },
      {
        kind: "go_to",
        target: "ht_pass",
        line: "out of earshot",
        cue: "The floor goes quiet behind you. Out of earshot, by about two metres.",
      },
      ...decide,
      { kind: "report", target: "priya", line: "tell Priya where that landed" },
    ],
  },
  C8: {
    title: "The Quiet Cut",
    staging:
      "There is a reduction you could make that this quarter needs and almost nobody would notice for a while. The sample is on the counter end and the invoice is folded underneath it.",
  },
  C9: {
    title: "Three Weeks Down",
    staging:
      "Well-funded competition, three straight weeks of decline, staff who have started reading the room, and cash that is tightening. This is the third hard stretch this year.",
  },
};

/** The Level B season. Same shape, different weight. */
export const PRO_MISSIONS: readonly Mission[] = MISSIONS.map((mission) => ({
  ...mission,
  activityId: activityIdFor(mission.competency, "PRO"),
  ...PRO_OVERRIDES[mission.competency],
}));

export function seasonFor(track: Track): readonly Mission[] {
  return track === "PRO" ? PRO_MISSIONS : MISSIONS;
}

/**
 * Who asks the question (PRD §19.5, ADR-006 §9). The host if they are still in
 * the room; the mission's stand-in if it has one; then Priya, who is the anchor
 * and cannot be removed by any world state; then the room itself.
 *
 * The order matters because the alternative is a beat with no speaker, and the
 * dialogue layer has nowhere to put a question nobody is asking.
 */
export function resolveSpeaker(mission: Mission, present: readonly CastId[]): CastId | "room" {
  if (mission.host && present.includes(mission.host)) return mission.host;
  if (mission.standIn === "room") return "room";
  if (mission.standIn && present.includes(mission.standIn)) return mission.standIn;
  if (present.includes("priya")) return "priya";
  return "room";
}

/**
 * The mission at this point in the season, on the track the player answered
 * Priya with. The two seasons run the same nine orders and the same nine weeks,
 * so everything that only cares about *when* you are — the light, whether the
 * café is shut that night, the tracker's ordinal — can keep reading the Level A
 * table and be right on both tracks.
 */
export function missionByOrder(order: number, track: Track = trackOrDefault()): Mission | null {
  return seasonFor(track).find((m) => m.order === order) ?? null;
}

/** The three `decide` beats, which are always the last three of a chain. */
export function decideBeats(mission: Mission): Objective[] {
  return mission.objectives.filter((o) => o.kind === "decide");
}

/**
 * How many of the three beats are behind you. Drives the pips, which are
 * identical to each other on purpose: a pip that looked different for the
 * transfer beat would tell the player which one the model wrote.
 */
export function beatsDone(mission: Mission, objectiveIndex: number): number {
  return mission.objectives.slice(0, objectiveIndex).filter((o) => o.kind === "decide").length;
}

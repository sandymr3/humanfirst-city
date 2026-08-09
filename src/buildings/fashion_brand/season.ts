// MAISON — the season spine (PRD docs/maison.md §8, §10.1).
//
// One collection, nine beats, counting down to the show. Each beat is one
// competency on the player's track: Level A = `SCA`, Level B = `SCB`, both
// slot 03. The countdown is fiction — nothing here is ever on a real timer
// (§3.5); it is what the room feels like, chalked on the atelier's column.
//
// This is the FIRST building-owned folder in the city (master PRD §7.1). MAISON
// owns its spine, its panel and its world state; the framework owns the venue
// record, the renderer and the content registry.

/** The player's track. Level A is the label you started; B is the one you took over. */
export type Track = "A" | "B";

export const TRACK_LEVEL: Record<Track, string> = { A: "SCA", B: "SCB" };

export const TRACK_FRAMING: Record<Track, string> = {
  A: "MAISON is the label you started. Two years old, one boutique, a following that surprises you.",
  B: "MAISON is the label you took over. It has a reputation you inherited and can spend.",
};

/** Where a beat happens, in the house's own words (§7 guided-navigation labels). */
export const STATION_NAME: Record<string, string> = {
  st_rail: "the rail",
  st_bench: "Élise's bench",
  st_desk: "the desk",
  st_boutique_floor: "the floor",
  st_atelier: "the atelier",
  st_press_wall: "the press wall",
};

export interface Beat {
  /** 1–9, the order the season runs in. */
  order: number;
  competency: string;
  /** Competency name as the house would say it, not as a rubric would. */
  competencyName: string;
  station: keyof typeof STATION_NAME | string;
  /** Who brings it (§8), as prose. */
  host: string;
  /** …and as cast ids, so the room knows who to put in it (§5). */
  hosts: string[];
  /** Chalked on the steel column. `after` is the ninth beat — the show happened. */
  countdown: string;
  /** Per-track activity id + title. */
  A: { id: string; title: string };
  B: { id: string; title: string };
  /** One line of staging — what the room is doing when the beat opens (§8). */
  staging: string;
}

export const BEATS: Beat[] = [
  {
    order: 1,
    hosts: ["ines"],
    competency: "C1",
    competencyName: "Problem Sensing",
    station: "st_rail",
    host: "Ines",
    countdown: "11 weeks",
    A: { id: "C1-SCA-03", title: "Three of Mine Asked" },
    B: { id: "C1-SCB-03", title: "The Resale Number" },
    staging:
      "She finishes a call at the rail to tell you three of her clients asked the same question this week. She means it helpfully. She is also repeating something rather than reporting it.",
  },
  {
    order: 2,
    hosts: ["elise", "vera"],
    competency: "C2",
    competencyName: "Learning Agility",
    station: "st_bench",
    host: "Élise",
    countdown: "9 weeks",
    A: { id: "C2-SCA-03", title: "Three Times Faster" },
    B: { id: "C2-SCB-03", title: "The Colour House" },
    staging:
      "The pre-season sell-through, printed, on your side of her bench rather than handed to you. The neutrals are moving three times faster than the vermilion.",
  },
  {
    order: 3,
    hosts: ["helene"],
    competency: "C3",
    competencyName: "Courage to Commit",
    station: "st_rail",
    host: "Hélène",
    countdown: "8 weeks",
    A: { id: "C3-SCA-03", title: "Forty-Eight Hours" },
    B: { id: "C3-SCB-03", title: "Friday" },
    staging:
      "Standing at the rail, touching the fabric. Two offers, one production slot, and Friday. She checks her watch once, without meaning anything by it.",
  },
  {
    order: 4,
    hosts: ["dov"],
    competency: "C4",
    competencyName: "Financial Discipline",
    station: "st_desk",
    host: "Dov",
    countdown: "7 weeks",
    A: { id: "C4-SCA-03", title: "Pre-Orders" },
    B: { id: "C4-SCB-03", title: "Patient Money" },
    staging:
      "Seated. The fabric invoice is on the desk between you, and it has gone up. He has been patient for six weeks and is about to be patient some more, which is the pressure.",
  },
  {
    order: 5,
    hosts: ["rio"],
    competency: "C5",
    competencyName: "Strategic Thinking",
    station: "st_boutique_floor",
    host: "Rio",
    countdown: "5 weeks",
    A: { id: "C5-SCA-03", title: "Your Name On It" },
    B: { id: "C5-SCB-03", title: "Two Seasons" },
    staging:
      "He walks the floor while he talks, which means you turn to follow him, which means the rail is behind him the whole time.",
  },
  {
    order: 6,
    hosts: ["helene"],
    competency: "C6",
    competencyName: "Power & Influence",
    station: "st_rail",
    host: "Hélène",
    countdown: "4 weeks",
    A: { id: "C6-SCA-03", title: "For the Exposure" },
    B: { id: "C6-SCB-03", title: "Pleasantly" },
    staging:
      "Back. Same spot at the rail. A number that would halve your margin, framed as a favour, delivered pleasantly, with Élise visible upstairs.",
  },
  {
    order: 7,
    hosts: ["elise", "kobby"],
    competency: "C7",
    competencyName: "People Management",
    station: "st_atelier",
    host: "Élise / Kobby",
    countdown: "2 weeks",
    A: { id: "C7-SCA-03", title: "Past Ten" },
    B: { id: "C7-SCB-03", title: "One Voice" },
    staging:
      "Past ten. Two machines running. Élise has been in since six and has unpicked the same seam twice. Kobby is downstairs looking at his own piece on the rail.",
  },
  {
    order: 8,
    hosts: ["rio"],
    competency: "C8",
    competencyName: "Value Creation",
    station: "st_desk",
    host: "Rio",
    countdown: "1 week",
    A: { id: "C8-SCA-03", title: "Sold Out" },
    B: { id: "C8-SCB-03", title: "The Placement" },
    staging:
      "The drop is Thursday. There is a shortcut, it is cheap, it works, and everyone in this industry has used it at least once.",
  },
  {
    order: 9,
    hosts: [],
    competency: "C9",
    competencyName: "Perseverance",
    station: "st_press_wall",
    host: "the wall",
    countdown: "after the show",
    A: { id: "C9-SCA-03", title: "Two Clippings" },
    B: { id: "C9-SCB-03", title: "And Then" },
    staging:
      "The show happened. Two clippings are up. One is polite. One is not. Élise is upstairs and has not said anything about either.",
  },
];

/** Every activity id MAISON hosts, both tracks — the venue's hostedActivities. */
export const MAISON_ACTIVITY_IDS: string[] = BEATS.flatMap((b) => [b.A.id, b.B.id]);

/** The (competency, level) lists the season board has to fetch — eighteen of them. */
export const MAISON_LEVELS: { competency: string; level: string }[] = BEATS.flatMap((b) => [
  { competency: b.competency, level: TRACK_LEVEL.A },
  { competency: b.competency, level: TRACK_LEVEL.B },
]);

export const beatForActivity = (id: string): Beat | undefined =>
  BEATS.find((b) => b.A.id === id || b.B.id === id);

export const activityForTrack = (beat: Beat, track: Track) => beat[track];

/**
 * The Café's career ladder — the stage graph (ADR-007 §6).
 *
 * ADR-006's spine is nine missions in a fixed order and one `currentMission`.
 * This branches (accept / retry / exit) and loops (retry re-enters the stage you
 * just left), which a linear runner cannot express. Eleven stages, one array,
 * one reducer.
 *
 * **There are no tiers in this file, and there must never be any.** Which option
 * is Developing, Strong or Advanced — and what each does to revenue — lives in
 * the server's answer key and nowhere else. This file is shipped to a browser
 * and read by anyone who opens the network tab.
 *
 * It mirrors `internal/registry/content/journeys/cafe.json` on the server, which
 * holds the same prose plus the grading criteria. Two copies is the same trade
 * `trees.ts` already makes against `scenarios/cafe.json`: the content has to be
 * in the bundle so a backend outage leaves a playable room rather than an empty
 * one, and the server needs its own copy so nothing a client sends reaches a
 * prompt. Keep them in step by hand; `journey.test.ts` pins the shape.
 */

import type { World, WorldPatch } from "./world";

/** The four postings, in order. Not a score — where you got to. */
export type Role = "candidate" | "employee" | "branch_manager" | "ceo";

export type StageKind = "qa" | "scenarios" | "gate" | "succession" | "exit";

/**
 * One typed question.
 *
 * `competency` is which registry row this is evidence for. It is not a tier and
 * never was — the client has shipped C1..C9 since the first interview — and the
 * per-competency submit cannot be addressed without it.
 */
export interface Question {
  unitId: string;
  competency: string;
  /** Asked in the host's voice. */
  prompt: string;
}

/** One branching decision at a level. */
export interface Scene {
  unitId: string;
  competency: string;
  /** Further competencies this scene is evidence for, if it tests more than one. */
  also?: readonly string[];
  title: string;
  /** The room before anybody speaks. */
  stage: string;
  /** The line that opens it. */
  prompt: string;
  /** Cast id, or "room" when the register is narration. */
  speaker: string;
  /**
   * True when the scene is answered in the player's own words.
   *
   * An open scene ships NO options and NO per-letter consequences, and that
   * absence is load-bearing rather than incidental: the three option texts are
   * now the grading rubric, which makes them answer key, and answer key does
   * not travel to a browser. They live in the server's journey key beside the
   * tiers they describe. `check_journey_mirror.mjs` asserts they are absent
   * here, which is the inverse of what it asserts for a lettered scene.
   */
  open?: boolean;
  /**
   * The one line served when the generator cannot say what happened. Outcome-
   * neutral by construction: there is no letter and no mark to key a tiered
   * line off, and picking one would be a proficiency readout in prose.
   */
  fallbackConsequence?: string;

  /** Keyed by the letter that goes on the wire — "a" | "b" | "c". Lettered scenes only. */
  choices?: Readonly<Record<string, string>>;
  /**
   * The authored consequence per letter, served whenever the generated one is
   * unavailable. Shipped to the browser on purpose: a room that has to wait for
   * a network round trip to say what happened is a room that can stall.
   */
  consequences?: Readonly<Record<string, string>>;
  world?: Readonly<Record<string, WorldPatch>>;
}

/**
 * A CEO scene is one of the existing authored decision trees, played whole. Its
 * prose, its branch-specific follow-up and its nine outcomes are `trees.ts`'s
 * already; only the composed path — "a.c" — goes on the wire.
 */
export interface TreeScene {
  unitId: string;
  competency: string;
  also?: readonly string[];
  title: string;
  activityId: string;
}

export interface Successor {
  key: string;
  name: string;
  profile: string;
  positive: string;
  watchOut: string;
}

export interface Stage {
  id: string;
  kind: StageKind;
  role: Role;
  /** Where in the room it happens. */
  station: string;
  /** Who carries it; null = the room. */
  hostNpc: string | null;
  title: string;
  next: string | null;
  /** Gate stages only. Exit is spelled out so a gate reads whole on its own. */
  accept?: string;
  retry?: string;
  exit?: string;
  questions?: readonly Question[];
  scenes?: readonly Scene[];
  trees?: readonly TreeScene[];
  successors?: readonly Successor[];
  pickUnitId?: string;
  pickCompetency?: string;
}

export const BUILDING_ID = "cafe" as const;
export const START_STAGE = "cafe.interview";

// ── Level 1 · the counter ─────────────────────────────────────────────────────

const L1_SCENES: readonly Scene[] = [
  {
    unitId: "cafe.l1.s1",
    competency: "C1",
    title: "Customer Scene 1 — Customer Needs",
    stage:
      "Mid-morning. The queue is four deep and Nadia is at the front, already reaching for her card.",
    prompt: "You still don't do oat, do you?",
    speaker: "nadia",
    open: true,
    fallbackConsequence:
      "You finish the drink and hand it across. Later that morning the manager reads the board on the way past the fridge.",
  },
  {
    unitId: "cafe.l1.s2",
    competency: "C7",
    title: "Customer Scene 2 — Difficult Customer",
    stage: "A flat white goes out to a table that ordered a cortado. It comes back fast.",
    prompt: "This isn't what I asked for. I've been sitting there ten minutes.",
    speaker: "room",
    open: true,
    fallbackConsequence:
      "The remake goes out. The customer carries it to the window table and stays another twenty minutes.",
  },
  {
    unitId: "cafe.l1.s3",
    competency: "C7",
    title: "Customer Scene 3 — Empathy",
    stage:
      "The till is open and half counted. The door goes, and someone comes in out of the cold looking hopeful.",
    prompt: "Is there any chance of a sandwich? I've come straight off a shift.",
    speaker: "room",
    open: true,
    fallbackConsequence:
      "The register is counted nine minutes later than usual. Tomas is still wiping down when you leave.",
  },
  {
    unitId: "cafe.l1.s4",
    competency: "C1",
    title: "Customer Scene 4 — Process Improvement",
    stage:
      "Marcus has been in his usual chair for an hour. On the way out he stops at the counter.",
    prompt: "It's always a wait to get to you lot. Every time.",
    speaker: "marcus",
    open: true,
    fallbackConsequence:
      "The line clears by ten. The next morning it forms again at the same time, in the same place.",
  },
];

// ── Level 2 · behind the flap ─────────────────────────────────────────────────

const L2_SCENES: readonly Scene[] = [
  {
    unitId: "cafe.l2.s1",
    competency: "C7",
    title: "Team Scene 1 — Attendance",
    stage:
      "Fifth morning running, the opener comes through the door with the queue already outside it.",
    prompt: "Sorry — sorry. Buses.",
    speaker: "room",
    open: true,
    fallbackConsequence:
      "She opens on time on Thursday. On Friday the bus is late again, and this time she texts ahead.",
  },
  {
    unitId: "cafe.l2.s2",
    competency: "C7",
    also: ["C5"],
    title: "Team Scene 2 — Conflict Between Team Members",
    stage:
      "Twelve forty. The chef and one of the counter staff are going at it over the pass, in front of everybody.",
    prompt: "Tell him. Tell him what he just did.",
    speaker: "tomas",
    open: true,
    fallbackConsequence:
      "The rush ends. Both of them work the rest of the shift, and the pass stays quiet until close.",
  },
  {
    unitId: "cafe.l2.s3",
    competency: "C7",
    title: "Team Scene 3 — Recognizing Good Work",
    stage:
      "A customer arrives furious about something that happened somewhere else, and leaves twenty minutes later laughing.",
    prompt: "(You watched the whole thing from the pass.)",
    speaker: "room",
    open: true,
    fallbackConsequence:
      "The shift ends. On Saturday the same customer comes back and asks for her by name at the counter.",
  },
  {
    unitId: "cafe.l2.s4",
    competency: "C5",
    title: "Team Scene 4 — Holiday Workload",
    stage: "Six weeks of the busiest trading in the year, and the team has gone quiet about it.",
    prompt: "We doing the same as last year, then.",
    speaker: "tomas",
    open: true,
    fallbackConsequence:
      "The schedule goes up on Sunday. By Tuesday two people have swapped a shift between themselves without asking you.",
  },
];

// ── Succession ────────────────────────────────────────────────────────────────

const SUCCESSORS: readonly Successor[] = [
  {
    key: "a",
    name: "The Influencer",
    profile:
      "Sold her own café because she could not run it alone. Wants back in, has no capital, and offers you twenty percent of profits to take it on.",
    positive: "A real audience that already follows her, and it would follow her here.",
    watchOut: "She may rebrand it. In a year this room could look like nothing you built.",
  },
  {
    key: "b",
    name: "Your Branch Manager",
    profile:
      "Five years in this building, knows every supplier and every rhythm of it, and has wanted the top job for most of that time.",
    positive: "Nobody would need to explain anything to him. Continuity from the first morning.",
    watchOut: "Two people have said he speaks to them badly on the floor, in front of customers.",
  },
  {
    key: "c",
    name: "The Eighteen-Year-Old",
    profile:
      "His mother ran a café when he was small and he grew up in it. He has wanted this since before he could legally be employed.",
    positive: "More energy and genuine appetite for it than the other two put together.",
    watchOut: "He has never managed money or people, and this would be both from day one.",
  },
];

const SUCCESSION_SCENES: readonly Scene[] = [
  {
    unitId: "cafe.succession.q1",
    competency: "C8",
    title: "Succession Interview 1 — Growing the Business",
    stage: "You ask all three the same two questions. This is the first.",
    prompt: "How would you make this place more money than I did?",
    speaker: "room",
    choices: {
      a: "I'd hire two more people and add signature items, because the menu hasn't moved in years and the team is stretched thin.",
      b: "I'd rebrand around what people are actually sharing, but keep what the regulars come for, since the traffic is worth nothing if they leave.",
      c: "I'd automate the machines and bring in better equipment, because the place runs on old kit and speed is where the money leaks.",
    },
    consequences: {
      a: "A sound answer, and a costly one. They have priced the hires and not the season that pays for them.",
      b: "They talk about the regulars for longer than they talk about the rebrand, which was not what you expected.",
      c: "They know the equipment catalogue well. They do not mention a single person who works here.",
    },
    world: { b: { regulars: "steady" }, c: { machine: "upgraded" } },
  },
  {
    unitId: "cafe.succession.q2",
    competency: "C2",
    title: "Succession Interview 2 — Receiving Feedback",
    stage: "The second question, and the one you actually care about.",
    prompt: "Someone tells you you're getting it wrong. Then what?",
    speaker: "room",
    choices: {
      a: "I act on feedback that comes with evidence, and I'll ask what's behind the rest, because not every firm opinion is about the business.",
      b: "I hold myself to a high standard and I don't make many mistakes, so there isn't usually much to go back over.",
      c: "I take feedback well and adjust my approach whenever I get it, because the people around me see things I can't.",
    },
    consequences: {
      a: "They ask you which feedback you ignored, and whether you were right to. It is a better question than yours.",
      b: "They say it evenly, without hedging. You cannot tell whether it is confidence or whether nobody has ever told them.",
      c: "They mean it. You wonder, briefly, what happens the first time two people tell them opposite things.",
    },
    world: { a: { staff: "trusting" }, c: { staff: "easy" } },
  },
];

// ── The spine ─────────────────────────────────────────────────────────────────

export const STAGES: readonly Stage[] = [
  {
    id: "cafe.interview",
    kind: "qa",
    role: "candidate",
    station: "st_tables",
    hostNpc: "owen",
    title: "The Interview",
    next: "cafe.gate1",
    questions: [
      {
        unitId: "cafe.interview.q1",
        competency: "C6",
        prompt: "Tell me about yourself.",
      },
      {
        unitId: "cafe.interview.q2",
        competency: "C2",
        prompt: "Why did you choose the Café?",
      },
      {
        unitId: "cafe.interview.q3",
        competency: "C2",
        prompt: "Tell me about a challenge you faced and how you handled it.",
      },
      {
        unitId: "cafe.interview.q4",
        competency: "C8",
        prompt: "What are your strengths, and one area you want to grow?",
      },
      {
        unitId: "cafe.interview.q5",
        competency: "C6",
        prompt:
          "A colleague on your shift gets an order wrong in front of a customer. How do you respond?",
      },
    ],
  },
  {
    id: "cafe.gate1",
    kind: "gate",
    role: "candidate",
    station: "st_tables",
    hostNpc: "owen",
    title: "The Offer",
    next: null,
    accept: "cafe.l1",
    retry: "cafe.interview",
    exit: "cafe.exit",
  },
  {
    id: "cafe.l1",
    kind: "scenarios",
    role: "employee",
    station: "st_counter",
    hostNpc: "priya",
    title: "The Counter",
    next: "cafe.review1",
    scenes: L1_SCENES,
  },
  {
    id: "cafe.review1",
    kind: "qa",
    role: "employee",
    station: "st_tables",
    hostNpc: "owen",
    title: "Your First Review",
    next: "cafe.gate2",
    questions: [
      {
        unitId: "cafe.review1.q1",
        competency: "C8",
        prompt: "What did you do well as an Employee?",
      },
      { unitId: "cafe.review1.q2", competency: "C6", prompt: "Why do you want to be promoted?" },
      {
        unitId: "cafe.review1.q3",
        competency: "C2",
        prompt: "What is the one thing you want to work on?",
      },
    ],
  },
  {
    id: "cafe.gate2",
    kind: "gate",
    role: "employee",
    station: "st_tables",
    hostNpc: "owen",
    title: "The Branch",
    next: null,
    accept: "cafe.l2",
    retry: "cafe.review1",
    exit: "cafe.exit",
  },
  {
    id: "cafe.l2",
    kind: "scenarios",
    role: "branch_manager",
    station: "st_pass",
    hostNpc: "tomas",
    title: "Behind the Flap",
    next: "cafe.review2",
    scenes: L2_SCENES,
  },
  {
    id: "cafe.review2",
    kind: "qa",
    role: "branch_manager",
    station: "st_tables",
    hostNpc: "owen",
    title: "Your Second Review",
    next: "cafe.gate3",
    questions: [
      {
        unitId: "cafe.review2.q1",
        competency: "C8",
        prompt: "What did you do well as a Branch Manager?",
      },
      {
        unitId: "cafe.review2.q2",
        competency: "C6",
        prompt: "Why do you want to be promoted to CEO?",
      },
      {
        unitId: "cafe.review2.q3",
        competency: "C2",
        prompt: "What is the one thing you want to work on as CEO?",
      },
    ],
  },
  {
    id: "cafe.gate3",
    kind: "gate",
    role: "branch_manager",
    station: "st_tables",
    hostNpc: "owen",
    title: "The Whole Thing",
    next: null,
    accept: "cafe.l3",
    retry: "cafe.review2",
    exit: "cafe.exit",
  },
  {
    id: "cafe.l3",
    kind: "scenarios",
    role: "ceo",
    station: "st_tables",
    hostNpc: null,
    title: "Running It",
    next: "cafe.succession",
    // The four CEO scenes ARE the existing authored trees, played whole, with
    // their branch-specific follow-up and their nine outcomes unchanged.
    trees: [
      {
        unitId: "cafe.l3.s1",
        competency: "C2",
        title: "Business Scene 1 — A New Product Underperforming",
        activityId: "C2-SCA-01",
      },
      {
        unitId: "cafe.l3.s2",
        competency: "C3",
        also: ["C6"],
        title: "Business Scene 2 — The Food Truck Request",
        activityId: "C3-SCA-01",
      },
      {
        unitId: "cafe.l3.s3",
        competency: "C4",
        title: "Business Scene 3 — A Good Month, A Slower Stretch Ahead",
        activityId: "C4-SCA-01",
      },
      {
        unitId: "cafe.l3.s4",
        competency: "C9",
        title: "Business Scene 4 — New Competition Across the Street",
        activityId: "C9-SCA-01",
      },
    ],
  },
  {
    id: "cafe.succession",
    kind: "succession",
    role: "ceo",
    station: "st_tables",
    hostNpc: null,
    title: "Who Gets It",
    next: "cafe.exit",
    successors: SUCCESSORS,
    pickUnitId: "cafe.succession.pick",
    pickCompetency: "C5",
    scenes: SUCCESSION_SCENES,
  },
  {
    id: "cafe.exit",
    kind: "exit",
    role: "ceo",
    station: "st_door",
    hostNpc: null,
    title: "The Door",
    next: null,
  },
];

const BY_ID: ReadonlyMap<string, Stage> = new Map(STAGES.map((s) => [s.id, s]));

export function stageById(id: string): Stage | undefined {
  return BY_ID.get(id);
}

/** Every scene in a stage, one-beat and two-beat alike, in play order. */
export function unitsOf(stage: Stage): string[] {
  const out = (stage.scenes ?? []).map((s) => s.unitId);
  for (const t of stage.trees ?? []) out.push(t.unitId);
  if (stage.pickUnitId) out.unshift(stage.pickUnitId);
  return out;
}

export function sceneOf(stage: Stage, unitId: string): Scene | undefined {
  return (stage.scenes ?? []).find((s) => s.unitId === unitId);
}

export function treeOf(stage: Stage, unitId: string): TreeScene | undefined {
  return (stage.trees ?? []).find((t) => t.unitId === unitId);
}

/**
 * Where a gate's three roads go. Exit is a first-class one — a player who takes
 * the job and leaves after the counter has played a complete journey, and the
 * report says so.
 */
export function gateRoads(stage: Stage): { accept: string; retry: string; exit: string } | null {
  if (stage.kind !== "gate" || !stage.accept || !stage.retry || !stage.exit) return null;
  return { accept: stage.accept, retry: stage.retry, exit: stage.exit };
}

/** The world write a choice earns, if it earns one. */
export function worldFor(scene: Scene, choice: string): WorldPatch | undefined {
  return scene.world?.[choice];
}

/**
 * Which competencies a set of decisions is evidence for, and which units and
 * questions to name under each.
 *
 * This is the join the per-competency submit is addressed by: the journey never
 * submits per scene, it accumulates and then settles into the nine registry rows
 * the building already owns (ADR-007 §8). A scene testing two competencies is
 * named under both — L2's conflict scene is people management and strategy at
 * once, and pretending otherwise would throw away half of what it measured.
 */
export function evidenceByCompetency(
  decided: readonly { unitId: string; choice: string }[],
  qaDone: readonly string[],
): Map<string, { units: { unitId: string; choice: string }[]; qa: { unitId: string }[] }> {
  const out = new Map<
    string,
    { units: { unitId: string; choice: string }[]; qa: { unitId: string }[] }
  >();
  const bucket = (comp: string) => {
    let b = out.get(comp);
    if (!b) out.set(comp, (b = { units: [], qa: [] }));
    return b;
  };

  const unitComps = new Map<string, string[]>();
  const qaComps = new Map<string, string>();
  for (const stage of STAGES) {
    for (const sc of stage.scenes ?? [])
      unitComps.set(sc.unitId, [sc.competency, ...(sc.also ?? [])]);
    for (const t of stage.trees ?? []) unitComps.set(t.unitId, [t.competency, ...(t.also ?? [])]);
    if (stage.pickUnitId && stage.pickCompetency)
      unitComps.set(stage.pickUnitId, [stage.pickCompetency]);
    for (const q of stage.questions ?? []) qaComps.set(q.unitId, q.competency);
  }

  for (const d of decided) {
    for (const comp of unitComps.get(d.unitId) ?? []) bucket(comp).units.push(d);
  }
  for (const unitId of qaDone) {
    const comp = qaComps.get(unitId);
    if (comp) bucket(comp).qa.push({ unitId });
  }
  return out;
}

/** Postings in order, so a role can never be walked backwards. */
const ROLE_RANK: Readonly<Record<Role, number>> = {
  candidate: 0,
  employee: 1,
  branch_manager: 2,
  ceo: 3,
};

export function outranks(a: Role, b: Role): boolean {
  return ROLE_RANK[a] > ROLE_RANK[b];
}

/** The posting a player holds, as the room's own words. */
export const ROLE_LABEL: Readonly<Record<Role, string>> = {
  candidate: "Candidate",
  employee: "Employee",
  branch_manager: "Branch Manager",
  ceo: "CEO",
};

/** Whether the counter flap is yours yet — the promotion beat, physically. */
export function mayPassFlap(role: Role): boolean {
  return role === "branch_manager" || role === "ceo";
}

export type { World };

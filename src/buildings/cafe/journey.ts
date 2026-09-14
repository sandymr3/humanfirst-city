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
  /**
   * The room before anybody speaks, where the content has one.
   *
   * Optional since the scenarios became the workbook's: it states a case in a
   * single line and writes nothing around it, so inventing a paragraph to sit
   * above that line is exactly the dramatisation that was asked to stop.
   */
  stage?: string;
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
    prompt: "A regular customer asks if you carry oat milk. You don't.",
    speaker: "nadia",
    choices: {
      a: "You apologize, offer the closest substitute you have (soy or almond), and let them know you'll pass along that they asked. You jot a note on the back-of-house whiteboard so the manager sees it at shift change.",
      b: "You apologize and quickly suggest soy milk instead so the line keeps moving. The customer accepts, gets their drink, and you move to the next order.",
      c: "You apologize, offer a substitute for today, and also ask a follow-up question — “Is oat milk something you'd want every visit, or just curious today?” Based on the answer, you log the request with context (how often they'd buy, any dietary reason mentioned) in the shared suggestions log, and mention to your manager that this is the third oat-milk ask this week, not just one customer's preference.",
    },
    consequences: {
      a: "You write it up between orders. At handover Priya reads the board, adds a tally mark under it, and says nothing.",
      b: "She takes the soy without comment and is gone in ninety seconds. The queue moves. By the afternoon you have forgotten she asked.",
      c: "She says every visit — she has been buying it at the place by the station on the way in. Priya's eyebrows go up when you tell her.",
    },
  },
  {
    unitId: "cafe.l1.s2",
    competency: "C7",
    title: "Customer Scene 2 — Difficult Customer",
    prompt: "A customer is upset — they were given the wrong order.",
    speaker: "room",
    choices: {
      a: "You apologize once, quickly remake the correct item, and hand it over without further comment so the line keeps moving and the customer isn't kept waiting any longer.",
      b: "You apologize sincerely, remake the order right away, and offer a small goodwill gesture (a free cookie or discount on their next visit). You check that they're satisfied before they leave.",
      c: "You apologize sincerely and remake the order immediately, same as above — but you also glance at the ticket to see where the mix-up happened (mislabeled cup? two similar names called back-to-back?), mention it to a teammate calmly and non-accusingly, and flag it to your manager as a pattern to watch rather than a one-off mistake. You check in with the customer, and if they're a regular, you make a mental note to greet them warmly next visit to rebuild trust.",
    },
    consequences: {
      a: "They take the cortado and sit back down. Nothing more is said about it, then or later.",
      b: "They leave warmer than they arrived and wave on the way out. Priya notices the comp on the till and asks nothing about it.",
      c: "The ticket shows two names called within a few seconds of each other. You mention it to Tomas, who nods slowly and looks at the rail.",
    },
  },
  {
    unitId: "cafe.l1.s3",
    competency: "C7",
    title: "Customer Scene 3 — Empathy",
    prompt:
      "Five minutes after closing, someone walks in hungry and asks if they can still get a sandwich.",
    speaker: "room",
    choices: {
      a: "You explain kindly that the kitchen and register are already closing down, but you check with your shift lead whether one quick sandwich is still doable without throwing off the close. If yes, you make it fast; if not, you point them to another place nearby that's still open and apologize for the timing.",
      b: "You firmly but politely explain that you're closed and the till is already being counted, so you're not able to serve them tonight — rules keep the closing process fair and consistent for everyone.",
      c: "You check with your shift lead the same way as a quick, fair call — and beyond just resolving tonight, you mention to your manager afterward that a few people have shown up right at close asking for food, and suggest it might be worth stocking a couple of grab-and-go items that don't need the full kitchen open, so late arrivals can still be helped without disrupting the close process.",
    },
    consequences: {
      a: "Tomas shrugs and says go on then. They eat it standing up and thank you twice on the way out.",
      b: "They take it well and go back out into the cold. The close runs exactly to time, the way it always does.",
      c: "Tomas makes the sandwich. The next morning Priya asks you how often this has been happening, and writes the answer down.",
    },
  },
  {
    unitId: "cafe.l1.s4",
    competency: "C1",
    title: "Customer Scene 4 — Process Improvement",
    prompt: "A customer complains there's always a long wait to reach the counter.",
    speaker: "marcus",
    choices: {
      a: "You apologize for the wait, tell them you appreciate the patience, and get back to taking orders as quickly as you can to help the line move.",
      b: "You apologize, and later mention to your manager that customers have been complaining about the line, especially in the mornings — you suggest opening a second register during the rush based on what you've noticed.",
      c: "You apologize, and afterward start actually tracking it for a few days — roughly how long the line gets and at what times, and whether it's the ordering step or the pickup step that backs up. You bring your manager the pattern (e.g., “mornings 8–9am, the bottleneck is order-taking, not the kitchen”) with a specific proposal — like a second register or splitting simple/complex orders — and suggest measuring wait times for two weeks after the change to see if it actually worked.",
    },
    consequences: {
      a: "He nods and goes. The queue clears by half ten, the way it does most days, and nobody mentions it again.",
      b: "Priya says she has wondered the same thing. She asks when exactly, and you realise you are guessing.",
      c: "Four mornings of scribbles say eight to nine, and it is order-taking, not the kitchen. Priya reads it twice.",
    },
  },
];

// ── Level 2 · behind the flap ─────────────────────────────────────────────────

const L2_SCENES: readonly Scene[] = [
  {
    unitId: "cafe.l2.s1",
    competency: "C7",
    title: "Team Scene 1 — Attendance",
    prompt: "Employee keeps clocking late every day.",
    speaker: "room",
    choices: {
      a: "You ask the employee to step aside for a quick private word and ask what's been making mornings hard for them lately, listening before responding. Together you agree on one clear expectation going forward, and you let them know you'll check back in a week to see how it's going.",
      b: "You ask the employee to step aside and ask what's been making mornings hard, listening before responding, while also noting that a couple of other openers have been trickling in late lately too. You agree on a plan with this employee, and separately look at whether the opening shift itself needs adjusting.",
      c: "You pull the employee aside before their shift and let them know the lateness has been noticed, reminding them that punctuality matters for the team and for customers waiting at open. You make a mental note in case it keeps happening and head back to prepping for the day ahead.",
    },
    consequences: {
      a: "It turns out to be a school run that moved. You shift their start by fifteen minutes and the lateness stops that week.",
      b: "The school run explains theirs. The rota explains the other two — the opening shift starts fifteen minutes before the first bus arrives.",
      c: "They are on time the next day, and the day after. They also stop asking you things they used to ask you.",
    },
  },
  {
    unitId: "cafe.l2.s2",
    competency: "C7",
    also: ["C5"],
    title: "Team Scene 2 — Conflict Between Team Members",
    prompt: "Conflict between chef and employee.",
    speaker: "tomas",
    choices: {
      a: "You step in while it's happening, tell both of them to knock it off and get back to work since customers are waiting, and figure it's just a rough day between two people who don't always get along. You check the rest of the shift ran fine and move on to the next task.",
      b: "Once the rush dies down, you pull each of them aside separately to hear their side of it without interrupting, then bring them together so they can agree on how to handle the next busy stretch. You let them both know you're available if anything like it comes up again.",
      c: "Once the rush dies down, you hear each of them out separately, then bring them together to agree on how they'll handle the next busy stretch. You also use the moment to set one simple, shared ground rule for how disagreements get handled mid-shift, so the next one doesn't need you in the middle.",
    },
    consequences: {
      a: "The rush finishes. Neither of them says anything else about it, to you or to each other, for the rest of the week.",
      b: "Each of them had half the story. They shake on how to handle the next one, and the next one goes fine.",
      c: "They agree the rule between themselves — flag it, park it, finish the rush. Three weeks later they use it without telling you.",
    },
  },
  {
    unitId: "cafe.l2.s3",
    competency: "C7",
    title: "Team Scene 3 — Recognizing Good Work",
    prompt: "You notice great customer service by an employee.",
    speaker: "room",
    choices: {
      a: "You notice the great service in the moment, tell the employee it was great with that customer as you pass by, and keep moving since it's a busy shift and there's still a line at the counter.",
      b: "You pull the employee aside briefly to name specifically what they did well and why it mattered to the customer, and you mention it at the shift handover so the next manager sees it too. It goes into the shift log as a positive note on their record.",
      c: "You name specifically what the employee did well and why it mattered to the customer, and mention it at the handover so it's visible. You also start thinking about a simple way to recognize moments like this going forward, so it's something the whole team can work toward.",
    },
    consequences: {
      a: "They smile and carry on. By the end of the shift you are not sure they registered which customer you meant.",
      b: "They go slightly pink and say it was nothing. It is in the log at handover, and the evening manager mentions it too.",
      c: "The log entry lands. So does the question you leave with Priya about how anyone else's good weeks get seen.",
    },
  },
  {
    unitId: "cafe.l2.s4",
    competency: "C5",
    title: "Team Scene 4 — Holiday Workload",
    prompt: "Process improvement — team demotivated about holiday workload.",
    speaker: "tomas",
    choices: {
      a: "You gather the team for a quick pep talk, remind everyone it's only for a few weeks, and tell them you know they can push through it like every year has gone before, same as always. You handle any complaints about the schedule as they come up during the busy stretch itself.",
      b: "You sit down with the team and ask what specifically feels heaviest about the next few weeks, then adjust breaks and bring in some extra weekend coverage based on what people tell you. You check back in partway through the season to see whether it's actually helping.",
      c: "You ask the team what specifically feels heaviest about the next few weeks, and also map out the season's schedule now instead of week to week, lining up extra coverage before the busiest stretch hits. You think ahead to how the team feels coming out of it, not just getting through it.",
    },
    consequences: {
      a: "They say the right things and go back to work. Two of them book leave in the first week of January.",
      b: "It is the back-to-back weekends, not the hours. You split them differently and the mood lifts by the second week.",
      c: "The whole season goes up on the wall in one go. People start swapping shifts with each other instead of with you.",
    },
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
    stage: "You ask all three the same two questions. This is the first.",
    title: "Succession Interview 1 — Growing the Business",
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
    stage: "The second question, and the one you actually care about.",
    title: "Succession Interview 2 — Receiving Feedback",
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
        prompt: "Strengths and one area to grow?",
      },
      {
        unitId: "cafe.interview.q5",
        competency: "C6",
        prompt: "Professional Responses.",
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
        prompt: "Why do you want to be promoted?",
      },
      {
        unitId: "cafe.review2.q3",
        competency: "C2",
        prompt: "What is the one thing you want to work on?",
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

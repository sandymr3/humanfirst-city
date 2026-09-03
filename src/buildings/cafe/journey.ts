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
  /** Keyed by the letter that goes on the wire — "a" | "b" | "c". */
  choices: Readonly<Record<string, string>>;
  /**
   * The authored consequence per letter, served whenever the generated one is
   * unavailable. Shipped to the browser on purpose: a room that has to wait for
   * a network round trip to say what happened is a room that can stall.
   */
  consequences: Readonly<Record<string, string>>;
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
    title: "The Dairy-Free Question",
    stage:
      "Mid-morning. The queue is four deep and Nadia is at the front, already reaching for her card.",
    prompt: "You still don't do oat, do you?",
    speaker: "nadia",
    choices: {
      a: "Apologise, offer soy for today, and write the request on the back-of-house board so the manager sees it at shift change.",
      b: "Apologise and offer soy so the line keeps moving, because the queue is backing up and she still gets her drink.",
      c: "Apologise, offer soy, and ask whether she'd want oat every visit, because that answer is what the manager needs, not the ask itself.",
    },
    consequences: {
      a: "You write it up between orders. At handover Priya reads the board, adds a tally mark under it, and says nothing.",
      b: "She takes the soy without comment and is gone in ninety seconds. The queue moves. By the afternoon you have forgotten she asked.",
      c: "She says every visit — she has been buying it at the place by the station on the way in. Priya's eyebrows go up when you tell her.",
    },
    world: { a: { chalkboard: "oat_asked" }, c: { chalkboard: "oat_asked" } },
  },
  {
    unitId: "cafe.l1.s2",
    competency: "C7",
    title: "The Wrong Order",
    stage: "A flat white goes out to a table that ordered a cortado. It comes back fast.",
    prompt: "This isn't what I asked for. I've been sitting there ten minutes.",
    speaker: "room",
    choices: {
      a: "Apologise once and remake it straight away, because they have waited long enough already and the rest of the queue is watching.",
      b: "Apologise, remake it, then glance at the ticket to see where it went wrong, since two similar names called together will do this again.",
      c: "Apologise, remake it, and put something on the house, then check they are happy before they go, because a bad visit rarely ends at the counter.",
    },
    consequences: {
      a: "They take the cortado and sit back down. Nothing more is said about it, then or later.",
      b: "The ticket shows two names called within a few seconds of each other. You mention it to Tomas, who nods slowly and looks at the rail.",
      c: "They leave warmer than they arrived and wave on the way out. Priya notices the comp on the till and asks nothing about it.",
    },
    world: { b: { staff: "easy" }, c: { regulars: "steady" } },
  },
  {
    unitId: "cafe.l1.s3",
    competency: "C7",
    title: "Five Past Close",
    stage:
      "The till is open and half counted. The door goes, and someone comes in out of the cold looking hopeful.",
    prompt: "Is there any chance of a sandwich? I've come straight off a shift.",
    speaker: "room",
    choices: {
      a: "Ask your shift lead whether one sandwich still fits the close, and if not, point them somewhere open nearby rather than just turning them away.",
      b: "Explain kindly that the till is counted and the kitchen is down, because closing works only if it means the same thing every night.",
      c: "Check with your shift lead tonight, and mention to the manager that late arrivals keep happening, because a grab-and-go shelf would settle it permanently.",
    },
    consequences: {
      a: "Tomas shrugs and says go on then. They eat it standing up and thank you twice on the way out.",
      b: "They take it well and go back out into the cold. The close runs exactly to time, the way it always does.",
      c: "Tomas makes the sandwich. The next morning Priya asks you how often this has been happening, and writes the answer down.",
    },
    world: { a: { staff: "trusting" }, c: { staff: "trusting" } },
  },
  {
    unitId: "cafe.l1.s4",
    competency: "C1",
    title: "The Queue",
    stage:
      "Marcus has been in his usual chair for an hour. On the way out he stops at the counter.",
    prompt: "It's always a wait to get to you lot. Every time.",
    speaker: "marcus",
    choices: {
      a: "Apologise for the wait and get back to taking orders quickly, because the fastest thing you can do right now is move the queue.",
      b: "Apologise, then track for a few days when it backs up and whether it is ordering or pickup, because those two need different fixes.",
      c: "Apologise, then tell your manager the mornings are the problem and suggest a second register, since you are the one watching it build up.",
    },
    consequences: {
      a: "He nods and goes. The queue clears by half ten, the way it does most days, and nobody mentions it again.",
      b: "Four mornings of scribbles say eight to nine, and it is order-taking, not the kitchen. Priya reads it twice.",
      c: "Priya says she has wondered the same thing. She asks when exactly, and you realise you are guessing.",
    },
    world: { b: { regulars: "steady" }, c: { regulars: "steady" } },
  },
];

// ── Level 2 · behind the flap ─────────────────────────────────────────────────

const L2_SCENES: readonly Scene[] = [
  {
    unitId: "cafe.l2.s1",
    competency: "C7",
    title: "The Late Opener",
    stage:
      "Fifth morning running, the opener comes through the door with the queue already outside it.",
    prompt: "Sorry — sorry. Buses.",
    speaker: "room",
    choices: {
      a: "Ask quietly what is making mornings hard, listen first, then agree one clear expectation and tell them you will check back in a week.",
      b: "Take them aside before the shift and remind them punctuality matters, because openers who drift make the whole morning start behind.",
      c: "Ask what is making mornings hard, and separately look at the opening shift itself, because two other openers have been trickling in late too.",
    },
    consequences: {
      a: "It turns out to be a school run that moved. You shift their start by fifteen minutes and the lateness stops that week.",
      b: "They are on time the next day, and the day after. They also stop asking you things they used to ask you.",
      c: "The school run explains theirs. The rota explains the other two — the opening shift starts fifteen minutes before the first bus arrives.",
    },
    world: { a: { staff: "trusting" }, b: { staff: "strained" }, c: { staff: "trusting" } },
  },
  {
    unitId: "cafe.l2.s2",
    competency: "C7",
    also: ["C5"],
    title: "The Line, Mid-Rush",
    stage:
      "Twelve forty. The chef and one of the counter staff are going at it over the pass, in front of everybody.",
    prompt: "Tell him. Tell him what he just did.",
    speaker: "tomas",
    choices: {
      a: "Step in now and tell them both to leave it until later, because customers are waiting and the rush is not the place for this.",
      b: "Hear them out separately, bring them together, and set one shared rule for mid-shift disagreements, so the next one does not need you in it.",
      c: "Once it quietens, hear each of them out alone, and bring them together to agree how they will handle the next busy stretch.",
    },
    consequences: {
      a: "The rush finishes. Neither of them says anything else about it, to you or to each other, for the rest of the week.",
      b: "They agree the rule between themselves — flag it, park it, finish the rush. Three weeks later they use it without telling you.",
      c: "Each of them had half the story. They shake on how to handle the next one, and the next one goes fine.",
    },
    world: { a: { staff: "strained" }, b: { staff: "trusting" }, c: { staff: "trusting" } },
  },
  {
    unitId: "cafe.l2.s3",
    competency: "C7",
    title: "The Good Save",
    stage:
      "A customer arrives furious about something that happened somewhere else, and leaves twenty minutes later laughing.",
    prompt: "(You watched the whole thing from the pass.)",
    speaker: "room",
    choices: {
      a: "Name exactly what they did and why it mattered, then put it in the shift log so the next manager sees it too.",
      b: "Tell them it was good work as you pass, because the shift is busy and a quick word still lands in the moment.",
      c: "Name what they did and log it, and start working out how moments like this get noticed routinely rather than whenever you happen past.",
    },
    consequences: {
      a: "They go slightly pink and say it was nothing. It is in the log at handover, and the evening manager mentions it too.",
      b: "They smile and carry on. By the end of the shift you are not sure they registered which customer you meant.",
      c: "The log entry lands. So does the question you leave with Priya about how anyone else's good weeks get seen.",
    },
    world: { a: { staff: "trusting" }, c: { staff: "trusting" } },
  },
  {
    unitId: "cafe.l2.s4",
    competency: "C5",
    title: "The Holiday Rota",
    stage: "Six weeks of the busiest trading in the year, and the team has gone quiet about it.",
    prompt: "We doing the same as last year, then.",
    speaker: "tomas",
    choices: {
      a: "Ask what specifically feels heaviest, then move breaks and add weekend cover based on what they say, and check partway whether it helped.",
      b: "Gather everyone for a quick lift and remind them it is a few weeks, because this team has come through every season so far.",
      c: "Ask what feels heaviest, and map the whole season's rota now instead of weekly, because cover lined up late is cover nobody feels.",
    },
    consequences: {
      a: "It is the back-to-back weekends, not the hours. You split them differently and the mood lifts by the second week.",
      b: "They say the right things and go back to work. Two of them book leave in the first week of January.",
      c: "The whole season goes up on the wall in one go. People start swapping shifts with each other instead of with you.",
    },
    world: { a: { staff: "trusting" }, b: { staff: "strained" }, c: { staff: "trusting" } },
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
    title: "How Would You Grow It?",
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
    title: "How Would You Take It?",
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
        prompt: "Start me off. Who am I talking to?",
      },
      {
        unitId: "cafe.interview.q2",
        competency: "C2",
        prompt: "Why this place? You could pull shots anywhere on this street.",
      },
      {
        unitId: "cafe.interview.q3",
        competency: "C2",
        prompt: "Tell me about something that went wrong on you, and what you did about it.",
      },
      {
        unitId: "cafe.interview.q4",
        competency: "C8",
        prompt: "What are you good at, and what are you still working on?",
      },
      {
        unitId: "cafe.interview.q5",
        competency: "C6",
        prompt:
          "Last one. Someone on your shift gets an order wrong in front of a customer. What do you say to them?",
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
        prompt: "You've had a few months on the counter. What did you do well?",
      },
      { unitId: "cafe.review1.q2", competency: "C6", prompt: "Why do you want the branch?" },
      {
        unitId: "cafe.review1.q3",
        competency: "C2",
        prompt: "What's the one thing you'd work on?",
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
        prompt: "You've had the branch for a while now. What did you do well?",
      },
      {
        unitId: "cafe.review2.q2",
        competency: "C6",
        prompt: "Why should the whole thing be yours?",
      },
      {
        unitId: "cafe.review2.q3",
        competency: "C2",
        prompt: "Last time you named something you wanted to work on. Where did that get to?",
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
        title: "The Drink That Didn't",
        activityId: "C2-SCA-01",
      },
      {
        unitId: "cafe.l3.s2",
        competency: "C3",
        also: ["C6"],
        title: "The Truck",
        activityId: "C3-SCA-01",
      },
      { unitId: "cafe.l3.s3", competency: "C4", title: "The Good Month", activityId: "C4-SCA-01" },
      {
        unitId: "cafe.l3.s4",
        competency: "C9",
        title: "The Place Across the Street",
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

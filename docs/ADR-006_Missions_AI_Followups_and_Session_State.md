# ADR-006 — Buildings as missions: a quest spine, an AI third beat, and session state that survives the door

_The City · Interior Framework · v1.0 · 2026-08-04 · **Status: Accepted** · Deciders: KK (product), santhosh / hrithik / uganthan (eng)_

_Extends **[ADR-005 v2.0](ADR-005_Interior_Framework.md)** (the interior engine, the scene data model, the silent-tier contract, accessibility). **Supersedes ADR-005 §19** (AI content policy) and **amends ADR-005 §9–§10** (the scenario script and the scoring model). Backend contract: **[PRD_Backend_Missions.md](PRD_Backend_Missions.md)**. Consumers: [Café](PRD_Building_Cafe.md) · [MAISON](PRD_Building_MAISON.md) · [MERIDIAN](PRD_Building_MERIDIAN.md)._

> **Read this if you are building a building.** ADR-005 tells you what a room is. This tells you what _happens_ in it: how nine competencies become nine missions, how a mission is a chain of things you go and do rather than a question that appears, where the AI is allowed to write and where it is forbidden, how a decision is scored across three beats, and what gets written to the server and when. If you want to change something in here, that is a framework issue and a maintainer PR — never a building-local fork.

---

## 1. TL;DR

A building stops being a list of nine decisions staged in a room and becomes **a season of nine missions played in order**.

A mission is a chain of small, concrete objectives — _go to the counter · wait for Nadia · talk to Nadia · decide · decide again · tell Priya_ — with the next one always readable in a **tracker panel in the top-left corner**. You are never handed a question. You go somewhere, someone arrives, and the question is the thing they say.

Each mission's decision is now **three beats, not two**:

```
   beat 1                    beat 2                     beat 3
   SEED                      FOLLOW-UP                  TRANSFER
   authored, from the        authored, branch-specific  AI-generated at runtime,
   blueprint                 to the seed choice         from BOTH prior choices
   3 options                 3 options                  3 options
   ─────────────────────────────────────────────────────────────────────────
   asked by the mission's host NPC · same voice for all three · always
```

The third beat is written by a model **on the server**, in the voice of the NPC who asked the first two, about the specific path this player actually took. It carries its own three plausible-peer options and its own three tiers, and **those tiers never leave the server** — the client receives opaque option ids. If the model is unavailable, or its output fails any validation gate, an authored scripted third beat is served instead and the player cannot tell the difference. There is no path where the mission breaks.

Scoring composes on top of what already exists, so **not one authored `terminals` table changes**:

```
finalOutcome = round( 0.7 × authoredTerminal  +  0.3 × aiTierValue )
             ≡  0.42 × seed  +  0.28 × follow  +  0.30 × transfer
```

And the season is durable: mission index, objective index, world state and the partial decision path are pushed to the backend as you play, debounced, and **flushed on the way out the door** with `sendBeacon`. Walk out mid-mission, close the tab, come back tomorrow — you resume standing where you were, with the room you made.

---

## 2. Context

### 2.1 What ADR-005 built, and what it left as a gap

ADR-005 gave every building a room, a cast, a nine-tree scenario script and a server-authoritative scoring path. That shipped: Café and MAISON are both walkable, MAISON carries all eighteen trees and 162 leaves, and the silent-tier contract holds end to end.

What it did not give them is **a spine you can feel**. In the shipped MAISON, `nextBeat()` picks the next undecided competency, `liveBeatAt()` makes it live when you approach its station, and that is the whole of the structure. It works, and it is invisible: there is no statement of what you are doing, no sense of a thing being _started_ and _finished_, and no reason to walk anywhere except that a station happens to be hot. A player who steps away for two minutes has nothing to come back to except a room.

### 2.2 What the brief now asks for

Three things, in the product owner's words:

1. **"It should be following like a story… completing each mission one by one, the next mission appearing at the top left corner."** A visible, ordered, one-at-a-time quest structure.
2. **"Each mission shall be like a quest to go to the café counter to begin the quest, and an NPC arrives and talks — or go talk to an NPC character, or do some tasks within the café."** The decision must be _arrived at_, not _served_. Objectives, not triggers.
3. **"For each NPC conversation or task, follow-up scenario-based questions shall be generated and asked by the NPC… for the option they have chosen and their previous paths… analysed by the backend for scoring."** A personalised transfer question, in the same voice, that counts.

Plus two operational requirements: **"on leaving the building, the session state shall be saved to the backend dynamically"**, and **"there shall not be any breaking at edge case scenario — if it is not an NPC asking the question, choose the best possible."**

### 2.3 Why the third beat is the interesting part

The two authored beats measure _judgment_ and _consistency_: you make a call, then the world pushes back and we find out whether the call was real or lucky. That is exactly what ADR-005 §10.2's seed/follow-up matrix was built to catch, and it works.

What neither beat measures is **transfer** — whether the reasoning generalises to a situation the learner has not read before. An authored third beat cannot measure it either, because it would be the same third beat for everyone on that branch, and by the second building a learner is pattern-matching against a fixed corpus.

A question generated _from this player's actual path_, naming the thing _they_ actually did, is a different instrument. It cannot be pre-read, it cannot be looked up, and it is the closest thing to a live interviewer this product can afford. That is the case for spending money and complexity on it.

### 2.4 The constraint that shapes everything below

**The silent-tier contract (ADR-005 §11) is not negotiable, and generated content is the easiest way to break it.** A model that writes three options will, unprompted, write the good one longer, hedge the weak one, and cheerfully add "unfortunately" to a consequence. Every gate in §8 exists because of that, and the gates are blocking rather than advisory for the same reason.

---

## 3. Requirements this decision must satisfy

### 3.1 Functional

| ID      | Requirement                                                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1**  | A building presents **nine missions in a fixed order**. Mission _n+1_ is not available, visible or spoilable until _n_ closes.                  |
| **M2**  | A mission is a chain of **typed objectives**. At least one objective in every mission is a movement or a conversation, never only a decision.   |
| **M3**  | The **current objective is always readable** without opening anything, in a persistent panel anchored top-left.                                 |
| **M4**  | Objectives complete **on approach or on act**, never on a timer. The fiction applies pressure; the game does not.                               |
| **M5**  | Each mission's decision is **three beats**: authored seed → authored branch-specific follow-up → **generated transfer question**.               |
| **M6**  | The transfer question is generated from **both prior choices and the room's current state**, and asked **in the voice of the beat's host NPC**. |
| **M7**  | Speaker resolution **never fails**. Where no NPC can plausibly speak, the object or the room speaks — never a context-free question box.        |
| **M8**  | Generation failure is **invisible to the player**. A scripted third beat is served and the mission completes normally.                          |
| **M9**  | Scoring stays **entirely server-side** and composes across all three beats. The client learns nothing about quality at any point.               |
| **M10** | Session state is **written to the backend during play and flushed on exit**, and a returning player resumes at the objective they left.         |
| **M11** | The tracker and every generated line are **real DOM**, announced, keyboard-reachable, and free of tier vocabulary.                              |

### 3.2 Non-functional

| ID     | Requirement                                                                                                                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **N1** | Transfer-question latency ≤ **2.5 s p95** from the player committing beat 2 to the NPC speaking beat 3. Beyond 4 s, the fallback is served instead — a slow question is a broken conversation. |
| **N2** | The interior stays inside ADR-005 §15's frame budget with the tracker mounted. The tracker is DOM; it must not cause a canvas relayout.                                                        |
| **N3** | Generation cost is bounded and observable: one call per mission per attempt, rate-limited per user, cached per path signature.                                                                 |
| **N4** | Every state write is idempotent and last-write-wins on an explicit revision, so a flaky connection never corrupts a season.                                                                    |
| **N5** | A backend outage degrades to today's behaviour (local persistence, unscored close), never to a lost season.                                                                                    |

### 3.3 Constraints

- Three developers, one building each, one shared Go service. The backend contract must be settled in **one** document before any of them starts (that is [PRD_Backend_Missions.md](PRD_Backend_Missions.md)).
- Buildings never call the model and never call `fetch` (ADR-005 §8.4). Both remain framework responsibilities.
- The 54 authored trees and their `terminals` tables are done and reviewed. **Nothing in this ADR may require re-authoring them.**
- Additive-only within backend API v1.

---

## 4. Options considered

### Option A — Scripted third beat, no AI

Author a third beat per branch: 9 competencies × 2 tracks × 3 branches = **54 per building, 162 across the three**, each with three options and three consequences.

| Dimension         | Assessment                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Cost              | Very high — roughly 1,500 new authored strings for three buildings, each needing a tier assignment and a plausible-peers audit |
| Risk              | Low technically, high editorially (prose fatigue is exactly what produces marked options — ADR-005 §20.2)                      |
| Measures transfer | **No.** Fixed corpus; learnable by the second building                                                                         |
| Latency           | Zero                                                                                                                           |

**Rejected as the primary path**, but note it is not wasted: a _reduced_ version of it (18 per building, §8.5) is the mandatory fallback, and that reduction is what makes the option affordable at all.

### Option B — AI-generated free-text answer, graded by the existing `ai` rubric

The NPC asks a generated question; the player types a short answer; `internal/scoring`'s existing `ai` rubric kind and `GeminiGrader` score it 1–3 per criterion.

| Dimension     | Assessment                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------- |
| Cost          | Low — the grading half already exists and is tested                                                |
| Signal        | Richest of the four options                                                                        |
| Accessibility | Poor. A typing task in the middle of a walking game, on a keyboard-only path, at 35–50, on a phone |
| Consistency   | Two model calls per mission; grading variance is real and unbounded                                |
| Silent tier   | Hardest to hold — free-text grading wants to return feedback, and feedback is a verdict            |

**Rejected.** The blueprint is an options-based instrument end to end (`Playroom Scenarios.xlsx` gives three choices and three tiers for every row); making the last beat a different instrument breaks comparability across the twelve buildings and across the two tracks.

### Option C — AI-generated three-option third beat, tiers held server-side ✅

The model writes the question, three plausible-peer options, one consequence each, and a tier per option. All of it stays on the server; the client receives the prompt, three option texts, and three opaque ids.

| Dimension     | Assessment                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------- |
| Cost          | Medium — one new endpoint, one table, one validation layer, one fallback bank of 18 per building  |
| Signal        | Good — measures transfer, personalised, unlearnable                                               |
| Accessibility | Identical to beats 1 and 2. Nothing new to learn                                                  |
| Silent tier   | **Structurally safe** — the tier is not in the payload, so it cannot leak through the network tab |
| Latency       | The real cost. §7.4 is how it is paid                                                             |

**Chosen.**

### Option D — Client-side generation

Rejected outright. It puts the tier, the rationale and the model key in the browser, and it makes scoring client-influenced. It violates ADR-005 §11 and §19 simultaneously.

---

## 5. Decision

**Option C, inside a mission spine.**

1. **Nine ordered missions per building**, each a chain of typed objectives, surfaced by a framework-owned **top-left mission tracker**. §6.
2. **Three beats per mission**: two authored (unchanged), one generated. §7.
3. **All generation is server-side**, behind `POST /api/v1/ai/followup`, with blocking validation gates and a mandatory authored fallback bank of 18 per building. §8.
4. **Speaker resolution is a deterministic four-step function** that cannot fail. §9.
5. **Scoring composes 0.7 / 0.3** over the unchanged authored terminal. §10.
6. **Session state is synced during play and flushed on exit**, with a local mirror. §11.
7. **ADR-005 §19 is superseded** by §12 below: the model may author beat 3 and ambient chatter, and nothing else, ever.

New framework surface, all maintainer-owned:

```
src/framework/mission/
  schema.ts          # Mission, Objective, MissionSpine (Zod)
  runner.ts          # the state machine: which mission, which objective, what closes it
  MissionTracker.tsx # the top-left panel — DOM, live region, collapsible
  speaker.ts         # resolveSpeaker() — §9
src/framework/session/
  sync.ts            # debounced writes, rev handling, sendBeacon flush
  mirror.ts          # localStorage fallback, same interface
src/framework/interior/scenario/
  transfer.ts        # fetch beat 3, render, submit; fallback-transparent
```

Buildings ship `missions.ts` and a `followups/` fallback bank, and nothing else new.

---

## 6. The mission model

> **v1.1 · superseded for the Café by [ADR-007 §6](ADR-007_The_Career_Journey.md); in force everywhere else.** The spine below is strictly linear — nine missions, order 1..9, one `currentMission`. The Café's career journey branches (accept / retry / exit) and loops (retry re-enters the stage it came from), which a linear runner cannot express, so that building runs a **stage graph** instead. What survives the swap and is still normative there: the `Objective` shape and its six kinds, the rule that a stage opening on a decision is a modal with a title, objectives completing on approach or act, nothing on a timer, and every rule in §6.3's tracker table. Only the _spine_ changed; the _grammar of a mission_ did not.

### 6.1 Shape

```ts
// src/framework/mission/schema.ts  (framework-owned)

export type ObjectiveKind =
  | "go_to" // walk to a station
  | "wait_for" // someone arrives; the room stages it
  | "talk_to" // start a conversation with an NPC
  | "inspect" // read/handle a prop: the board, the rail, the letter tray, the till
  | "decide" // one of the three beats
  | "report"; // go and tell someone what you did

export interface Objective {
  id: string;
  kind: ObjectiveKind;
  /** The line shown in the tracker, in the room's own words. Never "Press E to interact". */
  label: string;
  /** kind-specific target: a station id, an npc id, a prop id, or a beat name. */
  target: string;
  /** Optional line the room or an NPC says when this objective becomes current. */
  cue?: string;
  /** Optional line said when it completes. */
  ack?: string;
  /** Announced to the live region instead of `label`, when the label is too terse alone. */
  announce?: string;
}

export interface Mission {
  /** 1..9 — the order the season runs in. */
  order: number;
  id: string; // "cafe-m1"
  competency: string; // "C1"
  /** The house's name for it, not the rubric's. Shown in the tracker. */
  title: string;
  /** Per-track registry activity id — this is what gets submitted. */
  activity: { SCA: string; SCB: string };
  /** Where it happens and who carries it (ADR-005 §8 staging table). */
  station: string;
  hostNpc: string | null; // null = the room/an object carries it
  /** One line of staging, played when the mission opens. */
  staging: string;
  objectives: Objective[]; // ordered; the three `decide` beats are always the last three
  /** Applied when the mission closes, whatever was chosen. Guarantees M2's visible change. */
  closeWorldState: Record<string, string>;
  /** 2–3 legal world writes the transfer beat may pick from. Server-validated (§8.4). */
  aiWorldCandidates: Array<Record<string, string>>;
}

export interface MissionSpine {
  buildingId: string;
  missions: Mission[]; // length 9, order 1..9, strictly sequential
}
```

Note what is **absent**, for the same reason ADR-005 §9.1 gave: no tier, no score, no weight, no `isCorrect`. A mission file is safe to ship to a browser.

### 6.2 The rules

- **Strictly linear.** `runner.ts` exposes exactly one `currentMission` and one `currentObjective`. Mission 4's title is not fetched, rendered or announced while mission 3 is open.
- **The last three objectives of every mission are the three `decide` beats**, in order `seed → follow → transfer`. This is a schema invariant, checked in CI, and it is what lets the tracker's three-pip indicator be framework code rather than per-building code.
- **Every mission has at least one `go_to` or `talk_to` before its first `decide`.** M2. A mission that opens on a decision is a modal with a title.
- **Objectives complete on approach or act.** `go_to` completes on entering the station radius; `wait_for` completes when the staged arrival finishes its walk; `talk_to` and `inspect` complete on the act key or a click; `decide` completes on committing a choice; `report` completes on the act key at the named NPC.
- **Nothing is on a timer.** A player may stand in the room for ten minutes between objectives. `wait_for` is a staged arrival, not a countdown, and it begins when the preceding objective completes.
- **`closeWorldState` is mandatory and non-empty.** ADR-005's "every decision produces a visible change" becomes checkable: the change is authored at mission level and fires regardless of what was chosen, so it can never be read as a verdict on the choice.

### 6.3 The mission tracker

A DOM panel, anchored **top-left of the interior viewport**, inside the interior's own layer so it leaves the city HUD alone.

**Contents, top to bottom:**

```
┌──────────────────────────────┐
│  MISSION 3 OF 9              │   ← ordinal, small caps
│  The Truck                   │   ← mission title
│  ──────────────────────────  │
│  › Talk to Ray at the window │   ← current objective, the only one shown
│                              │
│  ● ● ○                       │   ← three-pip beat indicator, only once a decide starts
└──────────────────────────────┘
```

**Rules:**

| Rule                                                                                                                                                                      | Why                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Only the current objective is shown.** Not the list, not what is next.                                                                                                  | The tracker is a compass, not a walkthrough. Showing the chain spoils the staging.                               |
| Collapses to a single title line with **`M`**, and the collapsed state persists in the session blob.                                                                      | ADR-005 §14.2 already uses `M` for the station list; the tracker owns the same key and toggles both.             |
| `aria-live="polite"` fires on **objective change and mission change**, never on every frame.                                                                              | ADR-005 §14.3. Announcement text is `announce ?? label`.                                                         |
| Real `<button>` for collapse; the panel is in normal focus order; visible focus ring.                                                                                     | ADR-005 §14.1. Nothing readable is ever a canvas texture.                                                        |
| **No tier. No proficiency. No per-mission coin figure. No ✓/✗ on a completed mission** — completed missions are simply gone from the tracker.                             | ADR-005 §11.1. The tracker is the single most tempting place in the product to add a score, and it is forbidden. |
| The three pips fill as beats commit. They are **position indicators, not quality indicators** — identical colour, identical shape, no animation difference between beats. | Same.                                                                                                            |
| Under `prefers-reduced-motion`, the panel does not animate between objectives; it cuts.                                                                                   | ADR-005 §14.5.                                                                                                   |

**The one visible ordinal is deliberate.** "Mission 3 of 9" tells the player how much season is left, which is the pacing information they legitimately need, and tells them nothing about how they are doing.

### 6.4 Worked example — Café mission 1

| #   | Objective  | Target     | Label                         | Cue                                                  |
| --- | ---------- | ---------- | ----------------------------- | ---------------------------------------------------- |
| 1   | `go_to`    | `st_till`  | _take the till_               | —                                                    |
| 2   | `wait_for` | `nadia`    | _8:05 — the bell_             | Nadia comes in fast, already reaching for her card   |
| 3   | `talk_to`  | `nadia`    | _serve Nadia_                 | —                                                    |
| 4   | `decide`   | `seed`     | _decide_                      | Nadia: _"You still don't do oat, do you?"_           |
| 5   | `decide`   | `follow`   | _decide_                      | (branch-specific, authored — PRD_Building_Cafe §9.3) |
| 6   | `decide`   | `transfer` | _decide_                      | (generated, in Nadia's voice — §7)                   |
| 7   | `report`   | `priya`    | _tell Priya where you landed_ | Priya, not looking up: _"So what are we doing?"_     |

Seven objectives, one decision, and the player walked, waited, served and reported. That is the difference between a mission and a question.

---

## 7. The three-beat decision

### 7.1 The shape

```
                        ┌─ a ─┐
   SEED ────────────────┼─ b ─┼──►  FOLLOW-UP (branch-specific, authored)
   authored, blueprint  └─ c ─┘         │
                                        │  ┌─ a ─┐
                                        └──┼─ b ─┼──►  TRANSFER (generated from BOTH)
                                           └─ c ─┘         │
                                                           │  ┌─ opt ─┐
                                                           └──┼─ opt ─┼──►  mission closes
                                                              └─ opt ─┘
```

Beats 1 and 2 are exactly what ADR-005 §9.2 specified and what the three PRDs already contain: nine authored leaves per tree, nine rubric terminals, unchanged. Beat 3 hangs off the leaf.

### 7.2 What beat 3 is for

Beats 1 and 2 ask _what do you do_ and _now that the world has answered, what do you do_. Beat 3 asks **the question an interviewer would ask third**: it names what this player actually did, moves the situation somewhere they have not read about, and finds out whether the reasoning was portable or situational.

It is deliberately **not** a harder version of beat 2. Where beat 2 tests consistency inside the same problem, beat 3 tests transfer to an adjacent one — a different pressure, a different stakeholder, a longer horizon, or the same decision arriving again in a changed room.

### 7.3 The wire

Two calls per mission, both framework-owned.

**Generate** (after beat 2 commits, before the NPC speaks):

```jsonc
POST /api/v1/ai/followup
{
  "activityId": "C1-SCA-01",
  "track": "SCA",
  "buildingId": "cafe",
  "path": ["c", "b"],                 // seed choice, follow-up choice
  "speakerId": "nadia",               // resolved client-side by §9, validated server-side
  "worldState": { "chalkboard": "oat_asked", "regulars": "thin", "till": "tight" }
}
→ 200
{
  "followupId": "fu_01J8...",
  "source": "ai",                     // "ai" | "fallback" — telemetry only, never rendered
  "speaker": { "id": "nadia", "name": "Nadia", "role": "the commuter" },
  "prompt": "Six weeks on, the 7:50 window is yours again — and the station café has started opening at seven. Nadia, on her way out: \"You going to keep doing this every time they move?\"",
  "options": [
    { "id": "o_7f2a", "text": "..." },
    { "id": "o_c104", "text": "..." },
    { "id": "o_39be", "text": "..." }
  ]
}
```

**Submit** (unchanged endpoint, additive fields):

```jsonc
POST /api/v1/progress/C1-SCA-01/submit
{
  "clientVersion": "city@0.3.0",
  "durationSec": 412,
  "hintsUsed": 0,
  "result": {
    "trace": {
      "path": ["C1-SCA-01.seed", "C1-SCA-01.c",
               "C1-SCA-01.c.follow", "C1-SCA-01.c.b"],
      "followupId": "fu_01J8...",
      "followupChoice": "o_c104"
    }
  }
}
→ { "proficiency": 3, "coinsEarned": 25, "coinBalance": 340, "badgesAwarded": [] }
```

`path` is byte-identical to what ADR-005 §9.3 specified. `followupId` and `followupChoice` are optional additions; a submit without them scores exactly as it does today. That is what makes this additive rather than a migration.

### 7.4 Latency, and what the player sees while waiting

Generation is fired **the instant beat 2 commits**, in parallel with beat 2's consequence playing in the room. The consequence takes 4–6 seconds to read (ADR-005 §9.3, and every PRD's leaf spec), which is the budget the generation runs inside. In the normal case the question is already in hand before the player has finished reading why the almond cartons expired.

| Elapsed       | Behaviour                                                                                                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 s           | Beat 2 commits. `POST /ai/followup` fires. Beat 2's consequence begins playing.                                                                                                     |
| ≤ 2.5 s (p95) | Response in hand, held until the consequence finishes.                                                                                                                              |
| 2.5–4 s       | Consequence has finished; the NPC does an idle beat — Priya wipes down, Grace finishes what she is doing, Élise looks up from the bench. Captioned, unremarkable, and in character. |
| > 4 s         | Request abandoned. The scripted fallback (§8.5) is served. **The player is never told.**                                                                                            |

The idle beat is not a spinner and must not be one. A loading indicator in the middle of a conversation is the single most immersion-breaking thing this feature could ship, and it also tells the player that this question is different from the last two — which is information they should not have.

### 7.5 Replay and resume

- **Resume.** If a session is restored with a `pendingFollowupId`, the stored question is re-served from the database verbatim. It is never regenerated — a player who closes the tab and comes back must not find a different question waiting.
- **Replay.** Replaying a completed competency generates a **fresh** transfer question, because the player's path may differ. The server keeps `bestProficiency` (unchanged behaviour).
- **Idempotency.** Re-submitting the same `followupId` + `followupChoice` yields the same score. `consumed_at` is a telemetry timestamp, not a lock — a retry after a dropped connection must succeed.

---

## 8. The generation contract

Everything in this section is normative. Where a rule says _blocking_, failing it means the generated content is discarded and the fallback is served.

### 8.1 Where generation happens

**Server-side only.** The client sends the path and the world state; it receives prose and opaque ids. The prompt template, the persona cards, the tier vocabulary, the model's rationale and the API key exist only in the Go service. A curious learner reading the network tab sees three sentences and three hex strings.

### 8.2 What the model is given

| Input                                                                                                  | Source                                                                    |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Competency + subtopic, with the definition the rubric uses                                             | `internal/registry/content/c{n}.json`                                     |
| The building's fiction and the mission's staging                                                       | building `missions.ts`, mirrored server-side in the followup content pack |
| The **NPC persona card** — who they are, how they speak, three sample lines, what they would never say | the building PRD §5, mirrored in the content pack                         |
| The seed prompt and **the exact option text the player chose**                                         | authored tree                                                             |
| The follow-up prompt and **the exact option text the player chose**                                    | authored tree                                                             |
| Track (`SCA` = 16–21 / `SCB` = 35–50) and what changes between them                                    | ADR-005 §11.4 rule 8                                                      |
| Current world state, as a **whitelisted key→value map**                                                | building world-state schema                                               |
| `aiWorldCandidates` — the 2–3 legal world writes this beat may pick from                               | mission definition                                                        |
| The plausible-peers rules, verbatim                                                                    | ADR-005 §11.4                                                             |

### 8.3 What the model must return

```jsonc
{
  "prompt": "…",                       // ≤ 60 words, ends in the NPC's question
  "options": [
    { "text": "…", "tier": "developing", "consequence": "…", "world": { "chalkboard": "direct" } },
    { "text": "…", "tier": "strong",     "consequence": "…", "world": { … } },
    { "text": "…", "tier": "advanced",   "consequence": "…", "world": { … } }
  ]
}
```

`world` is optional per option and must be one of `aiWorldCandidates` exactly. Anything else is dropped and the mission's `closeWorldState` covers the visible change.

### 8.4 The validation gates — all blocking

Run in order; the first failure discards the whole generation.

| #   | Gate                        | Rule                                                                                                                                                                                                                                                   |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Schema**                  | Parses; exactly 3 options; every field present; prompt ≤ 60 words; each option 13–33 words; each consequence ≤ 45 words.                                                                                                                               |
| 2   | **Tier completeness**       | Exactly one `developing`, one `strong`, one `advanced`.                                                                                                                                                                                                |
| 3   | **Choice-length parity**    | Longest − shortest option ≤ **8 words** (ADR-005 §11.4 rule 2). This is the gate that fires most often; it is also the one that matters most.                                                                                                          |
| 4   | **Tier-vocabulary leak**    | No `Developing`/`Strong`/`Advanced` as capitalised labels, no proficiency numbers, no `n/3`, no pass/fail phrasing anywhere in `prompt`, `options[].text` or `consequence`.                                                                            |
| 5   | **Verdict language**        | No "unfortunately", "you should have", "the better move", "the right call", "correct", "well done", "mistake", "wisely" in any consequence. Consequences report facts (ADR-005 §11.4 rule 6).                                                          |
| 6   | **Self-justification**      | Every option contains a reason clause. If only two options explain themselves, the third is marked (ADR-005 §11.4 rule 3). Heuristic: each option must contain at least one of a small connective set (`because`, `and`, `—`, `so`, `since`, `while`). |
| 7   | **Path reference**          | The prompt must reference the player's actual prior situation — checked by requiring ≥ 2 content tokens shared with the chosen seed or follow-up option text. A generic question is a failed generation.                                               |
| 8   | **World-write legality**    | Any `world` object is a member of `aiWorldCandidates`, verbatim.                                                                                                                                                                                       |
| 9   | **Building-specific gates** | MERIDIAN's **no-advice rule** (PRD_Building_MERIDIAN §11.1): no second-person guidance about real money. Applied as a phrase blocklist plus a shape check. Other buildings may register their own.                                                     |
| 10  | **Injection hardening**     | World-state values are echoed from a closed enum, never free text. Nothing the player typed reaches the prompt, because the player never types.                                                                                                        |

**One regeneration attempt** on failure, with the failed gate named in the retry instruction. Second failure → fallback. Both outcomes are logged with the gate id, because gate-failure rates are the only honest measure of whether the prompt is good.

### 8.5 The fallback bank

**18 authored third beats per building — 9 competencies × 2 tracks.** Branch-agnostic (it does not know which of the nine leaves you reached) but **world-state aware** (it may vary its opening clause on one world key). Authored to exactly the same standard as beats 1 and 2, audited by the same fresh reader, tier-mapped in the same server-only place.

Stored as content, not code: `internal/registry/content/followups/{building}.json`, hot-reloadable via the existing `POST /api/v1/admin/registry/reload`.

Served when: the model is unconfigured · the call errors · the call exceeds 4 s · both generation attempts fail a gate · the user is over their generation rate limit.

**A building with a missing fallback entry is a blocking defect**, checked by `validate_registry`. This is what makes "no breaking at edge case" a property of the system rather than an intention.

### 8.6 Caching and cost

- Cache key: `(activityId, track, seedChoice, followChoice, worldStateSignature)`. A pool of up to **4 accepted variants** per key; a request draws one at random and stores its own row in `ai_followups` (so the tier lookup is per-player and per-attempt, never shared).
- Cold pools can be warmed offline by an admin job, which also gives the fresh-reader audit something to read before launch.
- Rate limit: per user, per hour, sized to a full nine-mission season plus headroom for replays. Over the limit → fallback, silently.
- **Model:** provider-agnostic behind a `FollowupGenerator` interface, beside the existing `scoring.Grader`. Recommended runtime model **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) — the latency budget in §7.4 is the binding constraint and Haiku meets it. The existing Gemini client stays as a configured alternative. Authoring the fallback bank and warming the cache offline is a job for a larger model.

---

## 9. Speaker resolution

> **The rule:** the follow-up is asked by the person who asked the question. Where that is impossible, something in the room asks it. There is no state in which a question appears with no one attached to it.

`resolveSpeaker(mission, room, worldState)` — framework-owned, pure, four steps, total:

| Step | Condition                                                                                                                                             | Result                                                                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `mission.hostNpc` is set **and** that NPC is present in the room under the current world state                                                        | The host NPC. **This is the case ~95% of the time and it is the intended one.**                                                                                                 |
| 2    | Otherwise, an NPC is present in the player's current zone                                                                                             | The nearest such NPC, by walk distance. They speak _about_ the absent host where the fiction needs it (_"Ray hasn't been back. But you've still got Saturday to answer for."_)  |
| 3    | Otherwise, the building's **anchor NPC** — Priya (Café) · Élise (MAISON) · Grace (MERIDIAN) — who is present in **every** world state by construction | The anchor NPC. Each building must guarantee its anchor is unremovable; this is an acceptance criterion.                                                                        |
| 4    | Otherwise (`hostNpc: null` by design — the night beat, the letter tray, the wall of screens)                                                          | **The object speaks**, as narration in the room's voice, attributed to the prop that carries the mission. The dialogue layer renders the prop's name where a portrait would go. |

Notes:

- The resolved id is sent to the generator so the prose is written in that voice, and echoed back so the dialogue layer renders the right name and portrait. A mismatch between requested and returned speaker is a client-side error and falls back to step 3.
- **Missions with `hostNpc: null` are not an edge case to be tolerated but a deliberate register** — the Café's week-8 night beat is alone on purpose, and MERIDIAN's C9 is delivered by six screens. Step 4 is a first-class path, not a failure mode.
- Step 2's "speaks about the absent host" line is **authored per mission**, not generated, because it is the one place where an NPC comments on another's absence and getting the tone wrong is expensive.

---

## 10. Scoring

### 10.1 The arithmetic

Tier values are unchanged from ADR-005 §10.1: **Developing 15 · Strong 60 · Advanced 95**.

The authored pair still resolves through the existing nine-entry `terminals` map, still meaning `0.6 × seed + 0.4 × follow`. **Every terminals table in every building PRD is unchanged.** The transfer beat composes on top:

```
finalOutcome = round( 0.7 × authoredTerminal  +  0.3 × aiTierValue )
```

`round` is half-away-from-zero (Go's `math.Round`). Effective weights across the three beats: **seed 0.42 · follow 0.28 · transfer 0.30**.

`scoreMap` is **unchanged** — the range is still 15…95:

```jsonc
"scoreMap": [
  { "minOutcome": 74, "proficiency": 3 },
  { "minOutcome": 42, "proficiency": 2 },
  { "minOutcome": 0,  "proficiency": 1 }
]
```

### 10.2 The full outcome table

Rows are the nine authored terminals (ADR-005 §10.1); columns are the transfer tier.

| authored (seed → follow)       | + Developing | + Strong    | + Advanced  |
| ------------------------------ | ------------ | ----------- | ----------- |
| **95** Advanced → Advanced     | **71** · P2  | **85** · P3 | **95** · P3 |
| **81** Advanced → Strong       | **61** · P2  | **75** · P3 | **85** · P3 |
| **74** Strong → Advanced       | **56** · P2  | **70** · P2 | **80** · P3 |
| **63** Advanced → Developing   | **49** · P2  | **62** · P2 | **73** · P2 |
| **60** Strong → Strong         | **47** · P2  | **60** · P2 | **71** · P2 |
| **47** Developing → Advanced   | **37** · P1  | **51** · P2 | **61** · P2 |
| **42** Strong → Developing     | **34** · P1  | **47** · P2 | **58** · P2 |
| **33** Developing → Strong     | **28** · P1  | **41** · P1 | **52** · P2 |
| **15** Developing → Developing | **15** · P1  | **29** · P1 | **39** · P1 |

Read the table and it says three things worth stating out loud, because the end-of-journey report will have to say them:

- **A blown transfer costs a perfect run its P3.** 95 + Developing = 71. You saw it, you held it, and then the same judgment did not survive contact with a new shape. That is Strong, not Advanced, and it should be.
- **A good transfer cannot rescue two bad calls.** 15 + Advanced = 39, still P1. One good answer out of three is not a competency.
- **The middle of the table is generous to recovery.** 47 (misread it, then corrected properly) + Strong = 51 → P2, and 42 (right instinct, poor follow-through) + Advanced = 58 → P2. The instrument rewards learning inside a mission, which is the behaviour the product exists to produce.

### 10.3 Rubric extension

`traceRubric` gains one optional block. Nothing else changes.

```jsonc
"rubric": {
  "kind": "trace",
  "terminals": { /* unchanged nine entries */ },
  "scoreMap":  [ /* unchanged */ ],
  "aiBeat": {
    "weight": 0.3,
    "tierValues": { "developing": 15, "strong": 60, "advanced": 95 },
    "required": false
  }
}
```

`required: false` means a submit with no `followupId` scores on the authored terminal alone. This keeps every `BEGINNER`/`MEDIUM` activity, every legacy client and every degraded path working unchanged.

### 10.4 Coins

Unchanged: `{1: 5, 2: 15, 3: 25}` (`Playroom Scenarios.xlsx` → `Rules`; ADR-005 §10.4). Server-computed, credited once per first pass, idempotent, and rendered by the client without comment. The transfer beat earns no coins of its own — the mission is the unit.

### 10.5 The mentor lifeline, resolved properly

The `BANK` blueprint sheet scores C2's mentor consultation as _0–1 uses = Developing · 2 = Strong · all 3 = Advanced_. With two beats, ADR-005-era PRDs could only offer two consultation opportunities and recorded the divergence as a compromise (MAISON §9.6, MERIDIAN §9.7).

**Three beats restores the blueprint exactly.** Sam (MERIDIAN) and Véra (MAISON) are a scored option at each of the three beats, and 0–1 / 2 / 3 uses map to Developing / Strong / Advanced through the tier maps as written. The compromise is withdrawn; the two PRDs are updated to say so.

For the transfer beat this means the generator is given the consultation as a **required option shape** for C2 — one of the three options must be "go and ask them" — with its tier fixed by how many times the player has already consulted. That is the one place a mission constrains generation beyond §8, and it is recorded here rather than in a building.

---

## 11. Session state

### 11.1 What is stored

One blob per user per building, plus one city-wide blob.

```ts
// building session — PUT /api/v1/city/buildings/{buildingId}/state
{
  rev: number,                       // monotonic, client-echoed
  track: "SCA" | "SCB",
  missionOrder: number,              // 1..9, the mission in progress
  objectiveIndex: number,            // index into that mission's objectives
  partialPath: string[],             // choices committed in the current tree
  pendingFollowupId: string | null,  // §7.5 — the question waiting to be re-served
  world: Record<string, string>,     // the building's world-state map (ADR-005 §12)
  playerCell: [number, number],      // where they were standing
  trackerCollapsed: boolean,
  updatedAt: string
}
```

```ts
// city state — PUT /api/v1/city/state   (the old BE-8)
{ rev, track, ftue: Record<string, boolean>, lastDistrict: string, lastTile: [number, number] }
```

**The track lives in city state, not building state.** ADR-005 §10.7 makes it one choice for the whole city; storing it per building would let the two drift.

### 11.2 When it is written

| Trigger                                  | Timing                                              |
| ---------------------------------------- | --------------------------------------------------- |
| Mission opens                            | immediate                                           |
| Objective completes                      | debounced 800 ms                                    |
| Beat commits (any of the three)          | immediate — this is the one that must never be lost |
| World-state write                        | debounced 800 ms, coalesced with the above          |
| Player crosses a zone boundary           | debounced 800 ms (position only)                    |
| **Exit through the door**                | **immediate, flushed**                              |
| `pagehide` / `visibilitychange → hidden` | **immediate, flushed**                              |

### 11.3 The exit flush

```
player presses E at the door
  → runner freezes; no further objective can complete
  → build the blob
  → navigator.sendBeacon("/api/v1/city/buildings/cafe/state", blob)
  → if sendBeacon returns false: fetch(..., { method: "POST", keepalive: true })
  → mirror to localStorage regardless
  → fade to black, dispose the interior, resume the city
```

`sendBeacon` requires `POST` and does not send an `Authorization` header, so **BE-16 exposes `POST` alongside `PUT` and accepts a short-lived signed token in the body** for the beacon path only. The details are [PRD_Backend_Missions.md §4.3](PRD_Backend_Missions.md); what matters here is that the exit path never blocks the fade and never loses the season.

### 11.4 Conflict and offline

- **Conflict:** the client echoes the `rev` it last read. A stale `rev` gets `409` plus the server's current document; the client adopts the server's copy if its `updatedAt` is newer, otherwise re-applies its own diff and retries once. Two tabs in the same building is the case this exists for.
- **Offline:** `mirror.ts` writes the identical blob to `localStorage` behind the same interface (the existing `eggStore` / `maisonStore` pattern). On the next successful load the local blob is pushed if its `updatedAt` is newer. A backend outage degrades to exactly today's behaviour — the season persists locally, submits report plainly that nothing scored them, and the room still moves, because **the room moves on the trace and never on the score**.
- **Size bound:** 16 KB per blob, enforced server-side. A building whose world state does not fit in that has too much world state (ADR-005 §12 caps it at about a dozen keys).

---

## 12. AI content policy — superseding ADR-005 §19

Stated as rules, with no exceptions.

**AI may:**

1. Author the **transfer beat** — its prompt, its three options, its three consequences, its three tiers, and one world write drawn from a server-supplied closed set. Server-side, through §8's gates, with §8.5's fallback behind it.
2. Vary **ambient NPC chatter** — the line a barista says while wiping the counter, the small talk in the branch queue. Unscored, never anchored to a decision station, length-capped, schema-validated.

**AI may never:**

3. Author, vary, reword, reorder or re-tier a **seed** or a **follow-up**. Their node ids are bound to server rubric terminals; one reworded choice silently changes what is being measured.
4. Author any part of the **end-of-journey report's tier language**, the tier definitions, or the consistency sentence. Those are the one place tiers are spoken and they are authored.
5. Write **world-state values** outside the closed candidate set the mission supplies.
6. Run **on the client**. The client never calls a model, never holds a key, and never grades anything locally.
7. See or return **anything about scoring** in a client-bound payload — no tier, no rationale, no confidence, no ordering hint.

**Offline authoring with a model remains encouraged** — drafting a room, a cast file, a mission spine or a first pass at the fallback bank, reviewed by a human, tier-assigned by a human, and audited under ADR-005 §11.5. That is what the schema-first architecture exists to enable, and it is a different activity from runtime generation.

---

## 13. Accessibility

Everything in ADR-005 §14 applies unchanged. What this ADR adds:

- **The tracker is DOM, in focus order, announced on change.** §6.3.
- **Generated prose is DOM like every other line.** It goes through the same dialogue layer, the same captions, the same focus management. There is no separate presentation for beat 3, deliberately — a player must not be able to tell which beat was generated.
- **The wait is announced, not spun.** During §7.4's 2.5–4 s window the live region says what the room is doing (_"Priya wipes down the counter"_), not that something is loading. A screen-reader user gets the same in-fiction beat a sighted user sees.
- **Objective completion is announced** with the objective's `announce ?? label`, so a player who cannot see the tracker still knows the objective moved.
- **`go_to` objectives are reachable by guided navigation.** Every `go_to` target must be a station in the building's guide list — a CI check, because an objective you cannot reach without a mouse is a blocked season.

---

## 14. Consequences

**Easier**

- A building's structure becomes one reviewable file (`missions.ts`) instead of an emergent property of station placement.
- Transfer is measured at all, for the first time, and it is measured with the same instrument shape as everything else.
- The mentor lifeline matches the blueprint exactly (§10.5) instead of carrying a documented compromise.
- The silent-tier rule gets _stronger_, not weaker: the tier for beat 3 is not merely hidden from the UI, it is never sent to the client at all.
- Session durability is one framework layer rather than three building-local `localStorage` schemes.

**Harder**

- We now own a runtime model dependency in the critical path of a conversation. §7.4's latency budget and §8.5's fallback are the price, and both are acceptance criteria rather than aspirations.
- Generation costs money per mission. §8.6's caching and rate limits are not optional.
- The fallback bank is 54 new authored beats across the three launch buildings, each needing a tier map and a fresh-reader audit. That is real writing work and it is on the critical path for "never breaks".
- Content QA now has a stochastic surface. Gate-failure rates become a metric someone has to watch.

**Revisit if**

- Gate-failure rates exceed ~20% after prompt iteration → the instrument is not reliable enough; fall back to Option A's authored third beat for the affected competencies and keep generation for the rest.
- p95 latency cannot be held under 2.5 s → move generation **ahead** of beat 2 (generate speculatively for all three follow-up branches while beat 1's consequence plays) and pay 3× the cost for the latency.
- A learner can reliably tell a generated beat from an authored one in playtest → §8's gates are not tight enough, and that is a content bug, not a UX one.

---

## 15. Risks

| Risk                                                                                        | Mitigation                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The generated option set leaks the tier** — the good one runs longer, the weak one hedges | Gate 3 (word parity ≤ 8) and gate 6 (self-justification) are blocking and automated; the fresh-reader audit samples generated output as well as authored, and gate-failure rates are monitored |
| **The model writes a verdict into a consequence**                                           | Gate 5's blocklist, plus the same fresh-reader pass. This is the single most likely failure and it is cheap to catch                                                                           |
| **MERIDIAN's generated copy reads as financial advice**                                     | Gate 9, registered per building, blocking. PRD_Building_MERIDIAN §11.1 is already an acceptance criterion; this extends it to generated text                                                   |
| **Latency turns a conversation into a wait**                                                | §7.4's parallel fire, the in-character idle beat, and the hard 4 s abandon. No spinner, ever                                                                                                   |
| **The tracker becomes a scoreboard** by well-meaning increment                              | §6.3's rule table; the tracker is framework code so a building cannot add to it; the tier-leak audit covers it                                                                                 |
| **The fallback bank is never finished** because generation "works"                          | `validate_registry` fails on a missing entry, so a building cannot ship without it                                                                                                             |
| **Session writes hammer the backend**                                                       | 800 ms debounce, coalescing, 16 KB cap, per-user rate limit; beat commits and exit are the only immediate writes                                                                               |
| **Two tabs corrupt a season**                                                               | `rev` + `409` + adopt-newer (§11.4)                                                                                                                                                            |
| **A mission's `go_to` target is unreachable without a mouse**                               | CI check against the building's guide list (§13)                                                                                                                                               |

---

## 16. Open decisions

- **Speculative generation.** Firing all three branches' transfer questions during beat 1's consequence would make latency a non-issue at 3× cost. Deferred until the p95 is measured against real traffic.
- **Whether the transfer beat appears in the end-of-journey report's consequence trail.** It is the most personal moment in a season and the report currently has room for two lines per competency. Recommendation: yes, as the third line, quoting the question. Needs KK.
- **Fallback bank authorship.** 54 beats across three buildings. Drafted by a model offline and human-audited (ADR-005 §19's offline-authoring path) is the only affordable route; confirming that the fresh-reader audit has capacity for it is a scheduling question.
- **Whether missions may ever be replayed out of order** once a season is complete. Currently no — the season is linear and the report is the terminus. Replay re-enters at mission 1.
- **Telemetry retention** for `ai_followups`. The rows are the only record of what a learner was actually asked, which matters for auditing an assessment. Recommendation: retain for the life of the account.

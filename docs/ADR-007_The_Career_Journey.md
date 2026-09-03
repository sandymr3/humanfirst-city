# ADR-007 — The Café becomes a career: a stage graph, an evidence ledger, and assessment that survives leaving early

_The City · Interior Framework · v1.0 · 2026-09-03 · **Status: Built — awaiting the fresh-reader audit (§18, item 10)** · Deciders: KK (product), santhosh / hrithik / uganthan (eng), backend owner (§5.5 posture change)_

_Extends **[ADR-005 v2.0](ADR-005_Interior_Framework.md)** (the interior engine, the silent-tier contract, accessibility) and **[ADR-006](ADR-006_Missions_AI_Followups_and_Session_State.md)** (the mission spine, the generated beat, session state). **Amends ADR-005 §11** (feedback in free-text stages) and **supersedes ADR-006 §6 for the Café only** (the linear mission spine). Backend contract: **[PRD_Backend_Missions.md](PRD_Backend_Missions.md)**, whose **§5.5 this ADR rewrites**. Consumer: [Café](PRD_Building_Cafe.md) v3.0._
_Content source: `FINAL_Cafe_Process_Flow.xlsx` (the flow, the scenes, the tiers) and `CEO CITY PLANNING.xlsx` → sheets `CITY Rules`, `CAFE` (the evaluation requirement and the seeded answer key)._

> **Read this if you are building the Café.** ADR-005 tells you what a room is. ADR-006 tells you what happens in it. This tells you what happens over **a career** — how one room holds three jobs, how you get hired and promoted and how you can walk out at any of three doors, how an interview you _type_ answers into is scored without breaking the assessment, and how twenty-six decisions settle into the nine registry rows the Café already owns. **This is a Café-local decision.** The other eleven buildings keep the nine-competency model of ADR-005/006 until someone decides otherwise.

---

## 1. TL;DR

The Café stops being **one interview** and becomes **one career**: you are hired, you work the counter, you are reviewed, you are promoted to the kitchen, you are reviewed again, you run the business, you choose who takes over, and you leave.

```
enter → JOB INTERVIEW ─────────────► gate ─┬─ accept ─┐
        5 questions, typed, 1–5 each       ├─ retry ──┘ (attempt saved)
                                           └─ exit
                                                ↓
        L1 EMPLOYEE · the counter · 4 scenarios, AI-written consequences
                                                ↓
        REVIEW #1 · 3 questions ────────► gate ─┬─ accept · retry · exit
                                                ↓
        L2 BRANCH MANAGER · behind the flap · 4 scenarios, AI-written consequences
                                                ↓
        REVIEW #2 · 3 questions ────────► gate ─┬─ accept · retry · exit
                                                ↓
        L3 CEO · the four-top · 4 scenarios, authored consequences + the twist
                                                ↓
        SUCCESSION · 3 candidates, 2 questions
                                                ↓
        EXIT · the business is handed over · revenue is banked
```

Five things are new, and each is a decision this document has to justify:

1. **A stage graph, not a mission list.** ADR-006's spine is nine missions in a fixed order. This branches (accept / retry / exit) and loops (retry re-enters the stage you just left). Eleven stages, one array, one reducer.
2. **The player types.** The interview and both reviews are free text — _"Tell me about a challenge you faced"_ cannot be asked three ways. This is a direct reversal of `PRD_Backend_Missions §5.5`'s _"the player never types anything"_, which is the load-bearing sentence in the prompt-injection argument. §13 rewrites it rather than quietly violating it.
3. **Twenty-six assessable units, nine registry rows.** The journey never submits per scene. It accumulates an **evidence ledger** and settles it into the nine `C{1..9}-SCA-01` activities the Café already owns. No new levels, no renamed ids, no badge changes, no other building touched.
4. **Revenue**, which moves on every decision and is **revealed only at stage boundaries** — because a revenue delta shown after a single choice is a directional tier readout, and a worse one than a score.
5. **Attempts are append-only**, which is what makes the evaluation report's _"where they started and how they are progressing"_ fall out of the schema instead of needing a mechanism of its own.

What does **not** change: proficiency is still 1–3, coins are still 5/15/25, tier values are still 15/60/95, `SubmitResponse` gains no fields, and no tier ever reaches a client.

---

## 2. Context

### 2.1 What the Café is today

`src/buildings/cafe/` is a walkable 12 × 10 isometric room containing **one job interview**. Owen, the area manager, sits at the four-top with a laptop and asks nine questions — one per competency — each a three-beat decision tree per ADR-006 §7. The sitting ends with an offer. The room is two people; five written cast members are benched in `cast.ts` with the comment _"they stay in `CAST` because the stages after the interview will want them."_

That shape is real and it works: 18 trees across two age tracks, 162 authored leaves, 18 fallback transfer beats, 346 green tests, and a machine-enforced silent-tier contract (`trees.test.ts:168`, `cafe-interview.spec.ts:56`).

It is also the _second_ thing the Café has been. It was a nine-week season first (commit `001eb3e`, _"The Café stops being a season and becomes an interview"_). This ADR is the third, and it should be the last for a while, because it is the first one that reaches all the way to an exit.

### 2.2 What the brief now asks for

`FINAL_Cafe_Process_Flow.xlsx` describes a career ladder, and `CEO CITY PLANNING.xlsx → CITY Rules` describes what has to come out of it:

> _"an evaluation report structure for business-wise competency assessment (ai assess natural strengths and emerging skills), and overall cumulative report of competencies… a badge for which business they have earned the most amongst… we want to be able to measure skill improvement — so we want to know where they started and how are they progressing."_

The second half is the harder half. Today the platform keeps `bestProficiency` and an `AttemptsCount` integer. **A best-score-only model cannot express improvement** — it has thrown away the baseline by construction. Everything in §10 exists to fix that.

### 2.3 The four decisions taken before this ADR was written

|              | Decision                                             | Why it matters here                                                                           |
| ------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Revenue**  | Revealed at **stage boundaries**, never per decision | §11; it is the only reading that survives §12                                                 |
| **Scope**    | **Café-local and bespoke**                           | Nothing in this ADR is framework code; §14 lists what must be asked of the maintainer instead |
| **Tracks**   | **Single track for now**; SCB rows stay seeded       | §9.4; the Level B rewrite stays a content job, not a migration                                |
| **Registry** | **Keep the 18 rows**, aggregate into them            | §4 and §8; this is the decision the rest of the document hangs off                            |

### 2.4 The constraint that shapes everything below

`CONTRIBUTING.md:66-73` names `internal/scoring/`, `internal/services/`, `internal/handlers/`, `internal/models/`, `cmd/` and `api/openapi.yaml` as _"never touch without asking first,"_ reviewed as contract changes rather than content PRs, additive-only within `/v1`, **openapi first, implementation second**.

Every backend change in this ADR is therefore designed to be **purely additive**: one new rubric kind beside six existing ones, one new result kind beside seven existing ones, two new tables, two new endpoints. Nothing existing changes shape. That is not politeness — it is what keeps the eleven other buildings, and the school-style drills at `BEGINNER`/`MEDIUM`/`HARD` with real progress rows against them, working while the Café is rebuilt.

---

## 3. Requirements this decision must satisfy

### 3.1 Functional

- Eleven stages, three of them exits, two of them loops.
- Free-text answers, scored 1–5 per question, with AI feedback the learner reads immediately.
- Every attempt retained; best shown; retrying credited as effort, never as proficiency.
- Four scenarios per level; consequences AI-written at L1/L2, authored at L3 with a follow-up twist.
- Revenue that moves on every decision and banks at exit.
- A per-competency verdict that survives a player leaving at any of the three doors.
- A report naming natural strengths, emerging skills, and the distance travelled from a baseline.

### 3.2 Non-functional

- **No tier, score or verdict vocabulary reaches a client during a scenario.** Machine-checked, not reviewed by eye.
- No generated content on the critical path without a fallback that a player cannot distinguish.
- A backend outage degrades to a locally-persisted journey, never a lost one.
- Free text must not widen the prompt-injection surface into the generators.
- Additive-only on the wire.

### 3.3 Constraints

- One dev on the building; the room, the cast and the session layer already exist and should be kept.
- `validate_registry` enforces exactly 12 activities per competency-level, six subtopics × 2. The Café owns slot 01.
- Proficiency is 1–3 everywhere: `scoring.go:26-31`, `openapi.yaml:665`, `coinsByProficiency`, every badge threshold.
- The 16 KB building-session blob cap.

---

## 4. Options considered — binding twenty-six units to nine rows

This is the load-bearing choice; everything else follows from it. Counted from the workbook, the journey's competency coverage is **C7 ×5 · C2 ×5 · C6 ×5 · C8 ×3 · C1 ×2 · C5 ×2 · C3 ×1 · C4 ×1 · C9 ×1** — all nine touched, unevenly, across roughly twenty-six assessable units.

### Option A — one registry activity per assessable unit

| Dimension        | Assessment                             |
| ---------------- | -------------------------------------- |
| Complexity       | High                                   |
| Cost             | ~26 slots per track for the Café alone |
| Scalability      | Fails immediately                      |
| Team familiarity | n/a                                    |

**Pros:** conceptually flat; every unit is independently addressable, retryable and reportable.
**Cons:** blows the 12-per-competency-level cap and the one-slot-per-building scheme in the same move. Twelve buildings × 26 units is a registry redesign, and `C9/HARD` already proved (ADR-005 §10.5) that renumbering ids with progress rows against them is a migration with a data-loss failure mode.

### Option B — one registry activity per stage

| Dimension        | Assessment       |
| ---------------- | ---------------- |
| Complexity       | Medium           |
| Cost             | 6 rows per track |
| Scalability      | Poor             |
| Team familiarity | Medium           |

**Pros:** the submit path stays trivially simple — one stage, one submit.
**Cons:** an activity would no longer map to one competency. That breaks the competency → badge → profile → report chain the entire academy is built on (`badge_service.go:32`, `profile_service.go:20-27`), and it is the chain the brief's own "cumulative report of competencies" depends on. Solving the near problem by breaking the far one.

### Option C — keep the eighteen rows; the journey feeds them ✅

| Dimension        | Assessment                                        |
| ---------------- | ------------------------------------------------- |
| Complexity       | Medium — one new rubric kind, one new result kind |
| Cost             | Zero migration; a content-pack change             |
| Scalability      | Good — any building can adopt the pattern later   |
| Team familiarity | High — mirrors `trace` exactly                    |

**Pros:** the nine competency activities per track stay the unit of record, so badges, coins, `ProfileService` and the report keep working untouched. The tier stays server-side in the same place and the same shape it lives today. No new levels, no renamed ids, no other building touched, **not one progress row disturbed**. And it is the honest model: a competency verdict _should_ be drawn from every decision that tested it, not from whichever single tree happened to be labelled with it.

**Cons:** the nine-entry `terminals` map no longer fits, so a new rubric kind is needed. C3, C4 and C9 rest on a single decision each — thinner evidence than today's three-beat tree, and §15 has to make the report's language honest about that.

### Option D — a new level namespace per career level (`SCA-L1`, `SCA-L2`, `SCA-L3`)

| Dimension        | Assessment                             |
| ---------------- | -------------------------------------- |
| Complexity       | High                                   |
| Cost             | 3× levels, 3× badges, a real migration |
| Scalability      | Poor                                   |
| Team familiarity | Medium                                 |

**Pros:** keeps twelve-per-level clean by construction.
**Cons:** multiplies levels and badges by three for a shape only one building uses, and re-runs the `SCA`/`SCB` naming exercise of ADR-005 §10.6.1 for less reason. Rejected on the same grounds that decision was taken.

### Trade-off analysis

A and D both solve the counting problem by expanding the namespace, and both pay for it in exactly the currency ADR-005 §10.5 established is expensive: ids that progress rows point at. B solves it by collapsing the namespace and pays in the currency the _brief_ cares most about — per-competency reporting.

C is the only option that leaves the namespace alone. The insight is that **the registry activity was never really "a decision tree" — it was always "the competency's verdict for this building."** Today one tree happens to produce that verdict. Under C, a journey produces it. The unit of record does not move; only the evidence behind it gets richer.

**Decision: Option C.**

---

## 5. Decision

**The Café adopts a stage graph, an evidence ledger, and append-only attempts, all Café-local. The nine per-competency registry activities per track remain the unit of record and receive one aggregated verdict per journey.**

Concretely, and each of these is normative:

1. The linear `MissionSpine` of ADR-006 §6 is **superseded for the Café** by the stage graph of §6. It remains in force for every other building.
2. Free text enters the product at three stages. `PRD_Backend_Missions §5.5` is rewritten as §13.
3. A new rubric kind `journey` and a new result kind `journey` are added, beside the existing six and seven. Nothing existing changes.
4. Revenue is server-computed, revealed at stage boundaries, and banked at exit as its own currency — never into the coin wallet.
5. Attempts are append-only. Best-of is a read, not a write.
6. ADR-005 §11 is amended: feedback is permitted where there are no options to pattern-match against, and forbidden everywhere else. §12 gives the rule and the reasoning.

---

## 6. The journey model

### 6.1 Shape

```ts
// src/buildings/cafe/journey.ts   (building-local — not framework)

export type Role = "candidate" | "employee" | "branch_manager" | "ceo";

export type StageKind =
  | "qa" // typed answers, AI-scored, feedback shown
  | "scenarios" // a block of branching decisions at one posting
  | "gate" // accept · retry · exit
  | "succession" // choose a successor, judge their answers
  | "exit"; // hand over, bank the revenue, read the report

export interface Stage {
  id: string; // "cafe.interview" | "cafe.l1" | "cafe.gate1" …
  kind: StageKind;
  role: Role; // the posting this stage is played at
  station: string; // st_tables | st_counter | st_pass
  hostNpc: string | null; // "owen" for every qa stage; null = the room
  title: string; // shown in the stage chip. Never a score.
  next: string | null;
}

export interface GateStage extends Stage {
  kind: "gate";
  accept: string; // the next stage
  retry: string; // the qa stage just completed
  exit: "cafe.exit";
}

export interface JourneySpine {
  buildingId: "cafe";
  stages: Stage[]; // 11, addressed by id — order is a property of `next`
  start: string;
}
```

Note what is **absent**, for the same reason ADR-005 §9.1 and ADR-006 §6.1 gave: no tier, no score, no weight, no `isCorrect`, no revenue delta. A journey file is safe to ship to a browser, and a curious learner reading the network tab learns nothing.

### 6.2 The rules

- **One stage is current.** The next stage's title is not fetched, rendered or announced while the current one is open. Gates are the only place a player sees more than one road.
- **Every gate has exactly three exits**, and _exit_ is a first-class one — not a failure state, not a confirmation dialog with a scary verb. A player who takes the job and leaves after L1 has played a complete, scoreable journey (§8.3).
- **Retry re-enters the qa stage it came from**, appends an attempt, and never overwrites (§10).
- **A `scenarios` stage keeps ADR-006's objective chain.** Its four scenes are still reached by walking, waiting and talking; the mission machinery underneath is unchanged. _A stage that opens on a decision is a modal with a title_ — ADR-006 §6.2's rule survives verbatim.
- **Nothing is on a timer**, anywhere, still.

### 6.3 The eleven stages

| #   | id                | kind       | role           | station      | host  |
| --- | ----------------- | ---------- | -------------- | ------------ | ----- |
| 1   | `cafe.interview`  | qa         | candidate      | `st_tables`  | owen  |
| 2   | `cafe.gate1`      | gate       | candidate      | `st_tables`  | owen  |
| 3   | `cafe.l1`         | scenarios  | employee       | `st_counter` | priya |
| 4   | `cafe.review1`    | qa         | employee       | `st_tables`  | owen  |
| 5   | `cafe.gate2`      | gate       | employee       | `st_tables`  | owen  |
| 6   | `cafe.l2`         | scenarios  | branch_manager | `st_pass`    | tomas |
| 7   | `cafe.review2`    | qa         | branch_manager | `st_tables`  | owen  |
| 8   | `cafe.gate3`      | gate       | branch_manager | `st_tables`  | owen  |
| 9   | `cafe.l3`         | scenarios  | ceo            | `st_tables`  | —     |
| 10  | `cafe.succession` | succession | ceo            | `st_tables`  | —     |
| 11  | `cafe.exit`       | exit       | ceo            | `st_door`    | —     |

### 6.4 The stage chip

The mission tracker of ADR-006 §6.3 survives, retitled and reduced. It shows the posting and the current objective, and **nothing else**:

```
┌──────────────────────────────┐
│  BRANCH MANAGER              │   ← the posting, small caps
│  The Holiday Rota            │   ← the scene title
│  ──────────────────────────  │
│  › Talk to Tomas at the pass │   ← the current objective, the only one shown
└──────────────────────────────┘
```

Every rule in ADR-006 §6.3's table still binds: no tier, no proficiency, no coin figure, no tick on a completed scene, `aria-live="polite"` on change only, collapse with `M`, cut rather than animate under `prefers-reduced-motion`. **No revenue figure** — that is §11's rule, and this is where it would most tempt someone.

The ordinal changes meaning. ADR-006 showed _"Mission 3 of 9"_ because season length was pacing information a player legitimately needed. A career has no honest denominator — you do not know how many jobs you will hold. The posting name replaces it, and it is the same information a real employee has.

---

## 7. The room — one room, three postings

The workbook names three places: Cafe Counter, Cafe Kitchen, CEO Table. **Do not build three rooms.**

The shipped 12 × 10 grid already holds all three, and the pieces are load-bearing rather than incidental:

- Four zones exist and are already first-match-wins: `z_pass` · `z_behind` · `z_window` · `z_floor` (`room.ts:250-269`).
- **The counter flap at `(4,2)` is a real gate** — the only route into the sealed staff zone, reduced-motion aware, with a sound and an announcement. It is the only moving part in any interior in the city.
- The four-top where Owen sits is the CEO table. It is already where you are assessed; it becomes where you preside.

So the **posting** moves, not the room:

| Role           | Where you work               | What changes                          |
| -------------- | ---------------------------- | ------------------------------------- |
| candidate      | the four-top, opposite Owen  | you may not pass the flap             |
| employee       | the counter, `z_floor` side  | the counter is yours; the flap is not |
| branch_manager | behind the flap, at the pass | **the flap opens for you**            |
| ceo            | the four-top, Owen's side    | the room is yours; Owen stops coming  |

This costs zero new art, and it makes promotion physically legible: you are promoted and the gate that was closed to you for the whole first act finally opens. That is a better promotion beat than a modal, and it is the reason to reject three rooms rather than merely the cheaper option.

**Restore the deleted furniture.** Commit `42b8e97` ("The café, emptied") removed six stations and four hotspots when the season became an interview. They are recoverable from git history, and `PRD_Building_Cafe.md §0.4` carries the v1.0 → shipped name mapping already. `ht_board` and `ht_pass` must be entries in `guide.ts` so a `go_to` can target them (ADR-006 §13).

**Unbench the cast.** `cast.ts:74-210` already holds Priya, Tomas, Marcus, Nadia, Ray and Ellery, written and unused. `castFor()` (`cast.ts:232`) hardcodes `["priya","owen"]` and becomes `castFor(role, world)`. The people for the later postings were written a year before the postings existed; this ADR is mostly permission to use them.

---

## 8. The evidence ledger

### 8.1 Shape

A journey never submits per scene. It appends to a ledger:

```ts
export interface Unit {
  unitId: string; // "cafe.l1.s2" | "cafe.interview.q3" | "cafe.succession.pick"
  competency: string; // "C7"
  kind: "choice" | "qa";
  choice?: string; // "a" | "b" | "c"  — choice units only
  attemptNo?: number; // qa units only; the score lives on the server
}
```

There is no tier and no score in it, and there is nowhere for one to be added, because the client has never been told either.

### 8.2 The wire

At each level's close the client submits **once per competency touched**, to the row the Café already owns:

```jsonc
POST /api/v1/progress/C7-SCA-01/submit
{
  "clientVersion": "city@0.4.0",
  "durationSec": 812,
  "hintsUsed": 0,
  "result": { "journey": {
    "buildingId": "cafe",
    "runId": "jr_01K2…",
    "units": [
      { "unitId": "cafe.l1.s2", "choice": "b" },
      { "unitId": "cafe.l1.s3", "choice": "c" },
      { "unitId": "cafe.l2.s1", "choice": "a" }
    ],
    "qa": [ { "unitId": "cafe.review1.q1" } ]
  }}
}
```

The server resolves each `unitId` + `choice` to a tier through the answer key, reads `qa` scores from the attempts table by `runId` (**never from the request** — same rule and same reason as `TraceResult.ResolvedTier`'s `json:"-"`), normalises, weights, means, and maps through the existing `scoreMap`.

`SubmitResponse` gains **no fields**. `PRD_Backend_Missions §4.5` forbids it, and the reason it forbids it is that every new field on a scored response is a new place for a tier to leak.

### 8.3 Settling early — why this submits per level and not at the end

A player may leave at gate 1, gate 2 or gate 3. If the ledger settled only at `cafe.exit`, all three of those players would score nothing, and the most common real session — someone who plays the interview and one level in a sitting — would be the one that measures nothing.

So **each level's close settles what that level touched.** Re-submitting a competency later in the same journey re-sends the full unit list for that competency; the server recomputes from scratch and `bestProficiency` does the rest. The operation is idempotent by construction, because it is a pure function of the units, and the units only ever grow.

---

## 9. Scoring

### 9.1 The arithmetic

Tier values are unchanged from ADR-005 §10.1 and ADR-006 §10.1: **Developing 15 · Strong 60 · Advanced 95** (`scoring.go:19-23`).

A `qa` question scored 1–5 normalises onto the same scale:

```
qaValue(n) = 15 + (n − 1) × 20      →   1:15  2:35  3:55  4:75  5:95
```

Per competency:

```
outcome = round( Σ(weight_i × value_i) / Σ(weight_i) )
```

then the **existing, unchanged** `scoreMap`:

```jsonc
"scoreMap": [
  { "minOutcome": 74, "proficiency": 3 },
  { "minOutcome": 42, "proficiency": 2 },
  { "minOutcome": 0,  "proficiency": 1 }
]
```

**Proficiency stays 1–3.** The 1–5 is a raw per-question score that lives in the attempts table and is shown to the learner as feedback; it is never a proficiency and never reaches `AcademyProgress.Proficiency`.

### 9.2 Weights

| Unit kind                   | Weight | Why                                                                                             |
| --------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| L3 scenario (two beats)     | 1.0    | the existing `0.6 × seed + 0.4 × follow` composition, resolved first, then entered as one value |
| L1 / L2 scenario (one beat) | 0.8    | a single beat tests less than a pair; it should not outweigh one                                |
| Interview / review question | 0.6    | what you say you would do is weaker evidence than what you did                                  |
| Succession pick             | 1.0    | it is the only decision in the journey with no follow-up and no undo                            |

The interview weighting is deliberate and worth stating: a learner who interviews well and works badly should not read as competent. Stated evidence is admitted, and discounted.

### 9.3 The rubric

New kind, additive, beside `trace`:

```jsonc
// internal/registry/content/c7.json → levels.SCA.activities[0]
{
  "id": "C7-SCA-01",
  "subtopic": "team_trust",
  "orderIndex": 1,
  "type": "DECISION_TREE",
  "title": "The People You Work With",
  "estMinutes": 14,
  "rubric": {
    "kind": "journey",
    "buildingId": "cafe",
    "units": {
      "cafe.l1.s2": { "choices": { "a": 15, "b": 60, "c": 95 }, "weight": 0.8 },
      "cafe.l1.s3": { "choices": { "a": 60, "b": 15, "c": 95 }, "weight": 0.8 },
      "cafe.l2.s1": { "choices": { "a": 60, "b": 95, "c": 15 }, "weight": 0.8 },
      "cafe.l2.s2": { "choices": { "a": 15, "b": 60, "c": 95 }, "weight": 0.8 },
      "cafe.l2.s3": { "choices": { "a": 15, "b": 60, "c": 95 }, "weight": 0.8 },
    },
    "qaUnits": { "cafe.review1.q1": { "weight": 0.6 } },
    "scoreMap": [
      { "minOutcome": 74, "proficiency": 3 },
      { "minOutcome": 42, "proficiency": 2 },
      { "minOutcome": 0, "proficiency": 1 },
    ],
  },
  "passCriteria": { "minProficiency": 2 },
}
```

The letters are shuffled per unit, exactly as ADR-005 §10.3 requires and for exactly the same reason. **The rubric is the only place that mapping is recorded**, and it is `json:"-"` on `ActivityRegistry` like every rubric before it.

`choices` is nested rather than sitting beside `weight` at the top level, so a letter can never collide with a key name — an answer key is exactly the file where that ambiguity would be found late and expensively.

Three behaviours, all pinned by test in `internal/scoring/journey_test.go`:

- **A submitted unit the rubric does not know is skipped, not an error.** The client sends one unit list per competency; a stale build sending a superset should score what counts rather than fail the submit. `PRD_Backend_Missions §4.5`'s rule.
- **A `qa` unit with no resolved score is skipped, not zeroed.** An interview the grader could not reach must not read as an interview answered badly — otherwise a grader outage silently marks people down, which is the kind of failure nobody notices for a quarter.
- **A choice the answer key has never heard of _is_ an error**, unlike the two above. It means the content and the key have drifted apart, and scoring around it silently would hide a real authoring bug.

**A competency may be evidenced entirely by typed questions.** The Café's C8 is asked at the interview and at both reviews and nowhere else, so a rubric with no `units` is valid content rather than a truncated file. `ValidateRubric` requires one map or the other, not both.

`ValidateRubric` (`scoring.go:236-303`) gains one case; `Evaluate` (`scoring.go:312-334`) gains one case. Both already switch on kind, so neither is a restructure.

### 9.4 Tracks

Single track for now. The journey ships one content set and settles into whichever track's rows the player is on, so `SCB`'s nine rows keep receiving progress and their badges keep working. `activityIdFor(competency, track, "01")` (`framework/city/track.ts:77`) is unchanged and remains the single place ids are assembled.

This is deliberately not the same as retiring `SCB`. A Level B rewrite later is then a **content job** — re-cut prompts, re-point the answer key — and never a migration.

---

## 10. Attempts, and where improvement comes from

### 10.1 Append-only

Two new tables (`00006_journey.sql`, goose, MySQL, matching `00004`'s conventions; both into `db.AllModels()` or `cmd/schemadrift` fails CI):

```
journey_runs      (id, user_id, building_id, track, status, role_reached,
                   revenue, exited_at_stage, started_at, ended_at)

journey_attempts  (id, run_id, stage_id, attempt_no, raw_score, band,
                   feedback, question_scores json, created_at)
                   UNIQUE (run_id, stage_id, attempt_no)
```

`journey_attempts` is **never updated**. The unique key is the guarantee: a retry writes `attempt_no + 1` or it fails.

### 10.2 What that buys, for free

| The brief asks for                                   | It is a query                                            |
| ---------------------------------------------------- | -------------------------------------------------------- |
| "Every attempt saved as Attempt 1, Attempt 2…"       | the rows                                                 |
| "Best attempt is shown"                              | `MAX(raw_score)` per `(run_id, stage_id)`                |
| "Retrying earns an additional-effort score"          | `COUNT(*) > 1`                                           |
| "Where they started and how they are progressing"    | attempt 1 is the baseline; best − attempt 1 is the delta |
| "Overall cumulative report of competencies"          | runs ordered by `started_at`, across buildings           |
| "A badge for which business they earned the most in" | `MAX(SUM(proficiency))` grouped by building              |

None of these needed a mechanism. They needed the schema to stop throwing the baseline away — which is the one thing `bestProficiency` alone can never do, and the reason §10.1 is worth a migration.

### 10.3 The effort score is not a proficiency

**Retrying must never raise a competency score.** It is reported in the end-of-journey report as persistence — _"you went back and did the review again, and it was better"_ — and it is a genuinely good behaviour to name. But the moment effort composes into proficiency, retrying becomes a way to farm it, and the instrument stops measuring judgment and starts measuring patience.

It is a separate counter, rendered in a separate sentence, and it never enters `outcome`.

---

## 11. Revenue

### 11.1 The rule

Revenue moves with every decision, and is **shown only at stage boundaries** — the close of L1, L2, L3, and at exit — aggregated over that stage's four decisions.

The reason is §12. _"Good decisions increase it, poor decisions reduce it"_ is the workbook's own rule, and a number obeying that rule, shown immediately after a choice, is a tier readout. It is strictly worse than a proficiency number: it is continuous, it is directional, and it is legible after a single trial. A learner would need about three decisions to work out the mapping, and from then on the assessment would be measuring their arithmetic.

Four decisions per reveal is enough that a delta cannot be attributed to any one of them.

### 11.2 Where it is computed

**Server-side.** The deltas are authored beside the tiers, in the same answer-key file, and for the same reason the tiers are: they correlate with quality, so they cannot ride on the wire before the reveal. The client holds a number it is incapable of deriving, and renders it when the server hands one back at stage close.

### 11.3 Revenue is not coins

Coins were rescaled platform-wide to `{1:5, 2:15, 3:25}` (BE-14) so that a learner comparing two sessions compares like with like. Dropping an uncapped, fiction-scaled revenue figure into the same wallet destroys that in one deploy.

Revenue banks at exit as a **separate, capped, idempotent credit** with its own ledger line — the same discipline coins already have (`progress_service.go:268-303`'s `earn:*` idempotency keys), a different currency. The Bank building is where the two are read side by side, which is the reading the fiction wanted anyway.

---

## 12. The silent-tier contract, amended

### 12.1 The amendment

ADR-005 §11 stands, with one exception, stated as a rule:

> **Feedback is permitted where there are no options to pattern-match against, and forbidden everywhere else.**

A branching scenario shows three options. Feedback there teaches which one was intended, and the learner stops deciding and starts guessing — which is the entire failure §11 exists to prevent. **L1, L2 and L3 stay silent. Nothing about them changes.**

A free-text question shows nothing. There is no trio, no position, no length, no letter — nothing to correlate feedback with on the next question. Owen telling you what went well and one thing to work on is what a job interview _is_, and withholding it would make the fiction worse without making the instrument better.

### 12.2 What the amendment does not permit

- **Band labels must not use the tier vocabulary.** The workbook's bands read _Strong_ and _Developing_ — shipping those teaches the report's own words a level early, and by the time the learner reaches the report the vocabulary has already been spent. Keep "Great job!"; re-cut the other three in the same non-tier register.
- **No numeric proficiency, ever.** The 1–5 per-question score may be shown; `n/3` may not.
- **No cross-stage comparison shown mid-journey.** "Better than last time" is report material.
- **Nothing changes in the tracker, the room, or a scenario consequence.**

### 12.3 The check stays machine-enforced

`trees.test.ts:168` and `cafe-interview.spec.ts:56` ban the tier vocabulary from shipping content and rendered DOM. Those tests stay, and their regex stays as strict as it is. The `qa` stages get their **own** narrower allowlist rather than a hole punched in the shared one — a hole in the shared check is how this rule gets lost in eighteen months.

---

## 13. Free text, and the §5.5 posture

`PRD_Backend_Missions §5.5` currently reads, in part: _"the player never types anything… There is no free text anywhere in the path, and there must not be one added later without revisiting this section."_

This ADR is that revisit. **The posture changes; the guarantees do not.**

| Guarantee                               | Before                     | After                                                                                                 |
| --------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Player text reaches a generator prompt  | impossible — none exists   | **never** — typed answers go to the grader only, and the grader's output is not fed to the generators |
| World state reaches a prompt            | closed enum, `FilterWorld` | unchanged                                                                                             |
| Player text is rendered to another user | impossible                 | never — answers are per-user and appear only in that user's own report                                |
| Grading failure                         | n/a                        | the activity's mandatory `fallback` (already required, `CONTRIBUTING.md:36`)                          |
| Length                                  | n/a                        | `AIRubric.MinWords` / `MaxWords`, which already exist                                                 |

The sanctioned path was already built: rubric kind `ai`, the `Grader` interface (`scoring.go:125-130`), Gemini behind it, and `OPEN_TEXT_AI` activities using it in production today. **This ADR adds no new text-handling machinery** — it routes three new stages through machinery that has been carrying typed answers since before the city existed.

The one genuinely new surface is that typed text now lives in the same _building_ as a generator. The rule that keeps them apart is one line and it belongs in code, not prose: **the consequence generator's input struct has no field a typed answer could occupy.**

---

## 14. What the framework must be asked for

This is a Café-local ADR, and ADR-005 §8.4 is a hard rule: a building may not touch shared framework code, and **buildings never call `fetch`**. Three things must therefore be asked of the maintainer as a separate PR, in the manner of `Cafe-status-and-asks.pdf` §2:

| Ask                                                  | Why the Café cannot do it                        |
| ---------------------------------------------------- | ------------------------------------------------ |
| `ApiClient.journeyStage()` + zod schema              | `client.ts` is the only place `fetch` is allowed |
| `ApiClient.aiConsequence()` + zod schema             | same                                             |
| A free-text `result` shape on the submit body schema | `schemas.ts` is framework-owned                  |

One more is worth **not** asking for. The consequence race — 4 s deadline, abort on timeout, no spinner, no tell — is modelled on `framework/interior/transfer.ts` and could be a framework promotion. It should be built Café-local and written to be promoted verbatim, exactly as the mission runner and tracker were: **worth lifting when a second building wants it, not before.**

And one thing to reuse rather than rebuild: `src/lib/decisionTree.ts` already provides `presentationOrder()` (`:128-136`) — the deterministic per-activity shuffle that stopped MAISON shipping its weak option first across eighteen trees — plus `choiceSpread`, `worldDeltaAlong` and `allPaths`. The Café's bespoke engine has none of them, and every new scene needs all of them.

---

## 15. The end-of-journey report

ADR-005 §13 stands. Three additions the brief asks for by name:

1. **Natural strengths and emerging skills.** Not a ranked list of nine. The two or three competencies that came out consistently high across _different_ stages — because consistency across contexts is what makes it a strength rather than a good day — and the two or three that were reached for and not yet landed.
2. **The distance travelled.** Attempt 1 versus best, per stage, in words. This is the sentence the brief actually asked for, and §10 is what makes it truthful.
3. **The business badge.** Across buildings, where this learner earned the most. Meaningless with one building playable; the query is written now so it is not retrofitted later.

**Honesty about thin evidence is a requirement, not a nicety.** C3, C4 and C9 rest on one decision each. The report must not narrate a single choice as though it were a pattern — _"you had one call to make on this and you made it well"_ is the register, and the alternative is an instrument that overclaims.

Tone is unchanged from ADR-005 §13: a debrief from someone who watched you work, not a scorecard. No shame framing, no percentile, failure states are "not yet".

---

## 16. Consequences

**What becomes easier**

- A player can leave and still be measured. Three doors, three complete journeys.
- Improvement becomes a query rather than a project.
- The registry, the badges, the coins and `ProfileService` keep working with no migration and no other building touched.
- The five written-and-benched cast members finally have stages to stand on.
- The counter flap becomes the promotion beat, which is the best thing in the room finally doing something.

**What becomes harder**

- Two content models in one repo. The Café is the stage graph; everything else is the nine-competency spine. Anyone reading `src/buildings/` will meet both and must be told which is which — §0.0 of the Café PRD is where they will look.
- Free text is a permanent new surface. It is small and it is fenced, but it is not zero, and every future generator has to be checked against §13's table rather than against "the player never types".
- Thin evidence on C3, C4 and C9.
- ADR-006's generated third beat loses its home at L1 and L2. It survives at L3 as the optional 0.3-weight beat (`required: false` already makes this free) so the eighteen-entry fallback bank and the nine gates keep earning their keep.

**What we will need to revisit**

- Whether the stage graph should be promoted to framework when a second building wants a career. Not before.
- Whether the interview's 0.6 weight is right; it is a judgment call made on first principles with no data behind it yet.
- Level B, when the older audience is actually being sold to.

---

## 17. Risks

| Risk                                                                                                                                 | Likelihood                                          | Mitigation                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **The workbook's option text ships as written and leaks the tier by length.** L1 S1 runs Developing at ~26 words and Advanced at ~68 | **High** — the content exists and reads as finished | `trees.test.ts:127-144` fails the build. All 24 trios re-cut to 13–33 words, ≤ 8-word spread, before they ship. §18 |
| Generated consequences drift into verdict language                                                                                   | Medium                                              | Gates 1/4/5/8/10 reused verbatim; 24-entry fallback bank; a missing entry is a blocking `validate_registry` failure |
| Free-text answers used as an injection vector                                                                                        | Low                                                 | §13's table; the generator input struct has no field a typed answer can occupy                                      |
| Revenue leaks the tier anyway, via a player who writes the numbers down                                                              | Low                                                 | Four decisions per reveal; deltas authored to overlap across tiers rather than to rank cleanly                      |
| The single-track decision quietly becomes permanent                                                                                  | Medium                                              | `SCB` rows stay seeded and keep scoring; the rewrite stays a content job                                            |
| Two content models confuse the next contributor                                                                                      | Medium                                              | Café PRD §0.0; this ADR's scope line at the top                                                                     |

---

## 18. Open decisions

Three, and they belong to product and to the content owner rather than to engineering.

| Question                                                                                                                                                                                                                                                                                            | Recommendation                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The workbook inverts C3's Strong and Advanced.** `CEO CITY PLANNING.xlsx → CAFE` and the seeded `tiermaps/cafe.json` both score _"say yes, but structure it — combo deal"_ as **Advanced** and _"one-month trial with a check-in"_ as **Strong**. `FINAL_Cafe_Process_Flow.xlsx` L3 S2 swaps them | Keep the seeded key. Structuring the deal on your own terms sees further than buying an option to exit — and it is already the audited answer                 |
| The four band labels, given §12.2 bans the tier vocabulary                                                                                                                                                                                                                                          | Keep "Great job!"; re-cut the other three off the tier words                                                                                                  |
| Does Owen conduct the reviews, having hired you?                                                                                                                                                                                                                                                    | Yes. The person who assessed you at the door assessing you at each gate is the fiction working; a new interviewer per stage is three cast members for no gain |

---

## 19. Action items

1. [x] `api/openapi.yaml` → v0.5.0: the `journey` result kind, `POST /city/buildings/{id}/journey/stage`, `POST /ai/consequence`. **Landed first** (`PRD_Backend_Missions §4.8`)
2. [x] `PRD_Building_Cafe.md` → v3.0 (§0.0 third entry). §8's eleven-stage rewrite still to do
3. [x] `PRD_Backend_Missions.md` §5.5 rewritten per §13
4. [x] Backend: rubric kind + result kind + two tables + `journey_service` + `consequence_service` + two handlers + routes
5. [x] Answer key `tiermaps/cafe_journey.json` — tiers, revenue deltas, weights
6. [x] Fallback bank — folded into the journey pack rather than its own file (one pack per building, one key per building; `validate_registry` gates both)
7. [x] Frontend: `journey.ts` (the spine and its content), `journeySession.ts`, `journeyStore.ts`, `roomStore.ts`, `Decision.tsx`, `QA.tsx`, `Gate.tsx`, `Report.tsx`, `StageChip.tsx`
8. [x] Room: four stations restored and gated by posting; `castFor(role)` unbenches the five written cast
9. [x] Content: 24 trios re-cut to the gate; 11 questions with `ai` criteria; succession
10. [ ] **The fresh-reader audit** (ADR-005 §11.5) — someone who did not write the content tries to pick the weak option in each trio. Blocking, and it cannot be done by the author
11. [x] `cmd/seed_journey` — written, and run: the nine `C{n}-SCA-01` rows now carry `journey` rubrics
12. [x] Framework asks (§14): `ApiClient.journeyStage()`, `ApiClient.aiConsequence()`, the `journey` result kind on the submit schema

### What a run looks like

Walked end to end against a dev server with the backend down, which is the
degraded path rather than the happy one and therefore the more useful check:

- **CEO, 15 decisions, 11 questions.** Four at the counter, four behind the flap,
  four running it, three at the succession; five at the interview and three at
  each review. That is the ~26 assessable units §4 was designed around, arriving
  in the shape it predicted.
- The guided list carries **the table and the door** for a candidate, and grows
  the counter and then the pass as the postings arrive — the promotion beat in
  the half of the room a keyboard player uses.
- With no grader reachable, the gate says _"Nothing came back on the record this
  time, so take this as a conversation rather than a decision"_ and still offers
  all three roads. Nobody is stuck, and nothing invents a verdict.

Two things that run found and no unit test would have:

- **Reading a consequence did not move you on.** Clearing the sheet without
  advancing re-opened the scene just decided, so a level never ended. Fixed, and
  pinned by `journeyUi.test.tsx`.
- **The CEO level and the succession had no UI at all.** `takeBeat` existed in
  the store and nothing rendered a two-beat tree or the three candidate cards, so
  the career stopped dead at the top of the ladder with the stage chip cheerfully
  naming a scene that was not on screen.

### What was retired

The interview did not survive the career, and leaving it in place would have left two spines in one building. Gone: `cafeStore.ts` (split into `roomStore.ts` for the room and `journeyStore.ts` for the career), `interview.ts`, `dialogue.ts`, `Dialogue.tsx`, `Offer.tsx`, `InterviewPanel.tsx`, `session.ts`, and their tests. `trees.ts` stays — the four CEO scenes are four of its nine trees — and took `COMPETENCIES` and `activityAt` with it, which had been living in `interview.ts` for no better reason than that the interview was asking the questions.

A side effect worth recording: `Dialogue.tsx` and `dialogue.ts` differed only in case, so on a case-insensitive filesystem TypeScript folded them and `npm run typecheck` had been failing locally on Windows for as long as both existed. Retiring the pair fixed it, and `Decision.tsx` is named for the beat rather than the content precisely so it does not collide with `scene.ts` the same way.

### What the build now enforces

Worth recording, because these were prose in §17 and are now checks:

| Rule                                                                                                      | Where                                                  |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Every trio passes the gates a _generation_ must pass — 13–33 words, ≤ 8-word spread, a reason clause each | `LintAuthoredTrio`, run by `make validate` and by test |
| Every one-beat scene has all three authored consequences                                                  | same                                                   |
| No band label, prompt, stage direction or successor card carries tier or verdict vocabulary               | `LintAuthoredProse`                                    |
| No line is used twice anywhere in the journey                                                             | `TestJourneyContent_NoLineIsUsedTwice`                 |
| The stage graph resolves, terminates, and is wholly reachable from the start                              | `TestJourneyContent_TheStageGraphTerminates`           |
| The answer key covers every unit, and scores nothing that is not shipped                                  | `TestJourneyKey_CoversEveryUnitAndNothingElse`         |
| Revenue bands **overlap** across tiers                                                                    | `TestJourneyKey_RevenueDoesNotRankCleanly`             |
| Revenue never leaves the server except as a stage total                                                   | `TestJourneyStage_RevenueIsOnlyEverAStageTotal`        |
| Attempt 1 survives every retry                                                                            | `TestJourney_AttemptsAreAppendOnly`                    |
| `ConsequenceRequest` has no field free text could travel in                                               | `TestConsequence_TheGeneratorNeverSeesAnythingTyped`   |
| No consequence path fails outward                                                                         | `TestConsequence_NoPathFailsOutward`                   |
| The stage graph resolves, terminates and is wholly reachable                                              | `journey.test.ts`                                      |
| The guided list and the counter flap agree about where a posting may stand                                | `journey.test.ts`, `accessibility.test.ts`             |
| No tier vocabulary reaches rendered DOM                                                                   | `journeyUi.test.tsx`, `cafe-journey.spec.ts`           |
| Revenue is never derived on the client                                                                    | `journeyStore.test.ts`                                 |
| The exit promotes nobody                                                                                  | `journeyStore.test.ts` (and its server twin)           |
| The two copies of the content have not drifted                                                            | `scripts/check_journey_mirror.mjs`, in `npm run ci`    |

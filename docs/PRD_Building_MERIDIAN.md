# PRD — MERIDIAN BANK · a growing retail & commercial bank

_The City · Building 02 · Downtown · **v2.0** · 2026-08-04 · **Status: Designed, zero code** · Owner: TBD (one dev, per CODEOWNERS)_

_Inherits [ADR-005 v2.0 — Interior Framework](ADR-005_Interior_Framework.md) for the interior pattern, the silent-tier contract, accessibility and budgets, and [ADR-006](ADR-006_Missions_AI_Followups_and_Session_State.md) for the mission spine, the three-beat decision and session state. Backend endpoints: [PRD_Backend_Missions.md](PRD_Backend_Missions.md); §19 below carries MERIDIAN's payloads._
_Parent: [PRD_City_Frontend.md](PRD_City_Frontend.md) · Siblings: [Café](PRD_Building_Cafe.md) · [MAISON](PRD_Building_MAISON.md) · City venue id: `bank`_
_Content source: `Playroom Scenarios.xlsx` → sheet **`BANK`**._

---

## 0. Repo reality — nothing is built, and that is the opportunity

### 0.1 Where MERIDIAN stands

**`src/buildings/bank/` does not exist.** The venue is placed on Downtown in `cityMap.ts` and opens the framework's overlay panel. Every word of §1–§18 is design; none of it is code.

This is the only launch building in that position, and it is worth being precise about what it means:

- MERIDIAN is **not blocked on framework work** the way the Café was. The interior seam, the building registry, the lazy gate, `decisionTree.ts`, the `DecisionTreeRenderer` and guided navigation all exist and have two tenants.
- MERIDIAN **is** blocked on the mission runner and the transfer-beat client (ADR-005 §17 G9–G11), which the Café builds first. That dependency is stated in §18.1 and it is the reason MERIDIAN's content phases start after the Café's.
- MERIDIAN starts from **the house standard rather than from an experiment.** Café and MAISON between them have already found the rules — one source of layout truth, the near-edge sill, hosts standing beside their station, no dead-end stations, don't bind `Tab`, arm `detach` early. MERIDIAN should not rediscover any of them.

### 0.2 The one thing this document had to change

v1.0 specified MERIDIAN as **a two-level first-person volume with a 5.2 m ceiling**, on the reasoning that a branch floor is designed to make an individual feel small and a first-person camera reproduces that better than any other medium. [ADR-005 v2.0](ADR-005_Interior_Framework.md) re-baselined the city's interiors to **2.5D isometric Pixi**, so that reasoning no longer has a camera to work with.

**§3.1 is therefore rewritten** as an isometric cell grid in the Café/MAISON idiom (§3.1 below). What survives the translation, and what does not:

| v1.0 intent | In 2.5D |
|---|---|
| "The volume makes you feel small" | **Partly lost.** No perspective, no ceiling height felt from inside. Compensated by **plan area** — MERIDIAN is the largest grid in the city, and the walk is long in cells rather than tall in metres |
| "You walk the length of your own bank past all fourteen of them" | **Fully preserved, and better.** In plan view you can see the whole queue *and* your own position in it at once, which first person could not do |
| "People and numbers in one frame, from the mezzanine" | **Fully preserved.** An iso camera looking down at a two-level room is *literally* this composition |
| "The queue is the primary readout" | **Fully preserved and cheaper.** Fourteen posed sprites instead of fourteen posed meshes |
| "The 5.2 m ceiling; doorways oversized by 10%" | **Withdrawn.** Replaced by silhouette weight and negative space (§4) |

The mezzanine becomes a **raised level in the same volume**, reached by a stair *and a lift alcove* — and the lift is the default guided route, exactly as MAISON's ramp is. **No content is behind the stair**; that was a blocking criterion in v1.0 and remains one.

### 0.3 What v2.0 adds

| § | Change |
|---|---|
| **§3.1** | Re-specified as a 2.5D iso cell grid |
| **§4, §16** | Restated for 2D: sprite budgets, baked textures, the queue as one instanced draw |
| **§8** | Rewritten as **nine missions with objective chains** (ADR-006 §6) |
| **§9.7** | The mentor consultation re-resolved — three beats restores the blueprint's literal *"all 3 times = Advanced"* |
| **§9.8** | New — the AI transfer beat, with the **no-advice rule as a blocking generation gate** |
| **§10.2** | The `aiBeat` rubric block. Terminals unchanged |
| **§19** | New — MERIDIAN's backend contract |
| **§18.1** | MER-0…MER-7 against the shipped Pixi stack |

---

## 1. TL;DR

The doors are heavy and they close behind you slowly, the way bank doors do. You are standing on the branch floor of MERIDIAN: three teller windows, a queue of eleven people, two desk pods, an ATM vestibule, and a wall of six screens behind the counter showing numbers that are moving. Above and behind all of it, a glass office on a mezzanine, looking down.

That office is yours. You run a mid-size retail and commercial bank — branches, an app, everyday customers, small-business clients, staff who have been here longer than you, and a regulator who reads everything.

Over four quarters you will decide where the money goes, who gets it, what you charge for it, and what you will not do to make a number. And you will make every one of those decisions in a building where you can stand on the mezzanine and look down at a queue of actual human beings, or turn ninety degrees and look at the screens instead.

**The fantasy in one line:** *you can see the numbers and the people from the same spot, and you have to choose which one you are looking at.*

**Why MERIDIAN.** Every other building in the city is a business. A bank is an institution — the only venue where a decision has a third party (the regulator), a fourth (the public), and a delay of years between the choice and the bill. That makes it the sharpest venue in the city for C5 (Strategic Thinking) and C8 (Value Creation), and the only one where "nobody would notice for a while" is a genuinely dangerous sentence.

---

## 2. Scope

### In scope

- One 2.5D isometric interior across two connected levels: a branch floor and a raised mezzanine office overlooking it (§3.1).
- Seven named NPCs, two tellers, and a **variable-length customer queue** as a first-class world-state readout.
- Nine competency decision trees × two tracks = **18 trees, 162 authored leaves**.
- A ten-key world-state model whose primary expressions are the queue and the wall of screens.
- **Nine missions**, strictly ordered, each with an objective chain (§8).
- The **mentor consultation** mechanic for C2 (§9.7) — three opportunities, matching the blueprint literally.
- **18 scripted fallback transfer beats** (§9.8.4), and the **no-advice generation gate** (§9.8.3).
- Session state synced to the backend during play and flushed on exit (§19).
- Registry content for `C1-SCA-02 … C9-SCA-02` and `C1-SCB-02 … C9-SCB-02`.
- The end-of-journey report as the annual board pack.

### Out of scope

- Any shared framework change (ADR-005 §8.4). Gaps go to the maintainer.
- Any backend endpoint beyond BE-13/BE-14.
- A banking simulation. No account screens, no loan-approval minigame, no balance-sheet builder. The interactions are: walk, look, talk, decide.
- Real financial advice. §11.4 is explicit about this: MERIDIAN teaches judgment under institutional pressure; it does not teach anyone how to bank, invest or borrow, and no copy in this building may read as guidance.
- The vault as a walkable space. It is a closed door and institutional theatre, which is all a vault has ever been.

---

## 3. The world

### 3.1 The space — a 2.5D isometric grid

> **v2.0.** Re-specified from a first-person volume to an isometric cell grid (§0.2). The composition survives; the camera changed.

**A 20 × 14 walkable play area inside a 22 × 16 grid**, with a one-cell wall ring — the largest room in the city by plan area, roughly twice the Café. The mezzanine is a **raised platform occupying the north-east block** of the same grid, drawn one level up, reached by a stair at `(17,4)` and a **lift alcove** at `(19,4)`.

Everything here is authored once in `src/buildings/bank/room.ts` and is the single source of layout truth ([ADR-005 §8.1](ADR-005_Interior_Framework.md)).

```
      x0                    x7                   x14              x21
 y0   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   far wall
 y1   ▓▓  ███ VAULT ███   ▓C ▓C ▓C ▓C ▓C ▓C ▓C ▓C ▓C  ·   ·   ·  ▓▓
 y2   ▓▓  ·   ·   ·   ·   ▓W1 ·  ▓W2 ·  ▓W3 ·   ·  ┌═════════════╗▓▓  ← counter
 y3   ▓▓  ░S ░S ░S ░S ░S ░S ░S ░S ░S ░S ░S ░S ░S   ║ MEZZANINE   ║▓▓  ← screens ×6
 y4   ▓▓  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·║ desk · TRAY ║▓▓   ▲stair ▲lift
 y5   ▓▓  ·  ○Q ○Q ○Q ○Q ○Q ○Q ○Q ○Q ○Q ○Q ○Q ○Q   ╚═════════════╝▓▓  ← THE QUEUE
 y6   ▓▓  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·  ▓▓
 y7   ▓▓  ▓PA ▓PA ·  ▓PB ▓PB  ·   ·  ▓WA ▓WA ▓WA  ·   ·   ·   ·  ▓▓  ← pods · waiting
 y8   ▓▓  ▓PA ▓PA ·  ▓PB ▓PB  ·   ·  ▓WA ▓WA ▓WA  ·   ·   ·   ·  ▓▓
 y9   ▓▓  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·  ▓▓
 y10  ▓▓  ▓A ▓A  ·   ·   ·   ·   ·   ·   ·   ·   ·  ▓L ▓L  ·   ·  ▓▓  ← ATM · leaflets
 y11  ▓▓  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·  ▓▓
 y12  ▒▒  ▒▒  ▒▒  ▒▒  ▒g ▒g  ▒▒  ▒D  ▒D  ▒▒  ▒g ▒g  ▒▒  ▒▒  ▒▒  ▒▒   vestibule sill
 y13  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   street glass
```

`▓` blocked · `·` walkable · `▒` walk-over (near sill) · `░` surface prop, non-blocking · `○` queue cell

| | | | |
|---|---|---|---|
| `C` teller counter | `W1/2/3` teller windows | `S` **wall of screens ×6** | `Q` the queue (rope line) |
| `PA/PB` desk pods | `WA` waiting chairs | `A` ATM | `L` leaflet stand (3 `fees` states) |
| `D` doors | `g` street glass | `═` mezzanine platform edge | `▒▒` near sill |

- **Spawn** `(7,11)` — **on the floor, by the doors, facing in.** You arrive as a customer would, and the queue is the first thing you see.
- **Exit** `(7,12)`, the door in the near sill.
- **The walk is the thesis.** Spawn to the mezzanine desk is ~20 cells, and the path runs the length of the queue. That happens every time you enter, on both tracks, and it is not something seniority exempts you from.

**Three load-bearing invariants, locked in `room.test.ts`:**

1. **Every mezzanine cell is reachable without the stair.** The lift alcove is a walk-over cell that teleports (cross-fades) to the platform. This is a blocking accessibility criterion (§18.2).
2. **The queue row `y5` is walkable.** You must be able to stand *in* your own line — mission 1 requires it.
3. **The border is solid except for exactly one hole**, the door, and every walkable cell reaches the open lane at `y6`/`y9`.

**Near-edge rule.** `y12` is a **low sill**, never a full wall — the street glass is drawn as a sill so it does not stand between the camera and the vestibule, and so it never clips the player's feet. This is MAISON's shopfront bug, designed out in advance ([ADR-005 §16.3](ADR-005_Interior_Framework.md)).

**Mezzanine culling.** The platform's contents are drawn only when the player is on it; the floor's dressing dims (not hides) when they are up there. Two levels of a large room drawn at full detail simultaneously is MERIDIAN's main perf risk (§16).

**Zones**

| id | name | Feel |
|---|---|---|
| `z_floor` | *the branch floor* | Public. Echoing. Everything you say here is overheard by eleven strangers. |
| `z_counter` | *behind the counter* | Staff side. The screens are directly overhead and impossible to ignore. |
| `z_pods` | *the desk pods* | Semi-private. Where the difficult conversations with customers happen, badly, in earshot of the queue. |
| `z_mezz` | *the office* | Yours. Glass. You can see everything and everyone can see you seeing it. |
| `z_vestibule` | *the vestibule* | The airlock between the street and the floor. Cold light. Where people check their balance and decide whether to come in. |

### 3.2 Circulation and sightlines

You spawn **on the branch floor, by the doors, facing in** — not in your office. The first thing you see is the queue, from the customer's position. You have to walk through your own bank to get to your own desk, past everybody waiting in it, and the stair is at the far end. That twenty-cell walk is the building's thesis and it happens every time you enter.

Three compositions — and in an isometric plan view they are all *simultaneous*, which is a gain over first person rather than a loss:

1. **Mezzanine + floor in one frame.** The queue, the screens and your desk are all on screen at once, and standing on the mezzanine you can see the line you are not in. **People and numbers, simultaneously, from a position of comfort.** Every strategic decision happens up there.
2. **The queue and the screens are adjacent on the grid** (`y5` and `y3`). From inside the line, the six screens are the only thing to look at. Customers stare at your metrics while they wait. There is something faintly obscene about that and the building leans into it.
3. **The vestibule → the floor.** Across the sill, before you commit. Where a customer decides whether the queue is worth it — and in `queue: long` states you can watch ambient customers arrive at the door, pause, and leave without crossing.

### 3.3 The unforgettable thing — THE QUEUE AND THE SCREENS

**The queue** is a rope line at the teller counter with a variable number of people in it, and it is the primary readout of everything you decide.

| State | The line | What it means without saying it |
|---|---|---|
| `long` | 11–14 people, slow shuffle, someone checking a watch | The branches are carrying load the app should be |
| `steady` | 6–8, moving | The default |
| `short` | 3–4, brisk | Digital is doing its job |
| `empty` | 0–1, and two tellers with nothing to do | You solved the wait, and now the floor is a room with staff in it and no reason for them |

And crucially, **`queue_mix`** — *who* is in the line:

| State | Composition |
|---|---|
| `paper` | Older customers, passbooks, forms, one person with a folder of documents |
| `mixed` | The default |
| `digital` | Younger, phone-in-hand, mostly at the desk pods rather than the tellers |

`empty` + `paper` is the state that should keep a player awake: you optimised the app, the queue emptied, and the four people still coming in are the four who cannot use it. Nothing in the game says that. The line says it.

**The screens** are six displays behind the counter running app sign-ups, average wait time, complaints, and net promoter score. They move between beats. They are the abstract counterpart to the queue, in the same field of view, and they are *always slightly more flattering than the floor*. That gap is deliberate and never remarked on.

**Why this satisfies the silent-tier contract:** neither the queue nor the screens has an opinion. A short queue is not a win — it might mean you have abandoned the people who need a branch. A flat screen is not a failure. The room reports; the learner judges (ADR-005 §11).

### 3.4 The letter tray

On the mezzanine desk, a shallow wooden tray. Regulator correspondence lands in it between beats. It is the only object in the building that reports on a delay — a decision made in Q2 shows up in the tray in Q4 — and it is the quiet counterweight to the screens, which report instantly and generously.

`letter_tray: empty → one → stacked → flagged`. At `flagged` there is a coloured tab on the top letter and the player can read it. Nothing happens as a consequence of reading it. It is simply there, the way it is in a real institution.

### 3.5 The year

MERIDIAN runs on four quarters. The audit is a fixed point at Q4 and everything bends toward it.

| Beat | Competency | When | The floor |
|---|---|---|---|
| 1 | C1 · Problem Sensing | **Q1**, Monday, 09:40 | Queue at fourteen. Two windows open. Grace has three branch managers' complaints. |
| 2 | C2 · Learning Agility | **Q1**, board week | Growth numbers in. The app is outpacing branches and you told the board it wouldn't. |
| 3 | C3 · Courage to Commit | **Q2**, Wednesday | Théo in the vestibule with 48 hours and a competing offer you also have. |
| 4 | C4 · Financial Discipline | **Q2**, quarter end | Loan demand high, economy shaky, deposit costs up, investors impatient. |
| 5 | C5 · Strategic Thinking | **Q3** | A product proposal on the mezzanine desk that would work and should not exist. |
| 6 | C6 · Power & Influence | **Q3** | Vivienne at desk pod A. A prestige name and an offer under your floor. |
| 7 | C7 · People Management | **Q4**, two weeks to audit | Grace is running on nothing. Hugh's team made an expensive error. Morale is thin. |
| 8 | C8 · Value Creation | **Q4** | A fee restructure that this quarter needs and almost nobody would notice. |
| 9 | C9 · Perseverance | **Q4+** | The launch flopped. Then the app went down for six hours. Then the partner pulled out. |

The quarter is displayed on the mezzanine wall as a small printed card in a brass holder, changed between beats — an institutional detail rather than a HUD.

---

## 4. Art direction

**One line:** *permanent, expensive, and slightly too cold* — a building designed to outlive everyone in it.

| Element | Direction |
|---|---|
| **Palette** | Institutional blue-grey, pale stone, brushed steel, glass. **Warmth appears in exactly two places:** the wood of the desk pods and the teller counter's top, and the letter tray. Money is cold; the places where people talk to each other are wood. 15 colours. |
| **Light** | Baked cold and flat across the floor — even, unforgiving, no warm falloff anywhere except two places. Warm tints at the desk pods and on the letter tray. The screens are the brightest thing in the room and they are blue. |
| **Surface** | The stone floor gets a cheap baked sheen — a lighter diagonal band, not a reflection. It is the one place MERIDIAN spends anything on surface, because a floor that looks hard is what a bank *sounds* like, visually. Matte everywhere else. |
| **Scale** | v1.0's oversized ceiling is withdrawn (§0.2). Institutional scale is carried by **plan area and negative space** instead: the walk is long, the lanes are wide, and there is more empty floor than any other interior in the city. Nobody notices consciously; everybody feels small. |
| **Wear** | Almost none on the architecture — the building is maintained. All the wear is on the *furniture people touch*: the counter edge, the pen chained at window 2, the waiting-area chairs. |
| **Silhouette** | Rectilinear, heavy, symmetrical. The queue rope is the only curve in the building. |
| **The screens** | Emissive cards with a low-res animated texture. Readable at a glance from the mezzanine, legible in detail from the counter. Numbers, not charts — charts read as a UI, numbers read as signage. |

**Candidate CC0 sources** (license audit required — ADR-005 §16.1):

| Need | Candidate | License |
|---|---|---|
| Architecture, glass, stair, counters | Kenney *Modular Buildings*, *Retro Urban Kit* | CC0 (verify) |
| Desks, chairs, shelving, office | Kenney *Furniture Kit* | CC0 (verify) |
| Characters | `src/world/characterArt.ts` — baked procedurally, four facings | n/a (ours) |
| Vault door, teller windows, ATM, rope line | Procedural draw functions in `props.ts`; `PROP_SPRITE` is the seam for real art later | n/a |
| Queue crowd (§16) | **8 posed sprites × 3 tints, one baked atlas, one instanced draw** | n/a |

MERIDIAN is the **cheapest of the three buildings to art-direct** — institutional architecture is repetitive, symmetrical and modular, which is exactly what a small set of procedural draw functions is good at. Its costs are all in plan area, not variety. **The screens are the one hero prop** and they are DOM-readable on inspection rather than baked text (§15).

---

## 5. The cast

Seven named plus two tellers. **Animated characters capped at 5 on screen**; the queue is posed static sprites from one baked atlas (§16), which is what makes a fourteen-person line affordable.

### 5.1 Grace Adeyemi — branch manager

- **Who.** 47. Twenty years on this floor, eleven of them running it. Knows every regular by name and every teller's childcare arrangements. Is currently running on about four hours a night and has told nobody, because telling people is not what she does.
- **Look.** Immaculate, always. The tell is that she is *too* immaculate — the composure is effortful and it reads.
- **Anchor.** The floor, between the pods and the counter. Patrol: counter → pods → vestibule → counter. She never sits.
- **Animation.** `stand_attentive`, `walk`, `talk`, `listen`, `rub_eyes` (rare, and only when `staff_mood` is `thin` — one animation doing an enormous amount of characterisation).
- **Voice.** Warm, efficient, deflects. Answers the question you asked rather than the one you meant. *"We're fine. Tuesday was hard. We're fine."*
- **Carries.** C1 (she brings you the complaints) and C7 Level A (she is the one burning out).
- **Gaze.** `player_near`, but with a half-second delay — she finishes what she is doing first. She is the only NPC in the city who makes you wait, and it says everything about her.

### 5.2 Hyun-woo "Hugh" Park — compliance officer

- **Who.** 34. Precise, anxious, correct considerably more often than he is listened to. Has raised the same concern three times in writing and is about to be right about it in an expensive way.
- **Look.** The least expensive suit on the mezzanine and the tidiest desk. Carries a folder everywhere.
- **Anchor.** A desk at the back of the mezzanine, `z_mezz`. Comes down to the floor only when something is wrong.
- **Animation.** `type`, `stand_folder`, `talk`, `listen`, `adjust_glasses`.
- **Voice.** Careful, slightly over-prepared, apologises for things that are not his fault. *"I flagged this in March. I'm not — I'm not saying that to score a point. I'm saying it because the March version is the one that's easiest to fix."*
- **Carries.** C7 Level B (the costly error happened on his watch, and he told you it would) and C8.

### 5.3 Devika Rao — regional manager

- **Who.** 50s. Believes in branches with genuine conviction, not nostalgia — she has data, she has communities, and she is at least partly right, which is what makes her difficult.
- **Look.** Travels. Coat on, bag down, never quite settled.
- **Anchor.** The mezzanine when present; otherwise absent from the building.
- **Animation.** `stand_talk`, `gesture_floor` (she points at the queue a lot), `sit_lean_forward`.
- **Voice.** Direct, evidence-led, unimpressed by decks. *"Show me the town where the branch closed and the app took over. I'll wait."*
- **Carries.** C2 — she is the counter-pressure to the mentor, and in the follow-up branches she is the one who insists branches are your only real advantage.

### 5.4 Sam Oyelaran — the mentor

- **Who.** 60s. Twenty years at a regulator, ten advising banks. Never tells you what to do. Asks what the number is measuring.
- **Look.** Comfortable, unhurried, sits down without being asked and it is fine.
- **Anchor.** Not in the building by default. Reachable from the mezzanine desk phone at any beat; appears in person for C2.
- **Animation.** `sit_talk`, `sit_listen`, `stand_window` (looks down at the floor from the glass — he always looks at the queue, never the screens, and never mentions it).
- **Voice.** Slow, specific, ends on a question. *"More sign-ups than branch openings. Openings of what — accounts, or doors?"*
- **Carries.** C2 and the consultation path.

### 5.5 Théo Marchand — fintech founder

- **Who.** 30s. Fast, warm, genuinely good at what he does, and entirely straight about the fact that his deadline is real because his own board set it.
- **Look.** The only person in the building not wearing a jacket. Stands out from twenty metres, which is the staging point.
- **Anchor.** The vestibule first — you see him through glass before you meet him — then the mezzanine.
- **Animation.** `walk_talk`, `gesture`, `show_phone`, `lean_glass`.
- **Voice.** Fluent, generous with detail, closes without appearing to. *"Friday isn't a tactic. Friday is when my engineers get assigned to somebody."*
- **Carries.** C3 and C5.

### 5.6 Vivienne Clark — the corporate client

- **Who.** Treasury lead at a name everyone recognises. Opens low, stays pleasant, mentions her alternatives once and never again.
- **Look.** Cooler palette than the room, which in this room is an achievement. Sits at desk pod A rather than being taken to the mezzanine, because she chose to.
- **Anchor.** Desk pod A, seated, in earshot of the queue — the negotiation happens in public and that is her doing.
- **Animation.** `sit_talk`, `sit_lean_back`, `slide_paper`, `check_phone`.
- **Voice.** Courteous, unhurried, never raises pressure — the pressure is structural. *"We'd like to work with you. I should say we're also talking to two others, but I'd rather it was you."*
- **Carries.** C6.

### 5.7 Alan Whitfield — the Tuesday customer

- **Who.** 78. In every Tuesday at 10:15, paper passbook, knows both tellers by name and asks after their families. He is not a plot device and he is not a lesson. He is a man who has banked here for forty-one years.
- **Look.** Coat, hat, the passbook. The most static silhouette on the floor — you notice when he is not there, exactly as you notice Marcus's empty chair in the Café.
- **Anchor.** Window 2, or the waiting-area chairs. Never the pods, never the app.
- **Animation.** `stand_wait`, `talk_teller`, `sit_wait`, `walk_slow`.
- **Voice.** Unhurried, courteous, occasionally funny. Never complains. *"I know it's all on the telephone now. I like the walk."*
- **Carries.** No decision at all — he carries the *consequence* of C1 and C5, which is the most important job in the building. When `queue_mix` goes `digital` and he is still there at window 2 with nobody else in the line, the game has said something it never wrote down.

### 5.8 Tellers and queue

Two animated tellers (Maya and Josef, unnamed in dialogue — `serve`/`type`/`talk`). The queue is **posed static sprites** with transform-level idle sway — up to fourteen, drawn from one baked atlas in a single instanced draw. See §16.

---

## 6. Ambient life

| Beat | Interval | Notes |
|---|---|---|
| Teller call ("window two, please") | 20–40 s | The building's metronome. Frequency scales with `queue`. When the queue is `empty` it stops entirely and the silence is loud. |
| Receipt printer | 15–35 s | Positional, from the counter |
| Queue shuffle | 25–50 s | The whole line moves one place; a small transform animation across fourteen instances |
| Doors (heavy, slow close) | 40–90 s | Someone arrives or leaves. In `queue: long` states, some arrive, look, and leave — visible from the vestibule. |
| Screen tick | 30 s, fixed | One of the six screens updates a number. Regular, mechanical, never dramatic. |
| Keyboard from the mezzanine | continuous, low | Hugh, working. Stops when he stands up, which is how you know he is coming to say something. |
| Stone-floor footsteps | continuous | The floor is hard and the ceiling is high. Everyone in this building is audible. **This is the single best ambience decision available here** — you hear people approaching before you see them. |
| Vault door (never opens) | — | Static. It is theatre and it is honest about being theatre. |

**Density binds to `queue` and `staff_mood`.** At `staff_mood: fearful` the tellers stop talking to each other between customers, which is a two-line change in the ambient loop and is instantly readable.

**Reduced motion / low-spec:** the queue shuffle becomes a cut rather than a slide; screen ticks halve; the crowd's idle sway stops. Teller calls and footsteps remain — they are informational.

**Audio.** Large hard-surfaced room tone with a real tail. **No music, ever.** Banks do not have music, and the absence is characterful. The street bed from Downtown is heavily filtered and only audible in the vestibule.

---

## 7. Player presence

- **Spawn:** `(7,11)`, on the floor by the doors, facing in — from the customer's position, looking at your own queue. **Identical on both tracks, deliberately** (§14).
- **Movement:** click-to-move over the walkable grid, plus WASD/arrows. Walking pace. The building is the largest in the city; that is a feature, and the twenty-cell walk is the thesis.
- **The queue row is walkable.** You can stand *in* your own line, and mission 1 makes you.
- **Interactables:** the queue (inspect — a readable DOM list of who is in it and how long they have waited), the screens (six labelled metrics, **DOM on inspection, never baked text**), the letter tray, the quarter card, the leaflet stand, the desk phone (Sam), the vault door (inspect; it does not open, and the prompt says so), and **each NPC** — all of them hotspots the mouse can touch.
- **Prompts:** DOM, anchored to the prop. The screens' is *"read the board"*. The tray's is *"the morning's post"*. **No station the guide offers is a dead end.**
- **Guided navigation:** real `<button>`s in a labelled `<nav>` — *the doors · the vestibule · the queue · the counter · desk pod A · desk pod B · the waiting area · the office · the letter tray*. **The lift is the default route to the mezzanine and every mezzanine cell is reachable without the stair.** The first entry is wherever the year is waiting.
- **The mission tracker** sits top-left (§8, §11.0). The quarter stays on the brass card.
- **Exit:** the doors. Always available; flushes the year on the way out (§19.3).

---

## 8. The mission spine

> **v2.0.** Nine staged beats become nine **missions** with objective chains ([ADR-006 §6](ADR-006_Missions_AI_Followups_and_Session_State.md)). The staging column survives verbatim as each mission's `staging` line.

### 8.1 The year

| # | Q | Comp | Title | Station | Host | The floor |
|---|---|---|---|---|---|---|
| 1 | Q1 | **C1** Problem Sensing | Fourteen In The Line | `st_counter` | **Grace** | 09:40, fourteen waiting, two windows open |
| 2 | Q1 | **C2** Learning Agility | Four To One | `st_mezz` | **Sam** + **Devika** | board week; the app is outpacing branches four to one |
| 3 | Q2 | **C3** Courage to Commit | Friday | `st_vestibule` | **Théo** | you see him through the glass before he sees you |
| 4 | Q2 | **C4** Financial Discipline | Quarter End | `st_mezz_desk` | **nobody** | late, floor empty, capital comfortable rather than strong |
| 5 | Q3 | **C5** Strategic Thinking | Before Friday | `st_mezz_desk` | **the proposal** | a deck that works, and should not exist |
| 6 | Q3 | **C6** Power & Influence | A Prestige Name | `st_pod_a` | **Vivienne** | she sat at the pod rather than coming up |
| 7 | Q4 | **C7** People Management | We're Fine | `st_pods` | **Grace** / **Hugh** | two weeks to the audit |
| 8 | Q4 | **C8** Value Creation | Page Nine | `st_mezz_desk` | **Hugh** | he put the paper on your desk rather than sending it |
| 9 | Q4+ | **C9** Perseverance | The Launch | `st_mezz` | **the screens** | three things wrong at once, and the tray is stacked |

**Grace is the anchor NPC** ([ADR-006 §9](ADR-006_Missions_AI_Followups_and_Session_State.md) step 3): she is on the floor in every world state, she never sits, and MERIDIAN cannot render a branch without its manager. Acceptance criterion, not convention.

**Pacing.** Between missions: the quarter card in its brass holder changes, the queue and screens update, the letter tray may gain a letter, and staff idle sets shift. Nothing is on a timer.

### 8.2 The objective chains

**MERIDIAN's signature objective is `inspect st_queue`** — going and looking at your own line. Five of the nine missions make you do it, and one makes you *stand in it*.

---

**Mission 1 · C1 · "Fourteen In The Line"** · Q1 · host **Grace**

| # | Kind | Target | Tracker line | Cue |
|---|---|---|---|---|
| 1 | `go_to` | `st_queue` | *walk the length of your own bank* | You pass all fourteen of them. The third window has said `POSITION CLOSED` since before you started |
| 2 | `inspect` | `st_queue` | *look at who's actually waiting* | The DOM readout: how many, roughly who, how long the front has waited |
| 3 | `talk_to` | `grace` | *Grace has been holding something since Friday* | She did not want to bring you a problem on a Friday |
| 4–6 | `decide` | seed · follow · transfer | *decide* | |
| 7 | `inspect` | `st_screens` | *read the board* | The screens are always slightly more flattering than the floor. Nobody remarks on it |

Objective 7 is the building's thesis delivered without a line of dialogue: you have just decided something about the queue, and now you look at the numbers that describe it.

`closeWorldState`: `{ quarter: "Q1" }` · candidates: `[{ queue: "steady" }, { queue_mix: "paper" }, { screens: "app_flat" }]`

---

**Mission 2 · C2 · "Four To One"** · Q1 · hosts **Sam** + **Devika** · **the mentor mission**

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `inspect` | `st_screens` | *sign-ups are four to one* |
| 2 | `go_to` | `st_lift` | *go up* — the lift, which is also how guided navigation gets there |
| 3 | `talk_to` | `devika` | *Devika thinks the branches are the edge* — she has data, and she is at least partly right |
| 4–6 | `decide` | seed · follow · transfer | **Sam is one of the three options at each of the three beats** — §9.7 |
| 7 | `inspect` | `st_letter_tray` | *the morning's post* |

---

**Mission 3 · C3 · "Friday"** · Q2 · host **Théo**

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `inspect` | `st_mezz_desk` | *the competing offer is already on your desk* |
| 2 | `wait_for` | `theo` | *someone's in the vestibule* — you see him through the glass first |
| 3 | `go_to` | `st_vestibule` | *go down and meet him* |
| 4 | `talk_to` | `theo` | *Friday isn't a tactic* |
| 5–7 | `decide` | seed · follow · transfer | |
| 8 | `report` | `hugh` | *tell Hugh what you're signing* — he will have to live with it |

---

**Mission 4 · C4 · "Quarter End"** · Q2 · **no host**

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `inspect` | `st_queue` | *the floor is empty* — the rope line with nobody in it, which is its own state |
| 2 | `go_to` | `st_mezz_desk` | *quarter end* |
| 3 | `inspect` | `st_screens` | *the numbers, from up here* |
| 4–6 | `decide` | seed · follow · transfer | **narration** — ADR-006 §9 step 4; the dialogue layer names *the capital position on the desk* |

No `report`. Like the Café's night beat, this mission ends with you alone in the building, and the tracker's last line is *go home*.

---

**Mission 5 · C5 · "Before Friday"** · Q3 · **the proposal**

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `inspect` | `st_mezz_desk` | *there's a deck on your desk* |
| 2 | `go_to` | `st_queue` | *go and look at who'd buy it* |
| 3 | `inspect` | `st_queue` | *look at the line properly* — the composition, not the length |
| 4–6 | `decide` | seed · follow · transfer | Speaker: **Grace** if she is near, else **Hugh**, else narration |
| 7 | `inspect` | `st_leaflets` | *the vestibule leaflet stand* — what you already tell people about your fees |

Objectives 2 and 3 are the mission. The product is aimed at people who need cash before Friday, and the mission makes you go and stand near them before you decide.

---

**Mission 6 · C6 · "A Prestige Name"** · Q3 · host **Vivienne**

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `wait_for` | `vivienne` | *she's taken desk pod A* — she chose the pod over your office |
| 2 | `go_to` | `st_pod_a` | *go down to her* |
| 3 | `talk_to` | `vivienne` | *hear the number* — nine people in the queue behind her can hear it too |
| 4–6 | `decide` | seed · follow · transfer | |
| 7 | `report` | `grace` | *tell Grace what you agreed* — her floor will service it |

---

**Mission 7 · C7 · "We're Fine"** · Q4 · hosts **Grace** / **Hugh**

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `inspect` | `st_letter_tray` | *the audit is in two weeks* |
| 2 | `talk_to` | `hugh` | *he flagged this in March* — three times, in writing |
| 3 | `go_to` | `st_pods` | *go down to the floor* |
| 4 | `talk_to` | `grace` | *"We're fine. Tuesday was hard. We're fine."* |
| 5–7 | `decide` | seed · follow · transfer | Track A host **Grace**; track B host **Hugh** |
| 8 | `report` | *the other one* | *say the same thing to both of them* |

Eight objectives, and objective 8 is why: the whole competency is whether you tell the same story to the person who was right and the person who is exhausted.

---

**Mission 8 · C8 · "Page Nine"** · Q4 · host **Hugh**

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `wait_for` | `hugh` | *the keyboard stopped* — Hugh only stands up when he wants to be in the room |
| 2 | `talk_to` | `hugh` | *"I've modelled it because you asked for options."* |
| 3 | `inspect` | `st_leaflets` | *the fourteen-page terms booklet* — nobody has ever read page nine |
| 4–6 | `decide` | seed · follow · transfer | |
| 7 | `inspect` | `st_queue` | *look at whose accounts these are* |

Objective 1 is a whole character in one mechanic: **the keyboard from the mezzanine is a continuous ambient bed, and it stops.** That is how you know he is coming.

---

**Mission 9 · C9 · "The Launch"** · Q4+ · **the screens**

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `inspect` | `st_screens` | *all three of the ones that matter are wrong* |
| 2 | `inspect` | `st_letter_tray` | *the tray is stacked* |
| 3 | `go_to` | `st_queue` | *the floor, on a bad Monday* |
| 4 | `talk_to` | `grace` | *ask Grace what the floor is saying* |
| 5–7 | `decide` | seed · follow · transfer | Speaker: **Grace** — anchor |
| 8 | `inspect` | `st_screens` | *look again* |

### 8.3 What this requires

| Need | Change |
|---|---|
| Everything | `src/buildings/bank/` does not exist. MER-0 and MER-1 build the room from §3.1 |
| `st_queue` inspectable and **standable** | The queue row `y5` is walkable, and inspecting produces the DOM readout §15 makes blocking |
| `st_screens` DOM-readable | Six labelled metrics with values and direction of travel, **not** baked text |
| Lift as the default guided route | `guide.ts`, MAISON's ramp pattern |
| Hugh's keyboard as an ambient bed that **stops** | §6; mission 8 objective 1 depends on it |
| Mission tracker + runner | Framework (ADR-005 §17 G9). Built in the Café, consumed here |

---

## 9. Decision content

### 9.1 How to read this section

Two-beat trees, branch-specific follow-ups, nine leaves (ADR-005 §9.2). Tiers live in §10 only. Choice letters are shuffled per activity.

### 9.2 Writing MERIDIAN's weak options — the hardest craft problem in the city

Two of MERIDIAN's decisions (C5 and C8) have a Developing option that is, in plain terms, *make money in a way that hurts people*. The plausible-peers rule (ADR-005 §11.4) requires that option to read as something a competent person genuinely chooses — and the design must do that **without endorsing it and without turning the learner into a mark.**

The rule applied throughout this building:

1. **Write it as the institutional case, because that is how these decisions actually get made.** Nobody in a bank has ever said "let's exploit vulnerable customers." They say "the product is legal, it is disclosed, it serves a real liquidity need, and the alternative for those customers is worse." That sentence is true, defensible, and how the harm happens. Write *that*.
2. **Never write it as villainy.** No smirking, no "they'll never know", no character who enjoys it. Hugh brings the fee restructure to you because it is his job to model options, and he is visibly uncomfortable, and he still brings it.
3. **Never write it as a recommendation.** The consequence does the work — years later, in the letter tray, in the queue's composition, in a regulator's tone. §11.4 is explicit: **no copy in this building may read as financial advice, and none of it may read as a defence of predatory practice.** The consequence is where the truth lives.
4. **The Advanced option must cost real money.** If refusing the fee is free, it is not a decision. It costs the quarter, and the quarter is real, and someone will ask about it.

This is the section a reviewer should read before reading §9.5, and it applies to the remaining nine buildings whenever a decision has an ethical floor.

### 9.3 Rewrites of the source blueprint

| Where | Source phrasing | Problem | Shipping text |
|---|---|---|---|
| C1-B (Lv B) | "Rush to copy the rival's app right away, or you'll keep losing customers." | "Rush to copy" is a judgement | "Match their app, this cycle. Every quarter you spend researching is a quarter of switchers you don't get back." |
| C2-A | "Stick with the branch plan — it's what you promised, and the early numbers are probably just noise." | "Probably just noise" dismisses it | "Hold the branch plan. Two quarters of sign-ups is an acquisition spike, not a channel shift, and a bank that re-plans every quarter has no plan." |
| C3-A | "Ask for two more weeks to research — better safe than sorry." | Cliché marks it | "Take two more weeks. Neither of these partnerships is easy to unwind, and a payments integration you regret is a three-year regret." |
| C4-A (Lv B) | "Loosen lending standards quickly to hit the growth investors want." | "Loosen standards quickly" is the author's verdict | "Widen the credit box to where the market is. Your standards were set for a different rate environment, and holding them while everyone lends is a choice too." |
| C5-A | "Launch it now — the quick profit is too good to pass up." | Marked | "Launch it. The demand is real, the product is legal and disclosed, and the customers who need money before Friday will get it somewhere far worse than here." |
| C6-A | "Accept the fee cut — having their name as a client is worth more than the lost revenue." | Thin | "Take the terms. That name on the client list opens doors with every other treasurer in the city, and reference value is revenue you can't invoice." |
| C7-A | "Push the team to hit the numbers — well-being can wait until after the busy season." | "Well-being can wait" is a verdict | "Hold the targets through the quarter. Everyone here has done a busy season before, and moving the goal two weeks out tells them the goal was never real." |
| C8-A | "Add the hidden fees — they lift profit right now." | "Hidden" marks it | "Restructure the fee schedule. It's disclosed, it's within the rules, and it closes the gap without touching a single rate anyone shops on." |
| C8-A (Lv B) | "Bury the fees in fine print — the numbers are what matter." | Marked | "Take the restructure. Every bank in this market prices the same way, the disclosure is compliant, and a quarter you miss is a quarter you explain for a year." |
| C9-A | "Panic and overhaul the whole strategy, or blame the market and freeze up." | Two options in one, both marked | "Overhaul it. The strategy produced this, and running the same plan into a worse quarter is how institutions die slowly." |
| C9-A (Lv B) | "Kill the product entirely, or stubbornly refuse to change anything." | Same | "Kill the product. Three failures in one quarter is not variance, and the discipline nobody praises is knowing when to stop funding something." |

---

### 9.4 Exemplar A — `C1-SCA-02` · "Fourteen In The Line" (Level A, fully worked)

**Station** `st_floor_counter` · **Host** Grace · **Q1, Monday 09:40**

> **Stage.** You have walked the length of your own bank to get here, past all fourteen of them. Two windows are open. The third has a card in it that says *POSITION CLOSED* and has said so since before you started.
>
> Grace has been holding this since Friday. She did not want to bring you a problem on a Friday.
>
> **Grace:** *"Three of the branch managers have sent the same thing. It's the waits. It's been the waits for about six months, and I think we've stopped hearing it because it's always the waits."*
>
> There is budget for one improvement this quarter.

**Seed choices**

| | Text |
|---|---|
| **a** | "Try one thing in three branches — mobile check-in, or a self-service station for the simple stuff — and see what people actually use before you spend across the network." |
| **b** | "Go and talk to the people in the line. Find out whether the problem is the twelve minutes, or that they had to come in at all for something that should have taken thirty seconds." |
| **c** | "Put more tellers on. The complaint is the wait, the fix for a wait is capacity, and the people in that line have been told 'we're looking at it' for six months." |

**Seed consequences**

- **a** — *Three branches, four weeks. The self-service station gets used four hundred times; mobile check-in gets used eleven. You now know one thing you did not know, which is more than the quarter usually delivers.* → `screens: app_flat`
- **b** — *You stand in your own vestibule for two hours on a Tuesday. Nine of the fourteen are there for something that takes under a minute and cannot be done any other way. Two are there because the app asked for a document they cannot photograph. One is Alan, who likes the walk.* → `queue_mix: paper`
- **c** — *Two more tellers by the end of the month. The wait drops from twelve minutes to eight and the complaints keep coming, because eight minutes to pay in a cheque is still eight minutes to pay in a cheque, and now it costs you two salaries.* → `queue: steady`, `loan_book: balanced`

**Follow-up — branch a** *(you tested in three branches)*

> The self-service station is a hit and check-in is not. Devika, who runs two of the three, says the station is proof the branch is the answer. Sam, on the phone, asks what the four hundred people used it *for*.

| | Text |
|---|---|
| **a** | "Roll out the stations. Four hundred uses in four weeks against eleven is not a close result, and there is such a thing as over-analysing a win." |
| **b** | "Find out what the four hundred were doing. If it's all one transaction type, the station isn't the answer — that transaction is, and it might not need a building." |
| **c** | "Roll the stations out and keep measuring the same way. You've found something that works and a method that works; use both." |

**Follow-up — branch b** *(you stood in the queue)*

> You know now: nine of fourteen are here for something that takes a minute, and two are here because the app asked for a document they cannot photograph. Grace, when you tell her: *"So do we make the branch faster, or make the branch unnecessary?"*

| | Text |
|---|---|
| **a** | "Fix the one-minute transactions first — that's nine of fourteen, and it's the same nine every week. Whatever channel that lands in, it lands there." |
| **b** | "Both, but the wrong order is the trap. Fix the document photo first — those two are the ones who tried to leave and couldn't." |
| **c** | "Design the ninety seconds properly, wherever it happens, and accept that a fifth of these people will always want a counter and a person, and that's a service, not a failure." |

**Follow-up — branch c** *(you hired tellers)*

> Eight minutes instead of twelve, two more salaries, and the same complaints. Devika thinks you've proved the branch model. Grace has stopped forwarding the complaints, which is not the same as them stopping.

| | Text |
|---|---|
| **a** | "Ask Grace why she stopped forwarding them, and then go and stand in the line yourself, six months late." |
| **b** | "Add a third teller. Eight minutes is better than twelve; four would be better than eight; the direction is right." |
| **c** | "Keep the tellers and pilot one self-service change alongside them — you've bought capacity, now find out whether capacity was the problem." |

---

### 9.5 Exemplar B — `C8-SCB-02` · "Within The Rules" (Level B, fully worked)

**Station** `st_mezz_desk` · **Host** Hugh · **Q4**

> **Stage.** The mezzanine, late afternoon, the floor below thinning out. Hugh has put the paper on your desk rather than sending it, which he only does when he wants to be in the room.
>
> A fee restructure. Reordered transaction processing, a revised threshold on the maintenance waiver, and a change to how the overdraft buffer is calculated. It closes the quarter's gap and then some.
>
> Every element is legal. Every element is disclosed in the terms. The disclosure is fourteen pages long and nobody has ever read page nine.
>
> **Hugh:** *"I've modelled it because you asked for options. I want to be clear that's why it's here."*

**Seed choices**

| | Text |
|---|---|
| **a** | "Don't do it — and don't just quietly not do it. Publish the fee schedule in plain language, put the money into helping customers avoid fees, and make being legible the thing this bank is known for." |
| **b** | "Take the restructure. Every bank in this market prices the same way, the disclosure is compliant, and a quarter you miss is a quarter you explain for the next four." |
| **c** | "Leave the fees alone and find the gap somewhere harder — costs, the property book, the two products nobody uses. It will take longer and it will be less clean." |

**Seed consequences**

- **a** — *You publish a one-page fee schedule in language a person can read, and fund a small team to tell customers how not to pay you. The quarter misses. Two board members ask, reasonably, what exactly you have optimised for.* → `fees: transparent`, `regulator: watching`, `letter_tray: one`
- **b** — *The gap closes with room to spare. Nothing happens for five months. Then the complaints data turns, and the complaints are concentrated in the accounts with the lowest balances, and that pattern is legible to anyone who looks at it — including the people whose job is looking at it.* → `fees: buried`, `letter_tray: stacked`, `queue_mix: paper`
- **c** — *It takes eleven weeks and it is genuinely miserable. You close two products, renegotiate a property lease, and cut a project three people had staked a year on. The quarter lands short but the fee schedule is untouched.* → `staff_mood: thin`, `fees: standard`

**Follow-up — branch a** *(you published)*

> Fee income is down eleven per cent. Complaints are down forty. A trade publication writes eight hundred words about you, mostly admiring, and a competitor's CFO is quoted saying it is "an interesting experiment". Two board members want to know when the experiment concludes.

| | Text |
|---|---|
| **a** | "Report it as an experiment with an end date, so the board has something to hold, and quietly hope the retention numbers arrive before the deadline does." |
| **b** | "Refuse the framing. This isn't an experiment, it's what the bank is; take the eleven per cent to the board with the forty and make them argue with the trade." |
| **c** | "Take it further while you have the attention — publish the complaints data too, and make the transparency structural rather than a fee-schedule decision that could be reversed by the next person in this chair." |

**Follow-up — branch b** *(you took the restructure)*

> Month five. The complaints pattern is unmistakable and the letter tray has three items in it. Hugh has not said *I told you so* and is not going to, which is somehow worse.

| | Text |
|---|---|
| **a** | "Reverse the buffer calculation now, before anyone asks you to, and put the reversal in writing to the regulator with the pattern attached." |
| **b** | "Reverse the whole restructure, refund the affected accounts without being told to, and take the write-back in a single visible quarter rather than bleeding it." |
| **c** | "Hold. Nothing has been alleged, the disclosure is compliant, and unwinding a compliant product on a complaints pattern sets a precedent you cannot afford." |

**Follow-up — branch c** *(you found it the hard way)*

> The quarter landed short by about a fifth. The fee schedule is intact. The three people whose project you cut have started updating their profiles, and Grace has asked you, once, whether it was worth it.

| | Text |
|---|---|
| **a** | "Tell her exactly what it bought — the fee schedule you didn't touch — and then go and tell the three people the same thing, by name, before they leave." |
| **b** | "Say it was worth it, and get on with the quarter. Explaining a decision to everyone it inconvenienced is how you end up making decisions by committee." |
| **c** | "Answer her honestly: you don't know yet, the bill for the alternative arrives in year three, and you'd rather be short than find out." |

---

### 9.6 The remaining sixteen trees — seed layer and follow-up specification

#### C1 · Problem Sensing — `root_cause`

**Level A — `C1-SCA-02`** — fully worked in §9.4.

**Level B — `C1-SCB-02` "Switchers"** · `st_floor_counter` · Grace · Q1
> Wait-time complaints rising, a rival just shipped a genuinely good app, and switching to online-only banks is accelerating. One budget line. No data on what customers actually want.

- Match their app this cycle. Every quarter you spend researching it is a quarter of switchers you do not get back.
- Pilot one fix in a handful of branches, track usage and complaint volume, and decide the rollout on what comes back.
- Find out who is frustrated, how often, and what would actually make them leave — then spend only where the pain is real.

#### C2 · Learning Agility — `updating_beliefs`

**Level A — `C2-SCA-02` "Four To One"** · `st_mezz` · Sam + Devika · Q1
> You bet the growth plan on branches. Sign-ups through the app are outpacing branch openings four to one, and it is the second quarter running.

- Hold the branch plan. Two quarters of sign-ups is an acquisition spike, not a channel shift, and a bank that re-plans every quarter has no plan.
- Get Sam to pull the numbers apart with you — what the sign-ups actually are — and move budget to digital if he reads it as you do.
- Shift new investment toward the app where growth is strongest, and keep branches funded in the communities that genuinely have no alternative.

*Follow-ups:* **"held"** → a third quarter, same shape; Devika still insists branches are the edge · **"asked Sam"** → he finds the sign-ups are 60% existing customers opening second accounts, which changes what the number means entirely · **"shifted"** → a rival that closed all its branches gets savaged in the press for service; were you wrong?

**Level B — `C2-SCB-02` "On The Record"** · `st_mezz` · Sam + Devika · Q1
> The branch-first plan is underperforming. Sam says the future is digital. You have said the opposite to the board and to a journalist, in print, with your name on it.

- Defend the plan publicly. Reversing two quarters after you staked your credibility on it tells the board your strategy is a mood.
- Move the plan on the data — shift resources to digital quietly, keep branches as the in-person promise, and let the results make the announcement.
- Treat being wrong as the most useful thing that happened this year. Get Sam to stress-test it, then reshape the plan early, before the market does.

#### C3 · Courage to Commit — `deciding_uncertainty`

**Level A — `C3-SCA-02` "Friday"** · `st_vestibule` · Théo · Q2
> A fintech wants to partner on payments. 48 hours. Decent terms. You do not have all the facts and you will not get them by Thursday.

- Take two more weeks. Neither of these partnerships is easy to unwind, and a payments integration you regret is a three-year regret.
- Weigh what you actually know against what you don't, decide inside the 48 hours, and own it either way.
- Commit to the partner who fits where this bank is going in five years, and accept that you are choosing partly blind.

**Level B — `C3-SCB-02` "Two Offers, One Slot"** · `st_vestibule` · Théo · Q2
> An exclusive from the fintech, a competing offer from an incumbent vendor, and a roadmap slot that closes Friday. Neither is proven.

- Hold both offers and keep gathering until one of them stops being a guess, even if that means losing the roadmap slot.
- Choose the one that fits the strategy and move before the slot closes, on what you know rather than what you'd like.
- Decide cleanly under the pressure, accept that it's your name on it, and turn the decision into momentum with the delivery team the same week.

#### C4 · Financial Discipline — `budgeting`

**Level A — `C4-SCA-02` "Quarter End"** · `st_mezz` · none · Q2
> Loan demand is strong. Approving freely would grow the book fast and take on risk you cannot see yet.

- Approve at pace. Demand like this doesn't sit around waiting for a credit committee, and the book has never been stronger.
- Lend inside your limits, hold the capital cushion, and take the applicants who can clearly repay in a bad year as well as this one.
- Match lending to demand you can evidence, time it against your funding costs, and keep reserves sized for a downturn rather than for a forecast.

**Level B — `C4-SCB-02` "Comfortable, Not Strong"** · `st_mezz` · none · Q2
> High demand, a shaky economy, deposit costs up, investors pushing for growth, and a capital position that is comfortable rather than strong.

- Widen the credit box to where the market is. Your standards were set for a different rate environment, and holding them while everyone lends is a choice too.
- Lend only to solid borrowers, prioritise return over volume, and weigh every point of growth against what it does to capital.
- Build the growth out of better funding and lower-risk lending before chasing volume at all — and make the caution itself the thing you're known for.

#### C5 · Strategic Thinking — `systems_thinking`

**Level A — `C5-SCA-02` "Before Friday"** · `st_mezz_desk` · the proposal · Q3
> A short-term, high-fee credit product aimed at people who need cash before payday. The margins are excellent and the demand is real.

- Launch it. The demand is real, the product is legal and disclosed, and the customers who need money before Friday will get it somewhere far worse than here.
- Work out what it does to trust and to the regulator over one to three years, put that against the profit, and decide with both numbers in front of you.
- Trace where it actually lands — on the customers, on the complaints data, on the next licence conversation — and design a product that meets the same need without the harm, or don't ship one.

**Level B — `C5-SCB-02` "Two Good Years"** · `st_mezz_desk` · the proposal · Q3
> The product would lift profit for two years. It would also concentrate harm in your most vulnerable customers, attract supervisory attention, and change how the market talks about you.

- Ship it. It solves this year, and this year is the one the board and the market are actually looking at.
- Map what it does to supervision, to complaints and to reputation over three years before you commit the bank to any of it.
- Model the whole system — customers, complaints, supervision, funding costs, who still partners with you in five years — and act to avoid that crisis now.

#### C6 · Power & Influence — `reading_people`

**Level A — `C6-SCA-02` "A Prestige Name"** · `st_pod_a` · Vivienne · Q3
> A large corporate client wants your services at half your fees, on the grounds that having them is worth it.

- Take the terms. That name on the client list opens doors with every other treasurer in the city, and reference value is revenue you can't invoice.
- Ask what they actually need before you talk price, make the case for what the service costs, and hold the terms that matter while flexing the ones that don't.
- Work out what they're really buying — speed, reliability, one point of contact — rebuild the deal around that, and be genuinely willing to let it go.

**Level B — `C6-SCB-02` "Two Others"** · `st_pod_a` · Vivienne · Q3
> A tight deadline, a name everyone knows, an opening offer under your floor, and a mention that she's talking to two others. Your position is stable but not strong.

- Concede the terms. A stable position becomes an unstable one very quickly once you start losing names like this one.
- Hold fees and the terms that matter, turn each objection into the reason the service costs what it does, and press for a decision date.
- Set the pace of the conversation rather than answering it, aim for the version that works for both, and be able to walk without damage.

#### C7 · People Management — `conflict_resolution`

**Level A — `C7-SCA-02` "We're Fine"** · `st_floor_pods` · Grace · Q4
> Two weeks to the audit. Grace has run this floor for eleven years and is currently running on nothing. Service is slipping and the numbers still have to land.

- Hold the targets through the quarter. Everyone here has done a busy season before, and moving the goal two weeks out tells them the goal was never real.
- Rebalance the load, check whether you've been leaning on her because she never says no, and put something in place so the next person tells you before it gets here.
- Fix what's actually causing it — the closed third window, the two vacancies you haven't filled — make it safe for her to say so, and take the audit hit if there is one.

**Level B — `C7-SCB-02` "I Flagged This In March"** · `st_floor_pods` · Hugh + Grace · Q4
> An expensive compliance error, from a team Hugh warned you about in writing three times. Morale is low with the audit two weeks out. And you have noticed that you have been running every decision past one manager and not the others.

- Deal with the error, hold the pace, and address the rest after the audit. There is a version of this conversation that can wait and this is it.
- Handle the mistake respectfully, name the fact that you've been listening to one voice before someone else names it, and protect the team's trust under pressure.
- Put people first where it costs you — fix the process that let a thrice-flagged risk through, change how concerns reach you so Hugh isn't the only route, and carry the audit exposure yourself.

#### C8 · Value Creation & Credibility — `trust_reputation`

**Level A — `C8-SCA-02` "Page Nine"** · `st_mezz_desk` · Hugh · Q4
> A fee restructure that closes the quarter, or a plain-language fee guide and a team that helps customers avoid paying you.

- Restructure the fee schedule. It's disclosed, it's within the rules, and it closes the gap without touching a single rate anyone shops on.
- Publish the fees in language people can read and take the slower growth in exchange for customers who know what they're buying.
- Make being legible the product — teach customers how banking actually costs them money, build the authority that comes with it, and let the loyalty follow.

**Level B — `C8-SCB-02`** — fully worked in §9.5.

#### C9 · Perseverance & Adaptability — `handling_failure`

**Level A — `C9-SCA-02` "The Launch"** · `st_mezz` · the screens · Q4+
> The new product launched to almost nothing. Sign-ups are a fraction of forecast, one trade review was brutal, and the screens have been flat for six weeks.

- Overhaul it. The strategy produced this, and running the same plan into a worse quarter is how institutions die slowly.
- Take the hit, work out precisely what missed, adjust the approach, and keep the bank pointed where it was pointed.
- Expect the resistance, use the failure to sharpen what the bank is actually for, and protect the team's morale while they watch you take it.

**Level B — `C9-SCB-02` "Then, And Then"** · `st_mezz` · Q4+
> The flop, then a six-hour outage on a Monday, then the fintech partner walks. Three things in one quarter and the letter tray is stacked.

- Kill the product. Three failures in one quarter is not variance, and the discipline nobody praises is knowing when to stop funding something.
- Take each piece of feedback into the next set of decisions and stay clear-headed while all three sets of numbers are bad at once.
- Separate the three properly — what to continue, what to change, what to stop — and use the quarter to make both the institution and yourself harder to knock over.

### 9.7 The mentor consultation — **re-resolved in v2.0**

The `BANK` blueprint scores C2's mentor lifeline as *"Used 0–1 time = Developing · 2 times = Strong · all 3 times = Advanced"*.

v1.0 could only offer two consultation opportunities and recorded the compression as a deliberate divergence. **Three beats restores the blueprint literally**, exactly as in [MAISON §9.6](PRD_Building_MAISON.md):

| Consultations across the three beats | Tier |
|---|---|
| 0–1 | Developing |
| 2 | Strong |
| 3 | Advanced |

Consulting Sam is one of the three options at each beat. For the transfer beat, the option set is constrained to include a *"call Sam"* option with its tier fixed by the running count — a framework behaviour, specified once in [ADR-006 §10.5](ADR-006_Missions_AI_Followups_and_Session_State.md) rather than twice in two building PRDs.

**Sam is free and ungated.** The desk phone works at every mission in the building. Calling him outside C2 is unscored and produces a genuinely useful question. **Devika is his counterweight**: also credible, also evidence-led, and frequently in disagreement with him — which is the honest version of "ask for advice", and much more instructive than a single oracle. The transfer beat's generator is given both of them, and a generated *"call Sam"* option must not imply that Sam is right.

### 9.8 The transfer beat — beat three

Generated server-side from both prior choices, in the host's voice ([ADR-006 §7–§8](ADR-006_Missions_AI_Followups_and_Session_State.md)).

#### 9.8.1 What it is for, in an institution

The Café's transfer beat is next Tuesday. MAISON's is next season. **MERIDIAN's is next year, and that is the whole point of putting the mechanic in a bank.** This is the only building in the city where a decision's bill arrives after the person who made it has stopped thinking about it, and a question generated from what you actually did — *"the complaints pattern from that restructure has turned; it is concentrated in the lowest balances"* — is the most honest instrument this product has for teaching delay.

**The letter tray is the natural home for it.** Where the Café's transfer beat is a person asking, MERIDIAN's frequently arrives as correspondence, and §9.8.2's `the tray` persona exists for exactly that.

#### 9.8.2 Persona cards

Mirrored into `internal/registry/content/followups/bank.json`.

| NPC | Voice | Sample | Never |
|---|---|---|---|
| **Grace** *(anchor)* | Warm, efficient, deflects. Answers the question you asked rather than the one you meant. | *"We're fine. Tuesday was hard. We're fine."* | Complaining · asking for help directly · commenting on your judgment |
| **Hugh** | Careful, over-prepared, apologises for things that are not his fault. | *"I flagged this in March. I'm not saying that to score a point."* | *I told you so* · moralising · refusing to model the bad option |
| **Devika** | Direct, evidence-led, unimpressed by decks. | *"Show me the town where the branch closed and the app took over. I'll wait."* | Nostalgia · being wrong for the sake of contrast |
| **Sam** | Slow, specific, **ends on a question**. Never tells you what to do. | *"More sign-ups than branch openings. Openings of what — accounts, or doors?"* | Answers · recommendations · approval |
| **Théo** | Fluent, generous with detail, closes without appearing to. | *"Friday is when my engineers get assigned to somebody."* | Villainy · manufactured urgency |
| **Vivienne** | Courteous, unhurried, never raises pressure — the pressure is structural. | *"I'd rather it was you."* | Threats · raising her voice |
| **Alan** | Unhurried, courteous, occasionally funny. **Never complains.** | *"I know it's all on the telephone now. I like the walk."* | Complaining · delivering a moral · being a lesson |
| **the tray** | Procedural, dated, factual. Regulator correspondence. | *"Further to our letter of 14 March, we note the complaints volume in the accounts identified therein."* | Accusation · warmth · telling you off |
| **the screens** | Six numbers and a direction of travel. No prose at all. | — | Any sentence whatsoever |
| **the floor** *(mission 4)* | Second person, present tense, flat. Reports facts about objects and about an empty building. | *"The capital position is on the desk where you left it. The floor below is dark."* | Opinion · address · a voice of any kind |

**Two of these are the building's most fragile characters and the persona card is where they break.** Hugh must not become the game's conscience; Alan must not become a lesson. Their cards say so explicitly, and a reviewer should read those two rows before anything else in this section.

#### 9.8.3 The no-advice gate — MERIDIAN-specific and blocking

§11.1's no-advice rule now applies to text nobody wrote. This is registered as **[ADR-006 §8.4](ADR-006_Missions_AI_Followups_and_Session_State.md) gate 9** for `buildingId: "bank"` and it is blocking:

- **No second-person guidance about real money.** A generated line that could be lifted out and read as *"here is what you should do with a loan / an overdraft / an investment"* fails the gate and the generation is discarded.
- Implemented as a phrase blocklist (`you should invest`, `pay off your`, `open an account`, `your credit score`, `we recommend you`) **plus a shape check**: the prompt must be about running the bank, not about being its customer.
- The subject is **judgment under institutional pressure**. The moment a generated question addresses the player as a consumer of financial services, it is the wrong instrument.

**And the harder half:** a generated option must not read as a defence of predatory practice, and must not read as a condemnation of one either. §9.2's writing standard — *"write it as the institutional case, because that is how these decisions actually get made"* — is passed to the generator verbatim, and the fresh-reader audit samples generated output specifically for C5 and C8.

#### 9.8.4 The fallback bank — 18 beats

| Mission | Track A opens on | Track B opens on | Varies on |
|---|---|---|---|
| C1 | the self-service station breaks for a week | a branch in a town with no alternative asks to stay open | `queue_mix` |
| C2 | a rival that closed all its branches gets savaged for service | a regional manager resigns over the plan | `screens` |
| C3 | the integration slips a quarter | Théo's own board replaces him | `partner` |
| C4 | a borrower you approved defaults early | the regulator asks about your capital plan | `loan_book` |
| C5 | a competitor ships the product and it sells | a consumer group names the market, not you | `regulator` |
| C6 | Vivienne's treasury team is restructured | a second treasurer cites your terms with her | `fees` |
| C7 | the audit lands and the finding is procedural | Grace takes leave she did not ask for | `staff_mood` |
| C8 | the complaints pattern turns, five months on | a journalist asks you about page nine | `letter_tray` |
| C9 | the relaunch does adequately | the partner asks to come back | `screens` |

**Status: authored.** All eighteen live at `internal/registry/content/followups/bank.json` in `backend-academy`, with the persona cards alongside them. They pass the §11.5 machine pass **and gate 9, the no-advice rule**, which is implemented as a phrase blocklist and run per beat. **Alan is deliberately not a speaker anywhere in the bank** — he carries the consequence of C1 and C5, and a beat delivered by him would make him the lesson §11 forbids him from being. **Not yet loaded**: `internal/registry/loader.go` reads only `content/c*.json`; wiring the pack up is part of BE-17.

**Still owed:** the fresh-reader pass (§18.2.1), paying particular attention to C5 and C8 per §9.2.

#### 9.8.5 The MERIDIAN-specific rule

**The transfer beat may not put an opinion in the letter tray or on the screens.** The tray is procedural; the screens are numbers. If the generator's chosen speaker is `the tray` or `the screens`, the prose is constrained to that register and a sentence with an attitude in it fails the gate. The building's most interesting silence — that the screens are always slightly more flattering than the floor, and nobody ever says so — must survive a machine being allowed to write.

---

## 10. Registry binding

### 10.1 Activity IDs and subtopics



Building slot **02** (ADR-005 §10.5). Ledger: [Café PRD §10.2](PRD_Building_Cafe.md).

| Competency | Level A | Level B | Subtopic | Title | Why this subtopic |
|---|---|---|---|---|---|
| C1 | `C1-SCA-02` | `C1-SCB-02` | `root_cause` | Fourteen In The Line / Switchers | The Advanced path is "the wait isn't the problem, coming in at all is" |
| C2 | `C2-SCA-02` | `C2-SCB-02` | `updating_beliefs` | Four To One / On The Record | A public commitment contradicted by your own data |
| C3 | `C3-SCA-02` | `C3-SCB-02` | `deciding_uncertainty` | Friday / Two Offers, One Slot | 48 hours and incomplete facts, by construction |
| C4 | `C4-SCA-02` | `C4-SCB-02` | `budgeting` | Quarter End / Comfortable, Not Strong | Capital allocation against a cushion is budgeting at institutional scale |
| C5 | `C5-SCA-02` | `C5-SCB-02` | `systems_thinking` | Before Friday / Two Good Years | Customers, complaints, supervision and funding costs are one system |
| C6 | `C6-SCA-02` | `C6-SCB-02` | `reading_people` | A Prestige Name / Two Others | The Advanced path is working out what she is actually buying |
| C7 | `C7-SCA-02` | `C7-SCB-02` | `conflict_resolution` | We're Fine / I Flagged This In March | Competing legitimate interests under audit pressure |
| C8 | `C8-SCA-02` | `C8-SCB-02` | `trust_reputation` | Page Nine / Within The Rules | Compliant harm against legible honesty — the definition |
| C9 | `C9-SCA-02` | `C9-SCB-02` | `handling_failure` | The Launch / Then, And Then | Compound failure and what you do with it |

`type: "DECISION_TREE"` · `orderIndex: 2` · `estMinutes: 6` (Level A) / `7` (Level B) · `passCriteria: { "minProficiency": 2 }`.

### 10.2 Tier maps and rubrics

**Server-only. Never shipped to a client.**

> **v2.0 — nothing below changed.** The transfer beat composes on top at `0.7 / 0.3` ([ADR-006 §10](ADR-006_Missions_AI_Followups_and_Session_State.md)). The only addition is the `aiBeat` block, identical in all eighteen MERIDIAN rubrics:
>
> ```jsonc
> "aiBeat": { "weight": 0.3,
>             "tierValues": { "developing": 15, "strong": 60, "advanced": 95 },
>             "required": false }
> ```

`C1-SCA-02`

| Node | a | b | c |
|---|---|---|---|
| **seed** | Strong (test in three branches) | Advanced (stand in the queue) | Developing (hire tellers) |
| follow · branch a | Developing | Advanced | Strong |
| follow · branch b | Strong | Developing | Advanced |
| follow · branch c | Advanced | Strong | Developing |

```jsonc
"rubric": {
  "kind": "trace",
  "terminals": {
    "C1-SCA-02.a.a": 42, "C1-SCA-02.a.b": 74, "C1-SCA-02.a.c": 60,
    "C1-SCA-02.b.a": 81, "C1-SCA-02.b.b": 63, "C1-SCA-02.b.c": 95,
    "C1-SCA-02.c.a": 47, "C1-SCA-02.c.b": 33, "C1-SCA-02.c.c": 15
  },
  "scoreMap": [
    { "minOutcome": 74, "proficiency": 3 },
    { "minOutcome": 42, "proficiency": 2 },
    { "minOutcome": 0,  "proficiency": 1 }
  ]
}
```

`c.a` = 47 → P2 is the cell that matters here: you spent two salaries on the wrong fix, then asked Grace why she stopped forwarding complaints and went and stood in the line six months late. Late correction beats no correction, and the arithmetic says so without anybody saying so.

`C8-SCB-02`

| Node | a | b | c |
|---|---|---|---|
| **seed** | Advanced (publish, fund avoidance) | Developing (take the restructure) | Strong (find it the hard way) |
| follow · branch a | Developing | Advanced | Strong |
| follow · branch b | Strong | Advanced | Developing |
| follow · branch c | Advanced | Strong | Developing |

```jsonc
"terminals": {
  "C8-SCB-02.a.a": 63, "C8-SCB-02.a.b": 95, "C8-SCB-02.a.c": 81,
  "C8-SCB-02.b.a": 33, "C8-SCB-02.b.b": 47, "C8-SCB-02.b.c": 15,
  "C8-SCB-02.c.a": 74, "C8-SCB-02.c.b": 60, "C8-SCB-02.c.c": 42
}
```

`b.b` = 47 → P2: you took the restructure and then, five months on, reversed the whole thing and refunded before anyone asked. That is a Strong outcome from a Developing start, and it is the most important thing this building can teach — **the second decision is real, and it can redeem the first.**

The remaining sixteen tier maps are authored with their leaf prose, under the same constraints as the other buildings: each tier once per node, no permutation repeated within the building.

---

## 11. Silent tier & reward

ADR-005 §11 in full. MERIDIAN-specific:

**The queue is not a score.** Short is not good. Empty is not a win. Long is not a fail. Reviewers must check that no queue state is lit, framed, sounded or scored as better than another.

**The screens are always slightly flattering, and this is never remarked on.** Sign-ups look better than the floor does. That gap is the building's most interesting silence and the moment a character points at it, the lesson stops being discovered and starts being taught.

**Hugh is not a conscience.** He is the character most at risk of becoming the game's moral voice. His reactions bind to `letter_tray` and `staff_mood`, not to tier. He never says *I told you so*, and — critically — he brings the fee restructure to you himself. A compliance officer who only ever says no is a cartoon; a compliance officer who models the bad option because it is his job is a person.

**Alan is not a lesson.** He never says anything about the app, never complains, never delivers a moral. He comes in on Tuesdays. Any line that turns him into an argument gets cut.

**The letter tray never accuses.** Regulator correspondence is procedural in tone and reports facts. It is not the game's way of telling you off.

**No hint button.** Suppressed in scenario mode. Sam is a scored choice, not a hint — he asks questions, and Devika, who is also credible, frequently disagrees with him.

**The coin tick** is silent, magnitude-proportional, identical in presentation at 5 and at 25.

### 11.0 The mission tracker

Framework code ([ADR-006 §6.3](ADR-006_Missions_AI_Followups_and_Session_State.md)) so MERIDIAN cannot add to it. MERIDIAN-specific: completed missions **disappear**; the tracker line is the institution's words (*walk the length of your own bank*, *the morning's post*, *look again*); the three pips are identical; and **the quarter stays on the brass card holder**, not in the tracker. The tracker says which mission; the quarter card says when. An institution measures time in quarters and a tracker measuring it in missions would be the game's voice, not the building's.

### 11.2 Generated lines

The persona cards (§9.8.2) describe *how* a character speaks and never *what they think of your decision* — which for Hugh is the difference between a person and a conscience. The no-advice gate (§9.8.3) and the register constraint on the tray and the screens (§9.8.5) are blocking. **And the player must never learn which beat was generated**: no badge, no typography change, no spinner. If Grace's third question is slow, she finishes what she is doing first — which is what she does anyway, and is the only character in the city whose defining trait doubles as a latency mask.

### 11.1 The no-advice rule

MERIDIAN depicts banking decisions. It does not give financial advice, and no copy in this building may read as guidance to a real person about real money — not in a choice, not in a consequence, not in the report. The subject is **judgment under institutional pressure**, and the difference matters enough to be an acceptance criterion (§18.2). Any line that could be lifted out and read as "here is what you should do with a loan/an overdraft/an investment" is rewritten.

---

## 12. World state

| Key | Values | Visible as |
|---|---|---|
| `queue` | `long` · `steady` · `short` · `empty` | The rope line: 0–14 posed figures, and the teller-call frequency |
| `queue_mix` | `paper` · `mixed` · `digital` | Who is in the line — skins, props, whether they're at tellers or pods |
| `screens` | `app_up` · `app_flat` · `outage` · `dark` | The six displays behind the counter |
| `letter_tray` | `empty` · `one` · `stacked` · `flagged` | The tray on the mezzanine desk; readable at `flagged` |
| `staff_mood` | `steady` · `thin` · `fearful` · `trusting` | Grace's idle set (incl. `rub_eyes`), whether tellers talk between customers, whether the third window is open |
| `loan_book` | `conservative` · `balanced` · `stretched` | The credit-committee whiteboard behind the pods; how many pod appointments are running |
| `fees` | `transparent` · `standard` · `buried` | The leaflet stand in the vestibule: a one-page plain guide, a standard brochure, or a fourteen-page terms booklet |
| `partner` | `none` · `fintech` · `walked` | A second logo on the ATM vestibule glass, applied and later removed |
| `regulator` | `quiet` · `watching` · `praising` | The tone and volume of the letter tray; a framed commendation on the mezzanine wall at `praising` |
| `quarter` | `Q1` … `Q4+` | The printed card in the brass holder on the mezzanine wall |

Presentation only; never influences scoring — the bank moves on the trace, never on the score.

**A generated transfer beat may not write a world key of its own.** It selects one write from the mission's `aiWorldCandidates` (§8.2), server-validated; anything else is dropped and the mission's `closeWorldState` covers the visible change. This matters more here than anywhere: `queue` and `queue_mix` together are the building's primary readout, and a machine allowed to set them freely could produce `empty` + `paper` — the state that should keep a player awake — for no reason a player earned.

Persisted continuously to `PUT /api/v1/city/buildings/bank/state` and flushed on exit (§19), with `localStorage` as the mirror.

---

## 13. End-of-journey report — *"The Board Pack"*

**Unlock:** all nine competencies on the player's track `COMPLETED`.

**The object.** A bound annual review pack on the mezzanine desk, tabbed, with the letter tray beside it. Walking to it opens a full-screen reader.

**The contents.**

1. **The year, in the institution's own voice** — a short review built from the world-state trail: what the queue looked like at the start and at the end, what the fee schedule says now, what is in the tray, whether the partner logo is still on the glass.
2. **The floor** — the queue as it finished, with its composition. If it is `empty` and `paper`, the pack says so plainly and without comment, and that plainness is the whole point.
3. **Your record** — the **only** place tier vocabulary appears in this building. Nine competencies, nine tiers, each with its one-line meaning and the quarter it was decided.
4. **The consequence trail** — two lines per competency: what you chose, what it cost, when the bill arrived. MERIDIAN is the building where the delay is the lesson, so the trail is dated.
5. **Consistency** — the seed/follow-up shape made legible. *"You took the fee restructure and then reversed it, unprompted, five months later with a refund attached. You are slow to see a harm and fast to own one."*
6. **The letter tray, transcribed** — every regulator letter you received, in order, so the delayed consequences are readable in one place at the end even if you never opened them at the time.
7. **Where next** — two or three city buildings that press hardest on the competencies that came out lowest.

**Tone.** Institutional, unsentimental, factual. A board pack does not praise and does not scold; it records. That register happens to be exactly what the silent-tier contract wants, which is why MERIDIAN gets the coldest report of the three and it is the right call.

---

## 14. Level A vs Level B in this room

| | Level A (`SCA`, 16–21) | Level B (`SCB`, 35–50) |
|---|---|---|
| **Framing** | You have just been given the floor. Grace has been here longer than you and everyone knows it. | You are in the corner office and have been for a while. The decisions you are living with are partly your own. |
| **Threshold question** | *"Are you stepping onto the floor, or into the corner office?"* — asked by Grace on first entry, once for the whole city | same |
| **Spawn** | On the floor, by the doors | On the floor, by the doors — **identical**, deliberately; the walk past the queue is not something seniority exempts you from |
| **Cast at beat 1** | Grace, tellers, queue, Alan | Grace, Hugh, tellers, queue, Alan — compliance is in the room from the start |
| **Props added** | — | Two letters already in the tray; the rival's app on a competitor leaflet in the vestibule; Hugh's March memo, dated, on the mezzanine desk |
| **Decisions** | One pressure at a time; a quarter-long horizon | Capital, supervision, reputation and staff move together; the horizon is five years and some decisions cannot be unwound |
| **Screens** | Four displays | Six, including complaints and NPS — more to look at, more to look away from |
| **What "Advanced" means** | Finding the real problem under the presenting one | Finding it, tracing where it lands in five years, and paying the quarter it costs to act on it |

---

## 15. Accessibility for this interior

ADR-005 §14 in full. MERIDIAN-specific, and this building has the most to do because two of its three primary channels are visual:

- **The mezzanine is reachable by lift as well as stair**, and the lift is the default guided-navigation route. No content is behind the stair.
- **The queue must be fully legible without sight.** Inspecting it produces a readable DOM list: how many people, roughly who (*"four with passbooks, two at the desk pods, one checking a phone"*), and how long the front of the line has been waiting. Every change in `queue` or `queue_mix` is announced to the live region in plain language — *"the line is shorter this quarter — four people, three of them with paper forms."* **This is a blocking acceptance criterion** (§18.2), because the queue is the building's primary feedback channel and a purely visual consequence is a consequence half the audience never receives.
- **The screens are DOM on inspection**, not baked textures. Six labelled metrics with their values and their direction of travel.
- **The letter tray** opens a DOM reader. Letters are text.
- **The quarter** is announced on change and present in the interior's DOM header, not only on a printed card.
- **Guided navigation labels** in institutional words: *the doors · the vestibule · the queue · the counter · desk pod A · desk pod B · the waiting area · the office · the letter tray*.
- **Sound is a real channel here** (footsteps on stone, teller calls, the keyboard that stops) so each is mirrored in text: approaching NPCs are announced, teller-call frequency is described on zone entry, and Hugh standing up is an announced event because it is a dramatic beat.
- **Alan's absence** — if he is ever not at window 2 — is announced explicitly, for the same reason as Marcus's empty chair in the Café.
- **Overhead fluorescent light is flat and low-contrast by design.** The scene carries a minimum-luminance floor, all UI is DOM at full contrast, and the high-contrast setting raises ambient rather than tinting the render.

---

## 16. Performance budget

Within ADR-005 §15. MERIDIAN has the largest volume and the most bodies, and gets there cheaply because institutions are repetitive.

Within ADR-005 v2.0 §15, restated for 2D. MERIDIAN has the largest plan area and the most bodies, and gets there cheaply because institutions are repetitive.

| Metric | MERIDIAN target | Notes |
|---|---|---|
| Sprites on screen | ≤ 420 | 308 cells of room + dressing + the queue + the cast. The largest budget in the city |
| Draw calls | ≤ 70 | Queue crowd, waiting chairs, teller windows, screens and pods all share baked containers |
| Baked textures | ≤ 30 unique | Institutional palette: one stone, one steel, one glass, one wood, reused everywhere |
| **The queue** | **8 posed sprites × 3 tints, one baked atlas, ONE instanced draw** | Transform-level idle sway only. **This is the technique that makes the building's central image affordable** and it must be specified in `room.ts`, not improvised |
| Animated characters | ≤ 5 on screen | Named cast + 2 tellers, staged so they are never all present |
| Texture memory | ≤ 44 MB | `resolution: 2`; the crowd shares one atlas |
| Scene build (bake) | ≤ 500 ms | Behind the fade. The largest bake in the city; if it exceeds, bake the mezzanine lazily on first ascent |
| Interior chunk | **≤ 1.4 MB** added | Repetitive architecture means few unique draw functions |
| Enter / exit | ≤ 1.0 s | Prefetched on approach from Downtown |
| Ambient beats active | ≤ 8 | §6 table |
| Transfer-beat latency | ≤ 2.5 s p95 | ADR-006 §7.4 |

**The plan area is the risk and the symmetry is the mitigation.** Three mitigations, in order: the back half of the floor (vault wall, counter run) bakes into one container and never changes; **the mezzanine's contents draw only when the player is on it**, and the floor's dressing dims rather than hides when they are up there; and the stone floor's sheen is a baked band, not a render target.

**If the budget is missed, cut the queue to ten figures — never to zero.** The queue *is* the building.

---

## 17. Asset checklist

Every line requires an `ASSETS_LICENSES.md` entry before work builds on it.

**Architecture** — branch shell, tall street glass + frame, heavy double doors, vestibule shell, mezzanine box (glass ×3), open steel stair, lift alcove + doors, polished stone floor, ceiling with fluorescent runs.
**Counter & fittings** — teller counter run, three windows (2 open / 1 closed variants), `POSITION CLOSED` card, **wall of screens ×6 (hero, DOM-readable)**, receipt printers, chained pen, **vault door (hero, never opens)**.
**Floor furniture** — desk pod ×2 (+ chairs), waiting chairs ×6, rope line + posts, ATM ×2, leaflet stand (3 `fees` variants), credit-committee whiteboard (3 states).
**Mezzanine** — desk, chair, **letter tray (hero, 4 states)**, brass quarter-card holder + 5 cards, desk phone, Hugh's desk, filing, framed commendation (`regulator: praising`).
**Characters** — shared rig + 7 skins (Grace, Hugh, Devika, Sam, Théo, Vivienne, Alan) + 2 teller skins.
**Queue crowd** — **8 posed static meshes** (passbook, folder, phone, pram, briefcase, shopping, coat, standing) × 3 skin tints, one instanced atlas.
**Animation** — the shared 12-clip set plus MERIDIAN-specific: `rub_eyes`, `stand_folder`, `slide_paper`, `serve`, `talk_teller`.
**Street (through glass)** — a low-detail Downtown card: opposite towers, kerb, one rival-bank frontage.
**Audio** — large hard room tone with tail, teller call VO (or a chime — see §18.5), receipt printer, queue shuffle, heavy door, screen tick, keyboard, footsteps on stone (the important one), filtered street. **No music.**

---

## 18. Phases, acceptance, testing, risks

### 18.1 Phases

> **v2.0.** Re-cut against the shipped 2.5D Pixi stack. **MER-0 cannot start until the Café proves the mission runner and tracker** (ADR-005 §17 G9) — that is the one hard cross-building dependency in the city, and it is stated here rather than discovered in week three.

| Phase | Deliverable | Gate |
|---|---|---|
| **MER-0** | `src/buildings/bank/` exists: `room.ts` per §3.1 (22×16 grid, wall ring, near sill, five zones, the station set), collision, spawn, exit, manifest + registry entry | Walk the floor and the mezzanine, mouse and keyboard-only, at 30 fps. **Every mezzanine cell reachable by lift** |
| **MER-1** | `props.ts` / `scene.ts` / `BankCanvas.tsx` — the room on screen. The stone sheen, the near sill, mezzanine culling | The room reads as a bank when nobody is in it |
| **MER-2** | **The queue system** — all four lengths × three mixes, one instanced draw, the DOM readout; the six screens as DOM-on-inspect; the letter tray; the leaflet stand's three `fees` states | Change `queue` and `queue_mix` by hand and watch the building's meaning change — assessed by someone who did not build it. **And read the whole queue with the screen reader** |
| **MER-3** | `cast.ts` — Grace + the two tellers + Alan; Grace's half-second gaze delay; Hugh's keyboard as an ambient bed **that stops**; audio | Someone approaches and you hear them before you see them |
| **MER-4** | Missions 1 and 8 as objective chains on the framework runner; the tracker | Walk mission 1's chain — including standing *in* your own queue — keyboard-only |
| **MER-5** | `C1-SCA-02` and `C8-SCB-02` end to end across all three beats, including the Sam phone and the no-advice gate | A real registry activity, server-scored, **no tier visible anywhere**, no way to tell which beat was generated, and the crowd holding frame budget |
| **MER-6** | All nine missions × both tracks; full cast; quarter progression; the tray filling; all 18 fallback beats; session sync | A complete year in one sitting, and the same year with the generator disabled |
| **MER-7** | The board pack; a11y pass (**the queue's DOM legibility is the big one**); perf pass; licences | A keyboard-only, screen-reader player completes a year and reads the pack |

### 18.2 Acceptance criteria

1. **Plausible-peers audit passes**, run by a fresh reader on all 54 seed choices, 162 leaves **and the 18 fallback transfer beats** with tiers covered. *Blocking.* Pay particular attention to C5 and C8 per §9.2.
2. **Tier-leak audit passes.** Nothing outside §13 — **including the mission tracker** (§11.0).
3. **No-advice audit passes.** No line in this building — **authored or generated** — reads as guidance to a real person about real money. *Blocking* (§11.1, and gate 9 in §9.8.3). The generated half is verified by a sample of 30 transfer beats read by the fresh reader.
4. **The queue is fully legible without sight.** DOM inspection list complete and accurate; every state change announced in plain language. *Blocking* — the queue is the building's primary feedback channel and a purely visual consequence is a consequence half the audience never receives.
5. **Registry validates.** All eighteen rubrics parse; all terminal sets are nine entries matching ADR-005 §10.1; **every activity with an `aiBeat` block has a fallback entry**. *Blocking.*
6. **Fallback parity.** With the generator disabled, a full nine-mission year plays end to end and no rendered string, timing or affordance differs. *Blocking.*
7. **The mentor mapping is literal.** Consulting Sam zero, two and three times across the three C2 beats yields Developing / Strong / Advanced (§9.7). *Blocking.*
8. **Keyboard-only completion**, verified by e2e, including standing in the queue in mission 1.
9. **Lift parity.** Every station and every mezzanine cell reachable without the stair. *Blocking.*
10. **Grace is unremovable.** No world state, quarter or staff mood takes the anchor NPC out of the building (§19.5). *Blocking.*
11. **Resume.** Quitting at any objective — including with a transfer question pending — resumes exactly there, with the same question.
12. **Performance.** §16 met at MER-6 and MER-7, including the fourteen-figure queue in one instanced draw.
13. **Consequence visibility.** Every mission changes at least one of: the queue, the screens, the letter tray, the leaflet stand, or the staff's ambient behaviour — guaranteed structurally by `closeWorldState`.
14. **The screens never blank.** `screens: "dark"` is an authored state that means an outage in the fiction and must not be reachable by a network failure (§19.7).

### 18.3 Test plan

- **Unit** — the world-state reducer; the queue state machine (all 4 × 3 combinations reachable and renderable); the quarter mapping; crowd instancing count under each state.
- **Content** — every constructible path terminates in a rubric terminal; every terminal is reachable; every leaf writes at least one world-state key; the mentor path is available at both C2 beats in both tracks.
- **Choice parity (machine pass, ADR-005 §11.5)** — for every trio of choices, longest minus shortest ≤ **8 words**; no capitalised tier label, proficiency number, `n/3` or pass/fail phrasing in any shipped string; no verdict language ("unfortunately", "you should have", "the better move", "correct", "well done") in any consequence; each tier used exactly once per node and no letter permutation repeated in the building. This runs in CI over `script.ts` and is the check that caught the length/tier correlation in this document's first draft.
- **Component** — the dialogue layer builds the correct `trace`; scenario mode renders no result view; the queue's DOM inspection list matches the rendered crowd exactly (snapshot test — these will drift).
- **E2E** — enter from Downtown → play `C1-SCA-02` → verify the queue changed → exit → re-enter → verify persistence → complete the year → open the board pack.
- **Playtest** — a 25-minute scripted session with a fresh player, ending with two questions: *"which choice do you think the game wanted?"* and *"did the game tell you the fee restructure was wrong?"*. The second must be answered *no* — the consequence should have told them, not the game.

### 18.4 Risks

| Risk | Mitigation |
|---|---|
| **C5 and C8's weak options are ethically loaded and easy to write as villainy.** | §9.2 is a normative writing standard, not guidance. The institutional case is the case. Hugh brings the option himself and is uncomfortable and still brings it. Fresh-reader audit is blocking. |
| **The building reads as financial advice.** | §11.1's no-advice rule as a blocking acceptance criterion; the subject is judgment under pressure, never money management. |
| **The queue is the central image and a fourteen-body crowd is expensive.** | Posed static instanced meshes, ~400 tris, one draw. Specified in the scene, not improvised. If it still misses, cut to ten figures — never cut to zero, because the queue *is* the building. |
| **Largest volume of the three interiors.** | Symmetry and repetition make it cheap; distance cards on the back wall; mezzanine/floor mutual culling. |
| **Hugh or Alan becomes the game's conscience.** | Reactions bound to world state, never tier. §11 flags both explicitly. Playtest question: *"did Hugh think you were wrong?"* — confident answers mean he is broken. |
| **Flat overhead lighting fights accessibility and looks dull.** | Minimum-luminance floor; the warmth at the pods and tray is the visual relief; high-contrast setting raises ambient. |
| **Institutional tone reads as boring.** | The pressure is human — Grace's composure, Hugh's three memos, Vivienne choosing to negotiate in public, Alan on a Tuesday. The building is cold; the people in it are not. |

### 18.5 Open decisions

- **Teller-call audio.** A spoken *"window two, please"* needs voice, which needs a CC0 source or TTS. **Recommendation:** a two-tone chime plus a DOM caption — cheaper, more institutional, and accessible by construction.
- ~~**The mentor divergence** (§9.7)~~ — **closed.** Three beats restores the blueprint literally.
- ~~**The interior stack**~~ — **closed.** 2.5D Pixi ([ADR-005 v2.0 §5](ADR-005_Interior_Framework.md)); §3.1 rewritten.
- **Does Alan ever stop coming?** Currently he does not, in any state. Making his absence a possible consequence of a `digital`+`empty` run would be the single most powerful beat in the city — and might be too much. Playtest at MER-6.
- **Whether the framed commendation at `regulator: praising`** is a reward the silent-tier contract should allow. It is world state, not a tier — but it is the closest thing in the city to a pat on the head. Currently in; flag for review.
- **Level B's spawn.** Identical to Level A on purpose (§14). Confirm in playtest that the repetition reads as thematic rather than as a missing feature.
- **How much institutional scale survives the camera change** (§0.2). The 5.2 m ceiling did real work and it is gone. MER-1's gate — *"the room reads as a bank when nobody is in it"* — is where we find out whether plan area and negative space are enough.

---

## 19. Backend contract — MERIDIAN

Full specification: **[PRD_Backend_Missions.md](PRD_Backend_Missions.md)**. MERIDIAN's instance. If anything here disagrees with that document, that document is right.

### 19.1 What MERIDIAN calls, and when

Identical in shape to [the Café's §19.1](PRD_Building_Cafe.md), with `buildingId: "bank"` and the eighteen `*-02` activity ids. As with every building, **MERIDIAN itself makes none of these calls** — the framework's `ApiClient`, mission runner and session layer do (ADR-005 §8.4).

### 19.2 The session blob

`PUT /api/v1/city/buildings/bank/state`

```jsonc
{
  "rev": 31,
  "track": "SCB",
  "blob": {
    "missionOrder": 8,                    // "Page Nine"
    "objectiveIndex": 5,                  // decide · follow
    "partialPath": ["b"],
    "pendingFollowupId": null,
    "world": {
      "queue": "short",       "queue_mix": "paper",   "screens": "app_up",
      "letter_tray": "one",   "staff_mood": "thin",   "loan_book": "balanced",
      "fees": "standard",     "partner": "fintech",   "regulator": "watching",
      "quarter": "Q4"
    },
    "playerCell": [18, 4],                // the mezzanine desk
    "trackerCollapsed": false
  }
}
```

Ten keys, exactly §12's. `queue: "short"` with `queue_mix: "paper"` is the state worth noticing in a blob dump: you solved the wait, and the people still coming in are the ones who cannot use the app. Nothing in the game says that. The line says it — and now so does the session.

### 19.3 Save triggers and the exit flush

Identical to [the Café's §19.3–19.4](PRD_Building_Cafe.md): mission open and every beat commit are **immediate**; objectives, world writes and position are debounced 800 ms; exit flushes via `sendBeacon` with a `keepalive` fetch fallback, also wired to `pagehide` and `visibilitychange → hidden`.

**One MERIDIAN-specific note.** The building is large and the walk is long, so position writes fire more often here than anywhere else. They are position-only and coalesce with everything else in the same 800 ms window; if `session_write_total{building="bank"}` runs materially above the other two in telemetry, raise MERIDIAN's position debounce to 1500 ms rather than dropping the writes.

### 19.4 Generating the transfer beat

```jsonc
POST /api/v1/ai/followup
{
  "activityId": "C8-SCB-02",
  "track": "SCB",
  "buildingId": "bank",
  "path": ["b", "b"],                       // took the restructure, then reversed it with refunds
  "speakerId": "hugh",
  "worldState": { "fees": "buried", "letter_tray": "stacked",
                  "queue_mix": "paper", "regulator": "watching" }
}
```

Server-side, `buildingId: "bank"` activates **gate 9, the no-advice gate** (§9.8.3) in addition to the eight general gates. A generation that fails it is discarded and the fallback served; the failure is logged with the gate id, and a rising `followup_gate_failure_total{gate="building_gates",building="bank"}` means the prompt is drifting toward consumer guidance and needs attention before the audit finds it.

### 19.5 Speaker resolution

[ADR-006 §9](ADR-006_Missions_AI_Followups_and_Session_State.md) in this building:

| Mission | Host | If absent | Resolves to |
|---|---|---|---|
| 1, 7, 9 | Grace | **never** — she is the anchor | step 1 |
| 2 | Sam / Devika | both are visitors and both leave | **Hugh** if the player is on the mezzanine (step 2), else **Grace** |
| 3 | Théo | he has gone | **Hugh** — he is the one who has to live with the integration |
| 4 | *none by design* | — | **step 4** — narration; the dialogue layer names *the capital position on the desk* |
| 5 | *the proposal* | — | **Grace** if near, else **Hugh**, else narration |
| 6 | Vivienne | she has left the pod | **Grace** — her floor services the account |
| 8 | Hugh | he has sat back down | **the tray** (step 4) — and this is the best version of the mission, because the delayed consequence arriving as correspondence is what the building is about |

**Grace must be present in every world state.** No `staff_mood`, no `queue` state, no quarter may remove her. Acceptance criterion (§18.2).

### 19.6 Submitting

```jsonc
POST /api/v1/progress/C8-SCB-02/submit
{
  "clientVersion": "city@0.3.0",
  "durationSec": 468,
  "hintsUsed": 0,
  "result": { "trace": {
    "path": ["C8-SCB-02.seed", "C8-SCB-02.b",
             "C8-SCB-02.b.follow", "C8-SCB-02.b.b"],
    "followupId": "fu_01JA…",
    "followupChoice": "o_2e91"
  } }
}
```

The authored terminal here is **47** — you took the restructure and then, five months on, reversed the whole thing and refunded before anyone asked you to. A Strong outcome from a Developing start, and [§10.2](#102-tier-maps-and-rubrics) calls it *the most important thing this building can teach: the second decision is real, and it can redeem the first.*

**The third beat now says whether the lesson took.** `47 + Advanced = 61 → P2`; `47 + Developing = 37 → P1`. Reversing the restructure and then, a year later, reaching for the same kind of move is not redemption — and the arithmetic says so without anybody saying so.

### 19.7 Degradation

As [the Café's §19.7](PRD_Building_Cafe.md). Two MERIDIAN-specific notes:

- **The queue must render from the session blob alone.** If the registry is unreachable and no mission can open, the room still shows a line with people in it, at whatever state the blob last held. A bank with no queue is not a degraded bank; it is a broken one.
- **The screens read from world state, never from the network.** They are a diegetic readout of `screens`, not a dashboard of live data, and no failure mode may leave them blank — `screens: "dark"` is an authored state that means something (an outage in the fiction) and must not be reachable by accident.

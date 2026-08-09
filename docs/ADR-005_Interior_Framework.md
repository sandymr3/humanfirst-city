# ADR-005 — Building interiors: one shared engine, twelve data-driven worlds

_The City · Interior Framework · **v2.0** · 2026-08-04 · **Status: Accepted (amended)** · Deciders: KK (product), santhosh / hrithik / uganthan (eng)_

_Extends **ADR-004** (§3 of [PRD_City_Frontend.md](PRD_City_Frontend.md)). **Amended by [ADR-006](ADR-006_Missions_AI_Followups_and_Session_State.md)**, which owns the mission spine, the third decision beat, the combined scoring arithmetic and the AI content policy. Companion documents: the three launch building PRDs — [Café](PRD_Building_Cafe.md) · [MAISON](PRD_Building_MAISON.md) · [MERIDIAN](PRD_Building_MERIDIAN.md) — and the backend contract at [PRD_Backend_Missions.md](PRD_Backend_Missions.md)._

> **Read this first if you are building a venue.** This document is the contract every one of the twelve buildings inherits. A building PRD tells you what its world *is*; this tells you what the world *runs on*, how a decision is scored, and what you are forbidden from showing the learner. If you find yourself wanting to change something in here, that is a framework issue and a maintainer PR — never a building-local fork.

---

## 0. Amendment record — v1.0 → v2.0

**v1.0 (2026-07-27, Proposed)** chose a first-person **React-Three-Fiber** engine with a Zod-validated 3D `InteriorScene`, GLB bundles and a two-beat decision tree.

**Two buildings were then built.** The Café and MAISON both ship, walkable, with 311 passing tests — and they are **2.5D isometric PixiJS rooms**, not first-person 3D. That was not a shortcut; it was arrived at by building it, and it is this ADR's own **Option B** (§4). v2.0 records what is true rather than what was proposed, because a document that says "R3F" while `src/buildings/` ships Pixi actively misleads three developers.

| § | v1.0 | v2.0 |
|---|---|---|
| Title / §1 / §5 | First-person R3F, pointer-lock, 1.65 m eye height | **2.5D isometric Pixi sub-scene** borrowing the city's existing `Application` |
| §8 | Zod `InteriorScene` schema, GLB bundle, collision boxes in metres | **The shipped data model** — `room.ts` cell grid, `props.ts`, `scene.ts`, `cast.ts`, `dressing.ts`, `guide.ts`, `<X>Canvas.tsx` |
| §9 | Two-beat decision tree | **Three beats** — see [ADR-006 §7](ADR-006_Missions_AI_Followups_and_Session_State.md) |
| §10 | `0.6 × seed + 0.4 × follow` | **Composed with a third beat at 0.7 / 0.3** — see [ADR-006 §10](ADR-006_Missions_AI_Followups_and_Session_State.md). **Every authored `terminals` table is unchanged.** |
| §14 | Comfort settings for a first-person camera | Motion sickness is no longer a surface; the guided-navigation and DOM-first rules survive intact and are now shipped |
| §15 | Triangles, draw calls, GLB size, tab memory | **Sprite counts, baked textures, bake time, draw calls** |
| §16 | CC0 GLB kits, meshopt, KTX2, a shared 3D rig | **Procedural vector props baked to textures**, with `PROP_SPRITE` as the seam where real art takes over |
| §17 | Eight framework gaps G1–G8 | Six closed by the shipped code; the open ones are the mission runner, session sync and the transfer-beat client |
| §19 | AI may vary ambient chatter only | **Superseded by [ADR-006 §12](ADR-006_Missions_AI_Followups_and_Session_State.md)** |

**Unchanged, and load-bearing:** §11 the silent-tier contract · §12 world state · §13 the end-of-journey report · §14's DOM-first accessibility and guided navigation · §10.5's twelve-slot registry binding · §10.6's `HARD`/`PRO` level mapping · §10.7's one-track-per-city rule · the folder-ownership model in §8.4.


**Is first-person 3D dead?** No — §16.4's escape hatch stands, and a venue that genuinely needs it (Race Car Manufacturing's pit wall, the Stock Exchange floor) may still take it behind the same contract, the same budgets and a maintainer review. It is no longer the default, and it is no longer building #1's problem.

---

## 1. TL;DR

The city stays exactly as it is: 2.5D isometric, PixiJS, a character walking a tycoon-style street grid. **Crossing a threshold changes the room, not the camera.** The door opens, the street fades, and you are standing inside your own café — same projection, same walk, same character, a completely different place. You walk to the counter. People are working, and they notice you. Someone brings you a problem. You decide. The room changes because of what you decided.

The interior does **not** create a second renderer. Two `PIXI.Application`s alive in one page breaks Pixi v8 — the second renderer's mere existence corrupts the first one's batcher and the city stops drawing forever. So the world layer publishes its `Application` and an interior *borrows* it: hide the city's layers, add your own container, add a ticker callback, put it all back on the way out. That handover is `src/framework/building/interiorStage.ts`, and it is the single most important file in this ADR.

There is exactly **one** interior pattern, and every building ships **data** into it: a room grid, props, a cast, a mission spine, a script. Twelve worlds, one runtime, one performance budget, one accessibility layer.

The nine competency decisions inside a building are staged as **missions** — things you go and do — not as a quiz. Every choice is written to read as a plausible peer of the others. The learner is never told which one was better. The tier is computed on the server, the coins tick quietly, and the only place the words *Developing*, *Strong* and *Advanced* ever appear is the report you are handed on your way out.

```
        CITY                                    INTERIOR
┌────────────────────────────┐         ┌────────────────────────────────┐
│  <CityCanvas>              │  door   │  <CafeCanvas> / <MaisonCanvas> │
│  iso street grid           │ ──────► │  iso room, same projection     │
│  walk · enter              │  fade   │  walk · act · talk · decide    │
└────────────────────────────┘         └────────────────────────────────┘
             │                                        │
             └──── ONE PIXI.Application, borrowed ────┘
                   (framework/building/interiorStage.ts)

        world store (Zustand)                  room store (Zustand)
                       ▲                                 │
                       └──── shared: HUD · audio · ApiClient · economy
                                                         ▼
                POST /ai/followup           → the transfer beat   (ADR-006 §7)
                POST /progress/{id}/submit  { trace: { path, followupId… } }
                PUT  /city/buildings/{id}/state  ← the season, flushed on exit
                            ← proficiency · coinsEarned · badges (server truth)
```

---

## 2. Context

### 2.1 Where we are

ADR-004 re-platformed The City onto React + Vite + PixiJS, and that decision has paid off. The city is built and running: [`CityCanvas.tsx`](../src/world/CityCanvas.tsx) owns the single `PIXI.Application`, [`cityMap.ts`](../src/world/cityMap.ts) places twelve venues plus the Shop and Trophy Hall as pure data, [`manifest.ts`](../src/framework/building/manifest.ts) defines a Zod-validated plug-in manifest, and [`PlayerShell.tsx`](../src/activities/PlayerShell.tsx) drives the server-authoritative activity loop against the live backend.

The master PRD deliberately stopped at the door. §4 lists "deep design of the 11 buildings" as an explicit non-goal, and §7.1 makes `interior` nullable precisely so venues could ship in overlay mode while their interiors were designed separately.

_**v2.0 update.** When v1.0 was written, every venue was `interior: null` and `src/buildings/` did not exist. Both are now false: `src/buildings/cafe/` and `src/buildings/fashion_brand/` ship walkable rooms behind lazy `interior` loaders, and the nine remaining venues still fall through to the overlay panel — which remains the correct behaviour for a venue with no room yet._

### 2.2 What changed

The experience brief moved. A modal listing activities is a competent training UI; it is not a world. The buildings are now specified as **places** — you enter, you move around, you talk to people, and the decisions you make are staged as events in that room rather than questions on a card. _(v1.0 read "first-person places"; v2.0 amends the camera, not the intent — see §0.)_

_**v2.0 addendum.** The brief moved again in August 2026: the nine decisions in a building are now a **story of ordered missions** with visible objectives, and the third beat of every decision is **generated from the path the player actually took**. That is [ADR-006](ADR-006_Missions_AI_Followups_and_Session_State.md), and it is the reason §9, §10 and §19 carry amendment notes._

At the same time the content model firmed up. Each building is one continuous business scenario running across all nine competencies, with two audience tracks (16–21 and 35–50), a two-beat decision structure per competency, and a **silent** quality signal: three choices that all read as things a real operator might do, differentiated only by what happens next.

### 2.3 The twelve-building multiplier

Every decision here is multiplied by twelve. A bespoke interior per venue is roughly twelve engines, twelve perf profiles, twelve accessibility stories and twelve places for the scoring contract to drift. The central architectural question is therefore not "can we do first person" — it is **"what is the smallest thing a building team has to write, and can that thing be data?"**

If it can be data, then Claude can generate a first draft of a whole interior against a schema, the way it already generates activity content, and a reviewer's job is checking judgment rather than checking syntax.

---

## 3. Requirements this decision must satisfy

### 3.1 Functional

| ID | Requirement | v2.0 |
|---|---|---|
| **F1** | The player walks freely through the interior, as a character, in the same projection as the city. | *amended — was "in first person, at human eye height"* |
| **F2** | Every place and every object is reachable by mouse **and** by an equally capable keyboard-only path. | *amended — was "look around continuously (mouse look)"* |
| **F3** | NPCs occupy the room, are animated, notice the player, and speak. | |
| **F4** | A decision is delivered **diegetically** — a person brings it to you, or the room does — not as a context-free question. | |
| **F5** | The consequence of a decision is delivered as dialogue **and** as a visible, persistent change in the world. | |
| **F6** | Nine competency decisions per building, in two age tracks, each a **three-beat** tree: judgment, consistency, transfer. | *amended by [ADR-006 §7](ADR-006_Missions_AI_Followups_and_Session_State.md) — was two beats* |
| **F7** | Scoring is server-authoritative and identical in shape to every other activity in the platform. | |
| **F8** | The tier is never surfaced during play. It appears once, in an end-of-journey report. | |
| **F9** | Exiting returns the player to the city, on the same street tile, with world state preserved **and pushed to the server**. | *extended by [ADR-006 §11](ADR-006_Missions_AI_Followups_and_Session_State.md)* |
| **F10** | The nine decisions are structured as **ordered missions** with visible objectives, not as nine independent stations. | *new, [ADR-006 §6](ADR-006_Missions_AI_Followups_and_Session_State.md)* |

### 3.2 Non-functional

| ID | Requirement | Source |
|---|---|---|
| **N1** | ≥ 30 fps floor (p95) on the reference profile: 2019 i5 laptop, integrated GPU, Chrome. 60 fps target where hardware allows. | master PRD §12.3 |
| **N2** | ≤ 1.5 MB added to the bundle per building (the interior is code + baked art, not a model bundle); the city shell stays ≤ 5 MB gzipped. | *amended — was 6 MB of GLB* |
| **N3** | Venue enter/exit ≤ 1.0 s with the module prefetched on approach. | master PRD §12.3 |
| **N4** | Keyboard-only playable end to end. Screen-reader navigable. `prefers-reduced-motion` honoured. | master PRD §16 |
| **N5** | ~~Motion comfort~~ **Withdrawn.** There is no first-person camera, so there is no motion-sickness surface. The comfort *settings* that survive (reduced motion, no camera shake) fold into N4. | *amended* |
| **N6** | ≤ 600 MB tab memory, with no growth across five enter/exit cycles. | master PRD §12.3 |

### 3.3 Constraints

- Three-person JS team plus Claude. Twelve buildings. The framework must make a building cheap.
- Free assets with explicit commercial licenses only; CC0 strongly preferred; every pack logged in `public/assets/ASSETS_LICENSES.md` before any work builds on it (master PRD §14.1).
- The backend contract is **additive-only within v1**. Buildings never call HTTP and never add endpoints.
- The city must not regress. Nothing in this ADR changes how the iso world renders.

---

## 4. Options considered

> **v2.0.** The four options are left exactly as v1.0 analysed them — the reasoning was sound and is worth keeping. What changed is the verdict: **v1.0 chose Option A; v2.0 chose Option B**, after building it. The ✅ has moved and the reasons are in §5 and §6.

### Option A — One shared R3F engine, buildings ship data _(v1.0's choice; superseded)_

A single `src/framework/interior/` module built on React-Three-Fiber. It owns the `<Canvas>`, the camera, the player controller, collision, the NPC system, the dialogue layer, the scenario runner and the accessibility layer. A building supplies a Zod-validated `InteriorScene` object, a cast file, a script file and a GLB asset bundle.

| Dimension | Assessment |
|---|---|
| Complexity | Med — real-time 3D is genuinely harder than sprites, but the hard parts are written once |
| Cost | Low per building after the first — the twelfth building costs a fraction of the first |
| Scalability (content) | Excellent — an interior is typed data, so it is AI-generatable and schema-validated |
| Team familiarity | Med-High — JS team is strong; R3F is declarative React; Claude is fluent in R3F |
| Perf risk | Concentrated in one place, where it can be measured and defended |

**Pros:** one perf budget, one a11y implementation, one dialogue system, one scoring path. A building PR is data plus art. The schema is the review surface. The framework/building boundary the master PRD already established (§7.3) survives intact and gets stronger.

**Cons:** the engine must be genuinely general before building #2, or building #2 forks it. Requires discipline about what belongs in the engine.

### Option B — 2D presence in Pixi ✅ _(v2.0's choice, in a form v1.0 did not consider)_

v1.0 evaluated this as *first person as a set of painted viewpoint plates with hotspot navigation* — the classic point-and-click adventure grammar — and rejected it on **F1** ("the player hops between fixed viewpoints rather than walking") and on the art budget.

**Both objections dissolve in the form that was actually built.** The room is not a set of plates; it is **the city's own isometric grid, indoors**, so the player walks continuously over a real walkable map and F1 is satisfied by amending "first person" to "as a character". And the art is not bespoke illustration; it is **procedural vector props baked to textures** (§16.1), so there is no illustrator bottleneck at all. The v1.0 analysis below is of the plate-based version and is left for the record.

| Dimension | Assessment |
|---|---|
| Complexity | Low — no new renderer, reuses the existing Pixi application |
| Cost | Lowest per building **if** art exists; art becomes the bottleneck |
| Scalability | Good technically; poor artistically — each viewpoint is a bespoke illustration |
| Perf risk | Near zero |

**Pros:** ships fastest, runs anywhere, zero motion-sickness surface, and honestly the most *beautiful* result per hour of effort if you have an illustrator.

**Cons:** the player hops between fixed viewpoints rather than walking, which fails **F1** as written. Every new viewpoint is a new illustration, so "lively" scales with an art budget we do not have (master PRD §14.1 restricts us to free packs, and free 2D interior plates in a consistent style essentially do not exist). Ambient life must be animated by hand per plate.

### Option C — Per-building free choice of stack

Each building team picks whatever suits its venue: the Café in 2D, Race Car Manufacturing in 3D, the Stock Exchange as a data-viz surface.

| Dimension | Assessment |
|---|---|
| Complexity | High in aggregate — twelve runtimes to keep alive |
| Cost | Highest — nothing amortises |
| Scalability | Poor — no shared dialogue, a11y, comfort or scoring layer |
| Team familiarity | Irrelevant; the problem is coordination, not skill |

**Pros:** the ceiling per venue is the highest. A venue that genuinely needs something exotic gets it.

**Cons:** twelve accessibility implementations is twelve chances to ship an inaccessible one. Twelve scoring integrations is twelve chances to leak the tier. The framework/building contract dissolves. **Rejected as a baseline** — but note that Option A explicitly *preserves* this as a per-venue escape hatch (§16.4), so nothing is lost except the default.

### Option D — Shared R3F engine plus a 2D low-spec tier

Option A, plus an automatically-selected 2D station mode for weak GPUs and reduced-motion users.

| Dimension | Assessment |
|---|---|
| Complexity | High — two presentations of every interior to keep in sync |
| Cost | ~1.5× Option A |
| Reach | Best |

**Pros:** widest device reach; the reduced-motion story is excellent.

**Cons:** doubles the content surface for every building, and the second presentation is exactly the one nobody will keep updated. **Deferred, not rejected** — §14.5 specifies a *degraded mode within the same 3D scene* (fixed camera, guided teleport between stations, no free look) which gets most of the reach benefit for a fraction of the cost, and does not require a second art pipeline.

---

## 5. Decision

> **v2.0.** v1.0 chose **Option A** (a shared R3F engine). Two buildings were then built, and what they are is **Option B done properly** — a 2.5D isometric room in the city's own projection, sharing the city's own renderer. v2.0 records Option B as the decision. §4's option analysis is left standing unedited, because the reasoning is still the reasoning; what changed is which column won once someone tried it.

**Option B, as a shared pattern rather than a shared engine.** One 2.5D isometric interior pattern, borrowing the city's `PIXI.Application`, with the framework owning the seam and the buildings owning their rooms.

Specifically:

- **Renderer: the city's, borrowed.** `src/framework/building/interiorStage.ts` publishes the world's `Application`; an interior hides the city's layers, adds its own container and ticker callback, and restores everything on exit. **A building never constructs a `PIXI.Application`.** Two Applications in one page corrupts Pixi v8's batcher — the first renderer throws out of its own ticker listener, its RAF loop never reschedules, and the city renders nothing but its clear colour forever. This was verified with an empty second Application and no textures at all: it is the second renderer's existence, not anything drawn into it.
- **Registration:** `src/framework/building/registry.ts` maps venue id → `BuildingManifest`. A building registers by adding one line; everything else lives behind its own lazy `interior: () => import("./Interior")`, so registering costs the bundle the manifest object and nothing more. `BuildingGate.tsx` mounts it under `Suspense`. A venue with no entry, or `interior: null`, falls through to the framework's overlay panel — the pre-existing behaviour, still correct for the nine venues that have no room yet.
- **Camera:** static, fit-to-viewport, clamped to `scale ≤ 1` so nothing is ever upscaled. A room is framed once and stays framed. No follow camera, no free look, no motion sickness.
- **Movement:** click-to-move over a walkable cell grid, plus WASD/arrows, plus a guided "go to" navigation list of real `<button>`s inside a labelled `<nav>` so the browser's own Tab reaches them. `E` is the act key and belongs to the room whatever has focus; `Enter` belongs to whatever control has focus. **Do not bind Tab** — hijacking it strips DOM focus navigation out of the interior entirely (MAISON learned this the expensive way).
- **Collision:** the cell grid. A cell is walkable, blocked, or walk-over. `src/lib/pathfinding.ts` already exists and is tested. **No physics, no capsules, no wall slide** — a grid does not need them.
- **Lighting:** baked into the art. Tints, a night multiply overlay, and emissive-looking props. There is no light source in a 2D scene; there is only what the artist drew.
- **Assets:** procedural vector `Graphics` baked to textures at build-of-scene time, with `PROP_SPRITE` as the per-kind seam where real sprite art takes over. Kenney iso packs (CC0) are the sprite source when it does. §16.
- **Escape hatch preserved:** a venue may still mount a bespoke sub-scene — including a 3D one — inside its `Interior.tsx` behind the same contract (§16.4). It is the exception, it needs maintainer review, and it still owes §15.

---

## 6. Trade-off analysis

The real trade was **fidelity versus everything else**, and building it settled it.

**What Option B bought.** No second renderer, no GLB pipeline, no asset-licensing bottleneck on 3D interior kits (which barely exist at CC0), no motion-comfort surface, no new perf profile to defend, and continuity across the threshold that first person could never have had — you walk out of the room as the same character, at the same angle, onto the same street. The Café's `cafe.jpg` reference happened to have a diamond-checkered floor, which translates to an iso grid one-for-one; that is a small thing, but the whole approach kept producing small things like it.

**What Option B cost.** The room is a room you look *at*, not a room you are *in*. Presence is weaker. F1's "you are standing there" is now "you are walking there", and that is a genuine loss against the original brief. The mitigation is the one the shipped buildings actually use: **the room is small, the camera is close, and everything in it answers the mouse.** MAISON's review found NPCs were the one thing the mouse could not touch, and fixing that did more for presence than any amount of perspective would have.

**What we did not trade away:** server-authoritative scoring, the additive-only backend contract, the folder-ownership model, DOM-first accessibility, the silent-tier contract, or the city itself.

---

## 7. Consequences

**Easier**

- A building is a folder of data plus one canvas. `src/buildings/cafe/` and `src/buildings/fashion_brand/` are the two worked examples and the second was measurably cheaper than the first.
- Claude can draft a room, a cast, a mission spine and a script against typed data, exactly as it already drafts activity content.
- Accessibility, dialogue, audio and scoring are implemented once. Guided navigation converged independently in both buildings on the same store shape (`walkTo: Cell | null`), which is a good sign that the seam is in the right place.
- The "silent tier" rule is enforceable in one place: the client holds no rubric, and after [ADR-006](ADR-006_Missions_AI_Followups_and_Session_State.md) it does not even hold the generated beat's tiers.
- No 3D perf budget, no memory-leak class from undisposed GLBs, no second WebGL context.

**Harder**

- **Every prop is drawn, not imported.** Procedural art ships fast and looks consistent, but the garment set (MAISON), the espresso machine (Café) and the wall of screens (MERIDIAN) are hero props that want real art, and that work is still owed.
- **Layout truth drifts.** MAISON shipped three separate lists of "where the machines are" and stood its ambient workers nowhere near them. The rule that came out of it is now normative (§8.1): everything that draws at a prop, or stands in front of one, derives its cells from one `FURNITURE` table.
- **Depth sorting is a real problem in 2.5D.** The shopfront row drew over the player's feet in MAISON because it is the frontmost row. The Café had already designed this out with a `NEAR_EDGE` low sill; that pattern is now normative too.
- Audio is entirely unstarted in both buildings, and §6 of each PRD makes ambience load-bearing.

**Revisit if**

- A venue's core idea genuinely cannot be expressed in an iso room → §16.4's escape hatch, with an ADR amendment note.
- Presence turns out to be the thing playtesters miss most → the answer is a closer camera and more interactable props before it is a different renderer.
- Mobile web becomes launch-critical → this is now a layout and touch-target conversation rather than an architecture one, which is a considerably better place to be than v1.0 was.

---

## 8. The interior data model

A building's world is a set of typed modules under its own folder. This is the review surface, the AI-generation target, and the thing that stops building #7 from inventing its own engine. It is described here as it exists in `src/buildings/cafe/` and `src/buildings/fashion_brand/` — those two are the normative examples, and MERIDIAN is expected to be recognisably the same shape.

### 8.0 The room — `room.ts`

One cell grid, authored once, and **the single source of layout truth for everything else in the building**.

```ts
// src/buildings/<id>/room.ts  (building-owned)

export const COLS = 12;              // x
export const ROWS = 10;              // y — a one-cell wall ring encloses the play area

export type Cell = readonly [number, number];

/** What a cell is. `walkover` is a sill or a rug: you cross it, it draws under you. */
export type CellKind = "wall" | "blocked" | "walkable" | "walkover" | "gate";

/** Every physical thing in the room, and the cells it claims. THE source of truth:
 *  anything that draws at a prop, or stands in front of one, derives its cells
 *  from here — never from a second list. */
export const FURNITURE: ReadonlyArray<{
  id: string;
  kind: string;                       // "counter" | "table" | "rail" | "teller_window" …
  cells: Cell[];
  /** Drawn ON its host cell without blocking — a till, a pastry case, a pendant. */
  surface?: boolean;
  /** Visible state driven by world state (§12): worldValue → sprite key. */
  variants?: Record<string, string>;
  /** The prompt shown on approach, in the room's own words. */
  prompt?: string;
}> = [ /* … */ ];

/** Named regions, ordered — FIRST MATCH WINS. Announced on entry; drive audio. */
export const ZONES: ReadonlyArray<{
  id: string; label: string; test: (c: Cell) => boolean;
}> = [ /* … */ ];

/** Where things happen. A station is where the PLAYER stands; a host NPC stands
 *  BESIDE it, never on it. */
export const STATIONS: ReadonlyArray<{
  id: string;
  label: string;                      // guided-nav + screen-reader label, e.g. "the till"
  cell: Cell;
  facing: "N" | "E" | "S" | "W";
  /** What this station reads when nothing is live. No station is a dead end. */
  prompt: string;
}> = [ /* … */ ];

export const SPAWN: Cell;             // where you arrive
export const EXIT: Cell;              // the door threshold
```

### 8.1 Authoring rules

- **Cells, always.** One cell is one cell. There are no metres, no world units and no scale factors in authored data; `src/lib/iso.ts` owns the projection and nothing else may.
- **One source of layout truth.** Every list of "where the X are" derives from `FURNITURE`. MAISON shipped three such lists, they drifted, and its ambient workers ended up standing nowhere near the machines they were operating. This is the single most reproducible bug in a 2.5D room and it is designed out, not reviewed out.
- **The room must be enclosed.** A one-cell wall ring outside the play area: full height on the far side, a **low sill (`NEAR_EDGE`) on the near side**, because a full wall there stands between the camera and the room. Without the ring the room reads as a floor slab floating in black. The ring claims no play cell and moves no prop, so every invariant over `FURNITURE` is untouched.
- **Surface props never block.** A till, a pastry case, a pendant, shelving — drawn on their host cell, walkable through. This is what keeps a staff zone navigable behind a solid counter run.
- **Two invariants are load-bearing and belong in `room.test.ts`:** (1) every restricted area has exactly one route in — the flap, the gate, the stair; (2) the border is solid except for exactly one hole, the door, and every walkable cell reaches an open lane.
- **No station is a dead end.** A place guided navigation will send you to must have something to read when you get there.

### 8.2 What a building folder contains

```
src/buildings/<building_id>/
  manifest.ts        # BuildingManifest — the only registration point (master PRD §7.1)
  room.ts            # the cell grid: FURNITURE, ZONES, STATIONS, SPAWN, EXIT   (§8.0)
  props.ts           # per-kind procedural draw functions + PROP_SPRITE seam    (§16)
  scene.ts           # composition: what is drawn, in what order, at what depth
  <X>Canvas.tsx      # the Pixi container + ticker callback; borrows the host   (§8.6)
  cast.ts            # who is in the room, their anchors, patrols, gaze, ambient lines
  dressing.ts        # world state → visible prop variants, tints, densities    (§12)
  guide.ts           # the "go to" navigation list — real buttons, real nav
  roomStore.ts       # position, zone, nearest station, panel, announcements (Zustand)
  <x>Store.ts        # the season: track, decisions, world state (persisted)
  missions.ts        # the nine missions and their objectives         (ADR-006 §6)
  trees/*.ts         # the eighteen decision trees, both tracks                 (§9)
  followups/         # the 18-entry scripted fallback bank            (ADR-006 §8.5)
  panels.tsx         # the building's own DOM readers (the board, the rail, the tray)
  Interior.tsx       # the DOM half: prompts, live region, keyboard, hosts the canvas
  index.ts           # the building's public surface
```

`Interior.tsx` is **not** a thin pass-through in this architecture — it owns the DOM half, and the DOM half is where accessibility lives (§14.1). Reviewers should expect it to be substantial and should be suspicious of a building where it is not.

### 8.3 Repo layout — the framework side

```
src/framework/building/
  manifest.ts              # BuildingManifest + InteriorProps (Zod-validated)
  registry.ts              # venue id → manifest; hasInterior()
  BuildingGate.tsx         # lazy mount under Suspense
  interiorStage.ts         # THE handover: borrow the city's Application     (§8.6)
src/framework/mission/     # ADR-006 §6
  schema.ts · runner.ts · MissionTracker.tsx · speaker.ts
src/framework/session/     # ADR-006 §11
  sync.ts · mirror.ts
src/framework/interior/scenario/
  transfer.ts              # the generated third beat: fetch, render, submit  (ADR-006 §7)
src/activities/
  PlayerShell.tsx          # presentation mode: "coached" | "scenario"
  renderers/DecisionTreeRenderer.tsx
src/lib/
  decisionTree.ts          # pure traversal, world deltas, presentationOrder, parity
  iso.ts · pathfinding.ts  # projection and routing — already exist, already tested
```

Everything under `src/framework/` is maintainer-owned and CODEOWNERS-protected; `scripts/check_building_boundary.sh` enforces in CI that a building PR touches only `src/buildings/<its-id>/`. A building imports **only** from `@/framework/<area>` — never from a submodule path, so the public surface stays deliberate.

### 8.4 What the framework provides vs. what a building owns

| Framework provides — never reimplemented | Building owns |
|---|---|
| The `PIXI.Application` and the handover seam (§8.6) | The room's grid, dressing and tints |
| The building registry, the lazy gate, the manifest schema | Its own manifest entry |
| Guided navigation as a mechanism, live regions, focus management | Station labels and zone names (the words announced) |
| The mission runner and the mission tracker (ADR-006 §6) | Its nine missions and their objectives |
| Dialogue overlay, typography, choice affordances, timing | The dialogue content |
| `DecisionTreeRenderer`, trace assembly, submit, error handling | The eighteen decision trees per building |
| **The transfer beat** — fetch, render, fallback-transparency (ADR-006 §7) | Its persona cards and its 18-entry fallback bank |
| Session sync, debounce, exit flush, local mirror (ADR-006 §11) | What goes in its own session blob |
| Coin/badge celebration, HUD, audio buses | Ambient audio registration on the framework bus |
| The end-of-journey report shell | The report's diegetic framing and per-competency copy |
| **All** API access | Nothing — buildings never call `fetch` |

**Hard rule, inherited from master PRD §7.3 and extended:** a building PR touches only `src/buildings/<its-id>/`. `scripts/check_building_boundary.sh` enforces it in CI. Need something the framework does not provide? Framework issue → maintainer PR → every building benefits.

### 8.5 The React ↔ Pixi boundary

The discipline ADR-004 set for the city applies unchanged inside a room:

- **React does not re-render the scene graph every frame.** Player position, zone, nearest station, panel state and world state live in Zustand stores read inside the ticker callback. Component re-renders happen when *structure* changes (a prop variant swaps, an NPC leaves), not when *values* change.
- **The DOM owns every word.** Dialogue, choices, prompts, the mission tracker, the report and all HUD are real DOM over the canvas. Nothing readable is ever drawn into a texture. This is what makes the a11y story possible at all.
- **World → UI** is the typed event bus and store selectors. **UI → world** is store actions. There is no third path.
- **One guarded path per action.** `actHere()` in the room store is the only way an act happens, whether it came from the `E` key, a click on a prop, or a guided-navigation arrival. Two paths means two sets of guards and one of them will be wrong.
- **A panel over the room freezes the room**, exactly as a panel over the city freezes the city — so a click meant for a panel never also walks you.

### 8.6 The handover — borrowing one renderer

**There is one `PIXI.Application` in the page, ever.** A second one corrupts the first's batcher (§5), so an interior borrows rather than creates.

```ts
// src/framework/building/interiorStage.ts
export interface InteriorHost {
  app: Application;        // the city's. Borrow it; never destroy it.
  stage: Container;        // root to add interior containers to
  hideWorld: () => void;   // hide the city's own layers
  showWorld: () => void;   // put the city back exactly as it was
}
```

```
approach venue  → prefetch: import("./Interior")
press E         → fade to black (240 ms)
                → whenInteriorHost()          (resolves even if the world is still booting)
                → hideWorld(); add the room container; add a ticker callback
                → bake procedural props to textures behind the fade
                → fade in — the player is standing at room.SPAWN
… play …
exit            → flush the session blob (ADR-006 §11.3)
                → fade to black
                → remove the ticker callback; destroy the room's textures and containers
                → showWorld(); the city resumes at the same street tile
                → fade in
```

Two failure modes are known and both must be designed against, because both leave the city hidden and frozen — the worst possible failure since the player cannot even walk away:

1. **Arm `detach` before the async build starts**, not after it resolves. An unmount mid-bake must still restore the world.
2. **`.catch` the async build.** A bake that throws must call `showWorld()` on the way out.

Both are listed as debts against the Café in [MAISON §19.3](PRD_Building_MAISON.md) and are framework-level requirements here.

---

## 9. The scenario script

> **v2.0 · amended by [ADR-006 §7](ADR-006_Missions_AI_Followups_and_Session_State.md).** A decision is now **three** beats, not two: the authored seed and the authored branch-specific follow-up below, plus a **generated transfer beat** written server-side from both prior choices. Everything in this section describes the two authored beats and is unchanged; the third beat's schema, generation contract and fallback live in ADR-006 §7–§8. The nine authored trees per building, their node ids and their nine rubric terminals are exactly as specified here.

The nine competency decisions in a building are one typed object per track. The shipped implementation of the traversal is [`src/lib/decisionTree.ts`](../src/lib/decisionTree.ts) — pure, tested, and holding no rubric.

### 9.1 Shape

```ts
// src/framework/interior/scenario/schema.ts
const Choice = z.object({
  id: z.string(),                  // node id fragment: "a" | "b" | "c"
  text: z.string(),                // what the player picks — a plausible peer
  /** What happens next, in the world and in the room's voice. */
  consequence: z.object({
    line: z.string(),              // spoken/narrated — never a verdict
    speaker: z.string().optional(),// npc id; omitted = narration
    worldState: z.record(z.string()).optional(),  // visible change (§12)
    beat: z.string().optional(),   // a one-off staged moment
  }),
});

const FollowUp = z.object({
  id: z.string(),                  // branch id, matches the seed choice id
  prompt: z.string(),              // branch-specific — this is the point
  speaker: z.string().optional(),
  choices: z.array(Choice).length(3),
});

const DecisionTree = z.object({
  activityId: z.string(),          // e.g. "C1-SCA-01"
  competency: z.string(),          // "C1"
  stationId: z.string(),           // where in the room it happens
  seed: z.object({
    prompt: z.string(),
    speaker: z.string().optional(),
    stage: z.string().optional(),  // a staged beat that sets it up
    choices: z.array(Choice).length(3),
  }),
  followUps: z.array(FollowUp).length(3),   // one per seed branch
});

export const ScenarioScriptSchema = z.object({
  buildingId: z.string(),
  track: z.enum(["SCA", "SCB"]),
  intro: z.string(),               // the shared setup, spoken on first entry
  trees: z.array(DecisionTree).length(9),
});
```

Note what is **absent** from this schema: there is no `tier` field, no `score`, no `isCorrect`, no `weight`. The client literally cannot know which choice is better, because the information is not in the client. That is deliberate — it makes the silent-tier rule of §11 impossible to violate by accident, and it makes the content safe to ship to a browser where a curious learner will read the network tab.

### 9.2 The tree shape

```
        ┌─ choice a ─→ follow-up branch A ─┬─ a.a   ← authored terminal
seed ───┼─ choice b ─→ follow-up branch B ─┼─ a.b   ← authored terminal
        └─ choice c ─→ follow-up branch C ─┴─ a.c   ← authored terminal
                                             (×3 branches = 9 terminals)
                                                       │
                                                       └──► TRANSFER BEAT
                                                            generated from the
                                                            leaf, 3 more options
                                                            (ADR-006 §7)
```

**Nine genuinely distinct leaf nodes.** The follow-up prompt is *branch-specific*: if you rushed the oat milk in, your follow-up is about the expiring almond cartons; if you tested with a counter card, your follow-up is about what the card actually told you. This is better writing, it makes the consistency check real, and — critically — it means the leaf node id alone identifies the authored outcome, so **the client never computes anything about quality**.

The transfer beat hangs off the leaf and is never part of the authored tree. Its options are not node ids, they are opaque per-attempt ids whose tiers exist only in the server's `ai_followups` row.

### 9.2.1 Choice presentation order

Authored trees are written **weakest-first**, because that is the order the blueprints list them in and the readable order to author and review in. Shipped that way, the weak option would sit first at almost every node in a building and a player would learn the position in two beats without reading a word — a tier leak with no tier vocabulary in it at all.

`presentationOrder(activityId, path, items)` in [`decisionTree.ts`](../src/lib/decisionTree.ts) shuffles the three options **per activity and per beat, deterministically** (seeded off the id, so replaying a decision is not a shell game). The choice *keys* are untouched — they are the trace tokens the server scores and they carry no position.

This is structural rather than editorial on purpose: MAISON's CI parity check caught the whole building shipping its weak option first, across eighteen trees, because eighteen trees were authored in the doc's order. No author can reintroduce it now.

### 9.3 The wire

Activity type `DECISION_TREE`, result kind `trace`. The `path` is exactly as it always was; two optional fields carry the transfer beat ([ADR-006 §7.3](ADR-006_Missions_AI_Followups_and_Session_State.md), [PRD_Backend_Missions §4.5](PRD_Backend_Missions.md)):

```jsonc
POST /api/v1/progress/C1-SCA-01/submit
{
  "clientVersion": "city@0.3.0",
  "durationSec": 341,
  "hintsUsed": 0,
  "result": { "trace": {
    "path": ["C1-SCA-01.seed", "C1-SCA-01.b",
             "C1-SCA-01.b.follow", "C1-SCA-01.b.c"],
    "followupId": "fu_01J8ZQ0S8N4T1V6M",     // optional
    "followupChoice": "o_c104de"             // optional
  } }
}
```

The server's `evalTrace` walks the path backwards for the last known terminal, looks up its outcome score, composes the transfer tier if one was submitted, and maps the result through `scoreMap`. The response carries `proficiency`, `coinsEarned`, `coinBalance` and any `badgesAwarded` — all server truth, all rendered, none inferred, and **no new fields**, because every new field on a scored response is a new place for a tier to leak.

Autosave is now per-building rather than per-activity: `PUT /api/v1/city/buildings/{id}/state` fires after every beat and flushes on exit, so a player who closes the tab mid-tree resumes at the exact objective they left, with the same transfer question waiting (ADR-006 §11).

---

## 10. Scoring model

> **v2.0 · amended by [ADR-006 §10](ADR-006_Missions_AI_Followups_and_Session_State.md).** The tier values, the seed/follow weighting, the nine-entry `terminals` map and the `scoreMap` below are all **unchanged**. The transfer beat composes on top of the result:
>
> ```
> finalOutcome = round( 0.7 × authoredTerminal  +  0.3 × transferTierValue )
> ```
>
> which is why not one authored `terminals` table in any building PRD had to be re-derived. The full 27-cell table lives in ADR-006 §10.2. A submit with no transfer beat scores on the authored terminal alone.

### 10.1 Tiers → outcome scores

Each choice is written at one of three tiers. The tier lives **only** in the server rubric, never in client content.

| Tier | Meaning | Value |
|---|---|---|
| **Developing** | A real, defensible move that trades the long game for the short one | 15 |
| **Strong** | Sound judgment — controlled, proportionate, evidence-respecting | 60 |
| **Advanced** | Sees the actual problem, not the presenting one; acts on it | 95 |

The seed decision is weighted **0.6** and the follow-up **0.4**. The seed is the harder call; the follow-up tests whether the judgment was real or lucky.

| seed ↓ / follow → | Developing | Strong | Advanced |
|---|---|---|---|
| **Developing** | **15** | **33** | **47** |
| **Strong** | **42** | **60** | **74** |
| **Advanced** | **63** | **81** | **95** |

### 10.2 Outcome → proficiency

```jsonc
"scoreMap": [
  { "minOutcome": 74, "proficiency": 3 },
  { "minOutcome": 42, "proficiency": 2 },
  { "minOutcome": 0,  "proficiency": 1 }
]
```

Read the two tables together and the consistency check does exactly what the blueprints asked for:

- **Advanced then Developing → 63 → P2.** You saw it clearly, then didn't follow through. That is Strong, not Advanced.
- **Developing then Advanced → 47 → P2.** You misread it, then corrected properly. That is also Strong — and it is the shape of a genuinely good learner.
- **Strong then Strong → 60 → P2.** Consistent competence.
- Only **Advanced then Strong or better** (81, 95) reaches P3. Only **Developing then Strong or worse** (15, 33) falls to P1.

### 10.3 The rubric a building ships to the backend

```jsonc
// internal/registry/content/c1.json → levels.SCA.activities[0]
{
  "id": "C1-SCA-01",
  "subtopic": "empathy_pain",
  "orderIndex": 1,
  "type": "DECISION_TREE",
  "title": "The Dairy-Free Question",
  "estMinutes": 6,
  "rubric": {
    "kind": "trace",
    "terminals": {
      "C1-SCA-01.a.a": 74, "C1-SCA-01.a.b": 42, "C1-SCA-01.a.c": 60,
      "C1-SCA-01.b.a": 15, "C1-SCA-01.b.b": 47, "C1-SCA-01.b.c": 33,
      "C1-SCA-01.c.a": 81, "C1-SCA-01.c.b": 95, "C1-SCA-01.c.c": 63
    },
    "scoreMap": [
      { "minOutcome": 74, "proficiency": 3 },
      { "minOutcome": 42, "proficiency": 2 },
      { "minOutcome": 0,  "proficiency": 1 }
    ]
  },
  "passCriteria": { "minProficiency": 2 }
}
```

Two conventions that matter:

1. **Terminal ids are `<activityId>.<seedChoice>.<followChoice>`.** The letters `a/b/c` are **shuffled per activity**, so "b is always the good one" never becomes learnable — which is why the values above are not in tidy rows. This example is the real `C1-SCA-01` from [the Café](PRD_Building_Cafe.md) §10.3, where the seed shuffle is `a→Strong · b→Developing · c→Advanced`. **The rubric is the only place that mapping is recorded**; a building's PRD carries a tier-map table for review, and nothing carries it into a client.
2. **No `hintsCap`.** Scenarios have no hints — there is nothing to hint at without leaking the tier. The player shell hides the hint button in scenario mode.
3. **The `aiBeat` block** (`{ weight: 0.3, tierValues: {…}, required: false }`) is added to every `DECISION_TREE` rubric. `required: false` is what keeps every legacy and degraded path scoring correctly. See [PRD_Backend_Missions §6.3](PRD_Backend_Missions.md).

### 10.4 Coins

`coinsByProficiency` in [`economy.json`](../../backend-academy/internal/economy/content/economy.json) is retuned from `{1:10, 2:20, 3:35}` to:

```jsonc
{ "coinsByProficiency": { "1": 5, "2": 15, "3": 25 } }
```

A content-pack change, no deploy. **This is a platform-wide rescale** — it also moves the existing C4-BEGINNER awards down. That is intended: 5/15/25 is now the reward scale for the whole academy, so that a learner comparing two sessions is comparing like with like.

Awards remain server-computed, credited once per first pass, idempotent on re-submit. The client renders `coinsEarned`; it never proposes it.

### 10.5 Registry binding — twelve buildings, twelve slots

> ### ⚠ BLOCKING — this section's id scheme collides with content that is already seeded
>
> **Verified against the live registry on 2026-08-07.** Two facts invalidate what §10.5 and §10.6 assert:
>
> 1. **`C9-HARD-01`, `-02` and `-03` are already taken.** C9 is fully seeded at all three levels, and `C9/HARD` holds twelve school-style activities occupying `orderIndex` 1–12:
>    `C9-HARD-01` *Chaos Simulator* (`MINI_SIM`) · `C9-HARD-02` *Grit vs Sunk Cost* (`CASE_STUDY`) · `C9-HARD-03` *The Setback Reflection* (`OPEN_TEXT_AI`) … through `C9-HARD-12`.
>    **All three launch buildings collide**, at their C9 slot, on day one.
> 2. **There is user progress against those ids.** 108 rows in the dev database, including `C9-HARD-05` and `C9-HARD-07`. Renumbering or evicting them dangles real data.
>
> §10.6's original claim that *"`HARD` and `PRO` become entirely scenario content — twelve buildings × one activity each fills both grids exactly"* was therefore **false as written**, and is withdrawn. It would have held for a level that did not exist yet. It was never true of `HARD`.
>
> **Resolved in §10.6.1: Option C, adopted 2026-08-07.** Scenario activities live at `SCA` and `SCB`; `HARD` is untouched. The ids in each building PRD §10.1 are final. A product-owner summary of the decision, with no engineering detail, is [DECISION_scenario_level_namespace.md](DECISION_scenario_level_namespace.md).

`validate_registry` enforces, per competency-level: **exactly 12 activities, `orderIndex` 1..12, six subtopics × exactly 2 each**. There are exactly twelve buildings. These are the same twelve.

| Slot | Building | Slot | Building |
|---|---|---|---|
| 01 | **Café** | 07 | Gym |
| 02 | **MERIDIAN** (Bank) | 08 | Race Car Manufacturing |
| 03 | **MAISON** (Fashion Brand) | 09 | Stock Exchange |
| 04 | Ice Cream Cart | 10 | Social Media / Personal Brand |
| 05 | School / College | 11 | Venture Capitalist |
| 06 | AI IT Company | 12 | Custom (client) |

A building owns its slot number across all nine competency files, in both scenario levels:

```
Café      → C1-SCA-01 … C9-SCA-01   and   C1-SCB-01 … C9-SCB-01
MERIDIAN  → C1-SCA-02 … C9-SCA-02   and   C1-SCB-02 … C9-SCB-02
MAISON    → C1-SCA-03 … C9-SCA-03   and   C1-SCB-03 … C9-SCB-03
```

> **Provisional.** Under §10.6.1's recommended Option C these become `C1-SCA-01 … C9-SCA-01` and `C1-SCB-01 … C9-SCB-01`. The *slot numbers* (01 = Café, 02 = MERIDIAN, 03 = MAISON) are unaffected either way; only the level segment moves.

Two building teams can never touch the same activity, even inside the same competency file. Twelve buildings × 9 competencies × 2 levels = **216 scenario activities** at full seed.

**Subtopic allocation.** Each of the six subtopics must land exactly twice per competency-level. Two ways to get there:

- **Authored (primary).** The building's author picks the subtopic that genuinely fits the decision, and a single **allocation table owned by the registry maintainer** balances the ×2 invariant across the twelve buildings. This is what the three launch PRDs do, and it produces markedly better fits than any formula — the Café's C4 decision *is* cash flow, MERIDIAN's C1 decision *is* root cause.
- **Rotation (fallback).** Where no strong fit exists, `subtopics[(k - 1 + i) mod 6]` for competency `Ci`, slot `k` gives a valid allocation by construction (twelve slots over six residues, twice each) without any coordination.

The three launch buildings claim one subtopic per competency each, leaving exactly nine slots per competency for the remaining nine buildings — three subtopics needing one more each, three needing two. The running ledger lives in [PRD_Building_Cafe.md](PRD_Building_Cafe.md) §10.2 and is the maintainer's to keep current. `validate_registry` is the gate either way.

Slot 12 (Custom) still seeds a real, generic scenario so the grid validates. Only its *interior skin and copy* are client-swapped; the registry rows always exist.

### 10.6 Levels — the scenario levels `SCA` and `SCB`

The backend has three levels: `BEGINNER` (8–13), `MEDIUM` (14–16), `HARD` (17–21) — all three holding school-style drills. The blueprints define two audience tracks: **Level A, 16–21** and **Level B, 35–50**.

Scenario buildings get **their own two levels**, and share none of the existing three:

- **Level A → `SCA`** (`SCENARIO_A`, `ageBand: "16-21"`).
- **Level B → `SCB`** (`SCENARIO_B`, `ageBand: "35-50"`).

Both are empty by construction, so the twelve-slot scheme of §10.5 fits exactly and collides with nothing. This is the additive backend change **BE-13** (§18).

> **v1.0 chose `HARD` for Level A**, reasoning that the 17–21 band already existed and inventing a level for a one-year overlap would be waste. That reasoning was about *age bands*; the blocker turned out to be *capacity* (§10.5). §10.6.1 records how it was re-decided.

~~**Consequence, stated plainly:** `HARD` and `PRO` become **entirely scenario content** — twelve buildings × one activity each fills both grids exactly, with no room left over.~~

> **Withdrawn 2026-08-07.** That paragraph assumed `HARD` was empty. It is not: `C9/HARD` is fully seeded with twelve authored drills, with user progress against them (§10.5). The sentence is true of the two levels that replaced it — `SCA` and `SCB` are empty by construction — and was never true of `HARD`.

`BEGINNER`, `MEDIUM` and `HARD` keep the existing school-style activity mix (drag-match, MCQ, sort, budget, mini-sim) and are **untouched by any of this**. Anyone wanting to add a drill at `HARD` still can.

### 10.6.1 How the collision was resolved

**The underlying problem is two content models sharing one namespace.** A level was designed to hold twelve *varied drills across six subtopics × 2*. The scenario model wants a level to hold twelve *buildings, one activity each*. Both cannot own `orderIndex` 1–12 of the same competency-level.

| | Option | Cost | Risk |
|---|---|---|---|
| **A** | **Evict `C9/HARD`** — move its twelve drills elsewhere to free the slots | There is nowhere to move them: `C9/BEGINNER` and `C9/MEDIUM` are both full at 12. They would have to be deleted | **High.** Destroys authored content and dangles progress rows |
| **B** | **Raise the per-level cap** to 24 and partition `orderIndex` — 1–12 scenarios, 13–24 drills | Renumbering the drills changes their ids (`C9-HARD-01` → `C9-HARD-13`) | **High.** Ids are the progress key; every existing row for those activities dangles |
| **C** ✅ | **Give scenarios their own two levels.** Level A → **`SCA`**, Level B → **`SCB`** (`SCENARIO_A` / `SCENARIO_B`), both empty by construction. `HARD` keeps its drills untouched | Two new levels instead of one; 18 level badges instead of 9; the 54 ids in the three building PRDs are renamed `C1-SCA-01` → `C1-SCA-01`, `C1-SCB-01` → `C1-SCB-01` | **Near zero.** Those ids exist only in documents — **not one row is seeded against them** — so renaming is free, and no shipped content or progress row is touched |

**Decision: Option C — adopted 2026-08-07.** Scenario buildings get their own two levels, `SCA` (16–21) and `SCB` (35–50). `HARD` keeps its drills and its progress rows and is untouched. The rationale memo is [DECISION_scenario_level_namespace.md](DECISION_scenario_level_namespace.md), kept for the record.

The original argument for reusing `HARD` was that *"inventing a level for a one-year overlap would be waste"* — a judgment about age bands. That argument is now beside the point: the blocker is **capacity**, not age fit. And the cost comparison has inverted. Renaming ids that exist only in prose is free; renaming ids that exist in a progress table is a migration with a data-loss failure mode.

Option C also fixes something §10.6 got wrong on its own terms. Keeping `PRO` for Level B while inventing a level for Level A would leave the two tracks asymmetrically named for no reason a reader could reconstruct. `SCA` / `SCB` is symmetric, is obviously distinct from the drill levels at a glance, and makes "which grid is this?" answerable from an activity id alone.

**What Option C changes, concretely:**

- **BE-13 grows.** Two levels in the allow-list, not one; `ageBand` `16-21` and `35-50`; **eighteen** `BADGE-C{n}-SCA` / `BADGE-C{n}-SCB` badges; two meta badges.
- **Id convention** follows the existing abbreviations (`BEG`, `MED`, `HARD`): `C1-SCA-01` … `C9-SCA-12` and `C1-SCB-01` … `C9-SCB-12`.
- **Every terminals table** in the three building PRDs is re-keyed. The *values* do not change — only the id prefix — so nothing in §10.1's arithmetic is re-derived.
- **`HARD` is left exactly as it is.** Anyone wanting to add a drill at `HARD` still can, which is now correct rather than "a feature".

The level *names* are a detail and KK may change them; the *structure* — a separate namespace for scenarios — is the decision.

### 10.7 Which track a player is on

Identity carries no age. [`warroom/directory.go`](../../backend-academy/internal/warroom/directory.go) mirrors id, email, name, batch code and role — nothing more.

So the track is a **one-time choice at the building threshold**, framed diegetically rather than as an age form. The Café asks it as *"Is this your first place, or have you done this before?"*; MAISON as *"Is MAISON the label you're starting, or the one you're taking over?"*; MERIDIAN as *"Are you stepping onto the floor, or into the corner office?"*. Once chosen, it persists for the whole city (all buildings share it) via `city/state` (BE-8) with a `localStorage` fallback until that endpoint lands.

The choice is changeable from settings, with a plain warning that the two tracks are separate progress. An admin/batch-code override is an open decision (§20).

---

## 11. The silent-tier contract

> **The design principle, stated as a rule:** choices must read as plausible peers. There is no throwaway "obviously wrong" option. Differentiation lives in the consequence, not in the choice text. The learner discovers quality through outcome. The tier is scored silently at the backend and is **never** surfaced mid-play. It appears once, in the end-of-journey report.

This section is normative. It is the part of this ADR that is easiest to violate by accident and most damaging when violated, because a learner who can spot the "right" answer stops making real decisions and starts pattern-matching — and the assessment stops measuring anything.

### 11.1 What the learner never sees during a scenario

| Forbidden | Why |
|---|---|
| The words *Developing*, *Strong*, *Advanced* | The tier vocabulary is report-only |
| A proficiency number in any form (`2/3`, `P2`, stars, bars) | Numeric feedback re-frames a judgment call as a test |
| "Passed" / "Not yet" / "Correct" / "Try again" | There is no pass state for a business decision |
| A ✓ or ✗ affordance on a choice, before or after | Same |
| Differing coin amounts *announced*, compared or explained | The coins scale; the commentary does not |
| A "best choice was…" reveal | The consequence *is* the reveal |
| Hints, or a hint button | A hint on a values question is a tier leak |
| Any styling that ranks the three choices (order, colour, weight, icon) | Visual ranking is a text-free tier leak |
| **A quality marker of any kind in the mission tracker** — a tick, a grade, a colour, a "well done" | The tracker is the most tempting place in the product to add a score. It is framework code precisely so a building cannot (ADR-006 §6.3) |
| **Any indication that the third beat was generated rather than authored** — a spinner, a badge, a different typography, a "personalised for you" | A player who knows which beat is different treats it differently, and it stops measuring transfer (ADR-006 §7.4) |
| **A win jingle or confetti on completing a decision** | A verdict delivered before the player has read the world their decision changed. MAISON shipped this and it was a §11 violation, caught in review |

### 12 characters is not a rule, but this is: **if a learner could screenshot the screen and identify the intended answer, we have failed.**

### 11.2 What the learner does see

- **The consequence, in the room's voice.** Not "that was suboptimal" but *"the oat milk sells fine. Three weeks later you find two unopened almond cartons behind the fridge, past date."* The world reports facts; the learner draws the conclusion.
- **A visible, persistent change.** The chalkboard is rewritten. A regular's table is empty. The rack has different price tags. §12.
- **The coin counter moving.** Quietly — the existing `Celebration` coin-fly is reused, with no text, no fanfare tier, no sound escalation between 5 and 25. A player who earns 5 and a player who earns 25 see the same animation at different magnitudes and are told nothing.
- **Their own choices, recalled.** The follow-up prompt refers to what they actually did. That is the strongest possible feedback and it costs nothing.

### 11.3 Framework changes this rule requires — **status: shipped**

v1.0 named two violations in the code. Both are fixed, and a third was found in play:

1. **[`PlayerShell.tsx`](../src/activities/PlayerShell.tsx) `ResultView`** rendered `"Passed!" / "Not yet — keep going"`, `Proficiency {n}/3 · best {n}/3` and `+{n} coins`. → **Done.** The shell has a **presentation mode**: `"coached"` (correct for BEGINNER/MEDIUM skill drills) and `"scenario"`. Scenario mode renders no result view at all — the consequence already played in-world and the shell returns control to the room. Mode is derived from the activity's type (`DECISION_TREE` → `scenario`), never set per-building, so a building cannot opt out.
2. **[`ActivityListPanel.tsx`](../src/activities/ActivityListPanel.tsx) `StatusChip`** rendered `★ {bestProficiency}/3`. → **Done.** In scenario venues the chip is a neutral state marker: *not yet · in progress · done*.
3. **Completing a beat fired a win jingle and confetti** (found in MAISON's M6 review). → **Done.** A celebration on commit is a verdict delivered before the player has read the world their decision changed. The coin fly remains, silent and magnitude-proportional; nothing else does.

The structural change is also shipped: the scenario renders **inside the room**, not inside a `Modal`. `PlayerShell` has a world-hosted path with no modal chrome — the dialogue layer is the presentation.

**Still open, and owned by ADR-006:** the mission tracker must never acquire a quality marker (§11.1), and the transfer beat must be presentationally indistinguishable from the two authored ones.

### 11.4 Authoring rules for plausible peers

For content authors, and for anyone reviewing a building PRD:

1. **Every option must be something a competent person actually does.** The Developing option is not stupid; it is *short-termist, or fear-driven, or ego-protective* — the failure modes of real operators under real pressure. "Ignore it and hope" is not an option; "act fast on what customers said, because moving first wins in a small shop" is.
2. **Equal length, equal specificity, equal confidence — and this one is measured, not judged.** The weak option must not be shorter, vaguer, or hedged. In practice the failure runs the other way: the *Advanced* option accretes clauses because it has more to justify, and within a few dozen decisions **"pick the longest option" becomes a winning strategy** — a tier leak with no tier vocabulary in it at all. The rule is therefore numeric:

   > **Within any set of three choices, the longest and the shortest must differ by no more than 8 words.**

   This is trivially checkable by script over the content files and belongs in CI, not in a reviewer's judgment. The three launch PRDs were drafted, measured, found in breach (worst trio: 22 words of spread, with the Advanced option nearly three times the length of its peers), and rewritten to comply — see each PRD's §18.3. Assume any new building will fail this on the first pass; every building has so far.
3. **Equal justification.** Every option carries its own reason. If only two options explain themselves, the third is marked.
4. **No loaded verbs.** "Panic and overhaul everything" marks itself; "make a bold, fast pivot to counter them before you lose more" does not. Where a source blueprint uses a loaded phrasing, the PRD rewrites it and says so.
5. **Shuffle the tier order per decision.** Never let position correlate with tier. The client letters `a/b/c` are shuffled independently for every activity.
6. **The consequence states facts, not grades.** No "unfortunately", no "you should have", no "the better move would have been". Report what happened in the world and stop.
7. **The Advanced option must cost something.** If the best answer is also the easiest, it is not a decision. Advanced usually costs time, comfort, revenue, or a relationship.
8. **Track differences are about stakes, not vocabulary.** Level B is not Level A with longer words; it has more variables, more irreversibility, and more competing legitimate interests.

### 11.5 The review gate — one machine pass, one human pass

Every building PRD carries a **plausible-peers audit** in its acceptance criteria, and it has two halves because the two failure modes are different in kind.

**The machine pass** runs in CI over the building's `trees/` and `followups/` and catches what a reader will not:

| Check | Rule |
|---|---|
| Choice-length parity | Longest − shortest ≤ **8 words** within every trio (§11.4 rule 2) |
| Tier-vocabulary leak | No `Developing`/`Strong`/`Advanced` as capitalised labels, no proficiency numbers, no `n/3`, no pass/fail phrasing anywhere in shipped strings |
| Verdict language | No "unfortunately", "you should have", "the better move", "correct", "well done" in any consequence |
| Tier-map hygiene | Each node uses each tier exactly once; no letter permutation repeated within a building; terminals match the §10.1 arithmetic exactly |
| Trace integrity | Every constructible path ends at a rubric terminal; every terminal is reachable |
| **Fallback completeness** | Exactly 18 fallback transfer beats per building (9 competencies × 2 tracks), each passing every check above. Enforced by `validate_registry` — a missing one is a build failure (ADR-006 §8.5) |
| **Objective reachability** | Every mission `go_to` target is a station in the building's guide list, so no objective needs a mouse (ADR-006 §13) |

**The same checks run server-side, per generation, on the transfer beat** — that is [ADR-006 §8.4](ADR-006_Missions_AI_Followups_and_Session_State.md)'s gate list, and it exists because a model will cheerfully write the good option longer, hedge the weak one, and add "unfortunately" to a consequence. Generated content that fails a gate never reaches a client. Gate-failure rate by gate id is a monitored metric.

**The human pass** catches what the machine cannot: a reviewer **who did not write the content** reads every choice with the tier column covered and tries to identify the weak option. If they can, from wording alone, that decision is rewritten. The pass now samples generated transfer beats as well as authored ones. Both halves are blocking.

---

## 12. World state — making consequences visible

A consequence the player only reads is half a consequence. Each building maintains a small map of visible facts about itself that decisions write to and props read from.

```ts
// per session; persisted with the interior's resume blob
type WorldState = Record<string, string>;
// e.g. { chalkboard: "oat_added", regulars: "thin", truck: "parked",
//        staff_mood: "strained", till: "healthy" }
```

- A decision's `consequence.worldState` merges into the map.
- Props with a `variants` record swap their visible model/material when their key changes.
- NPC idle animations, patrol routes and ambient lines are gated on world-state keys, so the room's *mood* shifts too.
- Ambient beats can be gated the same way — a busier room fires its beats more often.

**Constraints.** Keep it under about a dozen keys per building; every key must map to something the player can actually see; and it is presentation only — **it never influences scoring, which is entirely determined by the trace path.** That separation is what lets an offline submit report plainly that nothing scored it while the room still moves.

**A generated transfer beat may not invent a world-state value.** It may select one write from a closed set of 2–3 candidates the mission author supplies, server-validated for membership; anything else is dropped and the mission's authored `closeWorldState` covers the visible change ([ADR-006 §6.1, §8.4](ADR-006_Missions_AI_Followups_and_Session_State.md)). This keeps every prop's variant map closed and every room's history deterministic.

State persists to the server continuously via `PUT /api/v1/city/buildings/{id}/state` and is flushed on exit with `sendBeacon`, so a returning player walks back into the café they shaped ([ADR-006 §11](ADR-006_Missions_AI_Followups_and_Session_State.md), [PRD_Backend_Missions §4.2](PRD_Backend_Missions.md)). `localStorage` remains the mirror behind the same interface, so a backend outage degrades to a locally-persisted season rather than a lost one.

---

## 13. The end-of-journey report

The one place tiers exist.

**Unlock.** All nine competency activities for the building, on the player's current track, are `COMPLETED`. Computed client-side from `GET /api/v1/progress` joined with `GET /api/v1/registry/{comp}/{level}` — both live today. **No new endpoint.**

**Presentation.** The report is a diegetic object in the room, not a modal that appears from nowhere. Café: a year-end letter waiting on the pass-through. MAISON: the season lookbook with the press file folded into it. MERIDIAN: the board review packet on the mezzanine desk. Walking to it opens a full-screen DOM reader (real text, real focus order, real screen-reader semantics).

**Contents.**

1. **The story of your season**, in the building's voice — a short prose recap built from the world-state trail, naming the decisions that mattered.
2. **Nine competencies, nine tiers.** `bestProficiency` → Developing / Strong / Advanced, with the one-line meaning of each. This is the first and only time the learner sees these words.
3. **The consequence trail** per competency: what you chose, what happened, what the pattern was across the two beats.
4. **Where you were consistent, and where you weren't** — the seed/follow-up shape of §10.2 made legible. "You saw the real problem, then didn't follow through" is the most useful sentence in the report.
5. **What to try next**, pointing at other buildings that draw on the competencies that came out lowest.

**Tone.** No shame framing, no grades, no percentile. Failure states are "not yet". The report is a debrief from someone who watched you work, not a scorecard.

**Re-play.** Replaying a competency re-submits and the server keeps `bestProficiency`; the report reflects the best run. The consequence trail shows the most recent run, because that is the one the world reflects.

---

## 14. Accessibility & comfort

First person is an accessibility regression unless it is designed against. These are launch requirements, not polish.

### 14.1 Every word is DOM

Prompts, choices, consequences, NPC lines, station labels and the report are real HTML with real focus order and visible focus rings. Nothing readable is rendered into the canvas. This is non-negotiable and it is why §8.5 exists.

### 14.2 Guided navigation — a full equal path, always on

Click-to-move is one way to move, not the only way. Guided navigation is **not a mode** — it is a visible panel that is always present, for everyone.

- The panel is a labelled `<nav>` of real `<button>`s, one per station and one per NPC, in the room's own words. **The browser's own `Tab` reaches them and a screen reader reads them as a list of places.**
- **Do not bind `Tab`.** MAISON first bound it to cycle the list, which strips DOM focus navigation out of the interior entirely — worse accessibility than the thing it was meant to serve. The Café's approach is the standard.
- `Enter` activates whatever has focus, including a nav button, which walks the player there. **`E` is the room's own act key whatever has focus.** Binding `Enter` to "act" as well causes activating a nav button to both walk you and act on where you were still standing — and the act wins, because opening a panel locks the room before the walk order lands. That bug shipped once; the split is now normative.
- The panel's first entry is **wherever the mission is waiting**, named by whoever is holding it.
- The path is a real walk across the room over the walkable grid (`src/lib/pathfinding.ts`), or an instant cut under reduced motion.
- `M` toggles the panel and the mission tracker together.

A player who never touches the mouse must be able to complete a building end to end. That is an e2e test and a stated property in `guide.test.ts`, not an aspiration. **Every mission `go_to` target must be in this list** — CI checks it, because an objective you cannot reach without a mouse is a blocked season.

### 14.3 Announcements

An ARIA live region announces: entering a zone **and its state** ("the atelier — three machines running"), arriving at a station, an NPC beginning to speak, the choices becoming available, the consequence, a world-state change ("Priya has rewritten the board"), an **objective completing**, a **mission opening**, and coin changes. Announcements are concise and never announce a tier.

Two rules learned in review:

- **A zone's state is part of the announcement, not a separate one.** The atelier's mood is carried by how much noise the work makes; a sighted player gets that for free and a blind player must get it in words.
- **During the transfer beat's generation window the live region says what the room is doing** ("Priya wipes down the counter"), never that something is loading. Same beat a sighted player sees (ADR-006 §7.4).

### 14.4 Comfort settings

> **v2.0.** The v1.0 table was written for a first-person camera and most of it no longer applies — there is no head bob, no FOV, no vignette and no snap turn in an isometric room. Withdrawn rows are struck; what remains is what still exists.

| Setting | Default | Notes |
|---|---|---|
| ~~Head bob~~ · ~~Field of view~~ · ~~Vignette~~ · ~~Snap turn~~ | — | **Withdrawn** — no first-person camera |
| Movement speed | Walking pace | No run. There is nowhere to hurry to |
| Staged motion / screen effects | Off under reduced motion | Ambient beats that move the frame are suppressed |
| Captions | **On** | All spoken lines are captioned regardless of audio state |
| Mission tracker | Expanded | Collapsible with `M`; the state persists in the session blob |

### 14.5 Reduced motion

`prefers-reduced-motion` changes presentation only:

- Guided navigation moves the player by cut rather than by walk.
- Ambient beats reduced to about a third; patrolling NPCs become stationary.
- No transition animations on the mission tracker or between objectives.

The room, cast, missions, script and scoring are identical. This is the same content at a lower motion budget, not a second implementation.

### 14.6 The rest

Type ≥ 16 px logical with ×1.25/×1.5 user scale; a dyslexia-friendly font option; no colour-only signalling anywhere (states carry icon + shape); an always-available "step outside" exit that never traps the player mid-decision (leaving mid-tree autosaves and resumes).

---

## 15. Performance budget

Acceptance numbers, measured on the reference profile (2019 i5, integrated GPU, Chrome), at every phase gate. **v2.0 restates these for 2D** — triangles, materials and GLB size are meaningless here.

| Metric | Budget | Enforcement |
|---|---|---|
| Frame rate | **≥ 30 fps p95**, 60 target | Playwright + `requestAnimationFrame` sampling in CI on a fixed walk path |
| Sprites on screen | ≤ 400 | Scene budget review + a dev-mode counter |
| Draw calls | ≤ 60 | Static dressing baked into a small number of containers; repeated props share a texture |
| Baked textures per room | ≤ 40 unique | Procedural props are baked **once at scene build**, never redrawn per frame (§16) |
| Texture memory | ≤ 48 MB | `resolution: 2` on baked art; nothing upscaled past `MAX_UPSCALE` |
| Scene build (bake) time | **≤ 400 ms**, behind the fade | Measured from mount to first interactive frame |
| Interior chunk | **≤ 1.5 MB** added to the bundle | `vite build` size gate per building chunk; the city shell must not grow |
| Animated characters | ≤ 6 on screen | Cast count is a scene-review item; crowds are posed static sprites |
| Ticker callbacks | 1 per interior | The room owns one callback; nothing else may add one |
| Enter / exit | ≤ 1.0 s each with prefetch | Measured from keypress to first interactive frame |
| Tab memory | ≤ 600 MB steady, **no growth across five enter/exit cycles** | Disposal test in CI — every baked texture and container the room created is destroyed on exit |

**Optimisation order when a budget is missed** (apply top-down, never skip): reduce ambient beats → reduce cast on screen → merge static dressing into fewer baked containers → lower bake resolution → reduce room size. **Never** reduce dialogue, choices, mission objectives or accessibility features to hit a frame budget.

---

## 16. Art & asset pipeline

### 16.1 Procedural first, sprites second

**The shipped rooms draw their own props.** Every prop is a vector `Graphics` draw function, baked to a texture once at scene build and reused thereafter. That is why the Café and MAISON shipped without waiting on an art pipeline, and it is the right default for building #4 onwards too.

```ts
// src/buildings/<id>/props.ts
export const PALETTE = { oxblood: 0x6b2229, wood: 0x8a5a33, cream: 0xe8dcc6, … };

/** One draw function per prop kind, in cell space. Pure; called once, baked once. */
export const DRAW: Record<string, (g: Graphics, variant?: string) => void> = { … };

/** THE SEAM. A kind with an entry here uses real art instead of DRAW. Adding
 *  sprite art is a one-line change per prop and touches nothing else. */
export const PROP_SPRITE: Partial<Record<string, string>> = { /* kind → asset key */ };
```

**Rules:** bake at `resolution: 2`, never upscale past the city's `MAX_UPSCALE` guard (a past bug shipped 12 px trees blown up 2.1× that "read as pills"), and destroy every baked texture on exit — the disposal test in §15 is what catches the leak.

### 16.2 Sourcing, when real art lands

Free with explicit commercial license only; CC0 strongly preferred. Every pack is logged in `public/assets/ASSETS_LICENSES.md` with source URL, author, license, commercial-use proof and date **before** any work builds on it (master PRD §14.1, existing CI gate).

- **Kenney** (kenney.nl) — *Isometric Miniature*, Furniture Kit, Food Kit, Mini Market, Retro Urban Kit. CC0, and already the city's art lineage, which matters for continuity across the threshold.
- **Poly Pizza** and similar aggregators — licenses vary per asset (much of it CC-BY, requiring attribution). Per-asset verification, never bulk import.

### 16.3 Conformance — the free-pack trap, again

The master PRD's top risk was mixed free packs reading as different games. Mixed 2D sources betray themselves through outline weight, palette and pixel density.

- **One palette per building**, 8–24 tints, named constants in `props.ts`, derived from a shared city LUT so interiors and exteriors feel related.
- **One silhouette language.** Flat fills, minimal outline, no micro-detail. A prop denser than its neighbours reads as an error.
- **One pixel density.** Everything baked at the same resolution; imported sprites are resampled to match, never scaled at draw time.
- **Depth is by row, and the near edge is special.** The frontmost row draws over the player. Use a low sill (`NEAR_EDGE`) there — a full wall stands between the camera and the room, and a full-height frontmost prop clips the player's feet.
- **Naming:** `int_<building>_<object>` for props, `npc_<building>_<name>` for characters.

### 16.4 Characters

Characters are baked procedurally today by `src/world/characterArt.ts` — four facings, zero PNGs — and interiors reuse it. A building varies **palette, clothing shapes and carried props**, never the construction, which is what keeps the cast affordable and lets one animation approach be written once.

**Gaze** — an NPC turning to face the player when in range — is the single highest-value-per-line effect available in 2D, exactly as it was in 3D. Élise looking up when you come behind the bench does more for presence than any prop.

**Every NPC must be a hotspot.** §7 of every building PRD lists NPCs as interactables; MAISON shipped with them as the one thing in the room the mouse could not touch. Cast members are rebuilt as clickable hotspots with the cast, not bolted on afterwards.

### 16.5 The bespoke escape hatch

A venue that genuinely needs something this pattern cannot express — including a 3D sub-scene — may mount it inside its `Interior.tsx`, behind the same contract: same dialogue layer, same mission runner, same scoring, same a11y, same budgets. Race Car Manufacturing's pit wall and the Stock Exchange's trading floor remain the anticipated candidates. It is an exception requiring maintainer review and an ADR amendment note — never the pattern, and never a reason to fork the framework.

---

## 17. Framework gaps — status

v1.0 listed eight blockers. Six are closed by the shipped Café and MAISON work; the remainder, plus the new ones ADR-006 introduces, are below.

| # | Gap | Status |
|---|---|---|
| **G1** | **Manifests unused** — `cityMap.ts` was the de facto registry | **Closed.** `framework/building/registry.ts` maps venue id → manifest; `cityMap` still owns tile placement and the manifest's `exterior` block mirrors it documentarily. Keeping the two in step is a review item |
| **G2** | **One venue = one competency** | **Closed.** `hostedActivities` drives the list and the season fans out eighteen parallel registry queries via TanStack Query. One missing row must not blank the board |
| **G3** | **No `trace` renderer** | **Closed.** `DecisionTreeRenderer` + `src/lib/decisionTree.ts`, rendering in the room rather than in a `Modal` |
| **G4** | **Result presentation leaks the tier** | **Closed.** `coached` / `scenario` presentation mode, derived from activity type. See §11.3 |
| **G5** | **No R3F dependency** | **Withdrawn.** No longer needed — §5 |
| **G6** | **No Radix / Motion / dnd-kit** | **Open, downgraded.** The dialogue layer's focus management is hand-rolled and currently correct. Radix remains the recommendation if a second focus-trapping surface appears; it is no longer a blocker |
| **G7** | **`city/state` not live** | **Open → specified.** [PRD_Backend_Missions §4.1–4.2](PRD_Backend_Missions.md) (BE-15/BE-16). `localStorage` mirror stays behind the same interface |
| **G8** | **Two WebGL contexts** | **Closed, and it was worse than described** — two Pixi `Application`s corrupt the first's batcher outright. `interiorStage.ts` is the fix; §8.6 the protocol |
| **G9** | **No mission runner or tracker** | **Open.** [ADR-006 §6](ADR-006_Missions_AI_Followups_and_Session_State.md). `src/framework/mission/`. Blocks every building's mission work — build it in the Café and share it |
| **G10** | **No session sync layer** | **Open.** [ADR-006 §11](ADR-006_Missions_AI_Followups_and_Session_State.md). `src/framework/session/`, including the `sendBeacon` exit flush |
| **G11** | **No transfer-beat client** | **Open.** [ADR-006 §7](ADR-006_Missions_AI_Followups_and_Session_State.md). `src/framework/interior/scenario/transfer.ts`. Must be presentationally identical to the authored beats and must never show a spinner |
| **G12** | **Interior teardown is not fail-safe.** A bake that throws leaves the city hidden and frozen | **Open.** Arm `detach` before the async build starts and `.catch` the build — §8.6. Listed as a Café debt in [MAISON §19.3](PRD_Building_MAISON.md) |

---

## 18. Backend issues

All additive within v1. Process per master PRD §11.3: issue → openapi PR first → implementation → deploy. **The full specification is [PRD_Backend_Missions.md](PRD_Backend_Missions.md)**; this table is the index.

| ID | Issue | Priority | Blocks |
|---|---|---|---|
| **BE-13** | **Add levels `SCA` + `SCB`** (`ageBand` `16-21` / `35-50`) — allow-list in `cmd/validate_registry`, eighteen `BADGE-C{n}-SCA` / `BADGE-C{n}-SCB`, two meta badges, the level comment on `ActivityRegistry.Level`. `varchar(16)` already fits | **P0** | Both tracks entirely |
| **BE-14** | **Retune `coinsByProficiency` → `{1:5, 2:15, 3:25}`** in `economy.json`. Content pack, no deploy. Platform-wide rescale — §10.4 | **P0** | The reward design |
| **BE-15** | `PUT/GET /api/v1/city/state` — track choice, FTUE flags, last tile *(was BE-8)* | **P0** | Track persistence |
| **BE-16** | `PUT/GET/POST /api/v1/city/buildings/{id}/state` — the season blob, including the `sendBeacon` exit path | **P0** | ADR-006 §11 entirely |
| **BE-17** | `POST /api/v1/ai/followup` + `POST /api/v1/ai/followup/{id}/commit` — the transfer beat *(replaces BE-9's scope)* | **P0** | ADR-006 §7 |
| **BE-18** | Extended `trace` submit (`followupId`, `followupChoice`) + the `aiBeat` rubric block | **P0** | Three-beat scoring |
| **BE-12** *(exists)* | **Seed C1–C9 × `SCA` and `SCB`** for slots 01–03 = 54 activities; the full grid is 216. Blocked on **BE-21** | P1 | Content availability per building |
| **BE-20** | Un-stale `api/openapi.yaml` — must document `DECISION_TREE` / `trace` / `SCA` / `SCB` / everything above *(was BE-5)* | P1 | Type-safe drift detection |
| **BE-21** | Registry validator: bounded by default, exact under `-strict` | **P0** | **BE-12, and therefore every building being real** |
| **BE-19** | `POST /api/v1/telemetry/mission` — objective-level events | P3 | Nothing |

---

## 19. AI content policy

> **v2.0 · superseded by [ADR-006 §12](ADR-006_Missions_AI_Followups_and_Session_State.md).** v1.0 said *"AI may never author, vary, reword or reorder a decision prompt, a choice, or a consequence."* That is still true of the **seed and the follow-up**, whose node ids are bound to server rubric terminals — one reworded choice silently changes what is being measured. It is **no longer true of the third beat**, which is generated by design.
>
> The current policy in one line: **AI may author the transfer beat and ambient chatter, server-side, through blocking validation gates, with a scripted fallback behind it — and nothing else, ever.** The client never calls a model, never holds a key, never sees a tier and never grades anything locally. Read ADR-006 §12 for the full rule set.

Offline authoring remains encouraged and is a different activity: Claude drafting a room, a cast file, a mission spine or a first pass at a script — reviewed by a human, tier-assigned by a human, and audited against §11.4 — is exactly the workflow this data-first architecture exists to enable.

---

## 20. Phases, risks, open decisions

### 20.1 Phases

| Phase | Deliverable | Demo gate | Status |
|---|---|---|---|
| **I0 — Interior seam** | `framework/building/`: manifest, registry, lazy gate, `interiorStage.ts` handover. A gray-box room: walk, collide, one NPC with gaze, guided navigation. Grid + nav unit-tested | Walk a gray box from the city and back, at 30 fps on the reference laptop, with a mouse and without one | **Done** |
| **I1 — Café vertical slice** | The Café interior dressed; the decision loop end-to-end; scenario presentation mode; world state driving visible props | Make a real decision in a real room and watch the chalkboard change; the server-scored result lands with no tier visible anywhere | **Done** |
| **I2 — MAISON** | All nine competencies × two tracks; ten world-state keys; the lookbook; the dev fixture | Play a full nine-decision season and read the lookbook | **Done** (311 tests; audio and hero art outstanding — [MAISON §19.3](PRD_Building_MAISON.md)) |
| **I3 — Missions & the transfer beat** | `framework/mission/` + `framework/session/` + `transfer.ts` (G9–G11); the Café's nine missions; the backend's P0–P3 ([PRD_Backend_Missions §9](PRD_Backend_Missions.md)) | A nine-mission season with the tracker top-left, a generated third beat in the host's voice, and the season surviving a killed tab | **Next** |
| **I4 — MERIDIAN** | The bank as an iso room against the same pattern; queue and screens; the board pack | A complete year in one sitting | Pending I3 |
| **I5 — Framework freeze** | `docs/INTERIOR_GUIDE.md` + `CLAUDE.md` codegen recipes; the handoff test | A dev (or Claude, against the recipes) adds a fourth building touching only `src/buildings/<id>/` | Pending I4 |
| **I6 — Scale-out** | The remaining eight buildings against the frozen contract | — | — |

### 20.2 Risks

| Risk | Mitigation |
|---|---|
| **The tier leaks** — through copy, styling, ordering, a debug field, the mission tracker, or a well-meaning "nice work!" | §11 as a normative contract; presentation mode derived from activity type so a building cannot opt out; the tracker is framework code so a building cannot add to it; **the generated beat's tiers are never sent to the client at all**; the plausible-peers audit as a blocking review gate |
| **Generated choices don't read as peers** — the model writes the good option longer | [ADR-006 §8.4](ADR-006_Missions_AI_Followups_and_Session_State.md)'s nine blocking gates, run per generation, with gate-failure rate as a monitored metric. Gate 3 (word parity) will dominate |
| **Authored choices don't read as peers** | §11.4 authoring rules; §11.5 audit by someone who did not write it; `presentationOrder()` makes the position leak structurally impossible (§9.2.1) |
| **The transfer beat is late and the conversation stalls** | ADR-006 §7.4: fire in parallel with beat 2's consequence, an in-character idle beat in the gap, a hard 4 s abandon to the fallback, and **never a spinner** |
| **The fallback bank is never finished** because generation "works" | `validate_registry` fails on a missing fallback entry, so a building cannot ship without all 18 |
| **Procedural art plateaus** and the rooms read as placeholder | `PROP_SPRITE` is the seam; hero props (the espresso machine, the garment set, the wall of screens) are named per building and are the first real art commissioned |
| **Layout truth drifts** across `room.ts` / `scene.ts` / the canvas | §8.1: everything derives from `FURNITURE`. This has already happened once and cost a review cycle |
| **Interior teardown leaves the city hidden** (G12) | Arm `detach` before the async build; `.catch` the build; the five-cycle memory test in CI |
| **Content volume**: 216 scenario activities × 9 leaves = 1,944 authored consequence beats at full seed, **plus 18 fallback transfer beats per building** | Data-first so Claude drafts and humans judge; one fully-worked exemplar per building fixes the pattern; the twelve-slot model means twelve independent authors never block each other |

### 20.3 Open decisions

- ~~The scenario level namespace (§10.6.1)~~ — **closed 2026-08-07.** Option C adopted; `SCA` / `SCB` are in the validator allow-list and the first row is seeded.
- **The two meta badge names** for `SCA` and `SCB` (`BADGE-META-OPERATOR` was proposed when there was one) — KK. Not blocking.
- **Track override by batch code** — should a cohort be pinned to Level B by its WarRoom batch, overriding player choice? Deferred; player choice ships first.
- **Shared city palette LUT** — still unauthored, and MAISON's whole identity is colour.
- ~~Whether `HARD` being fully consumed by scenarios is acceptable long-term~~ — **withdrawn.** `HARD` is not consumed by scenarios at all under §10.6.1; it keeps its drills and has room for more.
- **Voice acting** — captions are mandatory regardless; whether any line is ever voiced is a post-launch question.
- **Speculative generation** of all three transfer branches during beat 1 (ADR-006 §16) — 3× cost, latency becomes a non-issue. Decide after the p95 is measured.
- **Audio.** Neither shipped building has any, and §6 of every building PRD makes ambience load-bearing. This is the largest unstarted item in the framework.

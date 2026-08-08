# PRD — The City · Web (React + TypeScript + PixiJS) Isometric Frontend (Master)

_Training Paths Frontend PRD · v2.0 · 2026-07-22 · **Owner: KK + team** · Status: Draft for sign-off_
_Supersedes v1.0 (Godot) — see ADR-004 (§3)._
_Companion docs, all in this folder: [ADR-005](ADR-005_Interior_Framework.md) (the interior framework) · [ADR-006](ADR-006_Missions_AI_Followups_and_Session_State.md) (missions, the AI transfer beat, session state) · [PRD_Backend_Missions.md](PRD_Backend_Missions.md) (the backend contract) · the three launch building PRDs: [Café](PRD_Building_Cafe.md) · [MERIDIAN](PRD_Building_MERIDIAN.md) · [MAISON](PRD_Building_MAISON.md)._
_(`00_OVERVIEW.md` and `PRD_Academy_Backend.md` were referenced by v1.0 and do not exist in this repository; the backend is `backend-academy`, and its contract for this work is PRD_Backend_Missions.md.)_

> **What changed from v1.0:** the _platform_ only. v1.0 specified a Godot 4.x / GDScript / HTML5 game. v2.0 re-platforms onto a **web-native TypeScript stack — React + Vite + PixiJS** — that a JS team owns end-to-end and that **Claude (Opus 4.8) can author and maintain natively**. **Every goal, functional requirement, non-functional requirement, the backend contract, the plug-in building framework, the 13 activity renderers, the economy, auth, and accessibility are unchanged in intent.** Only the engine, architecture, art/asset pipeline, hosting, collaboration model, testing, and phase mechanics are rewritten. The backend (`warroom-academy-backend`, live) remains the single source of truth; new endpoints are added additively as needed (§11.3).

> **Scope note (per KK):** this PRD specifies **the city as a framework** — world, engine, architecture, the building plug-in contract, activity presentation, economy UI, collaboration, deployment. The 11 buildings get _common hints only_ (§7); each building's deep design happens in its own scaffold, separately planned. The job here is a frame so solid that a building team can plug in without ever touching shared code.

---

## 1. TL;DR

One **web game**: a 2.5D isometric, tycoon-style city that a customizable character walks through, rendered with **PixiJS** on a WebGL/WebGPU canvas and wrapped in a **React** UI. City buildings are business **venues** — a Bank, an Ice Cream Cart, a VC office — and entering one launches training activities drawn from _any_ of the 9 competencies. The backend remains the single source of truth for identity, activities, scoring, badges, and coins; the city is the presentation layer that makes training feel like playing.

```
Browser (desktop web, 60fps target / 30fps floor, 1280×720+)
┌──────────────────────────────────────────────────────────────┐
│  Vite SPA — "The City"  (TypeScript · React 18 · PixiJS v8)   │
│  ┌───────────────────────────┐   ┌────────────────────────┐   │
│  │  <CityCanvas> (PixiJS)     │   │  React/DOM UI layer     │  │
│  │  iso world · tiles · nav   │   │  HUD · Shop · Avatar    │  │
│  │  ambient actors · buildings│   │  Trophies · Login       │  │
│  └───────────────────────────┘   │  Activity player (13)   │  │
│        world store (Zustand)      └────────────────────────┘   │
│  ApiClient (typed, Zod-validated) · TanStack Query cache       │
└───────────────┬───────────────────────────┬───────────────────┘
                │ Firebase ID token          │ (additive) AI content
                ▼                            ▼
  warroom-academy-backend (Cloud Run, live)  ai/* endpoints →
  /registry · progress/submit · badges · profile   Claude (Opus/Haiku)
  (+ additive: /me, wallet, shop, avatar, city/state, ai/*)   + server fallback
```

**Non-negotiables inherited from the platform (unchanged):** the client never computes proficiency, never grants badges, never credits coins — it submits structured results and renders what the server returns. Sign-up never happens here — unknown users are routed to `warroom.humanfirstbykk.com/register`.

## 2. Product vision

**Working title: "WarRoom City"** _(RENAME-ME — alternatives: HumanFirst City, Founder's Bay, Venture Ville; KK decides before launch)._

The pitch to a student: _you own a character in a small, lively business city. Every building teaches you something real about running things — money at the Bank, grit at the Gym, pitching at the VC — and everything you do earns coins you spend making your character yours._ The pitch to us: one world amortizes every asset, every system, and every hour of polish across all 9 competencies, instead of splitting that effort 9 ways.

Experience bar (KK's words): **clean, smooth, extremely good and contentful** — a tycoon-game feel. Concretely:

- **Clean** — calm, minimal HUD (real DOM, real focus states); the city itself is the interface; chaos appears only as _content_ (a crisis inside an activity), never as UI noise.
- **Smooth** — 60fps where the hardware allows, gracefully degrading to a stable 30fps floor; every transition (walk → door → interior → activity) is animated, nothing pops.
- **Contentful** — the city reads as alive and worth exploring: pedestrians, vehicles, animated shopfronts, discoverable corners — within a strict performance budget (§6.4).

**New in v2 — the game can help build itself.** Because the stack is one Claude authors natively, content, building modules, and design variations can be **generated by Opus 4.8 against typed schemas** (offline authoring) and NPCs/scenarios can be driven by **Claude at runtime** through the backend (§8.4, §11) — always inside the server-authoritative scoring contract. "Highly customizable" is now a property of the stack, not an aspiration.

## 3. ADR-004: Re-platform The City to a web-native TypeScript stack (React + Vite + PixiJS)

**Status:** Proposed (supersedes **ADR-003**) · **Date:** 2026-07-22 · **Deciders:** KK (product), santhosh/hrithik/uganthan (eng)

### Context

ADR-003 chose Godot 4.x / GDScript / HTML5. In practice that path underdelivered for this team: GDScript is a niche runtime the team doesn't own, the toolchain (headless export, web-export templates, COOP/COEP hosting, `.tscn` merge fragility) adds friction at every step, and — decisively — **Claude Opus 4.8, the team's primary force-multiplier, is dramatically more productive in TypeScript/React than in GDScript.** A stack the team _and_ its AI pair-programmer both own end-to-end changes the delivery math. The F0 Godot skeleton proved the backend integration works (auth, the dual/structured error-envelope normalization, base-URL handling, live-backend findings) — all of which port over as **concepts**, not code.

### Requirements this decision must satisfy (unchanged from v1)

- **Functional:** the full goals G1–G6 (§4) — walkable iso city, in-world training loop, 13 activity renderers, economy UX, WarRoom auth, a frozen plug-in building framework.
- **Non-functional:** runs on a 2019 i5 iGPU laptop in Chrome; ≤ modest initial download; smooth transitions; keyboard-accessible; desktop-web first, touch-not-precluded.
- **Constraints:** 3-person JS team + Claude; free/CC0 art only; the live backend contract is additive-only; ship incrementally (F0→F4).

### Options considered

#### Option A — Keep Godot 4.x / GDScript (ADR-003, status quo)

| Dimension             | Assessment                                                           |
| --------------------- | -------------------------------------------------------------------- |
| Complexity            | Med — real engine, but niche toolchain (export templates, COOP/COEP) |
| Cost                  | High for THIS team — GDScript ramp-up, Claude far less fluent        |
| Scalability (content) | Good engine primitives, but `.tscn` merge fragility caps parallelism |
| Team familiarity      | Low (JS team); AND low AI leverage                                   |

**Pros:** real game engine primitives out of the box; single runtime.
**Cons:** GDScript ramp-up; Claude can't author it fluently; COOP/COEP hosting; `.tscn` files merge terribly; web-export template friction. **This is what we're leaving.**

#### Option B — React + Three.js / React-Three-Fiber (3D low-poly, ortho "iso")

| Dimension             | Assessment                                                         |
| --------------------- | ------------------------------------------------------------------ |
| Complexity            | High — real-time 3D, lighting, glTF pipelines, perf discipline     |
| Cost                  | Med-High — richest, but heaviest perf/QA burden on low-end laptops |
| Scalability (content) | Excellent — consume downloadable glTF kits directly                |
| Team familiarity      | Med (JS team strong; R3F learnable; Claude strong at R3F)          |

**Pros:** consumes ready-made 3D model kits online; true depth/lighting; Opus is strong at R3F.
**Cons:** the low-end-laptop perf budget (the very reason ADR-003 shelved Three.js) needs constant instancing/culling discipline; heaviest QA surface. _Retained as the documented per-venue escape hatch (§12.6), not the baseline._

#### Option C — React + TypeScript + PixiJS (2.5D sprites) ✅

| Dimension             | Assessment                                                    |
| --------------------- | ------------------------------------------------------------- |
| Complexity            | Low-Med — mature 2D WebGL renderer + declarative React UI     |
| Cost                  | Low for this team — TS end-to-end; Claude authors it natively |
| Scalability (content) | Excellent — data-driven manifests; DOM/TS files merge cleanly |
| Team familiarity      | High (JS team); AND highest AI leverage (Opus-native)         |

**Pros:** keeps the exact tycoon sprite look; PixiJS is a battle-tested 2D WebGL/WebGPU renderer (thousands of sprites, atlases, tilemaps); the world (Pixi canvas) and the UI (React/DOM) separate cleanly — which maps 1:1 onto this PRD's own structure (city world vs HUD/shop/activity player); **no SharedArrayBuffer, so no COOP/COEP hosting constraint**; real DOM UI is an accessibility win; TS files merge cleanly (the `.tscn` risk disappears); reuses the same CC0 sprite pipeline. Most Opus-native → fastest, highest-quality delivery.
**Cons:** we assemble a few libraries (renderer + UI + state + validation) rather than inheriting one engine; a Pixi↔React coordination boundary must be defined once (§12.2). Both are one-time, well-understood costs.

### Decision

**Option C.** TypeScript (strict) · React 18 · Vite · **PixiJS v8** for the isometric world · a Tailwind + headless-component design system for all UI · Zustand + TanStack Query + Zod for state/data/validation · Claude-powered content (offline authoring + runtime NPC/AI via additive backend endpoints). One SPA; buildings as lazy-loaded plug-in modules (§7). 60fps target, 30fps floor. **Option B is preserved as a per-venue 3D escape hatch (§12.6), never the baseline.**

### Trade-off analysis

The core trade is **"inherit one engine" (Godot) vs "compose a few best-in-class web libraries" (Pixi/React)**. For a JS team whose primary accelerant is an LLM fluent in TypeScript, composition wins decisively: every hour of Claude time converts to more output, the merge/hosting/accessibility tax drops, and the "highly customizable / can design itself" requirement becomes native (typed schemas + AI codegen). We give up out-of-the-box engine niceties (built-in nav baking, scene editor) — recovered cheaply with small libraries (§12) — and we own a Pixi↔React seam we define once.

### Consequences

- **Easier:** Claude authors/maintains the whole codebase; no COOP/COEP hosting; DOM accessibility for free; clean merges (folder ownership without `.tscn` fragility); content and even building scaffolds can be AI-generated against schemas; hot-reload dev loop (Vite) is instant.
- **Harder:** we must define the Pixi↔React boundary and a small render-loop discipline (§12.2); perf is our responsibility (sprite batching, culling) rather than an engine's — bounded by the budgets in §12.3.
- **Revisit if:** a venue genuinely needs real-time 3D (use the R3F escape hatch §12.6, don't re-platform); or mobile-web becomes launch-critical (revisit budget/layout, not architecture).
- **Carry-over from the Godot F0:** the auth model (Firebase login, no in-game sign-up, register-interstitial fires at the Firebase layer), the **structured/legacy error-envelope normalization** (any 401 → re-auth; the live backend returns `{"error":{"code":"UNAUTHENTICATED",...}}`), base-URL normalization (`NEXT_PUBLIC_API_URL` ends in `/api`), and the "backend is ahead of its openapi" findings all port directly into the TypeScript ApiClient (§12, §11).

### Action items

1. [ ] Sign-off on ADR-004; archive the Godot F0 as reference (do not delete without KK's word).
2. [ ] Stand up the Vite/React/Pixi skeleton repo `city-frontend` (F0, §19).
3. [ ] Port the auth + envelope + base-URL logic from the Godot F0 into the typed ApiClient.
4. [ ] File the additive backend endpoints the economy/AI layers need (§11.3) as backend issues.

## 4. Goals & non-goals

**Goals (launch) — unchanged from v1:**

- G1 — A walkable, lively isometric city with the 11 venue buildings placed, signposted, and enterable.
- G2 — The full training loop in-world: enter venue → play activity → server-scored result → coins/badges celebration.
- G3 — All 13 activity types renderable in one shared player shell (§8).
- G4 — Economy UX complete: HUD wallet, in-world shop, 4-slot character customization, trophy display.
- G5 — WarRoom-linked auth: login here, sign-up only on the main site.
- G6 — The building framework frozen and documented well enough that a building scaffold plugs in with zero shared-code edits (F3 gate, §19).

**Non-goals (explicitly out) — unchanged:**

- Deep design of the 11 buildings — each has its own scaffold plan (KK).
- Mobile/touch at launch (design must not preclude it; §5.4).
- Multiplayer, real-time co-presence, chat.
- Kids Edition; any backend rewrite (additive endpoints only, §11.3).
- User-generated content or city-building mechanics ("tycoon-style" = look and feel, not a construction sim).

## 5. Player experience

_(Unchanged in intent from v1 — reproduced with web-specific input details in §5.4.)_

### 5.1 Core loop

```
login → bootstrap (/me when it lands; today: /registry/modules) → spawn in city
  → explore (walk, discover, read signs)
    → enter a venue → pick an activity (level-gated list)
      → play → POST submit → server returns proficiency/coins/badges
        → celebration (coins fly to HUD; badge toast if awarded)
  → spend: shop → buy cosmetic → equip in customization screen
  → progress: trophy shelf + competency progress view
→ leave anytime; everything persisted server-side
```

### 5.2 First-time experience (FTUE)

1. Login screen (city-skyline backdrop). Unknown WarRoom user → friendly interstitial: _"Your WarRoom account is your ticket into the city"_ + a button to `warroom.humanfirstbykk.com/register` (opens a new tab). **Note (carry-over from F0):** the "unknown user" signal surfaces at the **Firebase login layer** (`EMAIL_NOT_FOUND`, or `INVALID_LOGIN_CREDENTIALS` under email-enumeration protection), not a backend 403 — the backend auto-provisions. A persistent "New to WarRoom? Register" link is always visible.
2. First bootstrap call auto-grants starter coins + free cosmetics + a default avatar _once the backend `/me` grant endpoint lands_ (§11.3) — the player arrives already owning a character.
3. 60-second guided walk: HUD tour → walk to the nearest venue → complete one short beginner activity → first coin celebration. Skippable.
4. City is fully open from minute one — soft signposting ("New!" badges), never hard gates on exploration.

### 5.3 Session shapes

- **Drop-in (5 min):** one activity at a nearby venue; instant resume of any half-finished sim via the state endpoints.
- **Sitting (20–40 min):** a venue crawl or a level push toward a badge. Both must feel complete — no session-long mandatory chains.

### 5.4 Input & platform (desktop web first)

- **Primary:** mouse — click-to-move with path preview, click to enter/interact, wheel to zoom.
- **Secondary:** WASD/arrows movement, E/Enter interact, Esc closes topmost panel, M map.
- **Web specifics:** pointer events unify mouse/touch/pen; hit targets ≥ 40px logical; `prefers-reduced-motion` honored (§16); no hover-only affordances (hover may _enhance_, never _gate_); pinch-zoom mapped in the input layer even if untested at launch.
- Minimum viewport 1280×720; UI is responsive/anchored and scales to 4K (Tailwind fluid scale + a canvas resize policy, §12.2).

### 5.5 Tone

Calm interface, warm city, encouraging copy. Platform tone rules carry over: no shame framing, failure states are "not yet," chaos is content — the UI around it is the steady part.

## 6. The City (world design)

### 6.1 Layout & districts

A single contiguous map (no route-loading between districts at launch), sized for a 3–5 minute end-to-end walk. Districts give wayfinding identity, not gameplay boundaries:

| District            | Feel                         | Venues placed there (initial)                      |
| ------------------- | ---------------------------- | -------------------------------------------------- |
| **Downtown**        | glass, plazas, finance       | Bank, Stock Exchange, Venture Capitalist           |
| **Market Street**   | shopfronts, stalls, warm     | Ice Cream Cart, Fashion Brand, **the Shop** (§9.2) |
| **Campus Quarter**  | green, collegiate            | School/College, Gym                                |
| **Tech Park**       | modern, neon accents         | AI IT Company, Social Media/Personal Brand studio  |
| **Industrial Edge** | hangars, asphalt             | Race Car Manufacturing, Custom (client venue)      |
| **Civic Center**    | fountain plaza — spawn point | Trophy Hall (§9.4), city map board                 |

Layout principles unchanged: every venue visible from a main road; landmarks at decision points; no dead-end streets longer than one screen; spawn plaza reaches any venue within ~45s walk. **Data-driven:** district + venue placement lives in typed JSON (`city.map.ts` / `districts.json`), consumed by the loader — the canvas contains no hardcoded venue positions.

### 6.2 Camera

Fixed isometric projection (2:1 diamond) implemented as a Pixi container transform. Follows the character with soft lag (lerp); free-pan on drag/edge (leashed to ~1.5 screens, snap-back on move); zoom in 3 clamped steps (street ↔ block ↔ district) via container scale + `roundPixels` for crisp sprites. No rotation — one projection keeps the art pipeline (§14) sane.

### 6.3 Movement & world interaction

Click-to-move via grid pathfinding (A* over the walkable tile grid; obstacles: buildings, props, water). Path preview line; WASD as direct drive that overrides the path. Interactables (doors, signs, map boards, NPC bubbles) get a consistent highlight + a floating **DOM** prompt anchored to the world position when in range. Walk speed tuned so crossing Downtown ≈ 20s.

### 6.4 Liveliness (the "contentful" budget)

A hard budget, not a vibe — enforced in the Pixi render loop:

| Ambient system       | Launch budget                                       | Notes                                           |
| -------------------- | --------------------------------------------------- | ----------------------------------------------- |
| Pedestrian NPCs      | ≤ 20 on-screen, 2-frame walk cycles, waypoint loops | non-interactive at launch; culled off-screen    |
| Vehicles             | ≤ 6 on-screen, fixed road loops                     | simple, no traffic sim                          |
| Animated props       | ≤ 15 active `AnimatedSprite`s on-screen             | signs, steam, flags, fountain, birds            |
| Building "breathing" | door swings, window lights                          | texture-frame swaps, no custom shaders required |
| Weather/day-night    | **CUT from launch** — nice-to-have (F4+)            | palette must not depend on it                   |

All ambient sprites share atlased textures and a single ticker; off-screen actors are culled (`renderable=false` + update skip). Reduced-motion (§16) halves NPC/vehicle counts and disables non-essential prop animation.

### 6.5 Building exterior states

Driven by data, rendered identically for every venue: **Open** (default) · **New content** (pulse badge — new/unplayed activities, computed from registry-vs-progress) · **Locked** (venue not enabled in the manifest, e.g. Custom before client config; greyed sign, door refuses politely). No per-building bespoke logic — the framework owns state rendering.

### 6.6 Map & fast travel

`M` opens a stylized **DOM** city-map overlay: venue icons + state badges + "you are here." Clicking a venue offers _walk there_ (path autopilot) or _fast travel_ (fade through). Fast travel unlocks per-venue after first physical visit — first discovery is always on foot.

## 7. Building framework — the plug-in contract

> The heart of this PRD. A building is a **plug-in**: a typed manifest + an owned module folder, **lazy-loaded** (`import()`) so a venue's code and assets never bloat the initial download. The framework guarantees the world around it; the building scaffold owns everything inside it. Two building teams never edit the same file (§17).

### 7.1 What a building IS

One folder `src/buildings/<building_id>/` containing:

- **`manifest.ts` (typed manifest)** — the only registration point, validated by Zod at load:

```ts
// src/buildings/ice_cream_cart/manifest.ts
import type { BuildingManifest } from "@/framework/building";

export const manifest: BuildingManifest = {
  id: "ice_cream_cart",
  displayName: "Ice Cream Cart",
  district: "market_street",
  exterior: {
    atlas: "buildings/ice_cream_cart/exterior.json", // texture atlas key
    footprintTiles: [
      [0, 0],
      [1, 0],
    ],
    entranceTile: [1, 1],
  },
  interior: () => import("./Interior"), // lazy React/Pixi module, OR null → framework overlay
  hostedActivities: ["C4-BEG-09", "C4-BEG-11", "C9-BEG-07"], // canonical registry IDs — the venue model
  owner: "santhosh",
  enabled: true,
};
```

- **`Interior.tsx` (+ assets)** — the building's world, the owner's to design (a React component that may host its own Pixi sub-scene), **or omitted** (`interior: null`) so small venues run activities in the framework's standard overlay with no bespoke interior.

### 7.2 Lifecycle the framework guarantees (identical for every building)

```
approach → highlight + prompt → enter (fade) →
  lazy-load interior module (or overlay) →
    activity list (framework component: hostedActivities × player status from
      registry/progress APIs, level tabs, lock/score chips) →
      activity player (§8) → submit → celebration (coins/badge, framework-owned) →
  back to interior → exit → city (same spot)
```

### 7.3 The contract, explicitly

| The framework provides (never reimplemented per building)                        | The building scaffold owns                                                                    |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Exterior placement/state rendering from manifest                                 | Exterior sprite/atlas art (to §14 spec)                                                       |
| Enter/exit transitions, spawn-back position                                      | Interior module, layout, props, NPC placement                                                 |
| Activity-list UI (bound to `hostedActivities` + live progress)                   | Which activities it hosts (manifest) + themed framing copy                                    |
| The activity player + all 13 renderers (§8)                                      | Optional themed _skins_ for renderers (design tokens/backdrops via theme hooks — never logic) |
| `ApiClient` (typed, Zod-validated) + `useApi` hooks; auth/session; error UX      | Nothing — buildings never call HTTP or `fetch` directly                                       |
| Coins/badge celebration, HUD, audio buses, save/resume                           | Interior-specific ambient audio (registered on the framework's `AudioManager` bus)            |
| NPC dialogue _component_ (portrait + lines + choices; optional AI backing, §8.4) | The dialogue content (script, or an AI persona brief)                                         |

**Hard rule:** a building PR touches only `src/buildings/<its-id>/` + its own manifest registration. CI enforces it (§17). If a building needs something the framework doesn't provide → framework issue → maintainer PR → everyone benefits. Buildings never call HTTP directly, never add endpoints, never fork a renderer.

### 7.4 The 11 venues — common hints only (deep design deferred to per-building scaffolds)

> **Update (2026-08-04).** Deep design is **no longer deferred for three of them**, and the "suggested competency draw" column below is superseded for those three: a scenario building hosts **all nine competencies × two tracks**, not a subset. See [Cafe](PRD_Building_Cafe.md) (slot 01, Market St), [MERIDIAN](PRD_Building_MERIDIAN.md) (slot 02, the Bank, Downtown) and [MAISON](PRD_Building_MAISON.md) (slot 03, the Fashion Brand, Market St). The registry binding is twelve buildings x twelve activity slots per competency-level ([ADR-005 §10.5](ADR-005_Interior_Framework.md)), so the remaining nine venues below inherit fixed slots 04–12 whenever they are designed.

_(Otherwise unchanged from v1.)_

| Venue                             | District   | Theme in one line                          | Suggested competency draw                                             |
| --------------------------------- | ---------- | ------------------------------------------ | --------------------------------------------------------------------- |
| **Bank**                          | Downtown   | vaults, tellers, loan desk                 | C4 (budgeting, cash flow) · C3 (commitment calls)                     |
| **Stock Exchange**                | Downtown   | tickers and floor chaos                    | C4 (ROI) · C5 (scenario thinking) · C3 (smart risk)                   |
| **Venture Capitalist**            | Downtown   | glass boardroom, the pitch chair           | C3 (courage/pitch) · C6 (negotiation, DEFEND_PITCH) · C1 (validation) |
| **Ice Cream Cart**                | Market St  | tiny stand, big lessons — starter venue    | C4 (stand sims, C4-BEG-09) · C9 (bounce-back, C9-BEG-07)              |
| **Fashion Brand**                 | Market St  | studio + storefront, taste and identity    | C8 (branding) · C5 (positioning)                                      |
| **School/College**                | Campus     | classrooms, library, noticeboard           | C2 (learning agility) · C7 (feedback/teamwork)                        |
| **Gym**                           | Campus     | plates, plateaus, showing up               | C9 (grit/plateau) · C3 (follow-through)                               |
| **AI IT Company**                 | Tech Park  | standups, servers, ship-it culture         | C2 · C5 (strategy) · C7 (team)                                        |
| **Social Media / Personal Brand** | Tech Park  | creator studio, audience trust             | C8 (credibility) · C6 (persuasion)                                    |
| **Race Car Mfg**                  | Industrial | garage, pit wall, milliseconds             | C5 (tradeoffs) · C8 (craftsmanship) · C9 (pivots)                     |
| **Custom**                        | Industrial | client-configurable; ships `enabled:false` | any (per client)                                                      |

## 8. Activity presentation framework

One **player shell** (React) — header: title/competency/level · progress dots · hint button · quit-with-resume — hosting **one renderer per activity type**. Renderers are framework components implementing a typed contract; buildings may theme them (design tokens/backdrop), never fork them.

### 8.1 Type → renderer → submission kind

| Activity types (registry `activityType`)                               | Renderer interaction                      | Result kind submitted              |
| ---------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------- |
| MCQ_FEEDBACK, DRAG_MATCH, SPOT_IT, CASE_STUDY, DIAGNOSE, STORY_CHOICE* | choose/drag/tap/tag → itemId+choice pairs | `objective`                        |
| SORT_ORDER                                                             | arrange sequence                          | `order`                            |
| DECISION_TREE (and branching STORY_CHOICE*)                            | node-by-node choices -> `DecisionTreeRenderer` | `trace` (path + optional `followupId`/`followupChoice`) |
| MINI_SIM, BUDGET_SLIDER                                                | multi-round sim with meters/sliders       | `metrics` (+ optional decisionLog) |
| BUILD_PLAN                                                             | pick-N-into-slots assembly                | `slots`                            |
| OPEN_TEXT_AI                                                           | writing panel (word-count bounded)        | `text`                             |
| DEFEND_PITCH                                                           | chat-style conversation vs AI persona     | `transcript`                       |

_\*STORY_CHOICE submits `objective` when beats are independent, `trace` when they branch — per that activity's rubric kind. The shell reads nothing; it posts what the renderer built._

> **Update (2026-08-04).** `DECISION_TREE` is shipped: [`DecisionTreeRenderer`](../src/activities/renderers/DecisionTreeRenderer.tsx) over the pure traversal in [`src/lib/decisionTree.ts`](../src/lib/decisionTree.ts). It is the only activity type the twelve scenario buildings use, and it now runs **three beats** — two authored, one generated server-side — per [ADR-006](ADR-006_Missions_AI_Followups_and_Session_State.md). The shell has a `coached` / `scenario` presentation mode derived from activity type; scenario mode renders **no result view at all** (ADR-005 §11.3).

**Renderer contract (typed).** Every renderer is `React.FC<RendererProps<TContent>>` and returns a `ResultBuilder` producing exactly one of the seven result kinds. Drag/drop uses a headless dnd library (e.g. dnd-kit); sliders/sim meters are DOM/SVG; SPOT_IT tap-targets and any spatial renderer may host a small Pixi/Canvas sub-view. The seven result kinds are a **Zod discriminated union** — the renderer literally cannot emit a malformed result.

### 8.2 The wire contract (verbatim — do not drift)

- `POST /api/v1/progress/{activityId}/start` on activity open.
- `PUT /api/v1/progress/{activityId}/state` autosave (opaque JSON blob) every round of any multi-step sim; `GET` same path on open → offer **Resume / Start over**.
- `POST /api/v1/progress/{activityId}/submit`:

```jsonc
{
  "clientVersion": "city@<semver>",
  "durationSec": 245,
  "hintsUsed": 0,
  "result": {/* exactly ONE of: objective|order|trace|metrics|slots|text|transcript */},
}
```

- Response drives everything shown next: `{ proficiency, bestProficiency, passed, status, feedback, graded, badgesAwarded[], coinsEarned, coinBalance }` (`coinsEarned`/`coinBalance` land with the backend economy work, §11.3).
- **Celebration is server-driven only**: coins fly to the HUD for `coinsEarned`; badge toast/ceremony per `badgesAwarded`; `graded:"fallback"` renders a gentle "scored offline" note. The client never infers or predicts awards.
- Rich content (question text, sim tuning, art) lives in the game's own content files keyed by activity ID — the backend serves scoring metadata only (answer keys never leave the server). Content IDs must match registry IDs exactly; a **dev-mode startup check** cross-references every `hostedActivities` entry against `GET /api/v1/registry/modules`.

### 8.3 Error & offline behavior

Standard handling in the typed ApiClient (a fetch wrapper with interceptors, §12): the **structured envelope** `{"error":{code,message,redirectUrl?}}` (the live backend's shape) and the legacy flat `{"error":"msg"}` both normalize to one `ApiError`. **Any 401 → one silent Firebase token refresh → retry; else login** (carry-over F0 finding: the live 401 code is `UNAUTHENTICATED`, so auth is status-driven). `INSUFFICIENT_FUNDS`/`ITEM_LOCKED`/`NOT_OWNED` → contextual UI (§9); 5xx/network → retry toast with backoff; submits are safe to retry (server idempotency). Mid-activity network loss never loses work: state autosave + an in-memory buffer flushed on reconnect.

### 8.4 AI-backed activities & NPCs (new detail; server-authoritative)

`OPEN_TEXT_AI` and `DEFEND_PITCH` are **graded on the server** (unchanged) — the client only submits `text`/`transcript`. NPC dialogue and the DEFEND_PITCH persona are driven by an **additive backend AI endpoint** (§11.3) that reuses the backend's existing grader/AI pattern with a **mandatory server-side fallback** (scripted lines when the model is unavailable). Recommended provider given the Opus-native stack: **Claude — Opus 4.8 offline, Haiku 4.5 for cheap runtime turns** — but the client is provider-agnostic (it calls the backend, never a model directly). The client never calls an LLM directly and never grades locally.

## 9. Gamification & economy UI

_(Unchanged in intent; DOM/React implementations.)_

### 9.1 HUD (persistent, minimal)

Top-left: avatar chip (portrait from equipped cosmetics → opens customization). Top-right: coin balance (animates on change; source of truth = last server response). Bottom-right: map button. Toast lane top-center (badges, errors). No minimap, no quest log at launch.

### 9.2 The Shop (a building, not a menu)

Cosmetics are bought at **the Shop** on Market Street — dogfooding the venue framework (the Shop is a "building" whose interior is the store UI). Backed by `GET /api/v1/shop/items` (renders `owned`/`affordable`/`locked` exactly) and `POST /api/v1/shop/purchase` (**additive endpoints — not yet live, §11.3**). Insufficient funds → shake + "earn more at any venue"; badge-locked items show their requirement proudly; `alreadyOwned:true` renders as owned (no error).

### 9.3 Character customization

From the avatar chip or the Shop: 4 slots (**SKIN, HAT, BACKGROUND, PET**) matching the backend slot model. Grid of owned items (`GET /api/v1/inventory`), live preview on the character (Pixi sprite composition, §14.3), `PUT /api/v1/avatar/equip`/`unequip` per change. The equipped set drives the in-world sprite and the HUD portrait. _(Additive endpoints, §11.3.)_

### 9.4 Trophy Hall & progress

The Civic Center's **Trophy Hall** displays earned badges (`GET /api/v1/badges`, **live today**) as physical trophies on shelves — walkable, screenshot-friendly. A progress board shows per-competency P-levels (`GET /api/v1/profile`, **live today**, `category` field) as a clean 9-row display (radar chart optional later). Empty shelves show silhouettes + where to earn them.

## 10. Identity & session

- **Login (in-game):** email + password via the **Firebase JS Auth SDK** (`signInWithEmailAndPassword`, project `warroom-498513`; web API key from the main frontend's config — a client key, not a secret). The SDK manages `idToken`/`refreshToken` and **auto-refreshes** (`onIdTokenChanged`); "remember me" toggles SDK persistence (`local` vs `inMemory`). _(Simpler than v1's hand-rolled REST refresh; the F0 REST approach remains a documented fallback.)_
- **Token attach:** an ApiClient interceptor attaches `Authorization: Bearer <idToken>` to every backend call. On 401 → force-refresh once → retry → else login (§8.3).
- **No sign-up, ever:** no register UI. Unknown users are caught at the Firebase layer (`EMAIL_NOT_FOUND` / `INVALID_LOGIN_CREDENTIALS`) → full-screen interstitial → `warroom.humanfirstbykk.com/register` (new tab) + "I've registered — try again."
- **Logout:** menu action; Firebase `signOut`; clears caches; returns to login.
- **Bootstrap:** `GET /api/v1/me` is the first authed call once it lands (HUD + idempotent starter grants); until then, `GET /api/v1/registry/modules` bootstraps (carry-over F0 seam). Re-called on window refocus after long idle (TanStack Query `refetchOnWindowFocus`).
- **Config:** Firebase key + backend base URL come from Vite env (`.env`, gitignored) — accepting the main frontend's `NEXT_PUBLIC_*` names, and normalizing a trailing `/api` off the base (both carry-over F0 findings).

## 11. Backend integration map & extension policy

### 11.1 When the game calls what

| Endpoint                                                                 | Status       | Called                                                             |
| ------------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------ |
| `GET /api/v1/registry/modules`                                           | **live**     | city load (building "new content" states, dev-mode ID cross-check) |
| `GET /api/v1/registry/{comp}/{level}`                                    | **live**     | opening a venue's activity list                                    |
| `GET /api/v1/registry/activity/{id}`                                     | **live**     | opening one activity (metadata/passCriteria)                       |
| `POST .../progress/{id}/start` · `GET/PUT .../state` · `POST .../submit` | **live**     | the activity loop (§8.2)                                           |
| `GET /api/v1/progress`                                                   | **live**     | venue list score chips (batch)                                     |
| `GET /api/v1/badges` · `GET /api/v1/profile`                             | **live**     | Trophy Hall                                                        |
| `GET /api/v1/me`                                                         | **additive** | after login; refocus/resume (HUD + starter grants)                 |
| `GET /api/v1/wallet` · `/wallet/transactions`                            | **additive** | wallet detail panel                                                |
| `GET /api/v1/shop/items` · `POST /api/v1/shop/purchase`                  | **additive** | the Shop                                                           |
| `GET /api/v1/inventory` · `GET/PUT /api/v1/avatar/*`                     | **additive** | customization                                                      |
| `PUT/GET /api/v1/city/state`                                             | **additive** | player position/district/FTUE flags                                |
| `POST /api/v1/ai/dialogue` (or `/npc`, `/persona`)                       | **additive** | NPC lines + DEFEND_PITCH persona (server fallback)                 |
| `GET /health`                                                            | live         | not used by the game                                               |

### 11.2 Client-side data policy

Server data lives in **TanStack Query** caches (registry: cached aggressively with long `staleTime`; wallet/progress: invalidated by every submit/purchase response, which carry fresh balances). No durable client persistence of server data — a reload re-bootstraps from `/me`. Client-only state (camera, world entities, FTUE-in-progress) lives in Zustand and, for cross-session position, in `city/state` once it lands (local `IndexedDB`/`localStorage` fallback until then).

### 11.3 Extension policy (the "add endpoints when needed" rule)

The contract is **additive-only within v1** (backend PRD §11). Flow: issue on `academy-backend` → contract PR (`api/openapi.yaml` first — **note: the openapi is stale vs the handler; fix it as part of this**) → implementation → deploy. Candidates, in likely order of need, all reusing existing backend patterns:

1. **Economy surface** — `/me` (bootstrap + starter grants), `/wallet`, `/shop/*`, `/inventory`, `/avatar/*`, and `coinsEarned`/`coinBalance` on `SubmitResponse`. **The single biggest gap** — the v1 PRD assumed these were live; the F0 audit proved they are not. F2 depends on them.
2. `PUT/GET /api/v1/city/state` — player position/district/FTUE flags.
3. `POST /api/v1/ai/dialogue` — NPC + persona, Claude-backed with mandatory server fallback (reuses the backend grader pattern).
4. `GET /api/v1/leaderboard?batch=` — cohort boards (backend has batch codes already).
5. `POST /api/v1/daily/claim` — daily reward + streak.

None block F0/F1. Buildings never add endpoints — framework/maintainer path only. **The concrete, file-ready issue list (proposed contracts + acceptance criteria) is Appendix A, §21.**

## 12. Technical architecture (TypeScript · React 18 · Vite · PixiJS v8)

**Stack decision:** TypeScript (strict) end-to-end. React + Vite for the app shell and all DOM UI; **PixiJS v8** (WebGL2, WebGPU-capable) for the isometric world. This is the stack the JS team owns and that **Claude Opus 4.8 authors and maintains natively** — the core of ADR-004.

### 12.1 Project layout

```
city-frontend/
  index.html · vite.config.ts · tsconfig.json · tailwind.config.ts
  .env(.example)                 # FIREBASE_* / API_BASE_URL (accepts NEXT_PUBLIC_* aliases)
  src/
    main.tsx                     # React root, providers (Query, Auth, Theme)
    framework/                   # ★ shared runtime surface (maintainer-owned)
      api/                       # ApiClient (fetch+interceptors), Zod schemas, useApi hooks
      auth/                      # Firebase auth, session, refresh, register-interstitial
      economy/                   # wallet/inventory/avatar mirrors (server-fed only)
      events.ts                  # typed event bus (coins_changed, badge_awarded, …)
      router.tsx                 # city ↔ interior ↔ activity flow + transitions
      audio/                     # AudioManager (Music/Ambient/SFX/UI buses)
      building.ts                # BuildingManifest type + Zod validator + registry
    world/                       # PixiJS: <CityCanvas>, tiles, camera, nav (A*), ambient
    buildings/<id>/              # ★ one folder per venue (owner-owned), lazy-loaded
    activities/
      PlayerShell.tsx
      renderers/                 # 13 components, one per activity type
      content/                   # rich content (typed JSON) per activity ID
    ui/                          # HUD, login, shop, customization, trophy, toasts, design-system
    lib/                         # iso math, pure sim math, utils (unit-tested)
  public/assets/                 # atlases/audio per §14 + ASSETS_LICENSES.md
  tests/                         # vitest unit + playwright e2e
```

### 12.2 Core technical choices

- **The Pixi↔React boundary (defined once):** a single `<CityCanvas>` React component owns one `PIXI.Application`. **React never re-renders the world.** World entities read/write a **Zustand** store; the Pixi ticker reads that store each frame. React owns all DOM UI (HUD, panels, prompts) and reads the same stores. World→UI communication is via the typed event bus + store selectors; UI→world via store actions. This clean seam is the one architectural rule everyone learns.
- **World:** PixiJS `Container` graph with a 2:1 iso transform; a `Sprite`/`AnimatedSprite` per entity from **texture atlases**; manual **y-sort** for depth; **culling** of off-screen actors. Buildings instanced from manifests at load; the world scene contains no hardcoded venues.
- **Pathfinding:** A* over the walkable tile grid (small lib, e.g. `easystarjs`, or ~150 lines hand-rolled and unit-tested); click sets target, WASD overrides.
- **Data layer:** the **ApiClient** is a `fetch` wrapper with interceptors (auth attach, 401-refresh-retry, backoff, envelope normalization). Every response is parsed by a **Zod** schema → typed data or a normalized `ApiError`. **TanStack Query** wraps reads (cache/invalidation); mutations invalidate on the fresh balances they return. UI never calls `fetch` directly.
- **Validation-first types:** the 7 result kinds, the submit response, manifests, and content are **Zod schemas**; TS types are inferred from them. This makes the codebase safe for **AI authoring** — Opus generates content/modules and the schemas reject anything malformed at the boundary.
- **State machines:** explicit, typed (e.g. XState or small reducers) for character (idle/walk/enter), game flow (city/interior/activity/menu via the router), and each sim renderer.
- **Determinism note:** sims compute summary metrics client-side (T3 trust tier, backend PRD §8) — sim math lives in **pure, seedable functions** in `lib/` for testability and future server replay.
- **Motion:** Motion (Framer Motion) for UI transitions/celebrations; Pixi ticker/tweens (GSAP optional) for world motion. One well-orchestrated load/enter sequence over scattered micro-animations.

### 12.3 Performance budget (acceptance numbers, not aspirations)

| Metric              | Budget                                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Frame rate          | **60fps target; ≥ 30fps floor** (p95) on a 2019 i5 iGPU laptop, Chrome; `roundPixels`, atlas batching                                    |
| Initial JS/download | **≤ 5 MB** gzipped app shell + first district; **code-split** per district/building (lazy `import()`); loading screen with real progress |
| Memory              | ≤ 600 MB tab                                                                                                                             |
| Draw calls          | atlased sprites per district; ≤ 300 draw calls/frame (Pixi batches shared textures)                                                      |
| Load times          | cold start ≤ 8s on 20 Mbps (no wasm/pck pairing); venue enter/exit ≤ 1.0s (module already prefetched on approach)                        |
| Lighthouse          | performance ≥ 85 desktop; no long-task > 200ms during idle city                                                                          |

### 12.4 Why this is "optimized for Opus 4.8"

Concrete conventions that make the codebase one Claude authors and maintains at high quality:

- **Types are guardrails, not decoration:** Zod-first schemas + strict TS mean AI-generated content/modules fail loudly at the boundary instead of silently corrupting state.
- **Small, pure, colocated:** `lib/` pure functions with adjacent `*.test.ts`; renderers/components are self-contained; a building is one folder — the exact granularity an agent can generate and verify in isolation.
- **Generated contract types:** backend types are generated from `api/openapi.yaml` (once it's un-stalled), so client/server drift is a compile error.
- **A `CLAUDE.md` with codegen recipes:** documented prompts/commands for "add a building," "add an activity's content," "add a renderer" — turning Opus into a reliable scaffolder against the framework contract.
- **Everything data-driven:** map, districts, manifests, activity content are typed JSON/TS — new content is data an agent writes, reviewed against schemas, not engine surgery.

### 12.5 Runtime dependencies (all mature, permissively licensed)

React · Vite · PixiJS v8 · Zustand · @tanstack/react-query · Zod · Tailwind CSS · Radix UI primitives · Motion (Framer Motion) · dnd-kit · Firebase JS SDK (auth) · Howler.js (or a thin Web Audio wrapper) · easystarjs (or hand-rolled A*). Testing: Vitest · React Testing Library · Playwright. Lint/format: ESLint (typescript-eslint) · Prettier. _(Each pinned; licenses logged alongside assets, §14.1.)_

### 12.6 3D escape hatch (per-venue only) — **not taken**

> **Update (2026-08-04).** [ADR-005](ADR-005_Interior_Framework.md) v1.0 proposed making first-person React-Three-Fiber the interior baseline. **v2.0 withdrew that.** Building interiors are **2.5D isometric Pixi sub-scenes that borrow the city's existing `PIXI.Application`** — the Cafe and MAISON both ship that way. Two Pixi v8 `Application`s in one page corrupt the first one's batcher, so the borrowing is not a convenience but a requirement; the seam is `src/framework/building/interiorStage.ts`.

The escape hatch itself stands: a venue that genuinely needs real-time 3D may mount an R3F sub-scene inside its `Interior.tsx`, consuming CC0 glTF kits, behind the same framework contract — same dialogue layer, same mission runner, same scoring, same a11y, same §12.3 budgets. It never becomes the city baseline, and it requires maintainer review plus an ADR amendment note. Race Car Manufacturing's pit wall and the Stock Exchange's trading floor are the anticipated candidates.

## 13. Web hosting & deploy

- **Static SPA** (Vite build → hashed assets). **No COOP/COEP requirement** — a major simplification vs the Godot build (no SharedArrayBuffer). Host on **Firebase Hosting** (same project `warroom-498513`, one console the team lives in) or Cloudflare Pages/Vercel; SPA fallback to `index.html`; long-cache hashed assets, no-cache the entry HTML.
- **Config injection:** Firebase key + backend base URL from Vite env at build, with an optional `window.__CITY_CONFIG__` hook in `index.html` for hosting-time override without a rebuild (carry-over of the F0 `CITY_CONFIG` idea).
- **Backend CORS:** the live service currently allows `*` — at first deployed build, tighten `CORS_ALLOWED_ORIGINS` to the real hosting origin + localhost dev ports. Launch-checklist item.
- **Loading UX:** branded loader with real progress (Vite chunk + asset preload); visible retry on failed fetches; optional PWA (Vite PWA plugin) for instant repeat loads.
- **CI deploy:** every merge to `main` builds and deploys to a **staging channel**; tagged releases promote to production.

## 14. Art & asset pipeline (free packs only)

### 14.1 Sourcing rules _(unchanged in intent)_

- **Free with explicit commercial license only** — CC0 preferred (Kenney.nl first: isometric city/roads/vehicles/characters sets are CC0 and stylistically consistent). itch.io packs only after reading the license page.
- **`public/assets/ASSETS_LICENSES.md` is mandatory and CI-checked:** every imported pack logs source URL, author, license, commercial-use proof, date. Applies to **npm dependencies too** — a `LICENSES.md`/`license-checker` gate in CI. License verified before any work builds on a pack.

### 14.2 Consistency contract (the free-pack trap, mitigated)

One base style chosen at F0 (Kenney iso as the working default); everything conforms:

- One tile size (e.g. 256×128 diamond) and one pixel density project-wide; imports rescaled to spec, never mixed.
- Palette normalization (indexed palette/LUT) over any joining pack so mixed sources read as one city.
- The **11 signature buildings**: kitbash/recolor from CC0 parts in one batch, by one person, against a written style sheet (angle, palette, outline, shadow direction) — the style sheet is an F0 deliverable.
- **Texture atlases** per district (packed with a tool like TexturePacker/free-tex-packer → Pixi `Spritesheet` JSON); naming conventions (`bldg_<id>_ext`, `tile_<set>_<name>`); atlas-per-district for draw-call batching.
- **AI-assisted art ops (new):** Opus can generate the style-sheet doc, atlas manifests, palette LUT recipes, and per-item art briefs — humans still source/verify the CC0 pixels; the AI removes the bookkeeping.

### 14.3 Character & cosmetics

Layered Pixi sprite composition: base body (SKIN) + HAT overlay, 4-direction walk cycles as atlas frames; BACKGROUND applies to the HUD portrait/profile card (not the world); PET is a follower sprite with simple trailing logic. Every shop item needs its sprite pair (world atlas frame + UI icon) — the shop catalog and the art checklist are maintained together (typed `shop.ts`).

## 15. Audio

CC0/free-licensed only (same license log). One calm city theme + per-district ambient beds (crossfade on district change) + UI/SFX set (footsteps, door, coin, badge fanfare, button). **AudioManager** module with Music/Ambient/SFX/UI buses (Web Audio gain nodes or Howler groups) + per-bus sliders + master mute, persisted to `localStorage`. All playback through AudioManager — no scattered players in building modules (buildings register ambience on the framework bus, §7.3). A **TTS narration channel** (Web Speech API) is reserved for beginner-tier narration (§16).

## 16. Accessibility

Re-platforming to DOM UI is a large a11y win over a canvas-only game:

- **Reduced motion** toggle **and** `prefers-reduced-motion` (halves ambient actors, kills decorative animation, keeps functional feedback).
- **Keyboard-only playable:** full loop (move, enter, activity, shop) without a mouse; real DOM focus order and visible focus rings; Radix primitives ship correct roles/focus management.
- **Screen-reader support:** semantic HTML + ARIA on all UI; world state changes announced via live regions (e.g. "entered the Ice Cream Cart," "earned 20 coins").
- Readable type: UI font ≥ 16px logical; user scale ×1.25/×1.5; a dyslexia-friendly font option.
- **Colorblind-safe:** building states/badges never color-only (icon + shape).
- **TTS hook** for beginner narration via the Web Speech API (reserved on AudioManager; implementable at launch, not an afterthought).
- Captions/text for any voiced content; volume-independent visual cues for rewards.

## 17. Collaboration & repo model

- **New repo `city-frontend`** (working name), independent of `academy-backend`. Single Vite app (no multi-repo split needed).
- **Ownership = folders:** `src/buildings/<id>/` belongs to exactly one dev (CODEOWNERS); `src/framework/`, `src/world/`, `src/activities/`, `src/ui/`, `src/lib/` are shared-core, maintainer-reviewed. **TS/TSX files merge cleanly** — the `.tscn` merge hazard of v1 is gone; folder ownership remains for clarity and review, not merge survival.
- **CI (GitHub Actions):** `tsc --noEmit` + ESLint + Prettier check + **Vitest** unit + **Playwright** e2e smoke + `vite build` must all pass on every PR; a CODEOWNERS/path check that a `buildings/<id>/` PR touches nothing outside its folder; `ASSETS_LICENSES.md` + dependency-license entries required when assets/deps change.
- Branch protection mirroring the backend (PR + 1 review to `main`).

## 18. Quality bars & testing

- **Budgets are acceptance criteria** — §12.3 numbers measured at every phase gate on the reference laptop profile (Playwright + web-vitals in CI where feasible).
- **Unit tests (Vitest):** ApiClient envelope encode/decode against openapi fixtures for all 7 result kinds (+ the live-401→re-auth case from F0); pure sim math per renderer; manifest loader/Zod validation (bad manifest → clear error, not crash); iso transform round-trips.
- **Component tests (RTL):** each renderer builds the correct result kind; the player shell resume/quit flow.
- **E2E smoke (Playwright):** login → spawn → walk → enter venue → play one activity → submit → coins toast → buy one cosmetic → equip → resume a saved sim. Runs against a seeded staging backend.
- **Contract smoke:** CI hits live `/health` + `/api/v1/registry/modules` (with a CI token) to catch client/server drift early; generated types from `openapi.yaml` make drift a compile error.
- **Playtest gates:** each phase ends with a scripted 15-minute playtest checklist executed by someone who didn't build that part.
- **Telemetry (launch-minimal):** client error log with `clientVersion`; JS console/error boundary reporting to a simple collector (e.g. Sentry free tier) — not launch-blocking.

## 19. Phases & milestones

| Phase                     | Deliverable                                                                                                                                                                                                                                                                                  | Demo gate                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **F0 — Skeleton**         | Repo + CI (tsc/lint/vitest/playwright/build), Vite/React/Pixi app, Firebase login → bootstrap, gray-box iso city (tilemap, camera, click-to-move via A*, one placeholder venue), typed ApiClient with the ported auth/envelope/base-URL logic, art style sheet + base pack (licenses logged) | Walk a gray city as an authenticated WarRoom user; the register interstitial fires for an unknown login                  |
| **F1 — Vertical slice**   | One real venue (Ice Cream Cart) end-to-end: exterior → enter → activity list → play a real C4-BEG activity (objective or metrics) → submit → celebration; player shell + first 3 renderers                                                                                                   | Complete a real registry activity in-world; server result lands in HUD                                                   |
| **F2 — Economy UX**       | The Shop, customization (4 slots live on the character), Trophy Hall, wallet panel; remaining renderers to 13/13 — **gated on the additive economy endpoints (§11.3) landing**                                                                                                               | Earn → buy → equip → see it on your character; badge toast from a real award                                             |
| **F3 — Framework freeze** | All 11 venues placed with exteriors + manifests (overlay-mode minimum); `docs/BUILDING_GUIDE.md` + `CLAUDE.md` codegen recipes; ambient systems in budget; **framework API frozen**                                                                                                          | A dev (or Opus, against the recipes) adds a dummy building end-to-end touching only `buildings/<id>/` — the handoff test |
| **F4 — Content & polish** | Venue interiors per scaffold, FTUE, audio, accessibility pass, perf pass, CORS tightening, launch checklist                                                                                                                                                                 | Public URL, real cohort plays a full session                                                                             |

> **Update (2026-08-04).** F0–F2 shipped; F3 shipped in substance (the building registry, the lazy interior gate and the interior seam exist, with the Cafe and MAISON as tenants). F4 is now sequenced explicitly, because three developers are working in parallel against one backend:

| Phase                        | Deliverable                                                                                                                                                | Demo gate                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **F4a — Backend foundations** | [PRD_Backend_Missions](PRD_Backend_Missions.md) P0–P3: `PRO`, the coin rescale, city + building session state, `POST /ai/followup`, three-beat scoring     | A mission scores across three beats and its 27 outcome cells reproduce [ADR-006 §10.2](ADR-006_Missions_AI_Followups_and_Session_State.md) exactly |
| **F4b — Mission framework**   | `src/framework/mission/` (runner, tracker, speaker resolution), `src/framework/session/` (sync, beacon flush, local mirror), the transfer-beat client       | Walk the Cafe's mission 1 as an objective chain, keyboard-only, with the tracker top-left; kill the tab and resume     |
| **F4c — Three buildings**     | Cafe CAF-1…CAF-6 · MAISON MAI-5…MAI-9 · MERIDIAN MER-0…MER-7                                                                                              | A complete nine-mission season in each, and the same seasons played with the generator disabled                        |
| **F4d — Launch**              | FTUE, audio, a11y pass, perf pass, CORS tightening, the 54 registry rows seeded, the fresh-reader plausible-peers audits                                    | Public URL, real cohort plays a full session                                                                          |

**The one hard cross-building dependency:** MERIDIAN's content phases cannot start until the Cafe proves the mission runner in F4b. It is stated in [MERIDIAN §18.1](PRD_Building_MERIDIAN.md) rather than discovered in week three.

## 20. Risks & open decisions

| Risk                                                                                                                                | Mitigation                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backend economy surface missing** (top risk — the F0 audit found `/me`, wallet, shop, avatar, and `coinsEarned` do **not** exist) | File the additive endpoints now — the concrete tickets are **§21 Epic A (BE-1…BE-4)**; F0/F1 don't need them; F2 is explicitly gated on them; the `Economy` module is a wired-but-unfed seam holding no fake data |
| Pixi↔React coordination / perf is ours to own                                                                                       | One defined boundary (§12.2); atlas batching, culling, `roundPixels`; budgets (§12.3) measured per phase; cut ambient density before features                                                                     |
| Free-pack style inconsistency                                                                                                       | One base pack + conformance pipeline (§14.2); style sheet before any building art; one person batches the 11 signature buildings                                                                                  |
| Bundle size creep (many libs/venues)                                                                                                | Code-split per district/building (lazy `import()`); dependency budget; `vite build` size gate in CI                                                                                                               |
| AI content cost/latency/quality (NPCs, authoring)                                                                                   | Server-authoritative + **mandatory server fallback** (scripted lines); Haiku 4.5 for cheap runtime, Opus 4.8 offline; AI output validated by Zod schemas                                                          |
| openapi.yaml is stale vs the live handler (F0 finding)                                                                              | Un-stall it as part of the first additive PR; generate client types from it so drift is a compile error                                                                                                           |
| Scope creep into building depth                                                                                                     | This PRD's scope note + the F3 handoff test keep the framework/building boundary explicit                                                                                                                         |

**Open decisions:** city name (§2) · day/night cycle timing (post-launch) · leaderboard/daily endpoint timing (§11.3) · exact base art pack after license audit (F0) · repo final name · state-machine lib (XState vs hand-rolled reducers) · hosting target (Firebase vs Cloudflare/Vercel) · AI provider confirmation for the NPC endpoint (Claude recommended).

## 21. Appendix A — Backend issues to be filed (`academy-backend`)

These are the concrete backend changes this frontend needs, grounded in the **F0
audit of the live service** (read against `cmd/server/main.go`,
`internal/handlers/academy_handler.go`, `internal/models/academy.go`,
`internal/auth/middleware.go`). All are **additive within v1** (backend PRD §11).
Process for each: **openapi PR first** (`api/openapi.yaml`) → implementation →
deploy → the frontend generates types from it (so drift is a compile error, §18).
Proposed shapes are a starting point; the backend team owns the final contract.

### 21.1 Summary

> **Update (2026-08-04).** BE-1…BE-4 and BE-6 are **shipped**. BE-5, BE-8 and BE-9 are superseded by the mission work and renumbered below. **The full specification of BE-13…BE-20 lives in [PRD_Backend_Missions.md](PRD_Backend_Missions.md)**, which is single-owner by design; this table is the index.

| ID        | Issue                                                          | Priority | Blocks                         | Type               |
| --------- | -------------------------------------------------------------- | -------- | ------------------------------ | ------------------ |
| ~~BE-1~~  | Coin economy: `coinsEarned`/`coinBalance` on submit + wallet   | —        | **shipped**                    | schema + endpoints |
| ~~BE-2~~  | `GET /api/v1/me` bootstrap + idempotent starter grants         | —        | **shipped**                    | endpoint           |
| ~~BE-3~~  | Shop: `GET /shop/items` · `POST /shop/purchase`                | —        | **shipped**                    | endpoints + tables |
| ~~BE-4~~  | Inventory + avatar: `GET /inventory` · `GET/PUT /avatar/*`     | —        | **shipped**                    | endpoints + tables |
| ~~BE-5~~  | Un-stale `api/openapi.yaml`                                    | —        | superseded by **BE-20**        | contract           |
| ~~BE-6~~  | Standardize the error envelope                                 | —        | **shipped**                    | consistency        |
| **BE-7**  | Tighten CORS from `*` to an allow-list                         | P1       | F4 launch                      | config             |
| ~~BE-8~~  | `PUT/GET /api/v1/city/state`                                   | —        | superseded by **BE-15**        | endpoint           |
| ~~BE-9~~  | `POST /api/v1/ai/dialogue`                                     | —        | superseded by **BE-17**        | endpoint           |
| **BE-10** | `GET /api/v1/leaderboard?batch=`                               | P3       | post-launch                    | endpoint           |
| **BE-11** | `POST /api/v1/daily/claim` (reward + streak)                   | P3       | post-launch                    | endpoint           |
| **BE-12** | Seed the 54 scenario rows (C1–C9 × HARD/PRO × slots 01–03)     | P1       | every building being *real*    | content            |
| **BE-13** | Add level **`PRO`** (`ageBand 35-50`) + nine `BADGE-C{n}-PRO`  | **P0**   | Level B entirely               | registry           |
| **BE-14** | `coinsByProficiency` → `{1:5, 2:15, 3:25}`                     | **P0**   | the reward design              | content pack       |
| **BE-15** | `PUT/GET /api/v1/city/state` — track, FTUE, last tile          | **P0**   | track persistence              | endpoint + table   |
| **BE-16** | `PUT/GET/POST /api/v1/city/buildings/{id}/state` + beacon path | **P0**   | the season surviving the door  | endpoint + table   |
| **BE-17** | `POST /api/v1/ai/followup` (+ `/{id}/commit`) — the transfer beat | **P0** | ADR-006 §7                    | endpoint + table   |
| **BE-18** | Extended `trace` submit + the `aiBeat` rubric block            | **P0**   | three-beat scoring             | scoring            |
| **BE-19** | `POST /api/v1/telemetry/mission`                               | P3       | nothing                        | endpoint           |
| **BE-20** | Un-stale `api/openapi.yaml` — `DECISION_TREE`, `trace`, the scenario levels, all of the above | P1 | type-safe drift detection | contract |
| **BE-21** | Registry validator: accept a partially-populated level (default) vs `-strict` at launch | **P0** | **BE-12 — seeding anything at all** | tooling |

> **⚠ Two blockers sit in front of the P0 work.** The registry validator rejects a partially-populated level, and the scenario activity ids collide with already-seeded content that has user progress against it. See [PRD_Backend_Missions §6.4–6.5](PRD_Backend_Missions.md) and [ADR-005 §10.6.1](ADR-005_Interior_Framework.md). The second one needs KK, not an engineer.

### 21.2 Epic A — Economy surface (the critical path; blocks F2)

> The v1 PRD assumed these were "already live." They are **not**: there are no
> wallet/shop/inventory/avatar routes, `SubmitResponse` has no coin fields, and
> `AcademyUser` has no coin column. This epic is net-new tables + services.

**BE-1 · Coin economy — earn on submit + wallet reads.** _(P0, blocks F2)_

- **Why:** the whole gamification loop (§9) needs a server-authoritative coin balance; the client only renders `coinsEarned`/`coinBalance`.
- **Proposed contract:**
  - Extend `SubmitResponse` (§8.2) with `coinsEarned: int`, `coinBalance: int`.
  - `GET /api/v1/wallet` → `{ "balance": 120, "currency": "coins" }`.
  - `GET /api/v1/wallet/transactions` → `{ "transactions": [{ "id","delta","reason","activityId?","createdAt" }] }`.
- **Acceptance:** coins are credited **once** per pass (idempotent on re-submit, mirroring the badge idempotency in `UserBadge`); balance is monotonic and matches the sum of the ledger; award amount derived server-side from proficiency/passCriteria (client never proposes it).
- **Reuse:** the award-on-completion path already exists for badges — add a coin ledger table + a credit step in the same transaction.

**BE-2 · `GET /api/v1/me` bootstrap + starter grants.** _(P0, blocks F2; useful at F0)_

- **Why:** the intended first authed call (§10) — HUD bootstrap and the "arrive already owning a character" FTUE (§5.2). Until it lands, the client bootstraps on `/registry/modules` (F0 seam).
- **Proposed contract:** `GET /api/v1/me` → `{ "user": { "id","displayName","email","role" }, "wallet": { "balance" }, "avatar": { equipped slots }, "flags": { "starterGranted": true } }`.
- **Acceptance:** **idempotent starter grants** — first-ever call grants starter coins + free cosmetics + default avatar exactly once; subsequent calls are pure reads; safe to call on every refocus.
- **Reuse:** identity already resolved by `auth.Middleware` (auto-provision); this composes user + wallet (BE-1) + avatar (BE-4).

**BE-3 · Shop.** _(P0, blocks F2)_

- **Why:** the Shop building (§9.2).
- **Proposed contract:**
  - `GET /api/v1/shop/items` → `{ "items": [{ "id","slot","name","priceCoins","iconAsset","owned":bool,"affordable":bool,"locked":bool,"requiredBadgeId?" }] }`.
  - `POST /api/v1/shop/purchase` `{ "itemId" }` → `{ "purchased":bool,"alreadyOwned":bool,"coinBalance","item":{…} }`; errors `INSUFFICIENT_FUNDS` / `ITEM_LOCKED` / `NOT_OWNED` in the standard envelope (§8.3, BE-6).
- **Acceptance:** purchase is atomic (debit + grant ownership in one tx); `alreadyOwned:true` is a success (no error, §9.2); `locked` items reflect a badge requirement; server is the sole authority on price/affordability.
- **Reuse:** a `ShopItem` catalog table (seeded from a pack like the registry) + a `UserOwnedItem` table.

**BE-4 · Inventory + avatar (4 slots: SKIN, HAT, BACKGROUND, PET).** _(P0, blocks F2)_

- **Why:** character customization (§9.3) and the in-world sprite/HUD portrait.
- **Proposed contract:**
  - `GET /api/v1/inventory` → `{ "items": [{ "id","slot","name","iconAsset","worldAsset" }] }` (owned only).
  - `GET /api/v1/avatar` → `{ "equipped": { "SKIN":id|null,"HAT":…,"BACKGROUND":…,"PET":… } }`.
  - `PUT /api/v1/avatar/equip` `{ "slot","itemId" }` · `PUT /api/v1/avatar/unequip` `{ "slot" }` → the updated equipped set.
- **Acceptance:** can only equip owned items in the matching slot (`NOT_OWNED` otherwise); equipped set is what `/me` returns and drives §14.3; unequip is valid for all slots.
- **Reuse:** shares the `UserOwnedItem` table with BE-3; `AcademyUser` gains an equipped-avatar relation.

### 21.3 Epic B — Contract hygiene (do alongside Epic A; hardens F1)

**BE-5 · Un-stale `api/openapi.yaml`.** _(P1)_

- **Why:** it's **v0.2.0 and behind the handler** — missing `/badges`, `/profile`, `/hub/summary`, the structured error envelope, and (after BE-1) the submit coin fields. The frontend generates its types from this file (§12.4), so staleness = silent drift.
- **Acceptance:** openapi matches the deployed handler 1:1 (all live routes + all Epic-A additions), version bumped; a CI check fails if a handler route is undocumented.

**BE-6 · Standardize the error envelope.** _(P1)_

- **Why:** the F0 audit found the **live service returns structured** `{"error":{"code":"UNAUTHENTICATED","message":"Missing or malformed token"}}`, while the local handler source returns **flat** `{"error":"message"}`. The client normalizes both, but the backend should be consistent.
- **Acceptance:** every error response is `{"error":{code,message,redirectUrl?}}` with a documented `code` vocabulary; 401s carry an auth code (client treats any 401 as re-auth regardless, §8.3); the `graded:"fallback"` and economy error codes (`INSUFFICIENT_FUNDS`/`ITEM_LOCKED`/`NOT_OWNED`) are documented.

**BE-7 · Tighten CORS.** _(P1, launch-checklist)_

- **Why:** `CORS_ALLOWED_ORIGINS` is effectively `*` on the live service.
- **Acceptance:** allow-list = the deployed hosting origin(s) + localhost dev ports; verified from the browser at first deployed build (§13).

### 21.4 Epic C — Session, content & AI (non-blocking; F4 and beyond)

**BE-8 · `PUT/GET /api/v1/city/state`.** _(P2)_ — opaque per-user blob for player position / last district / FTUE flags. Client uses a local `IndexedDB` fallback until this lands (§11.2). Acceptance: last-write-wins, per-user, size-bounded.

**BE-9 · `POST /api/v1/ai/dialogue`.** _(P2)_ — NPC lines + DEFEND_PITCH persona turns. Request: `{ "personaId","context","history[]" }` → `{ "line","choices?[]" }`. **Mandatory server-side fallback** to scripted lines when the model is unavailable (mirror the existing grader fallback). Recommended model: **Claude Haiku 4.5** runtime / **Opus 4.8** authoring, but provider-agnostic to the client. Acceptance: never 5xx on model outage (falls back); no answer-key leakage; scoring stays in the existing submit path (this endpoint is dialogue only).

**BE-10 · `GET /api/v1/leaderboard?batch=`.** _(P3)_ — cohort boards; backend already has batch codes mirrored from WarRoom.

**BE-11 · `POST /api/v1/daily/claim`.** _(P3)_ — daily reward + streak; partial streak logic reportedly exists server-side.

**BE-12 · Seed content beyond C4-BEGINNER.** _(P1)_ — only **C4-BEGINNER** is seeded today, so most venues have nothing real to host. Not a code change but a **content/registry** dependency: F1 binds the Ice Cream Cart to real `C4-BEG-*`/`C9-BEG-*` ids; F3 needs enough seeded activities across competencies for all 11 venues' `hostedActivities` to resolve. Track seeding cadence against the venue roadmap.

# PRD — MAISON · an elite premium fashion label

> **This document supersedes `docs/maison.md`, now deleted.** That file's §0 (repo reality) and §19 (implementation log, standing debts) are folded into §0 and §19 here; its §1–§18 were already this document. There is one MAISON PRD from v2.0 onwards.

_The City · Building 03 · Market Street · **v2.0** · 2026-08-04 · **Status: Built (P0–P6, M0–M6, R1–R4); missions and the transfer beat outstanding** · Owner: TBD (one dev, per CODEOWNERS)_

_Inherits [ADR-005 v2.0 — Interior Framework](ADR-005_Interior_Framework.md) for the interior pattern, the silent-tier contract, accessibility and budgets, and [ADR-006](ADR-006_Missions_AI_Followups_and_Session_State.md) for the mission spine, the three-beat decision and session state. Backend endpoints: [PRD_Backend_Missions.md](PRD_Backend_Missions.md); §19.4 below carries MAISON's payloads. Read those first._
_Parent: [PRD_City_Frontend.md](PRD_City_Frontend.md) · Siblings: [Café](PRD_Building_Cafe.md) · [MERIDIAN](PRD_Building_MERIDIAN.md) · City venue id: `fashion_brand`_
_Content source: `Playroom Scenarios.xlsx` → sheet **`Fashion Retailer`**._

---

## 0. Repo reality — the most-built building in the city

### 0.1 What ships

MAISON is further along than anything else. `src/buildings/fashion_brand/` is **~35 modules and 311 passing tests**, walkable from Market Street.

| Shipped | Where |
|---|---|
| Two levels, five zones, nine stations; a **ramp** as the default guided route, with step parity proved by sealing the steps and walking the room | [`room.ts`](../src/buildings/fashion_brand/room.ts) |
| Props, scene composition, the canvas — the room on screen, procedurally drawn and baked | [`props.ts`](../src/buildings/fashion_brand/props.ts), [`scene.ts`](../src/buildings/fashion_brand/scene.ts), [`MaisonCanvas.tsx`](../src/buildings/fashion_brand/MaisonCanvas.tsx) |
| **All ten §12 world keys visible in the room** — the rail, the atelier's mood, the press wall, the cash | [`dressing.ts`](../src/buildings/fashion_brand/dressing.ts), [`world.ts`](../src/buildings/fashion_brand/world.ts) |
| Ten keys, a pure reducer, the rail state machine, and `describeRail()` / `describeAtelier()` / `describePress()` / `describeCash()` — **the rail is fully legible without sight** | `world.ts` |
| The season: nine beats × two tracks, the countdown, the eighteen-way registry fetch | [`season.ts`](../src/buildings/fashion_brand/season.ts), [`beats.ts`](../src/buildings/fashion_brand/beats.ts), [`MaisonPanel.tsx`](../src/buildings/fashion_brand/MaisonPanel.tsx) |
| **All eighteen trees, 162 leaves** | [`trees/`](../src/buildings/fashion_brand/trees) |
| The cast — seven, the on-screen cap, Élise's gaze, hosts standing *beside* their beat's station | [`cast.ts`](../src/buildings/fashion_brand/cast.ts) |
| Guided navigation as real `<button>`s in a `<nav>`, converged with the Café | [`guide.ts`](../src/buildings/fashion_brand/guide.ts) |
| The lookbook — the one place a tier appears, unlocked at nine decided beats | [`Lookbook.tsx`](../src/buildings/fashion_brand/Lookbook.tsx) |
| A dev registry fixture so the season is walkable offline, verified absent from the production bundle | [`devFixture.ts`](../src/buildings/fashion_brand/devFixture.ts) |
| The season persisted like `eggStore` | [`maisonStore.ts`](../src/buildings/fashion_brand/maisonStore.ts) |


### 0.2 What v2.0 adds

| § | Change |
|---|---|
| **§8** | Rewritten as **nine missions with objective chains** ([ADR-006 §6](ADR-006_Missions_AI_Followups_and_Session_State.md)). MAISON already has "one beat live at a time" in `beats.ts`; this is that idea made visible and given objectives |
| **§9.6** | **The mentor consultation is re-resolved.** Three beats gives three consultation opportunities, which restores the blueprint's literal *"all 3 times = Advanced"*. The v1.0 compromise is withdrawn |
| **§9.7** | New — the AI transfer beat: persona cards, generation context, the 18-entry fallback bank |
| **§10.2** | The `aiBeat` rubric block. **Terminals unchanged** |
| **§19** | The implementation log, the standing debts, and MAISON's backend contract |

### 0.3 The architectural deviation, and how it resolved

v1.0 was authored against an **R3F first-person engine that never existed**. The superseded `docs/maison.md` §0.3 recorded one deviation: *"the rail cannot be seen, so it is read"* — only `describeRail()`'s verbal half was buildable.

**That resolved better than expected.** The interior framework landed as a **2.5D isometric Pixi sub-scene** ([ADR-005 v2.0 §5](ADR-005_Interior_Framework.md)) with the Café as its first tenant, MAISON was re-cut against it, and the 3D rail now renders **from the same state** `describeRail()` reads. §18.3's snapshot test that keeps the DOM list and the rendered rail in sync has both its halves. The deviation is closed.

### 0.4 The registry blocker

MAISON's eighteen ids are still not seeded in the live registry, so the season shows every beat as *not yet open* against a real backend. This is [PRD_Backend_Missions §6.4](PRD_Backend_Missions.md) (BE-12) and it blocks MAISON being *real*, not MAISON being *reviewable* — the dev fixture covers the latter.

Two questions v1.0 flagged as unverified are now settled: the Level B code is **`SCB`** (BE-13, and *not* `PRO` — see [ADR-005 §10.6.1](ADR-005_Interior_Framework.md)), and the client submits **fully-qualified** trace segments (`"C2-SCA-03.a.b"`), not bare choice keys.

### 0.5 Where the tier maps live

§10.2 is **an authoring record for the backend registry, not client data.** Nothing under `src/` imports it, and nothing may. Reviewers: **a tier map appearing in `src/` is a blocking defect** — it is the answer key. This now extends to the transfer beat: the generated options' tiers live in the server's `ai_followups` row and are never sent to a client at all.

---

## 1. TL;DR

The door is heavy and it does not have a bell. Inside, the boutique is cool and mostly empty — four metres of polished floor, a single rail under one hard light, and a staircase at the back where you can see the atelier: eight people, north light, the sound of a machine running and stopping.

You run MAISON. Small team, one boutique, a following that is growing faster than your bank balance, and a collection to get out in eleven weeks. The brand is built on three things — reputation, scarcity, and the fact that the clothes are genuinely well made — and every single one of them can be spent, once, for cash.

Over one season you will decide what to make, what to charge, who to sell through, and what your name is worth. Nobody grades you. **The rail tells you what you decided.** The press wall tells you what happened. By the show, you are standing in a house that is the sum of nine choices, and it is either the house you meant to build or it is one you traded away in instalments.

**The fantasy in one line:** *your name is the product, and every deal spends a little of it.*

**Why MAISON.** It is the building where the abstract idea of "value" becomes a physical object you can walk up to. A bank's reputation is a spreadsheet; a fashion house's reputation is a garment on a rail with a price tag on it. That makes MAISON the clearest venue in the city for C8 (Value Creation) and C5 (Strategic Thinking) — the two competencies that are hardest to make concrete anywhere else.

---

## 2. Scope

### In scope

- One 2.5D isometric interior across two connected levels: a boutique floor and a raised atelier, open to each other by sightline. **Shipped** (§0.1).
- Seven named NPCs plus an ambient atelier and boutique loop.
- Nine competency decision trees × two tracks = **18 trees, 162 authored leaves**.
- A ten-key world-state model whose primary expression is a single garment rail.
- **Nine missions**, strictly ordered, each with an objective chain (§8).
- The **mentor consultation** mechanic for C2 (§9.6) — now three opportunities, matching the blueprint literally.
- **18 scripted fallback transfer beats** (§9.7.4).
- Session state synced to the backend during play and flushed on exit (§19.4).
- Registry content for `C1-SCA-03 … C9-SCA-03` and `C1-SCB-03 … C9-SCB-03`.
- The end-of-journey report as the season lookbook.

### Out of scope

- Any shared framework change (ADR-005 §8.4). Gaps go to the maintainer.
- Any backend endpoint beyond BE-13/BE-14.
- A design minigame. You do not pick fabrics on a grid or drag hems. The interactions are: walk, look, talk, decide.
- A 3D player avatar. See §3.4 and §18.5 — the mirror shows the collection, not you; the lookbook carries your portrait using the existing 2D composition.
- The runway show itself. It happens between C8 and C9, off-screen, which is the correct amount of restraint.

---

## 3. The world

### 3.1 The space

Two levels, one volume. The boutique is at street level; the atelier sits on a **0.9 m raised platform** at the back, reached by four broad steps *and a ramp* (the ramp is not only accessibility housekeeping — it is how rails get wheeled between the two, so it earns its place in the fiction as well as in §15).

Boutique **11.2 m × 8.0 m**; atelier platform **11.2 m × 6.4 m**; ceiling 4.6 m throughout, which is the single most important number in the room. MAISON is tall. The café was small enough that you could not escape anything; MAISON is big enough that you can stand a long way from a problem and still see it, which is a different and more expensive kind of pressure.

```
                                                            north light ↑↑↑
   ┌──────────────────────────────────────────────────────────────────────┐
   │   ATELIER  (raised 0.9 m)                                            │ NE
   │   ┌──────────┐   ┌──────────┐   ┌───────────┐    ┌────────────────┐  │
   │   │ cutting  │   │ machines │   │  ÉLISE'S  │    │  dress forms   │  │
   │   │  table   │   │  ×3      │   │   bench   │    │   ×4           │  │
   │   └──────────┘   └──────────┘   └───────────┘    └────────────────┘  │
   │   ▒▒▒▒▒▒▒▒▒▒▒▒▒▒ BALUSTRADE ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  [ steps ] [ ramp ]   │
   ├──────────────────────────────────────────────────────────────────────┤
   │  ╔═══════════════╗                                                   │
   │  ║  PRESS WALL   ║   BOUTIQUE                    ┌──────────────┐    │
   │  ║  (stair run)  ║                               │   FITTING    │    │
   │  ╚═══════════════╝            ┏━━━━━━━━━┓        │   ALCOVE     │    │
   │                               ┃  THE    ┃        │  + MIRROR    │    │
   │      ┌────────┐               ┃  RAIL   ┃        └──────────────┘    │
   │      │ desk / │               ┗━━━━━━━━━┛                            │
   │      │lookbook│                  ▲ key light                         │
   │      └────────┘                                                      │
   │  ░░░░░░░░░░ shopfront glass ░░░░░░░░░░░░░░░░░░░░░░░  [ DOOR ]        │ SW
   └──────────────────────────────────────────────────────────────────────┘
                        ← Market Street →
```

**Zones**

| id | name | Feel |
|---|---|---|
| `z_boutique` | *the floor* | Cool, quiet, under-furnished on purpose. Sound carries. This is where money is discussed. |
| `z_rail` | *the rail* | The one pool of hard light in the building. You stand in it to look at what you have made. |
| `z_atelier` | *the atelier* | Warmer, north-lit, cluttered, loud with machines. The only room in MAISON that is actually working. |
| `z_fitting` | *the fitting alcove* | Enclosed, softly lit, mirrored. Private the way the Café's pass-through is private. |
| `z_stair` | *the stair* | The press wall runs along it. A transitional space you pass through six times a session and read a little more of each time. |

### 3.2 Circulation and sightlines

You spawn **at the desk in the boutique**, facing the rail with the atelier behind it and above it. In one frame you see: your product, your team, and the light they work in. That is the whole company in one shot, and it is the reason the atelier is raised rather than hidden.

Three sightlines that do work:

1. **Boutique → atelier.** You can always see the people making the thing you are about to make a promise about. When you agree terms with a buyer on the floor, Élise is in your peripheral vision. That is not decoration; it is the C6 and C7 decisions arriving with a witness.
2. **The rail → the shopfront glass.** The rail sits between you and the street. Anything on it is visible from outside, which is why the collab piece landing on it in C5 is a public act.
3. **The stair.** Every trip between floors walks you past the press wall. The building's memory is on the route you take most.

### 3.3 The unforgettable thing — THE RAIL

A single garment rail, centre of the boutique floor, under the only hard light in the building. It holds the season.

It changes. Not subtly:

| World state | What is on the rail |
|---|---|
| `bold` | Eight pieces, all vermilion — the house signature, the thing the press calls you |
| `mixed` | Vermilion and neutrals hanging together; the neutrals outnumber the vermilion by the end of the week |
| `neutral` | Two vermilion pieces left as accents; the rest is bone, ash, sand |
| `capsule` | A second, shorter rail wheeled alongside — the entry line, visibly cheaper hangers |
| `collab` | One garment on the rail carries a second label. It is not badly made. It is just not yours. |
| `thin` | Four pieces. You could not fund the rest. |

The price tags change with `price_tags`. The label on the neck changes with `house_mark`. A player can walk up, look at the rail, and read their entire season off it in five seconds without a single word of UI.

**Why this works for the silent-tier contract:** the rail never says *good* or *bad*. A rail of neutrals is not a failure — it might be the best decision you made. A rail with a collab piece on it is not a sin — it might be what kept the lights on. The rail reports; the learner judges. That is exactly the shape ADR-005 §11 asks for, rendered in geometry.

### 3.4 The mirror and the lookbook

**The mirror** is full-height, in the fitting alcove. It shows a **dress form wearing the rail's current hero piece** — not the player. It is a fitting mirror, and its job is to let you look at the collection at body scale rather than on a hanger. Technically it is a mirrored duplicate mesh, not a real reflection (ADR-005 §15 forbids the render targets a true planar reflection would cost).

**The lookbook** on the desk is where *you* appear. It is the season's press material, and its cover plate carries the player's character portrait — the existing 2D composition from the HUD avatar chip (master PRD §14.3), framed as a designer's headshot. This is the one place in the whole city where a player sees the character they built presented as a person rather than a sprite, and it costs nothing because the composition already exists.

**Deliberately not built:** a 3D player avatar. It would ripple into the shop, the cosmetics pipeline and every other interior. §18.5 records this as an open decision with a recommendation to defer.

### 3.5 The clock

MAISON runs on one collection and counts down to the show. The countdown is physically present: a number chalked on the atelier's steel column, changed by Élise between beats.

| Beat | Competency | Countdown | The room |
|---|---|---|---|
| 1 | C1 · Problem Sensing | **11 weeks** | Full team, calm, samples everywhere |
| 2 | C2 · Learning Agility | **9 weeks** | First sell-through numbers are in from the pre-season drop |
| 3 | C3 · Courage to Commit | **8 weeks** | The production slot closes Friday. Everyone knows. |
| 4 | C4 · Financial Discipline | **7 weeks** | Fabric invoice on the desk. Dov is in the boutique, patiently. |
| 5 | C5 · Strategic Thinking | **5 weeks** | Rio's offer, and enough money in it to fund two seasons |
| 6 | C6 · Power & Influence | **4 weeks** | Hélène on the floor with a number and a deadline |
| 7 | C7 · People Management | **2 weeks** | Atelier lights on past ten. Élise has been here since six. |
| 8 | C8 · Value Creation | **1 week** | The drop is Thursday. There is a shortcut available. |
| 9 | C9 · Perseverance | **after** | The show happened. The reviews are on the press wall. |

The countdown does the pressure work so the UI does not have to. Nothing is ever on a real timer — the number on the column is fiction, and fiction is enough.

---

## 4. Art direction

**One line:** *expensive, cold, and one degree away from beautiful* — a room that is trying very hard, which is the truest thing about a small luxury house.

| Element | Direction |
|---|---|
| **Palette** | Bone, ash, raw plaster, pale oak, brushed brass, black steel. **One saturated colour: vermilion**, and it appears only on the rail. When the rail goes neutral, the entire building loses its only warm hue — which is the emotional content of the C2 decision, delivered without a word. 16 colours total. |
| **Contrast** | High and deliberate. The boutique is under-lit; the rail is over-lit; the atelier is flat north light. Three distinct lighting characters in one volume. |
| **Materials** | Matte plaster and linen everywhere. Specular budget spent on exactly three things: the mirror, the brass rail, and the shopfront glass. |
| **Texture** | The boutique is immaculate — no wear at all, which is its own kind of tell. The atelier is the opposite: chalk marks on the cutting table, thread on the floor, tape on the machines. The wear budget lives entirely upstairs. |
| **Key light** | A hard narrow directional over the rail (implemented as a tight directional + emissive card; no spot lights — ADR-005 §15). North light through tall atelier windows: soft, cool, unglamorous, and the only honest light in the building. |
| **Silhouette** | Low-poly and severe. Straight lines, no chamfers on architecture. The garments get the polygon budget: cloth silhouettes read at a distance and they are the product. |
| **Negative space** | Extreme in the boutique. Four metres of empty polished floor between the door and the rail. Luxury retail is the art of not filling a room, and it also happens to be excellent for a walking camera. |

**Candidate CC0 sources** (license audit required before use — ADR-005 §16.1):

| Need | Candidate | License |
|---|---|---|
| Architecture, stair, balustrade, glass | Kenney *Retro Urban Kit*, *Modular Buildings* | CC0 (verify) |
| Desks, benches, stools, shelving | Kenney *Furniture Kit* | CC0 (verify) |
| Characters | `src/world/characterArt.ts` — baked procedurally, four facings | n/a (ours) |
| **Garments, dress forms, the rail** | **Bespoke** — one artist, one batch, against the style sheet | n/a |
| Sewing machines, cutting table, bolts of cloth | Bespoke kitbash from kit parts | n/a |

MAISON needs more bespoke art than the Café because free asset packs contain approximately no clothing. **This is the building's largest risk** and §18.4 addresses it: the garment set is eight silhouettes × four colourways, built once, reused for every state of the rail.

---

## 5. The cast

Seven named. **Never more than five on screen** (ADR-005 §15). The atelier's ambient workers are the swing capacity — they thin out when a named character is downstairs.

### 5.1 Élise Moreau — head of atelier

- **Who.** 54. Thirty-one years of hands. She was cutting for other people's houses before yours existed and she chose to come here, which she has never mentioned and never will. Exacting, dry, and completely without ego about anything except a seam.
- **Look.** Grey shirt, sleeves rolled, tape measure that is never not around her neck, reading glasses pushed up. Reads instantly from the boutique floor because she is the only person in the building who stands still.
- **Anchor.** Her bench, `z_atelier`. Patrol: bench → cutting table → dress forms → bench.
- **Animation.** `work` (pinning, default), `fold`, `lean`, `talk`, `listen`.
- **Voice.** Few words, all load-bearing. She states facts about cloth and lets you extract the implication. *"This one's been unpicked twice. That's not a fabric problem."*
- **Carries.** C2 (she is the one who noticed the neutrals moving before the numbers did), C7 Level A (the exhaustion), and the countdown on the column.
- **Gaze.** `player_near`. She looks up, holds it a beat longer than is comfortable, then goes back to work. That single behaviour does more characterisation than any line she has.

### 5.2 Kwabena "Kobby" Asare — junior designer

- **Who.** 26. Prolific, fast, generous, and the reason three other people in the atelier have stopped putting ideas forward — because you keep choosing his, and you have not noticed that you keep choosing his.
- **Look.** Whatever he made last week, worn as a test. The most colourful person in the room.
- **Anchor.** The cutting table. Patrol: cutting table → boutique rail → cutting table (he keeps going down to look at his own pieces on the rail, which is both endearing and the C7 problem).
- **Animation.** `work`, `talk_emphatic`, `gesture`, `walk`.
- **Voice.** Enthusiastic, quick, slightly too many words. Genuinely kind. *"Can I show you one thing? One thing, then I'll leave you alone."*
- **Carries.** C7 Level B (the favouritism you have not seen).

### 5.3 Véra Lindqvist — the mentor

- **Who.** 60s. Ran a bigger house than yours for eighteen years, left before it ate her, now advises three labels including this one. She never tells you what to do. She asks you what the number means.
- **Look.** Impeccable, undramatic, entirely at ease. Sits when everyone else stands.
- **Anchor.** The boutique desk, `z_boutique`, when present. She is **not in the building by default** — she appears at C2 and can be reached at other beats through the desk phone, which is how the consultation mechanic (§9.6) is rendered without adding a character to every scene.
- **Animation.** `sit_talk`, `sit_listen`, `stand_look_rail`.
- **Voice.** Slow, exact, ends on questions. *"Three times faster than what? Than the bold, or than last season's bold?"*
- **Carries.** C2 in both tracks, and the consultation path.

### 5.4 Ines Vidal — the stylist

- **Who.** 30s. Dresses six clients who matter and knows what forty others are saying. In and out of the building constantly, always mid-call, always with a name you should recognise.
- **Look.** Coat, phone, sunglasses pushed into hair. Never puts the bag down, which reads as "not staying" at a glance.
- **Anchor.** The boutique floor near the door. Never goes upstairs.
- **Animation.** `stand_phone`, `talk_fast`, `gesture_rail`, `walk_out`.
- **Voice.** Fast, warm, transactional-but-not-cynical. Relays other people's opinions as facts, which is a specific and useful unreliability. *"Three of mine asked me the same thing this week. That's not nothing."*
- **Carries.** C1.

### 5.5 Hélène Barthes — the buyer

- **Who.** Department-store buyer. Decisive, unhurried, entirely comfortable telling you no. She holds the 48 hours and she will not extend them, not out of cruelty but because her own calendar is not hers either.
- **Look.** The most expensively dressed person in the building, and none of it is yours. Cool palette, one stop cooler than the room.
- **Anchor.** The rail — she talks to you standing at the rail, touching the garments, which is a quiet dominance move and reads even at this camera distance because the rail is the one place the eye already is.
- **Animation.** `stand_inspect`, `talk`, `touch_garment`, `check_watch`.
- **Voice.** Precise, courteous, never raises pressure — the pressure is structural, not personal. *"Friday. I'm not being difficult; Friday is when my slot closes too."*
- **Carries.** C3 and C6.

### 5.6 Dov Kessler — the investor

- **Who.** Patient money. Genuinely likes the clothes. Wants a percentage and is not in any hurry, which is the most effective form of pressure there is.
- **Look.** Understated, comfortable, sits down uninvited and it does not feel rude.
- **Anchor.** The boutique desk. Sits.
- **Animation.** `sit_talk`, `sit_listen`, `stand_look_rail`.
- **Voice.** Warm, unhurried, uses "we" early. *"You'll need this money in about six weeks. I'd rather we did it now, when you're negotiating from a good month."*
- **Carries.** C4.

### 5.7 Rio Santoro — the offer

- **Who.** Brokers collaborations and content. Represents a fast-fashion group in C5 and an audience deal in C8. Completely honest about being transactional, which makes him harder to dismiss than a villain would be.
- **Look.** Expensive-casual, phone out, moves around the room while talking rather than standing still.
- **Anchor.** Roams `z_boutique`. Never sits.
- **Animation.** `walk_talk`, `gesture`, `show_phone`, `lean_rail`.
- **Voice.** Fluent, friendly, closes without seeming to. *"Two seasons of runway. That's what this is. I'm not going to pretend it's anything else."*
- **Carries.** C5 and C8.

### 5.8 Ambient

Three atelier workers (sewing, pinning, pressing) on a shared loop, and one boutique client on a slower loop (enters, looks at the rail, leaves — buying nothing, most times, which is accurate). None of them speak lines the player must read.

---

## 6. Ambient life

| Beat | Interval | Notes |
|---|---|---|
| Sewing machine run-and-stop | 6–14 s | Positional, from the atelier. **The building's heartbeat.** When it stops entirely, something is wrong and the player feels it before they know it. |
| Steam press hiss | 25–50 s | Atelier |
| Scissors on the cutting table | 20–45 s | Atelier |
| Hangers sliding on the rail | 30–70 s | Boutique — someone rearranging the collection |
| Boutique door (heavy, no bell) | 60–120 s | A dull thud, not a chime. Deliberately unwelcoming. |
| Street bleed through glass | continuous | Crossfaded from Market Street, heavily muffled — MAISON is more insulated than the Café, both acoustically and otherwise |
| Élise sets down her glasses | 90–180 s | The single most-used idle variation; it is how you know she is about to say something |
| Traffic light through the shopfront | 40–90 s | A slow warm sweep across the polished floor from a passing vehicle |

**Density is bound to `atelier_mood`.** `strained` → machines run longer and stop harder, no conversation between workers. `fractured` → two of the three machines are silent. `trusting` → someone is humming. The room's mood is carried by *how much noise the work makes*, which is both cheap and completely legible.

**Reduced motion / low-spec:** ambient workers become stationary and the machine cadence halves; the machine sound stays, because it is informational.

**Audio.** Room tone (large, hard, reverberant — the opposite of the Café's boxiness), the atelier's machines, muffled street. **No music bed.** MAISON is a room where music would be a choice the owner made, and the silence is more expensive-sounding than anything we could source.

---

## 7. Player presence

- **Spawn:** at the boutique desk, facing the rail with the atelier above and beyond it. Every visit starts here (`resetRoomState()`).
- **Movement:** click-to-move over the walkable grid, plus WASD/arrows. Walking pace. The ramp and the steps both work; **the ramp is the default guided route, and step parity is proved by sealing the steps and walking the room** — no content is behind the stairs.
- **Interactables:** the rail (`railContents()` — a close look at the collection with the price tags and neck labels readable), the mirror, the lookbook on the desk, the press wall, the countdown column, the desk phone (§9.6), and **each NPC** — all of them hotspots the mouse can touch, which they were not until R4.
- **Prompts:** DOM, anchored to the prop. The rail's is *"look at the collection"*. The phone's is *"call Véra"*. **No station the guide offers is a dead end** — the stair reads the press wall, because §3.2 makes the wall the thing you pass on every trip between floors.
- **Guided navigation:** real `<button>`s in a labelled `<nav>` — *the desk · the rail · the fitting alcove · the press wall · the stair · the cutting table · Élise's bench*, plus NPCs by name and role. **The first entry is wherever the season is waiting**, named by whoever is holding it. `Tab` is the browser's; `E` is the room's; `Enter` belongs to whatever has focus.
- **The mission tracker** sits top-left (§8, §11.1). The countdown stays on the column.
- **A panel over the room freezes the room**, so a click meant for a panel never also walks you.
- **Exit:** the shopfront door. Always available; flushes the season on the way out (§19.4).

---

## 8. The mission spine

> **v2.0.** v1.0's nine staged beats become nine **missions** ([ADR-006 §6](ADR-006_Missions_AI_Followups_and_Session_State.md)). MAISON already had the hard half of this — `nextBeat()` / `liveBeatAt()` in `beats.ts` make exactly one beat live and put it at its station. What is added is **visibility** (the top-left tracker) and **objectives** (things to go and do before the question arrives). The staging column below survives verbatim as each mission's `staging` line.

### 8.1 The season

Nine missions, strictly ordered, counting down to the show. The countdown is fiction — nothing here is ever on a real timer (§3.5).

| # | Countdown | Comp | Title | Station | Host | The room |
|---|---|---|---|---|---|---|
| 1 | 11 weeks | **C1** Problem Sensing | Three of Mine Asked | `st_rail` | **Ines** | mid-call at the rail |
| 2 | 9 weeks | **C2** Learning Agility | Three Times Faster | `st_bench` | **Élise** (+ Véra) | a printed sheet on your side of her bench |
| 3 | 8 weeks | **C3** Courage to Commit | Friday | `st_rail` | **Hélène** | touching the fabric, checking her watch once |
| 4 | 7 weeks | **C4** Financial Discipline | The Invoice | `st_desk` | **Dov** | seated, patient, about to be patient some more |
| 5 | 5 weeks | **C5** Strategic Thinking | Two Seasons | `st_boutique_floor` | **Rio** | walking, so the rail is behind him the whole time |
| 6 | 4 weeks | **C6** Power & Influence | The Favour | `st_rail` | **Hélène** | back, same spot, a number framed as a kindness |
| 7 | 2 weeks | **C7** People Management | Past Ten | `st_atelier` | **Élise** / **Kobby** | two machines running, one seam unpicked twice |
| 8 | 1 week | **C8** Value Creation | The Shortcut | `st_desk` | **Rio** | the drop is Thursday |
| 9 | after | **C9** Perseverance | The Wall | `st_press_wall` | **the wall** | two clippings. one polite. one not |

**Élise is the anchor NPC** ([ADR-006 §9](ADR-006_Missions_AI_Followups_and_Session_State.md) step 3) and must be present in every world state — she is the atelier, and an atelier without its head is not a room MAISON can render. This is an acceptance criterion.

**Pacing.** Between missions: the countdown number changes on the steel column, the rail updates, one press-wall frame may fill, and the atelier's noise level shifts. The player is free to move; the next mission's first objective is simply available. Nothing is on a timer.

### 8.2 The objective chains

Each mission ends with the three `decide` beats — `seed`, `follow`, `transfer` — and begins with something to do. **MAISON's signature objective is `inspect st_rail`**: the rail is the building's primary readout, and four of the nine missions make you go and count it before anyone asks you anything.

---

**Mission 1 · C1 · "Three of Mine Asked"** · 11 weeks · host **Ines**

| # | Kind | Target | Tracker line | Cue |
|---|---|---|---|---|
| 1 | `inspect` | `st_rail` | *look at the collection* | The rail, its prices, its neck labels — `railContents()` |
| 2 | `wait_for` | `ines` | *Ines is on a call* | She finishes it rather than cutting it short |
| 3 | `talk_to` | `ines` | *hear what her clients said* | She means it helpfully. She is also repeating rather than reporting |
| 4–6 | `decide` | seed · follow · transfer | *decide* | |
| 7 | `report` | `elise` | *tell Élise what you're doing about it* | |

`closeWorldState`: `{ press: "quiet" }` · candidates: `[{ rail: "mixed" }, { rail: "signature" }, { cash: "tight" }]`

---

**Mission 2 · C2 · "Three Times Faster"** · 9 weeks · host **Élise** · **the mentor mission**

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `go_to` | `st_stair` | *go up* — you pass the press wall on every trip between floors (§3.2) |
| 2 | `inspect` | `st_bench` | *read the sheet* — the pre-season sell-through, on your side of her bench, not handed to you |
| 3 | `talk_to` | `elise` | *ask Élise what she makes of it* |
| 4–6 | `decide` | seed · follow · transfer | **Véra is one of the three options at each of the three beats** — §9.6 |
| 7 | `inspect` | `st_rail` | *look at the rail again* — with the number in your head this time |

`closeWorldState`: `{ atelier_mood: "steady" }` · candidates: `[{ rail: "neutral" }, { rail: "mixed" }, { rail: "signature" }]`

---

**Mission 3 · C3 · "Friday"** · 8 weeks · host **Hélène**

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `wait_for` | `helene` | *someone's at the rail* |
| 2 | `go_to` | `st_rail` | *go to her* |
| 3 | `talk_to` | `helene` | *hear both offers* |
| 4–6 | `decide` | seed · follow · transfer | |
| 7 | `report` | `elise` | *tell Élise about the production slot* — it is her slot |

---

**Mission 4 · C4 · "The Invoice"** · 7 weeks · host **Dov**

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `inspect` | `st_desk` | *the fabric invoice* — it has gone up |
| 2 | `talk_to` | `dov` | *hear what Dov is offering* |
| 3 | `inspect` | `st_rail` | *count what's already paid for* — `describeCash()` in the readout |
| 4–6 | `decide` | seed · follow · transfer | |
| 7 | `report` | `elise` | *tell Élise what the season can afford* |

---

**Mission 5 · C5 · "Two Seasons"** · 5 weeks · host **Rio**

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `wait_for` | `rio` | *someone's on the floor* |
| 2 | `talk_to` | `rio` | *walk with Rio* — he moves while he talks, so the rail is behind him the whole time |
| 3 | `inspect` | `st_fitting` | *see the season on a body* — the fitting alcove (§3.4) |
| 4–6 | `decide` | seed · follow · transfer | |
| 7 | `inspect` | `st_press_wall` | *look at what's been written about you so far* |

---

**Mission 6 · C6 · "The Favour"** · 4 weeks · host **Hélène**

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `wait_for` | `helene` | *she's back* — same spot at the rail |
| 2 | `inspect` | `st_rail` | *check your own numbers first* |
| 3 | `talk_to` | `helene` | *hear the number* — framed as a favour, delivered pleasantly, with Élise visible upstairs |
| 4–6 | `decide` | seed · follow · transfer | |
| 7 | `report` | `elise` | *go upstairs and say what you agreed* |

Objective 7 matters because objective 3 staged it: Élise was visible from the rail for the entire negotiation.

---

**Mission 7 · C7 · "Past Ten"** · 2 weeks · hosts **Élise** / **Kobby**

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `go_to` | `st_atelier` | *it's past ten and there's still noise up there* |
| 2 | `inspect` | `st_bench` | *the seam* — unpicked twice |
| 3 | `talk_to` | `elise` | *she's been in since six* |
| 4 | `go_to` | `st_rail` | *Kobby is downstairs, looking at his own piece* |
| 5–7 | `decide` | seed · follow · transfer | |
| 8 | `report` | `kobby` | *say something to Kobby* |

**Eight objectives, and it is the right number.** The mission physically walks you between the two people whose interests conflict, which is the competency.

**This mission is why Kobby must patrol** (§5.2, and a standing debt in §19.3). Objective 4 does not land if he is welded to the cutting table.

---

**Mission 8 · C8 · "The Shortcut"** · 1 week · host **Rio**

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `inspect` | `st_press_wall` | *what's been said so far* |
| 2 | `talk_to` | `rio` | *hear the shortcut* — it is cheap, it works, everyone has used it |
| 3 | `inspect` | `st_mirror` | *look at yourself for a second* — the mirror (§3.4), which until R3 was a prompt that did nothing |
| 4–6 | `decide` | seed · follow · transfer | |
| 7 | `report` | `elise` | *tell Élise* |

Objective 3 is the only ornamental objective in the city and it earns its place: MAISON's C8 is about who you are when nobody is watching, and the mirror is the room saying so without a line of dialogue.

---

**Mission 9 · C9 · "The Wall"** · after · **the wall**

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `go_to` | `st_press_wall` | *two clippings went up* |
| 2 | `inspect` | `st_press_wall` | *read both* — one polite, one not |
| 3 | `talk_to` | `elise` | *she's upstairs and hasn't said anything about either* |
| 4–6 | `decide` | seed · follow · transfer | Speaker: **Élise** — anchor |
| 7 | `inspect` | `st_rail` | *look at what you made* |

`closeWorldState`: `{ press: "mixed" }` · candidates: `[{ atelier_mood: "steady" }, { press: "warm" }, { cash: "tight" }]`

---

### 8.3 What this requires

| Need | Change |
|---|---|
| `st_mirror`, `st_fitting`, `st_press_wall`, `st_desk` targetable by `go_to`/`inspect` | Already stations in `room.ts` and already in `guide.ts` — **no room change needed** |
| Kobby patrols to the rail | §19.3 standing debt; mission 7 objective 4 needs it |
| Staged arrivals for Hélène, Rio, Dov | `wait_for` needs an NPC to enter and reach an anchor. `cast.ts` places them; the walk-in is new |
| Mission tracker + runner | Framework (ADR-005 §17 G9). Built in the Café, consumed here |

---

## 9. Decision content

### 9.1 How to read this section

Two-beat trees, branch-specific follow-ups, nine leaves (ADR-005 §9.2). Tiers live in §10 only. Choice letters are shuffled per activity.

### 9.2 Rewrites of the source blueprint

The MAISON blueprint marks its weak options more heavily than the others, and several of its options are abstractions rather than actions. Both are fixed here; **the rewrite is the shipping text.**

| Where | Source phrasing | Problem | Shipping text |
|---|---|---|---|
| C1-B (Lv B) | "Copy the rival's cheaper line right away, or you'll lose those buyers for good." | "Copy" is a judgement | "Match them, this season. That buyer is deciding where they start, and whoever they start with is where they stay." |
| C2-A | "Stick with bold colour — it's who you are, and the early data is probably just noise." | "Probably just noise" is the author dismissing it | "Hold the colour. Six weeks of sell-through in a pre-season drop is not a season, and a house that chases its own early numbers stops having a point of view." |
| C3-A | "Ask for two more weeks to research — better safe than sorry." | Cliché marks it as timid | "Ask for two weeks. Neither of these deals is reversible, and the cost of choosing the wrong one is a year, not a season." |
| C4-A (Lv B) | "Take the investor's cash quickly to remove the stress and grow right away." | "Quickly … remove the stress" frames it as weakness | "Take Dov's money. He's offering on a good month at a fair number, and money raised from strength is the cheapest money you will ever get." |
| C5-A | "Take the money now — you can worry about brand image later." | Explicitly marked | "Sign it. Two seasons of funded runway buys you the freedom to be uncompromising later, and nobody remembers who paid for the year you survived." |
| C6-A | "Accept the cut — the exposure is worth more than the lost profit." | Acceptable but thin | "Take the terms. That floor puts you in front of forty thousand people a week, and there is no marketing budget on earth that buys that." |
| C7-A | "Push the team to hit the deadline — feelings can wait until after launch." | "Feelings can wait" is the author's verdict | "Hold the date. Everyone in this building knew what the two weeks before a show look like when they took the job, and moving it costs you the slot." |
| C8-A | "Fake the 'sold out' hype — it drives sales right now." | "Fake" marks it | "Post that it sold out. Scarcity is the oldest lever in this industry, everyone pulls it, and the pieces genuinely are nearly gone." |
| C8-A (Lv B) | "Pay for the hidden press — image is everything." | Marked | "Take the placement. Every house you admire has bought coverage at some point, and being written about is how a small label stops being small." |
| C9-A | "Panic and change the whole brand direction, or blame the market and freeze up." | Two contradictory options in one, both marked | "Change direction. The collection was the statement and it did not land — go back to the table and come back next season as something else." |
| C9-A (Lv B) | "Give up on the line, or stubbornly refuse to change anything." | Same | "Cut the line. Three problems in one season is not a rough patch, it is an answer, and the discipline is knowing when to stop paying for one." |

**Abstractions grounded.** The source's Advanced options are frequently written as competency descriptions rather than actions ("fix the real cause, make the team feel safe to speak up, build for long-term loyalty"). Every one is rewritten as something a person does in this room, this week, with a named consequence. A choice the player cannot picture is a choice they cannot make.

---

### 9.3 Exemplar A — `C2-SCA-03` · "Three Times Faster" (Level A, fully worked)

**Station** `st_bench` · **Host** Élise · **9 weeks out**

> **Stage.** The atelier, mid-morning, north light. Élise has printed the pre-season sell-through and put it on your side of her bench rather than handing it to you, which is how she says things she does not want to say out loud.
>
> The neutrals are moving three times faster than the vermilion. The vermilion is the house. It is on the rail downstairs, it is in every photograph anyone has ever taken of this label, and it is the word the one review you have ever had used about you.
>
> Élise sets her glasses down.

**Seed choices**

| | Text |
|---|---|
| **a** | "Get Véra on the phone before you touch the order. Ask what a three-to-one on a pre-season drop actually means, and move on what she says." |
| **b** | "Shift the next drop toward what's selling, but keep one vermilion piece in it. Follow the money without giving up the thing people know you for." |
| **c** | "Hold the colour. Six weeks of sell-through in a pre-season drop is not a season, and a house that chases its own early numbers stops having a point of view." |

**Seed consequences**

- **a** — *Véra asks you three questions in a row and you can only answer two of them. Three times faster than what — the bold, or last season's bold? Faster in units or in value? By the end of the call the number means something different than it did at the start, and it still says neutrals.* → `atelier_mood: steady`
- **b** — *You reweight the order: six neutral, two vermilion. Élise puts the sheet away without comment, which from Élise is agreement. The rail goes mixed by Friday and looks, honestly, better than it did.* → `rail: mixed`
- **c** — *You hold. Élise says "right" and goes back to the seam. Over the next three weeks the neutrals in the boutique sell out and the vermilion does not, and the rail starts to look less like a statement and more like a surplus.* → `rail: bold_thin`, `cash: tight`

**Follow-up — branch a** *(you called Véra)*

> The reweighted order is in and it is selling. Véra rings back a week later, unprompted: *"I've been thinking about your three-to-one. Do you know yet whether they're buying neutrals, or buying an easier first purchase?"*

| | Text |
|---|---|
| **a** | "Split the next drop deliberately — neutral at entry price, vermilion at full — and find out which variable is actually doing the work." |
| **b** | "Ring her back every time a number surprises you from now on. She sees the thing behind the number faster than you do, and that gap is the whole point." |
| **c** | "It's selling. Take the win, run the neutral weighting through the season, and revisit the question when there's a season's worth of data to revisit it with." |

**Follow-up — branch b** *(you reweighted and kept one)*

> The mixed rail sells through better than either version would have alone. Ines mentions, delightedly, that two of her clients described you as "less shouty this season". She means it as praise. Élise, upstairs, heard it.

| | Text |
|---|---|
| **a** | "Get Véra in. 'Less shouty' is either the best or the worst thing anyone has said about this house, and you can't tell which from inside it." |
| **b** | "Lean in. Reweight further toward neutral for the main collection, and let the vermilion become the accent it is clearly already becoming." |
| **c** | "Hold the split exactly where it is for the rest of the season, and decide what the house is after the show rather than during it." |

**Follow-up — branch c** *(you held the colour)*

> Three weeks. The neutrals in the boutique are gone and the vermilion is not. Élise has started folding the unsold pieces rather than rehanging them, which she has never done. She has not said anything.

| | Text |
|---|---|
| **a** | "Hold. You are eight weeks from a show built entirely around this colour, and changing the collection now would be reacting to a boutique, not to a market." |
| **b** | "Cut the vermilion order, take the loss on what has already been made, and reweight the show while there is still time to reweight it." |
| **c** | "Call Véra, say out loud that you have been defending the colour rather than reading the numbers, and let her work out which you are still doing." |

---

### 9.4 Exemplar B — `C5-SCB-03` · "Two Seasons" (Level B, fully worked)

**Station** `st_boutique_floor` · **Host** Rio · **5 weeks out**

> **Stage.** Rio walks while he talks, which means you turn to follow him, which means the rail is behind him the entire conversation. He is not hiding it. He knows exactly where he is standing.
>
> A fast-fashion group wants your name on a capsule. Twelve pieces, their factories, their price points, your label on the neck alongside theirs. The money funds two seasons outright.
>
> You have four weeks of cash. The pieces on your rail resell for more than you charge for them, which is the only reason Hélène is interested and the only reason Rio is here.
>
> **Rio:** *"Two seasons of runway. That's what this is. I'm not going to pretend it's anything else."*

**Seed choices**

| | Text |
|---|---|
| **a** | "Work the numbers on what it does to you — resale, the buyers, what Hélène says when she sees it — then decide with the cost in front of you." |
| **b** | "Map the chain before you answer: cash this year, resale next year, who takes your call the year after. Then design the deal around what you won't give up, or refuse it." |
| **c** | "Sign it. Two seasons of funded runway buys you the freedom to be uncompromising later, and nobody remembers who paid for the year you survived." |

**Seed consequences**

- **a** — *You spend two days on it and the number that stops you is not the fee, it's the resale — a comparable house did this eighteen months ago and their secondary market has never recovered. You knew the deal was a trade. Now you know what you were trading.* → `resale: strong`
- **b** — *You come back to Rio with a shape rather than an answer: no label on the neck, a separate name, twelve pieces, one season, and a hard end date. He says he'll ask. It's smaller money. It is also a deal you could survive being public.* → `cash: funded`, `house_mark: clean`
- **c** — *The money clears in eleven days and it is more money than this company has ever had at once. Three months later the capsule is in every branch of a chain with 600 stores, your resale prices have halved, and Hélène's calls have got noticeably shorter.* → `cash: funded`, `house_mark: collab_logo`, `resale: soft`, `rail: collab`

**Follow-up — branch a** *(you costed it properly and declined)*

> You turned it down on the resale number. Six weeks later a house one tier above you takes almost the same deal and gets a visible sales bump and a lot of coverage. Ines asks, not unkindly, whether you were being principled or slow.

| | Text |
|---|---|
| **a** | "Say the quiet part: you weren't being principled, you were being solvent, and you'd take a version of that deal tomorrow if it didn't touch the neck label." |
| **b** | "Hold the position and say nothing. The bump is three months old; the resale damage takes eighteen. You'll be right eventually and being right early looks like being wrong." |
| **c** | "Go back to Rio with the version you'd actually sign — different name, hard end date, no label — and use the fact that a bigger house just validated the category." |

**Follow-up — branch b** *(you designed a deal you could survive)*

> They agree to most of it and push back on one thing: they want the MAISON name in the marketing even if it's off the neck. It is a smaller concession than the one you refused and it is the same concession.

| | Text |
|---|---|
| **a** | "Refuse it, in writing and specifically — the neck label was never the point, the association was, and conceding it in marketing concedes it everywhere." |
| **b** | "Take it. You held the line where it actually mattered, the marketing is transient, and the garment is the thing that lasts." |
| **c** | "Trade it: they can use the name for one campaign window, and in exchange the whole thing ends on a fixed date with no renewal option." |

**Follow-up — branch c** *(you signed)*

> The capsule is everywhere. Your resale has halved, Hélène's calls have got shorter, and Rio has come back with a second, larger version of the same offer. The money is real, the runway is real, and the thing you were funding it to protect is visibly worse than it was.

| | Text |
|---|---|
| **a** | "Take the second one too. You are in this now; the damage is done and the only bad version of this is doing it once and getting none of the upside." |
| **b** | "Stop at one. Take the money you have, spend the two seasons rebuilding the thing you spent, and treat the capsule as a bridge rather than a business." |
| **c** | "Stop, and be public about stopping — put the reason in the next collection's notes, let the market see a house that priced its own mistake, and start earning the resale back." |

---

### 9.5 The remaining sixteen trees — seed layer and follow-up specification

Shipping text for the seed layer; follow-ups specified by prompt and tier intent.

#### C1 · Problem Sensing — `good_questions`

**Level A — `C1-SCA-03` "Three of Mine Asked"** · `st_rail` · Ines · 11w
> She finishes her call to tell you three of her clients want a cheaper way in. She's repeating rather than reporting, and you have cash for exactly one move this season.

- Launch the entry line now. Three stylists saying the same thing in one week is as close to a market signal as this business gets.
- Go and ask the clients themselves. Find out whether it's the price they want or an easier first purchase — those are different problems with different answers.
- Put out one short capsule at a lower price and watch who actually buys it before you commit a line to it.

*Follow-ups:* **"launched"** → it sells to new buyers and two long-standing clients ask if you've gone mass · **"asked"** → it turns out to be access, not price; do you fix access, fix price anyway, or fix both? · **"capsule"** → the capsule sells but at a margin that doesn't scale; extend, kill, or reprice?

**Level B — `C1-SCB-03` "The Resale Number"** · `st_rail` · Ines · 11w
> A rival launched an entry line. Your pieces are reselling at nearly double retail. Cash for one move. No proof of how many would actually buy.

- Match them, this season. That buyer is deciding where they start, and whoever they start with is where they stay.
- Run one capsule for a season and track both sell-through and margin properly before you commit a whole line to it.
- Find out who is asking, how often, and what they would genuinely pay — then spend only where demand and margin both hold.

#### C2 · Learning Agility — `learning_from_feedback`

**Level A — `C2-SCA-03`** — fully worked in §9.3.

**Level B — `C2-SCB-03` "The Colour House"** · `st_bench` · Élise + Véra · 9w
> The bold pieces are slow. A buyer you trust says the customer wants neutrals. The press has spent two years calling you *the colour house*, and that phrase is most of your recognition.

- Defend the colour publicly. Your entire recognition is one word, and changing it mid-season tells the press you don't know what you are.
- Move the plan on what the data says — shift quietly toward neutrals and keep vermilion as a controlled signature rather than the whole statement.
- Treat the miss as the most useful information you've had all year. Get Véra to stress-test it, then reposition ahead of the market rather than behind it.

#### C3 · Courage to Commit — `saying_no_opportunity_cost`

**Level A — `C3-SCA-03` "Forty-Eight Hours"** · `st_rail` · Hélène · 8w
> A department store wants to stock you. Terms are decent. You have 48 hours and you do not have all the facts.

- Ask for two weeks. Neither of these deals is reversible, and the cost of choosing the wrong one is a year, not a season.
- Weigh what you actually know against what you don't, decide inside the 48 hours, and own whichever way it goes.
- Commit to the one that fits what this house is meant to be in three years, and accept that you are buying it partly blind.

**Level B — `C3-SCB-03` "Friday"** · `st_rail` · Hélène + Rio · 8w
> An exclusive with a high-end store, a pop-up offer on the table, and a production slot that closes Friday. Neither deal is safe.

- Hold both and keep gathering until one of them stops being a guess, even if that means losing the production slot.
- Pick the one that fits the house, act before the slot closes, and accept that you are choosing on incomplete information.
- Decide cleanly under the pressure, accept that your name is on it either way, and turn the decision into momentum that afternoon.

#### C4 · Financial Discipline — `roi`

**Level A — `C4-SCA-03` "Pre-Orders"** · `st_desk` · Dov · 7w
> Pre-orders are strong. You're tempted to double the run and hire two people. Cash is tight.

- Double the production run and hire the two people now. Momentum in this business is a window, not a trend, and windows close.
- Produce only what has already been ordered, keep the cash where it is, and take on freelancers instead of permanent hires.
- Match the spend to demand you can prove, time it to when the money actually lands, and hold a reserve for the next drop.

**Level B — `C4-SCB-03` "Patient Money"** · `st_desk` · Dov · 7w
> Pre-orders are strong but unpaid. Fabric costs have jumped. Dov will fund you for a percentage. You have about one season of cash.

- Take Dov's money. He's offering on a good month at a fair number, and money raised from strength is the cheapest money you will ever get.
- Produce only paid orders, put what's left behind the highest-return piece, and price what the equity would actually cost you over ten years.
- Build the money out of the business first — pre-paid orders, a fabric partner, terms from the mill — and go to Dov only for what's left.

#### C5 · Strategic Thinking — `tradeoffs`

**Level A — `C5-SCA-03` "Your Name On It"** · `st_boutique_floor` · Rio · 5w
> A fast-fashion brand will pay well for your name on a cheap collaboration.

- Sign it. The cheque solves this season, and brand is something you can rebuild once you're solvent enough to have one.
- Work out what it does to you over one to three years, put that against the money, and pick accordingly.
- Trace where it lands — resale, the buyers, who takes your call next year — and design the deal around what you won't give up.

**Level B — `C5-SCB-03`** — fully worked in §9.4.

#### C6 · Power & Influence — `persuasion_storytelling`

**Level A — `C6-SCA-03` "For the Exposure"** · `st_rail` · Hélène · 4w
> A known boutique wants your pieces and wants your margin halved "for the exposure".

- Take the terms. That floor puts you in front of forty thousand people a week, and there is no marketing budget on earth that buys that.
- Ask what the exposure is actually worth to them, make the case for what you're worth, and hold the terms that matter while flexing the ones that don't.
- Negotiate from what you actually have — a resale market they'd like access to — show them the deal that works for both, and be genuinely willing to leave without it.

**Level B — `C6-SCB-03` "Pleasantly"** · `st_rail` · Hélène · 4w
> Tight deadline, names you'd like on your list, an opening offer well under your floor, and a hint that she'll go elsewhere. Your position is stable but not strong.

- Concede the terms. Losing this account with four weeks to a show is not a position you can afford to be principled from.
- Protect the margin and the terms that matter, turn each objection into the reason the work costs what it costs, and push for a decision date.
- Control the pace of the conversation rather than answering it, aim for the version that works for both of you, and be able to leave without damage if it doesn't hold.

#### C7 · People Management — `motivating_team`

**Level A — `C7-SCA-03` "Past Ten"** · `st_atelier` · Élise · 2w
> The atelier lights have been on past ten for a week. Élise has been in since six and has unpicked the same seam twice. A large order ships Friday.

- Hold the date. Everyone in this building knew what the two weeks before a show look like when they took the job, and moving it costs you the slot.
- Rebalance the workload, check whether you've been loading her because she never complains, and put something in place for the team to tell you before it gets here again.
- Fix what's actually causing it — the sample revisions, not the hours — make it safe for her to say so, and accept the ship date moves.

**Level B — `C7-SCB-03` "One Voice"** · `st_atelier` · Élise + Kobby · 2w
> A costly cutting error from a new hire. Morale flat with two weeks to go. And you have noticed, this week, that you have taken Kobby's suggestion nine times running and nobody else has offered one in a month.

- Deal with the error, keep the pace, and address the rest after the show. There is a version of this conversation that can wait and this is it.
- Handle the mistake respectfully, name the favouritism out loud before someone else does, and protect the team's trust while the pressure is on.
- Put people first where it actually costs you — fix the process that let the error through, change how ideas reach you, and carry the schedule hit yourself.

#### C8 · Value Creation & Credibility — `real_value`

**Level A — `C8-SCA-03` "Sold Out"** · `st_desk` · Rio · 1w
> The drop is Thursday. You could post that it's sold out, or you could spend the week showing people how the pieces are actually made.

- Post that it sold out. Scarcity is the oldest lever in this industry, everyone pulls it, and the pieces genuinely are nearly gone.
- Show the work — the cloth, the construction, Élise's hands — and take slower growth in exchange for people knowing what they're buying.
- Teach rather than sell. Make this house the place people learn what good construction looks like, and let the demand arrive as a consequence.

**Level B — `C8-SCB-03` "The Placement"** · `st_desk` · Rio · 1w
> Undisclosed paid coverage, or the slow version: publishing your patterns, your mills, your costs. Cash is tight.

- Take the placement. Every house you admire has bought coverage at some point, and being written about is how a small label stops being small.
- Build the reputation the slow way, publish nothing you can't stand behind, and protect the one asset a house this size actually has.
- Invest in the industry around you — publish the sourcing, credit the mill, teach the technique — and let the reputation outlast any single season's coverage.

#### C9 · Perseverance & Adaptability — `resilience`

**Level A — `C9-SCA-03` "Two Clippings"** · `st_press_wall` · the wall · after
> The show happened. Sales were weak, one review was polite and one was not, and the wall has two frames on it where you expected six. Élise hasn't said anything about either.

- Change direction. The collection was the statement and it did not land — go back to the table and come back next season as something else.
- Take the hit, work out specifically what missed, adjust the next collection, and keep the house pointed exactly where it was pointed.
- Treat the resistance as part of the job: take what's true from the bad review, protect the atelier's morale, and come back sharper.

**Level B — `C9-SCB-03` "And Then"** · `st_press_wall` · after
> After the flop: returns spike, and the wholesale order you were counting on is cancelled in the same week.

- Cut the line. Three problems in one season is not a rough patch, it is an answer, and the discipline is knowing when to stop paying for one.
- Take the feedback into the next set of decisions and keep a clear head while the numbers are bad and everyone is watching.
- Judge each of the three separately — what to continue, what to change, what to stop — and let the stretch make you harder to move.

### 9.6 The mentor consultation — **re-resolved in v2.0**

The `Fashion Retailer` blueprint specifies a scored "mentor lifeline" for C2 — *"Used 0–1 time = Developing · 2 times = Strong · all 3 times = Advanced"* — as a usage counter across three opportunities.

**v1.0 could not honour it.** Two beats gave two consultation opportunities, so the mapping was compressed to 0 / 1 / 2 and the divergence was recorded as a deliberate compromise.

**v2.0 withdraws the compromise.** Three beats gives **three** consultation opportunities, and consulting Véra is one of the three options at each. The blueprint's mapping is now literal:

| Consultations | Tier | Why |
|---|---|---|
| **0–1** | Developing | You went once, or not at all. A single check is a formality |
| **2** | Strong | You checked, then checked again when the answer was inconvenient |
| **3** | Advanced | You looked for evidence that might prove you wrong at every point where it could have |

Mechanically: the seed and follow-up consultation options sit in the authored tier maps as before, and the **transfer beat's option set is constrained** — for C2 only, one of the three generated options must be *"go and ask Véra"*, with its tier fixed by how many times the player has already consulted. This is the single place in MAISON where a mission constrains generation beyond [ADR-006 §8](ADR-006_Missions_AI_Followups_and_Session_State.md)'s general rules, and it is recorded in ADR-006 §10.5 as a framework-level behaviour rather than a MAISON quirk, because MERIDIAN's Sam needs exactly the same thing.

**Véra is never punished and never gated.** The desk phone works at every beat in the building, at any time, and calling her outside C2 is free, unscored, and produces a genuinely useful question. A lifeline that costs something is a lifeline nobody uses, and the point of this competency is that asking is the strong move.

> **Standing debt.** The free, unscored, always-available call is **not built** — Véra exists as a *choice* inside the C2 trees, which is the scored mechanic, but the desk phone as an always-on affordance needs wiring (§19.3).

### 9.7 The transfer beat — beat three

Generated server-side from both prior choices, in the host's voice ([ADR-006 §7–§8](ADR-006_Missions_AI_Followups_and_Session_State.md)). What MAISON authors is who speaks, what they may draw on, and the fallback.

#### 9.7.1 What it is for, in this house

MAISON's authored beats are about one season. The transfer beat is **next season arriving early** — the resale market moves, the buyer's boss changes, a rival copies the thing you refused to do. A luxury label's real test is whether a decision holds when the reason for it has changed, and that is what beat three asks.

#### 9.7.2 Persona cards

Mirrored into `internal/registry/content/followups/fashion_brand.json`.

| NPC | Voice | Sample | Never |
|---|---|---|---|
| **Élise** *(anchor)* | Precise, unhurried, speaks about the work rather than about you. Long silences she is comfortable with. | *"The seam is fine now. It was not fine at six."* | Praising or criticising the player · management vocabulary |
| **Ines** | Warm, fast, socially fluent. Repeats what her clients said rather than reporting it. | *"Three of mine asked. I said I'd mention it."* | Analysis · numbers · admitting she is repeating |
| **Hélène** | Courteous, unhurried, never raises pressure — the pressure is structural. | *"I should say we're also seeing two others this week."* | Threats · impatience · unpleasantness |
| **Dov** | Patient in a way that is itself the pressure. Asks one question and waits. | *"And if the fabric goes up again?"* | Ultimatums · warmth · hurry |
| **Rio** | Fluent, generous, closes without appearing to. Genuinely likes the work. | *"Everyone's done it. That's not an argument, I know."* | Villainy · contempt for the craft |
| **Kobby** | Eager, a little raw, says the thing everyone is thinking. | *"Is mine going in or not?"* | Bitterness · strategy |
| **the wall** *(mission 9)* | Quoted press, verbatim, no framing. | *"…a house that knows exactly what it is, and charges for it."* | Editorialising · addressing the player |

#### 9.7.3 What the generator is given

Fiction, mission staging, the persona card, both chosen option texts, the track, and **the world state as MAISON's own prose** — `describeRail()`, `describeAtelier()`, `describePress()`, `describeCash()`. Feeding the generator the same sentences the screen reader gets is deliberate: it guarantees the generated question and the room describe the same house.

`aiWorldCandidates` per mission, per §8.2.

#### 9.7.4 The fallback bank — 18 beats

| Mission | Track A opens on | Track B opens on | Varies on |
|---|---|---|---|
| C1 | a fourth client asks, through a different stylist | the resale number moves the other way | `rail` |
| C2 | the neutrals stop moving three weeks later | the press calls you "the colour house" again, in print | `rail` |
| C3 | the production slot moves by a week | the other offer comes back improved | `cash` |
| C4 | the fabric goes up again | Dov introduces a second investor without asking | `cash` |
| C5 | a smaller, better-fitting collaboration appears | the fast-fashion brand does it anyway, with someone else | `press` |
| C6 | Hélène's buyer is replaced | a second buyer offers full margin and no prestige | `cash` |
| C7 | Kobby asks for what the conversation implied | Élise takes a week she did not ask for | `atelier_mood` |
| C8 | someone else's shortcut is discovered publicly | a magazine asks you, directly, how you did it | `press` |
| C9 | the polite review turns into an order | the unkind reviewer asks for an interview | `press` |

**Status: authored.** All eighteen live at `internal/registry/content/followups/fashion_brand.json` in `backend-academy`. They pass the §11.5 machine pass. C2's three beats each carry a call to Véra flagged `mentor: true`, so the 0–1 / 2 / 3 count of §9.6 is read from data rather than inferred from prose. No beat names a garment that is not on the rail (§9.7.5). **Not yet loaded** — that is BE-17.

**Still owed:** the fresh-reader pass (§18.2.1).

#### 9.7.5 The MAISON-specific rule

**The transfer beat may not describe a garment that is not on the rail.** The rail is a state machine with a closed set of contents, and a generated question that invents a piece breaks the building's one unbreakable readout. The generator is given `railContents()` and instructed to reference only what is in it; a reference to anything else fails [ADR-006 §8.4](ADR-006_Missions_AI_Followups_and_Session_State.md) gate 8 as an illegal world reference.

---

## 10. Registry binding

### 10.1 Activity IDs and subtopics



Building slot **03** (ADR-005 §10.5). Ledger: [Café PRD §10.2](PRD_Building_Cafe.md).

| Competency | Level A | Level B | Subtopic | Title | Why this subtopic |
|---|---|---|---|---|---|
| C1 | `C1-SCA-03` | `C1-SCB-03` | `good_questions` | Three of Mine Asked / The Resale Number | The Advanced path is asking who, how often, and at what price — the question *is* the skill |
| C2 | `C2-SCA-03` | `C2-SCB-03` | `learning_from_feedback` | Three Times Faster / The Colour House | The whole tree is what you do with a signal that contradicts your identity |
| C3 | `C3-SCA-03` | `C3-SCB-03` | `saying_no_opportunity_cost` | Forty-Eight Hours / Friday | Two offers, one slot — choosing is declining |
| C4 | `C4-SCA-03` | `C4-SCB-03` | `roi` | Pre-Orders / Patient Money | "What does this equity actually cost over ten years" is return on investment |
| C5 | `C5-SCA-03` | `C5-SCB-03` | `tradeoffs` | Your Name On It / Two Seasons | Cash now against brand value later, made physical on the rail |
| C6 | `C6-SCA-03` | `C6-SCB-03` | `persuasion_storytelling` | For the Exposure / Pleasantly | The Advanced path is reframing the deal around what they actually value |
| C7 | `C7-SCA-03` | `C7-SCB-03` | `motivating_team` | Past Ten / One Voice | Burnout, morale and unequal attention — the maintenance of willingness |
| C8 | `C8-SCA-03` | `C8-SCB-03` | `real_value` | Sold Out / The Placement | Manufactured scarcity against demonstrated craft |
| C9 | `C9-SCA-03` | `C9-SCB-03` | `resilience` | Two Clippings / And Then | Compound setbacks; the competency is absorbing them without deforming |

`type: "DECISION_TREE"` · `orderIndex: 3` · `estMinutes: 6` (Level A) / `7` (Level B) · `passCriteria: { "minProficiency": 2 }`.

### 10.2 Tier maps and rubrics

**Server-only. Never shipped to a client.**

> **v2.0 — nothing below changed.** The transfer beat composes on top of the terminal at `0.7 / 0.3` ([ADR-006 §10](ADR-006_Missions_AI_Followups_and_Session_State.md)), so every value here is exactly as reviewed and as shipped in `trees/`. The only addition is the `aiBeat` block, identical in all eighteen MAISON rubrics:
>
> ```jsonc
> "aiBeat": { "weight": 0.3,
>             "tierValues": { "developing": 15, "strong": 60, "advanced": 95 },
>             "required": false }
> ```

`C2-SCA-03`

| Node | a | b | c |
|---|---|---|---|
| **seed** | Advanced (call Véra) | Strong (reweight, keep one) | Developing (hold the colour) |
| follow · branch a | Strong | Advanced | Developing |
| follow · branch b | Advanced | Developing | Strong |
| follow · branch c | Developing | Strong | Advanced |

```jsonc
"rubric": {
  "kind": "trace",
  "terminals": {
    "C2-SCA-03.a.a": 81, "C2-SCA-03.a.b": 95, "C2-SCA-03.a.c": 63,
    "C2-SCA-03.b.a": 74, "C2-SCA-03.b.b": 42, "C2-SCA-03.b.c": 60,
    "C2-SCA-03.c.a": 15, "C2-SCA-03.c.b": 33, "C2-SCA-03.c.c": 47
  },
  "scoreMap": [
    { "minOutcome": 74, "proficiency": 3 },
    { "minOutcome": 42, "proficiency": 2 },
    { "minOutcome": 0,  "proficiency": 1 }
  ]
}
```

Note `c.c` = 47 → P2: you defended the colour for three weeks, then rang Véra and named your own defensiveness out loud. That is a Strong outcome from a Developing start, and it is the single most important cell in this building's design — **the game must reward changing your mind late over never changing it.**

`C5-SCB-03`

> ### ⚠ This table's branch-c row no longer matches the shipped prose
>
> Found on 2026-08-08 while deriving the tier maps from `src/buildings/fashion_brand/trees/c5-pro-03.ts`. The table below says branch c is **Strong · Advanced · Developing**. The prose that ships reads the other way round:
>
> | | shipped text | reads as |
> |---|---|---|
> | **c.a** | *"Take the second one too. You are in this now; the damage is done…"* | textbook sunk cost — **Developing** |
> | **c.b** | *"Stop at one. Take the money you have, spend the two seasons rebuilding…"* | **Strong** |
> | **c.c** | *"Stop, and be public about stopping — let the market see a house that priced its own mistake"* | **Advanced** |
>
> The prose was authored after this table. The seeded rubric follows the **prose**, because the prose is what a learner reads — see `internal/registry/content/tiermaps/fashion_brand.json`. Either this table is corrected or the reading is wrong; **somebody who did not do either should decide which**, because three of the nine terminals score differently depending on the answer.

| Node | a | b | c |
|---|---|---|---|
| **seed** | Strong (cost it, then decide) | Advanced (map the chain, design the deal) | Developing (sign) |
| follow · branch a | Developing | Strong | Advanced |
| follow · branch b | Advanced | Developing | Strong |
| follow · branch c | Strong | Advanced | Developing |

```jsonc
"terminals": {
  "C5-SCB-03.a.a": 42, "C5-SCB-03.a.b": 60, "C5-SCB-03.a.c": 74,
  "C5-SCB-03.b.a": 95, "C5-SCB-03.b.b": 63, "C5-SCB-03.b.c": 81,
  "C5-SCB-03.c.a": 33, "C5-SCB-03.c.b": 47, "C5-SCB-03.c.c": 15
}
```

The remaining sixteen tier maps are authored with their leaf prose under the same constraints as the Café (§10.3 there): each tier once per node, and no permutation repeated within the building.

---

## 11. Silent tier & reward

ADR-005 §11 in full. MAISON-specific:

**The rail is the feedback, and the rail has no opinion.** It is a factual report of what you decided to make and what it costs. Reviewers should specifically check that no rail state is lit, framed or scored as better than another — the collab piece hangs in the same light as everything else.

**Élise is not a verdict.** She is the character most at risk of becoming one, because she is wise and taciturn and the temptation to have her be quietly disappointed is enormous. Her reactions are bound to `atelier_mood` and `cash` — she is short with you when the atelier is strained, whatever decision strained it. She never comments on a decision as a decision.

**The press wall is not a score.** Clippings fill in from world state, and a cold review is not a fail state — a house can be panned and correct. The wall reports coverage, not quality.

**No hint button.** Suppressed in scenario mode. Véra is not a hint: she asks questions, she never gives an answer, and consulting her is a scored *choice* rather than an escape from one.

**The coin tick** is silent, magnitude-proportional, and identical in presentation at 5 and at 25.

**No celebration on a decision.** This building shipped a win jingle and confetti on completing a beat, and it was a §11 violation — a verdict delivered before the player had read the world their decision changed. It is now a named forbidden item framework-wide ([ADR-005 §11.1](ADR-005_Interior_Framework.md)) and it must not come back.

### 11.1 The mission tracker

Framework code ([ADR-006 §6.3](ADR-006_Missions_AI_Followups_and_Session_State.md)) so MAISON cannot add to it. MAISON-specific commitments: completed missions **disappear** rather than being ticked; the tracker line is the house's words (*look at the collection*, *go up*, *tell Élise what you're doing about it*); the three pips are identical whichever beat they mark; and the countdown stays on the steel column where it belongs, **not** in the tracker — the tracker says which mission, the column says how long you have, and conflating them would turn the season's pressure into a progress bar.

### 11.2 Generated lines are held to the same rule

The persona cards (§9.7.2) describe *how* a character speaks and never *what they think of your decision*. Élise's card is the one to watch: she is wise and taciturn and a card that said "quietly disappointed when the player compromises" would put a verdict in every generated line in the building. **And the player must never learn which beat was generated** — no badge, no different typography, no spinner. If Élise's third question is slow, she finishes the seam first.

---

## 12. World state

| Key | Values | Visible as |
|---|---|---|
| `rail` | `bold` · `bold_thin` · `mixed` · `neutral` · `capsule` · `collab` · `thin` | The rail. The building's primary readout. |
| `price_tags` | `house` · `entry` · `cut` | Tag colour and printed number, readable on inspection |
| `house_mark` | `clean` · `collab_logo` | The neck label on every garment on the rail |
| `press` | `empty` · `one` · `mixed` · `warm` · `cold` | Filled frames along the stair; the wall is read on foot |
| `atelier_mood` | `steady` · `strained` · `fractured` · `trusting` | Machine cadence, how many machines run, whether anyone talks, Élise's idle set |
| `cash` | `season` · `tight` · `funded` | Bolts of cloth on the atelier shelf (many/few/premium); whether the second cutting table is in use |
| `equity` | `whole` · `sold` | Dov's presence in the building after C4, and a second name on the desk paperwork |
| `resale` | `strong` · `soft` | A resale-market printout pinned by the desk, updated between beats |
| `buyer` | `circling` · `signed` · `walked` | Whether Hélène's boxes are stacked by the door |
| `countdown` | `11w` … `after` | The chalked number on the atelier's steel column |

Presentation only; never influences scoring — the house moves on the trace, never on the score, which is why an offline submit can report plainly that nothing scored it and the room still changes.

**A generated transfer beat may not write a world key of its own.** It selects one write from the mission's `aiWorldCandidates` (§8.2), server-validated for membership; anything else is dropped and the mission's `closeWorldState` covers the visible change. This is what keeps the rail a closed state machine ([ADR-006 §8.4](ADR-006_Missions_AI_Followups_and_Session_State.md) gate 8, and §9.7.5 here).

Persisted continuously to `PUT /api/v1/city/buildings/fashion_brand/state` and flushed on exit (§19.4), with `localStorage` as the mirror.

---

## 13. End-of-journey report — *"The Lookbook"*

**Unlock:** all nine competencies on the player's track `COMPLETED`.

**The object.** The season's lookbook, on the desk where it has been all along, now printed and bound. The press file is folded into the back. Walking to it opens a full-screen reader.

**The spread.**

1. **The collection** — the rail as it finished, photographed. Eight pieces, whatever they turned out to be, with the prices you set. Below it, in small type, the version you started with. The diff is the season.
2. **The press file** — the clippings from the wall, in order, with the dates.
3. **Your record** — and this is the **only** place tier vocabulary appears anywhere in this building. Nine competencies, nine tiers, each with its one-line meaning and the week it was decided.
4. **The consequence trail** — two lines per competency: what you chose, what it cost, what it bought.
5. **Consistency** — the seed/follow-up shape made legible. *"You mapped the collaboration properly and then conceded the marketing. You see the whole board and you negotiate the last ten per cent as though it doesn't count."*
6. **The cover plate** — your character's portrait, framed as the designer's headshot (§3.4).
7. **Where next** — two or three city buildings that press hardest on your lowest competencies.

**Tone.** A lookbook is a document a house makes about itself. This one is honest. No grades, no percentiles, no praise — a record of a season and what it revealed, written by someone who was in the building.

---

## 14. Level A vs Level B in this room

| | Level A (`SCA`, 16–21) | Level B (`SCB`, 35–50) |
|---|---|---|
| **Framing** | MAISON is the label you started. Two years old, one boutique, a following that surprises you. | MAISON is the label you took over. It has a reputation you inherited and can spend. |
| **Threshold question** | *"Is MAISON the label you're starting, or the one you're taking over?"* — asked by Élise on first entry, once for the whole city | same |
| **Cast at beat 1** | Élise, Ines, ambient | Élise, Kobby, Ines, ambient — the favouritism problem is already in the room |
| **Props added** | — | The resale printout by the desk from beat 1; a second, older lookbook on the shelf (the house before you); Dov's card already on the desk |
| **Decisions** | One pressure at a time; the money is small and the horizon is one season | Cash, brand, equity and reputation move together; the horizon is ten years and the equity decision is permanent |
| **The rail** | Starts at eight pieces | Starts at eight pieces and a resale tag — the secondary market is a character from the beginning |
| **Light** | The key over the rail is warmer | One stop cooler and harder; the boutique is dimmer |
| **What "Advanced" means** | Asking the better question before spending | Asking it, mapping where the answer lands three years out, and being willing to pay what the answer costs |

---

## 15. Accessibility for this interior

ADR-005 §14 in full. MAISON-specific:

- **The raised atelier** is reachable by ramp as well as steps, and the ramp is the default guided-navigation route. No content is gated behind the steps.
- **Guided navigation labels** in the house's own words: *the desk · the rail · the fitting alcove · the press wall · the stair · the cutting table · Élise's bench*.
- **The rail is the building's primary non-verbal channel and must therefore be fully verbal too.** Every rail change is announced to the live region in plain language — *"the rail is now mostly neutrals; two vermilion pieces remain"* — and inspecting the rail produces a readable DOM list of what is on it, with prices and labels. A player who cannot see the rail must be able to read the same season off it.
- **The press wall** is a DOM reader on inspection, not an image; the clippings are text.
- **The countdown number** is announced on change and is present in the DOM header of the interior, not only chalked on a column.
- **The machine sound** carries the atelier's mood, so the mood is *also* surfaced in text: entering `z_atelier` announces both the zone and its state (*"the atelier — two machines running, nobody talking"*).
- **High contrast** is a risk here: this building is deliberately low-contrast in the boutique. The scene has a minimum-luminance floor, all UI is DOM at full contrast, and the high-contrast accessibility setting raises the boutique's ambient rather than tinting the render.

---

## 16. Performance budget

Within ADR-005 §15. MAISON is the most demanding of the three launch buildings — bigger volume, more characters, and cloth.

Within ADR-005 v2.0 §15, restated for 2D.

| Metric | MAISON target | Notes |
|---|---|---|
| Sprites on screen | ≤ 320 | Two levels visible at once; the rail's eight silhouettes × four colourways are the expensive set |
| Draw calls | ≤ 55 | Dress forms, machines, hangers and bolts share baked containers |
| Baked textures | ≤ 34 unique | Four colourways are one draw function with a tint argument, not four textures |
| Animated characters | ≤ 5 on screen | Ambient atelier workers thin out when a named character comes downstairs |
| Texture memory | ≤ 40 MB | `resolution: 2` |
| Scene build (bake) | ≤ 400 ms | Behind the fade. MAISON is the largest bake of the three |
| Interior chunk | **≤ 1.5 MB** added | At ADR-005's ceiling. If it exceeds, cut ambient workers before cutting garments |
| Enter / exit | ≤ 1.0 s | Prefetched on approach from Market Street |
| Ambient beats active | ≤ 8 | §6 table |
| Transfer-beat latency | ≤ 2.5 s p95 | ADR-006 §7.4 |

**The volume is the risk.** Two levels means more of the scene is on screen at once than in the Café. Mitigations, in order: the atelier's back wall is a low-detail card; the boutique's emptiness is genuinely cheap (§3.1 — *"under-furnished on purpose. Sound carries."* — **and it is not a defect**); and the shopfront glass reuses the Café's street card rather than baking a second one.

**The near-edge rule is load-bearing here.** The shopfront is the frontmost row and drew over the player's feet until it was rebuilt as a low sill. Any future prop on `y = ROWS-1` must be a sill.

---

## 17. Asset checklist

Every line requires an `ASSETS_LICENSES.md` entry before work builds on it.

**Architecture** — boutique shell, atelier platform, steps, ramp, balustrade, stair run, shopfront glass + frame, heavy door, tall atelier windows, steel column (countdown).
**Boutique** — **the rail (hero)**, desk, lookbook (2 states), resale printout, fitting alcove shell, **full-height mirror (hero)**, dress form ×4, hangers.
**Atelier** — cutting table, sewing machines ×3, steam press, Élise's bench, shelving, cloth bolts (3 density states), thread, scissors, chalk, tape.
**Garments (bespoke, the big one)** — 8 silhouettes × 4 colourways (vermilion, bone, ash, sand) + 1 collab piece + 3 entry-line pieces + price tags (3 variants) + neck labels (2 variants). **This is one artist, one batch, and it is the critical-path asset for the whole building.**
**Press wall** — frame ×8, 6 clipping text variants (DOM-readable, not baked images).
**Characters** — shared rig + 7 skins (Élise, Kobby, Véra, Ines, Hélène, Dov, Rio) + 4 ambient skins.
**Animation** — the shared 12-clip set plus MAISON-specific: `pin`, `fold`, `touch_garment`, `walk_talk`, `sit_uninvited`.
**Street (through glass)** — reuse the Café's Market Street card at a different angle.
**Audio** — large room tone, sewing machine (run/stop), steam press, scissors, hangers sliding, heavy door thud, muffled street, glasses set down. **No music.**

---

## 18. Phases, acceptance, testing, risks

### 18.1 Phases

> **v2.0.** MAI-0…MAI-4 assumed an interior engine that did not exist and were superseded by the phases actually run — P0–P6 (the season board), M0–M6 (the interior), R1–R4 (the Café pass). Those are recorded in §19.1. What follows is what is **left**.

| Phase | Deliverable | Gate | Status |
|---|---|---|---|
| **MAI-0…4** | The room, the rail, all eighteen trees, the cast, the lookbook, guided navigation, the dev fixture | 311 tests, `npm run ci` green | **Done** — see §19.1 |
| **MAI-5** | **Missions** — the nine objective chains of §8.2 on the framework runner and tracker; Kobby's patrol; staged arrivals for Hélène, Rio and Dov | Walk a season by objectives, keyboard-only, with the tracker top-left and mission *n+1* invisible until *n* closes | Blocked on the Café's framework work (ADR-005 §17 G9) |
| **MAI-6** | **The transfer beat** — the framework client, the 18-entry fallback bank, and **the mentor's third consultation** (§9.6) | Play C2 on both tracks consulting Véra zero, two and three times, and confirm the blueprint's mapping | Blocked on MAI-5 and BE-17 |
| **MAI-7** | **Session sync** — replace `maisonStore`'s local persistence with the framework layer; the `sendBeacon` exit flush | Kill the tab mid-mission, reopen on another device, resume at the same objective with the same transfer question | Blocked on BE-16 |
| **MAI-8** | **Debts** — §6 audio, the garment set, the room's first moving part, the free Véra phone (§19.3) | The atelier's mood is carried by sound as §6 specifies | |
| **MAI-9** | **Real** — the eighteen registry rows seeded; the fresh-reader plausible-peers audit | MAISON plays against the live backend and the audit passes | Blocked on BE-12 |

### 18.2 Acceptance criteria

1. **Plausible-peers audit passes**, run by a fresh reader on all 54 seed choices, 162 leaves **and the 18 fallback transfer beats** with tiers covered. *Blocking, and still owed* (§19.3). MAISON's blueprint is the most heavily marked of the three, so this gate matters most here.
1b. **Fallback parity.** With the generator disabled, a full nine-mission season plays end to end and no rendered string, timing or affordance differs from the generated path. *Blocking.*
1c. **The mentor mapping is literal.** Consulting Véra zero, two and three times across the three C2 beats yields Developing / Strong / Advanced (§9.6). *Blocking* — it is the one place MAISON reads the blueprint word for word.
1d. **The transfer beat never names a garment that is not on the rail** (§9.7.5). Sampled in the launch audit.
2. **Tier-leak audit passes.** Nothing outside §13.
3. **Registry validates.** `validate_registry` passes with MAISON's rows; all eighteen rubrics parse; all terminal sets are nine entries matching ADR-005 §10.1.
4. **The rail is fully legible without sight.** Inspecting it yields a complete DOM list; every change is announced. *Blocking* — this is the building's primary feedback channel.
5. **Keyboard-only completion**, verified by e2e.
6. **Ramp parity.** Every station reachable without using the steps.
7. **Performance.** §16 met at MAI-3 and MAI-4.
8. **Consequence visibility.** Every decision changes at least one of: the rail, the press wall, the atelier's noise, or the cloth on the shelf.

### 18.3 Test plan

- **Unit** — the world-state reducer; the rail state machine (every state reachable, no state unreachable); the countdown mapping.
- **Content** — every constructible path terminates in a rubric terminal; every terminal is reachable; every leaf writes at least one world-state key; the mentor path is available at both C2 beats in both tracks.
- **Choice parity (machine pass, ADR-005 §11.5)** — for every trio of choices, longest minus shortest ≤ **8 words**; no capitalised tier label, proficiency number, `n/3` or pass/fail phrasing in any shipped string; no verdict language ("unfortunately", "you should have", "the better move", "correct", "well done") in any consequence; each tier used exactly once per node and no letter permutation repeated in the building. This runs in CI over `script.ts` and is the check that caught the length/tier correlation in this document's first draft.
- **Component** — the dialogue layer builds the correct `trace`; scenario mode renders no result view; the rail's DOM inspection list matches its 3D state exactly (a snapshot test, because these will drift).
- **E2E** — enter → `C2-SCA-03` → verify the rail changed → exit → re-enter → verify persistence → complete the season → open the lookbook.
- **Playtest** — a 25-minute scripted session with a fresh player, ending with *"which choice do you think the game wanted?"*. More than two correct out of nine sends §9 back for rewrite.

### 18.4 Risks

| Risk | Mitigation |
|---|---|
| **Garment art is the critical path and free packs contain none.** | Eight silhouettes × four colourways, built once by one artist, reused for every rail state. Fallback: dress forms and hanging cloth shapes rather than garments — less beautiful, entirely legible. Start this asset at MAI-0, not MAI-2. |
| **The blueprint's options are the most heavily marked of the three buildings.** | The rewrite table in §9.2 is mandatory shipping text; the audit is blocking and run fresh. |
| **The Advanced options are abstractions** ("build for long-term loyalty") rather than actions. | Every one rewritten into something that happens in this room this week. Reviewers reject any option they cannot picture. |
| **Élise becomes the game's conscience** — a verdict in a grey shirt. | Her reactions are bound to world state, never to tier. §11 flags it for reviewers. Playtest question: *"did Élise approve of what you did?"* — if players can answer confidently, she is broken. |
| **The volume costs more than the Café and MAISON is at the bundle ceiling.** | §16's mitigation order; the atelier back wall as a card; empty floor is free. |
| **Low-contrast art direction fights accessibility.** | Minimum-luminance floor; DOM at full contrast; the high-contrast setting raises ambient rather than tinting. |
| **The mentor mechanic diverges from the blueprint's literal wording.** | §9.6 records the resolution and the reasoning explicitly so it reads as a decision rather than an omission. Needs KK sign-off. |

### 18.5 Open decisions

- **Player avatar in the mirror.** The mirror currently shows a dress form wearing the season. A real avatar would ripple into the shop, the cosmetics catalogue and every interior. **Recommendation: defer past launch**; the lookbook's portrait plate carries the "this is you" moment adequately.
- ~~**The mentor divergence** (§9.6)~~ — **closed.** Three beats restores the blueprint literally; the compromise is withdrawn (§9.6).
- ~~**The interior engine**~~ — **closed.** 2.5D Pixi, [ADR-005 v2.0 §5](ADR-005_Interior_Framework.md).
- **The house's signature colour.** Vermilion is this document's choice because it reads hot against a cold room and survives flat shading. Cheap to change now; expensive once the garment set is real art.
- **Does the show itself ever appear?** Current position: no. It happens between missions 8 and 9 and we see only the press wall. Playtest whether that restraint reads as elegant or as a missing scene.
- **Whether Hélène returns in mission 9** if she signed. Currently she doesn't, and her absence carries.
- **Whether the empty boutique should stay empty.** §3.1 says yes and R1–R4 deliberately left it alone. Worth re-testing once missions make people walk it more.

---

## 19. Implementation log, standing debts, and the backend contract

### 19.1 What was actually built

Re-cut against the real codebase. These phases replace MAI-0…MAI-4 (§18.1).

**P0–P6 — the season board** (before an interior existed)

| Phase | Deliverable | Status |
|---|---|---|
| **P0** | Baseline; the tree clean; `src/` typechecks | Done |
| **P1** | `fashion_brand` becomes MAISON: `kind: "scenario"`, a 3×2 footprint on Market Street, all eighteen ids, routed to its own panel. The city's placement invariants (reachability, non-overlap, corridors, crosswalks) pass unchanged | Done |
| **P2** | [`decisionTree.ts`](../src/lib/decisionTree.ts) (traversal, world deltas, parity helpers), the `decision_tree` content kind, the renderer emitting `{ trace: { path } }`, the silent-tier close | Done |
| **P3** | [`world.ts`](../src/buildings/fashion_brand/world.ts) — ten keys, reducer, rail state machine, the four `describe*()` functions; [`maisonStore.ts`](../src/buildings/fashion_brand/maisonStore.ts) persists the season | Done |
| **P4** | [`MaisonPanel.tsx`](../src/buildings/fashion_brand/MaisonPanel.tsx) — the threshold question, the rail readout, nine beats, the eighteen-way fetch, the world moving on the trace the player actually submitted | Done |
| **P5** | All eighteen trees, 162 leaves, in [`trees/`](../src/buildings/fashion_brand/trees) | Done |
| **P6** | [`devFixture.ts`](../src/buildings/fashion_brand/devFixture.ts) (offline, absent from the production bundle) and [`Lookbook.tsx`](../src/buildings/fashion_brand/Lookbook.tsx) | Done |

**P5 is worth reading twice.** The §18.3 machine pass ran in CI over every authored string as they were written and caught three real defects: a 20/23/30-word trio where the resigned option was the short one; Dov delivering a verdict on the player; and — the one that mattered — **the whole building shipping its weak option first**, because §9.5 lists options weakest-first and eighteen trees were authored in that order. Fixed structurally rather than by hand: `presentationOrder()` shuffles the three options per activity and per beat, deterministically, so no author can reintroduce it. That function is now framework-normative ([ADR-005 §9.2.1](ADR-005_Interior_Framework.md)).

**M0–M6 — the interior**, once the framework landed with the Café as its first tenant:

| Phase | Deliverable |
|---|---|
| **M0** | Merge (17 commits), one conflict in `CityScreen`, re-baseline |
| **M1** | [`room.ts`](../src/buildings/fashion_brand/room.ts) — two levels, five zones, nine stations |
| **M2** | [`props`](../src/buildings/fashion_brand/props.ts) / [`scene`](../src/buildings/fashion_brand/scene.ts) / [`MaisonCanvas`](../src/buildings/fashion_brand/MaisonCanvas.tsx) — the room on screen |
| **M3** | [`dressing.ts`](../src/buildings/fashion_brand/dressing.ts) — all ten §12 keys visible |
| **M4** | [`beats.ts`](../src/buildings/fashion_brand/beats.ts) + [`vera.ts`](../src/buildings/fashion_brand/vera.ts) — beats at their stations, the desk phone |
| **M5** | [`cast.ts`](../src/buildings/fashion_brand/cast.ts) — the seven, the on-screen cap, Élise's gaze |
| **M6** | The silent-tier fix, the lookbook's cover plate and where-next |

M6's silent-tier fix is the one to remember: **completing a beat fired a win jingle and confetti** — a verdict delivered before the player had read the world their decision changed. It is now a named forbidden item in [ADR-005 §11.1](ADR-005_Interior_Framework.md).

**R1–R4 — the Café pass.** The Café module is the house standard, so MAISON was read against it line by line.

| Round | What it did |
|---|---|
| **R1** | One source of layout truth, `NEAR_EDGE`, `resolution: 2`, [`panels.tsx`](../src/buildings/fashion_brand/panels.tsx), [`index.ts`](../src/buildings/fashion_brand/index.ts), six geometry invariants |
| **R2** | `actHere()` in [`roomStore.ts`](../src/buildings/fashion_brand/roomStore.ts) — one guarded path, and props that answer the mouse |
| **R3** | The mirror (§3.4), which had been a prompt that did nothing since the stations were authored |
| **R4** | [`guide.ts`](../src/buildings/fashion_brand/guide.ts) — a "go to" nav that crosses the room |

Two rendering bugs came out of the comparison rather than out of play, and both are now normative rules in [ADR-005 §8.1](ADR-005_Interior_Framework.md):

- **Three lists of "where the machines are" had drifted apart.** `room.ts` said `(3,1)(4,1)(5,1)`, `scene.ts` restated the same three, and `MaisonCanvas` stood the ambient workers at `(2,1)(6,1)(8,2)` — the people running the machines were nowhere near them. Everything that draws at a prop, or stands in front of one, now derives its cells from `FURNITURE`.
- **The shopfront was drawing over the player.** Frontmost row, so by depth alone it clipped the feet of anyone walking the front of the boutique. The Café had designed this out with `NEAR_EDGE`; MAISON had not.

### 19.1.1 What walking the room turned up

Everything above was proved by tests. Then the room was walked, station by station, with the store read out at each stop, and three things the test suite had no opinion about fell out. **They are recorded because every future building will hit at least one of them.**

- **The host of a beat never went to it.** §8 stages every beat at a station and guided navigation walks you there — but Ines stood at her §5 idle anchor by the door for the whole beat. The comment in `castAt` even *claimed* hosts stand at the station; it added them to the room and never moved them. Hosts now stand **beside** the beat's station (beside, not on: the station cell is where the player stands), with idle anchors reserved first so nobody is placed on top of anyone.
- **Élise's bench reported the cloth shelf**, which is across the room and somebody else's problem. The bench and the atelier now report the work; the cutting table keeps the shelf, which is beside it.
- **The stair said "Nothing to look at from here."** It is a station guided navigation deliberately sends you to, and §3.2 makes the press wall the thing you pass on every trip between floors. It reads the press wall now, as do the boutique floor and the atelier. **No station the guide offers is a dead end** — now an ADR-005 §8.1 rule.

And two in the environment:

- **The room was not enclosed.** Only `y = 0` was walled, so MAISON read as a floor slab floating in black — the opposite of §3.1, which makes the 4.6 m ceiling "the single most important number in the room". A one-cell shell now runs outside the play area: full height on the far side, a low sill on the near side. It claims no cell and moves no prop, so every invariant over `FURNITURE` is untouched.
- **NPCs were the one thing in the room the mouse could not touch**, though §7 lists each of them as an interactable. They are hotspots now, rebuilt with the cast.

### 19.1.2 Converging with the Café on guided navigation

The Café landed guided navigation independently at the same time, and the two arrived at the same store shape — a one-shot `walkTo: Cell | null` that the canvas paths to and clears. MAISON's field was renamed to match, because two interiors should not each invent a vocabulary for the same idea.

They diverged on the surface, and **the Café's was right.** MAISON first bound `Tab` to cycle the list. That is worse accessibility than the thing it was meant to serve: hijacking `Tab` strips DOM focus navigation out of the interior entirely. The Café renders real `<button>`s inside a labelled `<nav>`, so the browser's own `Tab` reaches them and a screen reader reads them as a list of places. MAISON now does the same, and keeps only what is genuinely its own: **the first entry is wherever the season is waiting, named by whoever is holding it** — which is exactly what the mission tracker needs, and is why §8's chains fit the existing nav without changing it.

Merging the two surfaced a real bug in MAISON's key handling. The room treated **Enter** as "act", so activating a nav button by keyboard both walked you *and* acted on wherever you were still standing — and the act won, because opening a panel locks the room before the walk order lands. **Enter now belongs to whatever control has focus; `E` stays the room's own key whatever has focus.** Also an ADR-005 §14.2 rule now.

### 19.2 Framework files touched, and why

A building PR should touch only its own folder (master PRD §7.3). These were the exceptions, each closing a gap rather than reaching into shared code for convenience:

| File | Change |
|---|---|
| `src/world/cityMap.ts` | `VenueKind` gains `"scenario"`; `fashion_brand` becomes MAISON |
| `src/ui/CityScreen.tsx` | Routes `"scenario"` to the venue's own panel |
| `src/lib/decisionTree.ts` | New — the traversal, beside `sim.ts` and `budget.ts`; later `presentationOrder()` |
| `src/activities/content.ts` | `decision_tree` joins the union; venue content maps merge into `ACTIVITY_CONTENT` |
| `src/activities/renderers/DecisionTreeRenderer.tsx` | New |
| `src/activities/PlayerShell.tsx` | Dispatch branch; the silent-tier close; `activity_submitted`; the dev-world unscored close |
| `src/framework/events.ts` | `activity_submitted` — the choice, not just that a choice happened |

### 19.3 Standing debts

- **§6's audio does not exist.** Room tone, the sewing machines' run-and-stop, the steam press, the heavy door with no bell — all §17 lines, none recorded. §6's whole conceit is that the atelier's mood is carried by **how much noise the work makes**, so this is a gap rather than a detail. The visual half is in and bound to `atelier_mood`.
- **The art is procedural.** Every prop is vector `Graphics`, baked. `PROP_SPRITE` is the seam where real art takes over per kind. **The garment set — eight silhouettes × four colourways, §18.4's critical path — is not started.**
- **Kobby does not patrol** (§5.2). He stands at the cutting table rather than drifting down to look at his own pieces on the rail. **Mission 7 objective 4 (§8.2) depends on this**, so it is no longer cosmetic.
- **The room has no moving part.** The Café's counter flap is a reduced-motion-aware affordance with a sound and an announcement; MAISON animates only the player and the people.
- **The free Véra phone** (§9.6). Present as a *choice* in the C2 trees, which is the scored mechanic. Absent as a free, unscored, always-available call.
- **The §18.2.1 plausible-peers audit is owed.** The sixteen follow-up layers were authored to §9.5's stated intent by Claude, not by this document's author. The machine pass runs in CI; the **fresh-reader pass is blocking and still required before this venue is called done.**
- **The Café owes MAISON two things**, since it is the same standard: the early-armed `detach` and the `.catch` on the async build (without them a bake that throws leaves the city hidden and frozen — exactly how this room once failed), and the label/prompt linting tests.

### 19.4 Backend contract — MAISON

Full specification: **[PRD_Backend_Missions.md](PRD_Backend_Missions.md)**. MAISON's instance:

**Session blob** — `PUT /api/v1/city/buildings/fashion_brand/state`

```jsonc
{
  "rev": 14,
  "track": "SCB",
  "blob": {
    "missionOrder": 2,                  // "Three Times Faster"
    "objectiveIndex": 5,                // decide · transfer
    "partialPath": ["b", "a"],
    "pendingFollowupId": "fu_01J9…",    // re-served verbatim on resume
    "world": {
      "rail": "mixed", "atelier_mood": "steady", "press": "quiet",
      "cash": "tight", "capsule": "none", "stockists": "one",
      "ownership": "whole", "reputation": "rising",
      "countdown": "9w", "season": "current"
    },
    "playerCell": [4, 2],
    "trackerCollapsed": false
  }
}
```

**Replacing `maisonStore`'s local persistence.** `maisonStore` currently persists the season the way `eggStore` persists discoveries — `localStorage`, MAISON-owned. MAI-7 moves it behind the framework's session layer, keeping `localStorage` as the mirror. **The store's shape does not change**; only where it is written.

**Generating the transfer beat** — note the world state is sent as MAISON's own prose (§9.7.3):

```jsonc
POST /api/v1/ai/followup
{
  "activityId": "C2-SCB-03",
  "track": "SCB",
  "buildingId": "fashion_brand",
  "path": ["b", "a"],
  "speakerId": "elise",
  "worldState": { "rail": "mixed", "atelier_mood": "steady",
                  "press": "quiet", "cash": "tight" }
}
```

For **C2 only**, the response's option set is constrained to include one *"ask Véra"* option, per §9.6 and [ADR-006 §10.5](ADR-006_Missions_AI_Followups_and_Session_State.md).

**Speaker resolution** ([ADR-006 §9](ADR-006_Missions_AI_Followups_and_Session_State.md)) in this house:

| Mission | Host | If absent | Resolves to |
|---|---|---|---|
| 1 | Ines | she has left after her call | **Élise** — anchor |
| 3, 6 | Hélène | she has gone | **Élise**, or **Kobby** if the player is in the atelier (step 2) |
| 4 | Dov | he has gone | **Élise** — anchor |
| 5, 8 | Rio | he has gone | **Élise** — anchor |
| 7 | Élise / Kobby | never absent | step 1 |
| 9 | *the wall* | — | **Élise** — she is upstairs and has not said anything about either clipping, which makes her the right person to be asked |

**Degradation** is identical to the Café's §19.7, with one MAISON-specific note: the dev fixture (`devFixture.ts`) already proves the building plays with no backend at all. A submit offline says plainly that nothing scored it, and **the house still moves, because the house moves on the trace and never on the score.**

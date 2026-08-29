# PRD — THE CAFÉ · a small neighbourhood coffee shop

> **This document supersedes `cafe.md` and `cafedev.md`.** `cafe.md` was this document's predecessor; `cafedev.md` was the engineering plan, and its unique content — the projection and camera decisions, the counter flap's contract, the room invariants and the Pixi-`Application` investigation — is folded into §20. There is one Café PRD from v2.0 onwards.

_The City · Building 01 · Market Street · **v2.0** · 2026-08-04 · **Status: Draft for sign-off** · Owner: TBD (one dev, per CODEOWNERS) · City venue id: `cafe`_

_Inherits [ADR-005 v2.0 — Interior Framework](ADR-005_Interior_Framework.md) for the interior pattern, the silent-tier contract, accessibility and budgets, and [ADR-006](ADR-006_Missions_AI_Followups_and_Session_State.md) for the mission spine, the three-beat decision and session state. Backend endpoints are specified in [PRD_Backend_Missions.md](PRD_Backend_Missions.md); §19 below carries the Café's concrete payloads. Read those first. This document specifies **only what is true of this building**._
_Parent: [PRD_City_Frontend.md](PRD_City_Frontend.md) · Siblings: [MAISON](PRD_Building_MAISON.md) · [MERIDIAN](PRD_Building_MERIDIAN.md)_
_Content source: `Playroom Scenarios.xlsx` → sheet **`CAFE New`** (the `CAFE` and `CAFE old` sheets are superseded)._

---

## 0. Repo reality — what ships today, and what this version adds

### 0.0 Since v2.0 — the Café is an interview, not a season

> **Read this before §8 and §5.** The nine-week season this document specifies
> was built and then taken out again. What the Café is today is **one job
> interview**, and the rest of the document is the design history behind the
> content it asks.
>
> - **The nine competencies survived; the season did not.** The same nine
>   scenarios are asked in one sitting as nine interview questions — seed,
>   authored follow-up, AI transfer beat, exactly as §9.6 specifies — and the
>   sitting ends with an offer rather than with a week 18. There are no
>   missions, no objective chains and no mission tracker.
> - **The interviewer is Owen, the area manager** (`cast.ts`, `INTERVIEWER`).
>   Not Priya: the person assessing you cannot also be the person pulling your
>   shot. He is seated at the four-top with a laptop, and **speaking to him is
>   what starts the interview** — there is no station and no button.
> - **The room is two people.** `castFor()` returns Priya and Owen in every
>   world state, plus one ambient customer. Marcus, Tomas, Nadia, Ray and
>   Ellery are still written in §5 and still in `CAST`, waiting for the stages
>   after the interview; they are not in the room.
> - **The five hotspots are gone**, and with them the twelve-chip guided-nav
>   list. `GUIDE` has one destination — the interview table — plus whoever is in
>   the room. §7's interactable list and the `ht_*` ids in §0.1 and §8 are
>   history.
> - **The city asks for it.** One objective line in the HUD naming the Café,
>   and a gold marker on the building, cleared once the first question has been
>   answered (`src/framework/city/firstMission.ts`). Not a quest system.
>
> §0.1 and §0.2 below are the repo as it stood at v2.0 and are kept as the
> record of what this document was written against.

### 0.1 What exists

`src/buildings/cafe/` is a **walkable 2.5D isometric room**, and it is the house standard every other interior is read against.

| Shipped | Where |
|---|---|
| A **12 × 10 cell grid** with a one-cell wall ring; spawn `(4,8)` just inside the door, exit `(4,9)` in the near sill | [`room.ts`](../src/buildings/cafe/room.ts) |
| `FURNITURE` as the single source of layout truth, with **overlay props** (till, pastry case, espresso machine) drawn on their host cell without claiming it — this is what keeps the staff zone navigable behind a solid counter run | `room.ts` |
| **The counter flap** at `(4,2)` — a real gate, the only route into the sealed staff zone, reduced-motion-aware, with a sound and an announcement. The only moving part in any interior in the city | `room.ts` `GATES` |
| Four zones, first-match-wins: `z_pass` · `z_behind` · `z_window` · `z_floor` | `room.ts` `ZONES` |
| Six stations — `st_counter` · `st_flap` · `st_jukebox` · `st_tables` · `st_window` · `st_door` — and four hotspots: `ht_chalkboard` · `ht_board` · `ht_window` · `ht_pass` | `room.ts` |
| Procedural props baked once, `NEAR_EDGE` low sill so the frontmost row never clips the player's feet | [`props.ts`](../src/buildings/cafe/props.ts), [`scene.ts`](../src/buildings/cafe/scene.ts) |
| Guided navigation as real `<button>`s in a labelled `<nav>` — **the pattern MAISON converged on** | [`Interior.tsx`](../src/buildings/cafe/Interior.tsx) |
| Steam emitter, day/night tinting, manifest + registry entry, lazy interior gate | [`steam.ts`](../src/buildings/cafe/steam.ts), [`manifest.ts`](../src/buildings/cafe/manifest.ts) |


### 0.2 What does not exist

- **No cast.** There is no `cast.ts`. Priya, Marcus, Nadia, Ray, Ellery and Tomas exist in this document and nowhere in the code. The room is beautiful and empty.
- **No decision content.** No `trees/`, no registry binding, no submit path. MAISON has all eighteen trees; the Café has none.
- **No missions.** [ADR-006 §6](ADR-006_Missions_AI_Followups_and_Session_State.md)'s spine, tracker and runner are unbuilt anywhere.
- **No audio.** §6's whole conceit is that the room's mood is carried by sound. None of it is recorded.
- **No hero art.** Every prop is procedural. The espresso machine, the chalkboard and the pastry case are the three that want real art (§4).
- **Two framework debts the Café owes**, named in [MAISON §19.3](PRD_Building_MAISON.md) because MAISON hit them: the **early-armed `detach`** and the **`.catch` on the async build**. Without them a bake that throws leaves the city hidden and frozen — the worst possible failure, since the player cannot even walk away. Also owed: the label/prompt linting tests.

### 0.3 What v2.0 of this document adds

| § | Change |
|---|---|
| **§8** | Rewritten as **nine missions with objective chains** (ADR-006 §6), replacing the "staging table" of v1.0. This is the largest change in the document |
| **§9.6** | New — **the AI transfer beat**: persona cards, generation context, and the 18-entry scripted fallback bank |
| **§10.3** | The `aiBeat` rubric block. **The terminals tables are unchanged** |
| **§11** | Extended to the mission tracker and to generated lines |
| **§19** | New — **the Café's backend contract**: concrete payloads, the session blob, save triggers, the exit flush |
| **§18** | CAF-5 / CAF-6 / CAF-7 phases; acceptance criteria for fallback parity, tracker cleanliness and resume |

### 0.4 Station-name reconciliation

v1.0's §8 named stations that predate the shipped room. The mapping is fixed here once, and §8 uses the **shipped** ids throughout:

| v1.0 name | Shipped id | Note |
|---|---|---|
| `st_till` | `st_counter` | the till is an overlay prop on the counter run |
| `st_bar` | `st_counter` | same station; the fiction distinguishes them, the grid does not |
| `st_till_night` | `st_counter` | the night beat is a world state (`season: night`), not a second station |
| `st_board` | `ht_board` | a hotspot, not a station — but it must be **added to the guide list** so a `go_to` can target it (ADR-006 §13) |
| `st_window` | `st_window` | unchanged |
| `st_table_4` | `st_tables` | unchanged in substance |
| `st_passthrough` | `ht_pass` | same treatment as `ht_board` |
| `st_counter_end` | `st_flap` | the far end of the counter run, by the flap |

**Consequence for the dev:** `ht_board` and `ht_pass` become entries in `guide.ts`. That is the only room change §8 requires.

---

## 1. TL;DR

You push open a door on Market Street and the city falls away behind you. You are standing behind the counter of a small coffee shop with four staff, a set of regulars who have sat in the same seats for years, six flat weeks of sales, and not much money. It is yours from this morning.

Over one season — nine weeks, nine decisions — you will decide what to sell, what to spend, who to keep, and what you will not do for money. Nobody tells you which choice was right. The room tells you what happened instead: the chalkboard gets rewritten, the light changes, the regulars' table fills up or it doesn't, and by the last week you are standing in a café that is measurably the consequence of you.

**The fantasy in one line:** *it's your café, and the room remembers.*

**Why this is building 01.** The Café is the smallest business in the city and therefore the clearest. Every competency has a concrete, physical expression at this scale — cash is a drawer, a team is one person you can see from where you stand, reputation is whether Marcus is in his chair on Thursday. It is the vertical slice for the whole interior framework: if the loop is not moving here, it will not be moving at a bank.

---

## 2. Scope

### In scope

- One 2.5D isometric interior: a single room plus a visible back-of-house pass-through and a street view. **Shipped** (§0.1).
- Six named NPCs plus an ambient customer loop.
- **Nine missions**, strictly ordered, each with an objective chain (§8).
- Nine competency decision trees × two tracks (Level A → `SCA`, Level B → `SCB`) = **18 trees, 162 authored leaves**, plus **18 scripted fallback transfer beats** (§9.6).
- A visible world-state model with ten keys driving props, light, cast presence and ambience.
- The end-of-journey report as a diegetic object.
- Registry content for `C1-SCA-01 … C9-SCA-01` and `C1-SCB-01 … C9-SCB-01`.
- Session state synced to the backend during play and flushed on exit (§19).

### Out of scope

- Any change to shared framework code (ADR-005 §8.4 — hard rule). Framework gaps go to the maintainer. **Note:** the mission runner, the tracker and the transfer-beat client (ADR-005 §17 G9–G11) are framework work that will be *built during* the Café's phases — as maintainer PRs, not as Café files.
- Implementing any backend endpoint. The Café *consumes* BE-13…BE-18; the Go work is [PRD_Backend_Missions.md](PRD_Backend_Missions.md) and belongs to the backend owner.
- The kitchen as a walkable space — visible through the pass-through, never entered.
- A café management sim. There is no drag-a-cup minigame, no timed service loop. The interactions are: walk, act, talk, decide.
- Multiplayer, co-presence, or any other customer than the ones the script brings.

### Assumptions this PRD depends on

| Assumption | Source | If false |
|---|---|---|
| `SCA` and `SCB` levels exist in the registry | BE-13 | Nothing can seed. The room is walkable but no mission opens |
| `coinsByProficiency` is `{1:5, 2:15, 3:25}` | BE-14 | Rewards are off-scale but nothing breaks |
| `city/state` and building-session endpoints exist | BE-15 / BE-16 | Falls back to `localStorage`; the season persists locally and is lost on another device |
| `POST /ai/followup` exists | BE-17 | **Nothing breaks** — the 18-entry fallback bank serves every transfer beat and the player cannot tell |
| The `aiBeat` rubric block is live | BE-18 | Missions score on the authored terminal alone; proficiencies skew slightly high, nothing errors |
| Framework G9–G11 are built | ADR-005 §17 | No missions, no tracker, no transfer beat. This is the real blocker |

---

## 3. The world

### 3.1 The room

**A 10 × 8 walkable play area inside a 12 × 10 grid** with a one-cell wall ring — call it roughly 9 m × 7 m in fiction. Small enough that you can see everyone in it from anywhere, which is the whole point: this is a business where every problem is in the same room as you. The whole room fits on one screen at 1280×720, so the camera is framed once and stays framed (`fitScale`, clamped to ≤ 1 so nothing is ever upscaled).

```
                      ← Market Street (visible through glass) →
   ┌────────────────────────────────────────────────────────────────┐
   │  ░░░░░░░░░░░░  WINDOW WALL  ░░░░░░░░░░░░░░░░░░░░░░░  [ DOOR ]  │  SW
   │  ░                                                    ░  bell  │
   │  ░   ┌────┐        ┌──────────┐        ┌────┐         ░        │
   │  ░   │ T1 │        │    T3    │        │ T2 │      ┌──┴──┐     │
   │  ░   └────┘        │ REGULARS │        └────┘      │ T4  │     │
   │  ░  two-top        └──────────┘       two-top      │ high│     │
   │  ░                   four-top                      └─────┘     │
   │  ░                                                             │
   │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ COUNTER ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │
   │   till    pastry case   grinder   ESPRESSO MACHINE   end-run    │
   │  ═══════════════ CHALKBOARD (above, wall-mounted) ═══════════   │
   │  ┌──────────┐                                    ┌───────────┐  │
   │  │  BOARD   │            back bar                │PASS-THROUGH│ │
   │  │ community│                                    │  → kitchen │ │
   │  └──────────┘                                    └───────────┘  │  NE
   └────────────────────────────────────────────────────────────────┘
```

**Zones** (`InteriorScene.zones` — announced on entry, drive audio and ambience):

| id | name | Feel |
|---|---|---|
| `z_floor` | *the floor* | Where customers are. Warmest light, most footfall, most noise. |
| `z_behind` | *behind the counter* | Your side. Machine noise, the till, the chalkboard within arm's reach. |
| `z_window` | *by the window* | Street sound bleeds in. Where you go to look at what the competition is doing. |
| `z_pass` | *the pass-through* | The only private corner. Out of earshot of the floor by about two metres, which matters in C7. |

### 3.2 Circulation and sightlines

The counter is the spine. You spawn **behind it**, at the till, facing out — the first thing you see is your own room with people in it, and the door dead ahead. Everything is reachable in under six seconds of walking; nothing is more than one turn away.

Three deliberate sightlines:

1. **Till → door.** You always see who comes in. The bell means you hear them first, look up second — a rhythm the ambient loop leans on hard.
2. **Behind the counter → the regulars' table.** Marcus's chair is directly in your eyeline from where you work. This is why C9's empty table lands.
3. **Anywhere → the window → the street.** The iso city you left is visible outside, stylised and slightly out of focus. In C3 the food truck parks in that frame. In C9 a new awning appears across the road. **The threat is always visible from inside**, which is the honest version of running a small shop.

The pass-through is the one place you cannot be seen from the floor. Every conversation that should not happen in public happens there, and the framework's proximity system is tuned so that the ambient customer chatter ducks when you stand in `z_pass`. Privacy is rendered as an audio mix.

### 3.3 The unforgettable thing

**The chalkboard and the regulars' table.**

The chalkboard above the counter is not decoration. It is the running record of every decision you have made about what this café sells, rewritten between weeks in Priya's handwriting, and the player can walk up and read it at any time. Adding oat milk puts a line on it. Renaming the iced drink changes a word. Taking the delivery app puts a small logo in the corner, and building your own direct channel takes it off again and replaces it with a phone number. Nine weeks in, the board is a physical diff of your season.

The four-top by the window is the other half. It fills, thins and refills according to `regulars`, driven by C1, C8 and C9. Marcus is in the same chair every morning until he isn't.

Between them they do the thing the silent-tier contract needs: **feedback with no verdict attached.** The board says what you sell. The table says who is still here. Neither says "good" or "bad" and neither has to.

### 3.4 The season

Nine decisions map onto one season, and the room ages through it. Between weeks the screen does not cut away — the light shifts over about 1.2 seconds, ambient density changes, and Priya is mid-way through rewriting something when you look back at the board.

| Week | Competency | Light | Room temperature |
|---|---|---|---|
| 1 | C1 · Problem Sensing | late-spring morning, high and clean | busy, easy |
| 3 | C2 · Learning Agility | the same, a shade warmer | busy |
| 5 | C3 · Courage to Commit | first properly hot day, glare on the window | loud, street noise up |
| 8 | C4 · Financial Discipline | **night** — the only closed-café beat | silent, one lamp |
| 10 | C5 · Strategic Thinking | high summer, flat overhead light | steady |
| 12 | C6 · Power & Influence | late summer, long light through the glass | quiet mid-morning |
| 14 | C7 · People Management | first grey day | tense, thin |
| 16 | C8 · Value Creation | autumn, low gold | steady |
| 18 | C9 · Perseverance | late autumn, blue and short | depends entirely on you |

The week-8 night beat is the structural centrepiece: chairs up, machine cooling, no NPCs, the takings on the counter and nobody to perform for. It is the only time in the building you are alone, and it carries the money decision on purpose.

---

## 4. Art direction

**One line:** *warm, worn, and a little too small* — a room that has been loved by other people before it was yours.

| Element | Direction |
|---|---|
| **Palette** | Burnt oak, oxblood tile, brass, cream plaster, chalk white. One cold accent only: the daylight through the window glass, which is deliberately bluer than everything else so the room reads warm by contrast. 18 colours total, derived from the shared city LUT. |
| **Materials** | Matte everywhere except three surfaces — the espresso machine (brushed steel), the counter top (worn lacquer), and the window glass. Specular is a storytelling budget here; spend it on the machine, because the machine is a character. |
| **Wear** | Every horizontal surface has a story. Ring marks on the counter. A chip in the tile by the door. The four-top's varnish worn pale where forearms go. This is texture work, not geometry — one shared wear overlay. |
| **Key light** | From the window, low and warm, angled so it lands across the floor and clips the counter edge. The chalkboard is deliberately in the shade so the chalk reads bright. |
| **Practicals** | Three pendant bulbs over the floor (emissive cards, no point lights), the pastry case glow, the machine's group-head lamp. At night, only the pendant over the till. |
| **Silhouette** | Low-poly, chamfered, no micro-detail (ADR-005 §16.2). Chairs are four planes and a back. The espresso machine gets the polygon budget nothing else does. |
| **Negative space** | The floor is emptier than a real café. Deliberate — a walkable grid needs more room than a photograph does, and a room you can move through cleanly feels better than a room that is accurate. |
| **Depth** | Row-ordered. The frontmost row is a **low sill (`NEAR_EDGE`)**, never a full wall — a full-height frontmost prop clips the player's feet, which is exactly how MAISON's shopfront failed. |

**Candidate CC0 sources** (each pending license audit before use — ADR-005 §16.1):

| Need | Candidate | License |
|---|---|---|
| Room shell, counters, shelving | Kenney *Retro Urban Kit*, *Mini Market* | CC0 (verify) |
| Tables, chairs, stools, lamps | Kenney *Furniture Kit* | CC0 (verify) |
| Cups, pastries, bottles, crates | Kenney *Food Kit* | CC0 (verify) |
| Characters | `src/world/characterArt.ts` — baked procedurally, four facings, zero PNGs | n/a (ours) |
| Espresso machine (hero prop) | **Bespoke** — kitbash from kit parts, one artist, one batch | n/a |

The espresso machine, the chalkboard and the pastry case are the three hero props and are worth building rather than borrowing. Everything else is kit.

---

## 5. The cast

Six named characters. **Never more than four present at once** (ADR-005 §15 caps skinned meshes at six on screen; ambient customers eat the rest of the budget).

### 5.1 Priya Raman — head barista

- **Who.** 26. Been here three years, longer than you. Fast hands, dry mouth, notices everything and comments on about a fifth of it. She is the best thing about this café and she knows it, which is not the same as being difficult.
- **Look.** Apron over a plain tee, sleeves pushed up, hair tied back and losing. Warm skin tones, one bright element (a green band on the wrist) so she reads instantly across the room.
- **Anchor.** At the machine, `z_behind`. Rarely leaves it. Patrol: machine → grinder → counter end → machine.
- **Animation.** `work` (default, at the machine), `wipe`, `talk`, `listen`, `lean` (against the back bar when something's wrong).
- **Voice.** Short sentences. Understatement. She asks questions she already knows the answer to, as a courtesy. *"So is that good or not?"* *"We keeping the almond?"*
- **Carries.** C2 (the iced drink she championed to the team on your say-so), C7 Level A (she is the one arriving late), C4's aftermath, and the end-of-journey letter.
- **Gaze.** `player_near`. She looks up when you come behind the counter, every time. It is a two-frame effect that does more for presence than anything else in the building.

### 5.2 Tomas Bergström — second barista

- **Who.** 30s. Brilliant on the bar and genuinely faster than Priya on a rush. Also the reason the rota is a running argument. In Level A he is background; in Level B he is the high performer whose presence is costing you the rest of the team.
- **Look.** Same apron, worn differently. Taller, broader, takes up more space than the room has.
- **Anchor.** The grinder end of the counter. Patrol: grinder → pass-through → grinder.
- **Animation.** `work`, `lean`, `talk_emphatic`, `turn`.
- **Voice.** Confident, faintly amused, does not think he is being difficult. *"I moved my Thursday. It's fine — I cleared it."*
- **Carries.** C7 Level B.

### 5.3 Marcus Ofori — the regular

- **Who.** Late 60s, retired, in at 7:40 every morning without exception until the morning he isn't. Four-top by the window, newspaper, one long black, occasionally a second. He has been coming here longer than you have owned it.
- **Look.** Coat he never takes off. Reading glasses. The most static silhouette in the room, which is the point — you notice when the chair is empty.
- **Anchor.** T3, seated. Never patrols.
- **Animation.** `sit_read`, `sit_look`, `talk` (seated), `stand_leave`.
- **Voice.** Unhurried. Says the true thing without any weight on it, which is why it lands. *"It's a bit different, isn't it. The coffee."*
- **Carries.** C8 (he is the one who notices the beans) and C9 (he is the one who tries the new place).
- **The rule:** Marcus's presence is bound to `regulars`. `full` → in his chair. `thin` → chair empty, coat gone. `returning` → back, and he says nothing about having been away, which is worse and better.

### 5.4 Nadia Haddad — the commuter

- **Who.** Early 30s, in at 8:05, always slightly late, always takeaway. Polite, brisk, has somewhere to be. She has been buying her second coffee somewhere else for six weeks and has not mentioned it.
- **Look.** Coat, bag, phone in hand. Moves fast. Never sits — she is a silhouette at the till, which makes the C1 conversation feel stolen from her morning.
- **Anchor.** The till, `z_floor` side. Enters, orders, leaves.
- **Animation.** `stand_wait`, `talk`, `check_phone`, `walk`.
- **Voice.** Friendly and compressed. Says the important thing on her way out the door. *"You still don't do oat, do you?"*
- **Carries.** C1 (the dairy-free ask that is really an exit signal) and C5 (she has been ordering through the app).

### 5.5 Ray Delacroix — the food truck

- **Who.** 40s, runs a loaded-fries truck two streets over and wants your kerb on weekends. Loud, warm, entirely straight with you — he is not a villain, he is a man with a truck and a proposal. In Level B he doubles as your supplier's rep with a bulk offer that expires today.
- **Look.** Cap, forearms, a clipboard he does not need.
- **Anchor.** Appears first at the window (visible from inside before he comes in — a staging trick worth stealing for other buildings), then at the door, then at the counter.
- **Animation.** `talk_emphatic`, `lean_counter`, `gesture_outside`.
- **Voice.** Fast, generous, a closer's rhythm. *"Your crowd, my fries, Saturday. Tell me what's wrong with that."*
- **Carries.** C3.

### 5.6 Ellery Fitch — the office buyer

- **Who.** The office manager from the block behind you. Wants weekly coffee for their meetings and wants it at 40% off. In Level B she is the corporate account whose terms would tie up a year of your capacity at nearly no margin, and who mentions, pleasantly, that she has other options.
- **Look.** Laptop bag, lanyard, sits down before she's asked. Cooler palette than anyone else in the room — she is the one character lit slightly wrong for the café, on purpose.
- **Anchor.** T3, the four-top — she takes Marcus's table, which nobody mentions and everybody notices.
- **Animation.** `sit_laptop`, `sit_talk`, `sit_lean_back`.
- **Voice.** Warm, precise, entirely comfortable with silence. Her pressure is never raised.
- **Carries.** C6.

### 5.7 Ambient customers

Three unnamed skins on a shared loop: enter → queue → order (mimed at the till) → sit or leave. Density is bound to `regulars` and to the week. They never speak lines the player must read; they produce room noise and bodies, and their job is to make the room feel like it exists when nothing is being asked of you.

---

## 6. Ambient life

The liveliness budget for this interior, enforced in the frame loop (ADR-005 §15).

| Beat | Interval | Notes |
|---|---|---|
| Espresso machine steam | 8–20 s | Only while an NPC is at the machine. Audio + a short particle puff. |
| Grinder burr | 30–60 s | Loud enough to duck conversation for 1.5 s — used deliberately as a beat before a hard line. |
| Door bell + customer | 25–45 s | Density scales with `regulars` and week. Street audio swells for 2 s while the door is open. |
| Cup on saucer | 12–30 s | Positional, from wherever a customer is sitting. |
| Priya wipes / restacks | 40–90 s | Idle variation so she is never a statue. |
| Marcus turns a page | 45–120 s | Only when `regulars` is `full` or `returning`. |
| Pigeon on the window ledge | 90–180 s | Rare. A callback to the city billboard's *"the pigeons remain unbothered."* Continuity is cheap and people love it. |
| Street traffic through glass | continuous bed | Crossfaded from the Market Street district bed on entry — the city audio does not stop, it goes muffled, which is exactly what walking indoors sounds like. |

**Reduced motion / low-spec** (ADR-005 §14.5): the pigeon, the steam particles and the customer loop drop to a third; Priya and Marcus become stationary; the grinder and bell remain because they are informational.

**Audio.** Room tone (warm, small, slightly boxy), a low instrumental bed, the machine, the street. All CC0, all logged. **Open item:** a CC0 bed with the right warmth is the hardest asset to source here; the fallback is room tone only, which is honestly not worse.

---

## 7. Player presence

- **Spawn:** `(4,8)`, just inside the door, facing into the room. v1.0 spawned you behind the counter; the shipped room walks you in through your own front door instead, which is better — you arrive as a person, not as a fixture.
- **Movement:** click-to-move over the walkable grid, plus WASD/arrows. Walking pace only. The room is ten cells across; the whole point is that you cannot get away from anything in it.
- **The counter flap** at `(4,2)` is the only route into the staff zone, and it is **the only moving part in any interior in the city** — reduced-motion aware, with a sound and an announcement. Getting behind your own counter should cost one deliberate act.
- **Interactables:** the chalkboard (`ht_chalkboard`), the noticeboard (`ht_board`), the window (`ht_window` — the street, the truck, the rival's awning), the pass-through (`ht_pass`), the sample bag (mission 8 only), and **each NPC**. Every one answers the mouse *and* the `E` key.
- **Prompts:** a DOM prompt anchored to the prop, appearing within one cell. Priya's prompt is her name; the chalkboard's is *"read the board"*. Never *"Press E to interact with object_04"*.
- **Guided navigation** (ADR-005 §14.2): real `<button>`s in a labelled `<nav>` — six stations, four hotspots and the cast, in the room's own words. **The first entry is wherever the mission is waiting**, named by whoever is holding it. Do not bind `Tab`; `E` is the act key whatever has focus.
- **The mission tracker** sits top-left, showing the current objective (§8, §11.1).
- **Exit:** the door at `(4,9)`. Always available, never blocked. Leaving mid-mission flushes the season to the server (§19.4) and resumes at the exact objective, with the same transfer question waiting if one was pending.

---

## 8. The mission spine

> **v2.0.** v1.0 specified nine decisions "staged" at nine stations. That is now nine **missions**, each a chain of typed objectives ([ADR-006 §6](ADR-006_Missions_AI_Followups_and_Session_State.md)) with the current objective always readable in the top-left tracker. The staging table below survives inside it as the mission's `staging` line — nothing of the fiction is lost, and the player now knows what they are doing.

### 8.1 The season

Nine missions, strictly ordered, one season. Mission *n+1* does not exist until *n* closes.

| # | Wk | Comp | Title | Station | Host | Light | Room |
|---|---|---|---|---|---|---|---|
| 1 | 1 | **C1** Problem Sensing | The Dairy-Free Question | `st_counter` | **Nadia** | late-spring morning | busy, easy |
| 2 | 3 | **C2** Learning Agility | The Iced Drink | `st_counter` | **Priya** | a shade warmer | busy |
| 3 | 5 | **C3** Courage to Commit | The Truck | `st_window` | **Ray** | first hot day, glare | loud, street up |
| 4 | 8 | **C4** Financial Discipline | The Good Month | `st_counter` | **nobody** | **night**, one lamp | silent |
| 5 | 10 | **C5** Strategic Thinking | The App | `ht_board` | **Nadia** (offhand) | flat overhead | steady |
| 6 | 12 | **C6** Power & Influence | Forty Off | `st_tables` | **Ellery Fitch** | long light | quiet mid-morning |
| 7 | 14 | **C7** People Management | Late / The Best One | `ht_pass` | **Priya** / **Tomas** | first grey day | tense, thin |
| 8 | 16 | **C8** Value Creation | The Sample Bag | `st_flap` | **the sample bag** | autumn, low gold | steady |
| 9 | 18 | **C9** Perseverance | The New Awning | `st_window` | **the street** | blue and short | depends on you |

Missions 4, 8 and 9 have `hostNpc: null` by design. That is not an edge case to be tolerated — it is the register: the night beat is alone on purpose, the sample bag is an object on a counter, and the awning is a thing you see through glass. [ADR-006 §9](ADR-006_Missions_AI_Followups_and_Session_State.md) step 4 handles them, and the anchor NPC (**Priya**, present in every world state by construction) covers everything else.

**Pacing.** Between missions: a 1.2 s light transition, an ambient density change, and the closing mission's `closeWorldState` applied. The player is then free — walk, read the board, look out of the window, talk to whoever is in — and the next mission's first objective is simply *available*. **Nothing is ever on a timer.** The fiction applies the pressure; the game does not.

### 8.2 The objective chains

Every mission ends with the same three `decide` beats — `seed`, `follow`, `transfer` — and begins with at least one movement or conversation. The tracker shows exactly one line at a time.

---

**Mission 1 · C1 · "The Dairy-Free Question"** · week 1 · host **Nadia** · anchor **Priya**

> **Staging.** 8:05. The bell goes. Nadia's already reaching for her card before she's at the counter, the way she is every morning.

| # | Kind | Target | Tracker line | Cue / ack |
|---|---|---|---|---|
| 1 | `go_to` | `st_counter` | *take the counter* | — |
| 2 | `wait_for` | `nadia` | *8:05 — the bell* | The bell. Nadia comes in fast, phone in one hand. |
| 3 | `talk_to` | `nadia` | *serve Nadia* | — |
| 4 | `decide` | `seed` | *decide* | **Nadia:** *"You still don't do oat, do you?"* |
| 5 | `decide` | `follow` | *decide* | branch-specific — §9.3 |
| 6 | `decide` | `transfer` | *decide* | generated, in Nadia's voice — §9.6 |
| 7 | `report` | `priya` | *tell Priya where you landed* | **Priya**, not looking up: *"So what are we doing?"* |

`closeWorldState`: `{ season: "spring" }` · `aiWorldCandidates`: `[{ chalkboard: "oat" }, { chalkboard: "oat_plus" }, { regulars: "steady" }]`

---

**Mission 2 · C2 · "The Iced Drink"** · week 3 · host **Priya**

> **Staging.** Two weeks in. Priya has the numbers on the back of a docket and has clearly been waiting for you to ask.

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `inspect` | `ht_chalkboard` | *read the board* — the drink is still up there in your handwriting |
| 2 | `go_to` | `st_flap` | *get behind the counter* — **the flap**, the only way in |
| 3 | `talk_to` | `priya` | *ask Priya how it's going* |
| 4–6 | `decide` | seed · follow · transfer | |
| 7 | `inspect` | `ht_chalkboard` | *change the board* — or don't |

`closeWorldState`: `{ staff: "easy" }` · candidates: `[{ chalkboard: "iced_renamed" }, { chalkboard: "iced" }, { staff: "trusting" }]`

---

**Mission 3 · C3 · "The Truck"** · week 5 · host **Ray**

> **Staging.** The hottest day of the year. Ray's truck is at the kerb before he is at the door.

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `inspect` | `ht_window` | *something's parked outside* — you see the truck before you meet the man |
| 2 | `wait_for` | `ray` | *he's coming in* — the bell, and Ray filling the doorway |
| 3 | `talk_to` | `ray` | *hear Ray out* |
| 4–6 | `decide` | seed · follow · transfer | |
| 7 | `report` | `priya` | *tell Priya about Saturday* |

Ray appearing **at the window before he comes in** is a staging trick worth stealing for every other building: the threat, or the offer, is visible from inside first.

`closeWorldState`: `{ truck: "parked" }` (or `gone_rival` on the decline branch) · candidates: `[{ truck: "parked" }, { truck: "gone_rival" }, { regulars: "steady" }]`

---

**Mission 4 · C4 · "The Good Month"** · week 8 · **no host** · `season: night`

> **Staging.** 22:30. Chairs up, machine cooling and ticking as it goes. One pendant on over the counter. The month's takings are stacked in front of you.

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `go_to` | `st_door` | *lock up* — the door, from the inside, for once |
| 2 | `inspect` | `ht_chalkboard` | *look at what you sell now* — eight weeks of your decisions, in Priya's hand |
| 3 | `go_to` | `st_counter` | *count the month* |
| 4–6 | `decide` | seed · follow · transfer | **narration** — [ADR-006 §9](ADR-006_Missions_AI_Followups_and_Session_State.md) step 4. The room speaks; the takings on the counter are what the dialogue layer names |

**No `report` objective.** There is nobody to report to, and that is the point of the mission. This is the only mission in the season that ends with you alone in the room, and the tracker's last line before it clears is simply *go home*.

`closeWorldState`: `{ season: "autumn" }` · candidates: `[{ till: "healthy" }, { till: "strained" }, { machine: "upgraded" }]`

---

**Mission 5 · C5 · "The App"** · week 10 · host **Nadia** (offhand)

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `inspect` | `ht_board` | *something's on the noticeboard* — a promo card you did not pin |
| 2 | `wait_for` | `nadia` | *8:05* |
| 3 | `talk_to` | `nadia` | *ask Nadia about the card* — she means it as a compliment |
| 4–6 | `decide` | seed · follow · transfer | |
| 7 | `inspect` | `ht_board` | *deal with the card* |

`closeWorldState`: `{ board: "app_card" }` · candidates: `[{ board: "app_card" }, { board: "direct_card" }, { chalkboard: "app" }]`

---

**Mission 6 · C6 · "Forty Off"** · week 12 · host **Ellery Fitch**

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `wait_for` | `ellery` | *someone's taken the four-top* — Marcus's table, which nobody mentions |
| 2 | `go_to` | `st_tables` | *go over* |
| 3 | `talk_to` | `ellery` | *hear the offer* |
| 4–6 | `decide` | seed · follow · transfer | |
| 7 | `report` | `marcus` | *say something to Marcus* — he is standing, holding his paper, waiting |

Objective 7 is the whole mission. Ellery took Marcus's table; whatever you agreed at it, he was standing up while you did.

`closeWorldState`: `{ regulars: "steady" }` · candidates: `[{ till: "healthy" }, { regulars: "thin" }, { staff: "strained" }]`

---

**Mission 7 · C7 · "Late" / "The Best One"** · week 14 · host **Priya** (A) / **Tomas** (B)

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `inspect` | `ht_pass` | *check the rota* — pencil corrections that are not yours |
| 2 | `talk_to` | *host* | *ask them to step through* |
| 3 | `go_to` | `ht_pass` | *out of earshot* — the only private corner in this room |
| 4–6 | `decide` | seed · follow · transfer | |
| 7 | `report` | `priya` (track B: `tomas`) | *say what you decided, to their face* |

**The privacy is rendered in three channels** and must be, or it does not exist for half the audience: the ambient customer chatter ducks, the prompt reads *"out of earshot of the floor"*, and the live region says the same.

`closeWorldState`: `{ staff: "strained" }` · candidates: `[{ staff: "trusting" }, { staff: "strained" }, { staff: "easy" }]`

---

**Mission 8 · C8 · "The Sample Bag"** · week 16 · **no host** — the object carries it

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `go_to` | `st_flap` | *the delivery's in* |
| 2 | `inspect` | `bean_sack_sample` | *open the sample bag* — the sample, and the invoice under it |
| 3 | `talk_to` | `priya` | *pull a shot of it with Priya* |
| 4–6 | `decide` | seed · follow · transfer | Speaker resolves to **Priya** (step 1 — she is the objective-3 host and she is standing there) |
| 7 | `report` | `marcus` | *take Marcus his coffee* |

Marcus is in his chair behind you for the whole mission, reading. Objective 7 is you carrying him a cup you have just decided the price of.

`closeWorldState`: `{ beans: "good" }` (or `cheap`) · candidates: `[{ beans: "good" }, { beans: "cheap" }, { chalkboard: "beans_story" }]`

---

**Mission 9 · C9 · "The New Awning"** · week 18 · **the street**

| # | Kind | Target | Tracker line |
|---|---|---|---|
| 1 | `inspect` | `ht_window` | *there's a new awning across the road* |
| 2 | `go_to` | `st_tables` | *the four-top* — Marcus's chair is empty for the first time |
| 3 | `talk_to` | `priya` | *ask Priya what she's hearing* |
| 4–6 | `decide` | seed · follow · transfer | Speaker: **Priya** (anchor) |
| 7 | `inspect` | `ht_chalkboard` | *write next week* |

**Objective 2's empty chair is announced explicitly** (*"the four-top by the window is empty"*), because a consequence that exists only visually is a consequence half the audience never receives (§15).

`closeWorldState`: `{ rival: "open" }` · candidates: `[{ regulars: "returning" }, { regulars: "thin" }, { rival: "promo" }]`

---

### 8.3 What this requires of the room

| Need | Change |
|---|---|
| `ht_board` and `ht_pass` targetable by `go_to` | Add both to `guide.ts` (§0.4) |
| `bean_sack_sample` as a hotspot | New `FURNITURE` overlay at the counter end, week 16 only, gated on `world.beans` |
| Cast | `cast.ts` — six named skins, anchors, patrols, gaze, ambient lines (§5). **Does not exist yet** |
| Staged arrivals | `wait_for` needs an NPC to walk in through the door and reach an anchor. The bell + door already exist |
| Mission tracker | Framework (ADR-005 §17 G9). The Café is where it gets built |

---

## 9. Decision content

### 9.1 How to read this section

Each decision is a two-beat tree (ADR-005 §9.2): a seed with three choices, then a **branch-specific** follow-up with three more. Nine leaves. The tier of each choice is recorded in §10 and appears **nowhere** in shipped client content.

Choice letters are shuffled per activity so that position never correlates with tier (ADR-005 §11.4 rule 5). The shuffle is recorded in the tier map in §10.3 and nowhere else.

### 9.2 Rewrites of the source blueprint

The source blueprint contains phrasings that mark the weak option, which violates the plausible-peers rule. These are rewritten here, and the rewrite is the shipping text.

| Where | Source phrasing | Problem | Shipping text |
|---|---|---|---|
| C4-A | "Buy the upgraded espresso machine — you earned it, and it'll impress people." | "You earned it" is the author judging the player | "Replace the machine. It's the oldest thing in the room, it's the thing everything else runs through, and a good month is exactly when you fix it." |
| C5-A | "Sign up — more orders is more orders." | Too short, glib; marks itself | "List with them. Reach you can't buy is worth a cut you don't like, and every order is an order you weren't getting." |
| C6-A | "Give the discount — a steady bulk order is worth it." | Too short | "Take the 40%. A standing weekly order is the only predictable revenue in this building, and predictable is worth paying for." |
| C8-A | "Switch to the cheaper beans — customers probably won't notice." | "Probably won't notice" frames it as deceit | "Take the cheaper beans. The difference is real in a cupping room and nearly invisible under milk, and the margin is what keeps the lights on." |
| C9-A | "Quickly drop your prices to win the regulars back fast." | "Quickly" and "fast" mark it as reactive | "Cut prices while they're still deciding. Habit is the whole business at this size, and habit is cheapest to defend before it breaks." |
| C3-A | "Decline — it's too risky to commit without knowing the impact." | Short; hedged where others are confident | "Say no. You'd be handing your Saturday lunch trade to a man with a fryer, and you can't model what that costs until it's already gone." |
| C9-B | "Make a bold, fast pivot to counter them before you lose more." | "Bold, fast" is author praise attached to the weak option | "Move first and move big. Three weeks of decline is a trend, and the worst thing you can do against funded competition is nothing." |

**General rule applied throughout:** every option carries its own justification and is written by someone who believes it — and choice length is held to parity, because it is the tier leak nobody looks for.

The first draft of this document failed that. Measured across all 69 choices, the Advanced options ran systematically longer than their peers (worst trio: 25 / 9 / 19 words), which makes *"pick the longest option"* a partial strategy with no tier vocabulary involved. Every trio was rewritten. The shipping content measures **13–33 words, median 23, and no trio spread above 8 words** — the numeric rule now recorded in [ADR-005 §11.4](ADR-005_Interior_Framework.md). It is checked by script (§18.3), not by eye.

---

### 9.3 Exemplar A — `C1-SCA-01` · "The Dairy-Free Question" (Level A, fully worked)

**Station** `st_till` · **Host** Nadia · **Week 1**

> **Stage.** 8:05. The bell goes. Nadia's already reaching for her card before she's at the counter, the way she is every morning. She orders, then stops halfway through putting her phone away.
>
> **Nadia:** *"You still don't do oat, do you?"*
>
> It's the third time this week someone's asked. Behind you, Priya doesn't say anything, which is Priya's way of saying something. There's enough in the till for one move this month.

**Seed choices**

| | Text |
|---|---|
| **a** | "Chalk a card and prop it by the till — *Oat milk? Should we?* — and see how many people actually react over two days." |
| **b** | "Order oat and almond this week. People are telling you what they want, and in a shop this size the one who moves first wins." |
| **c** | "Ask Nadia — and the others who've asked — what they'd actually do if you had it. Find out whether it's a nice-to-have or the reason they'd stop coming." |

**Seed consequences**

- **a** — *You prop the card by the till. Over two days eleven people tap it and three write their names underneath in Priya's chalk. You order one crate of oat with a number in your head instead of a hope.* → `chalkboard: oat_asked`
- **b** — *Two crates arrive Thursday. The oat moves. Three weeks later you find the almond behind the fridge, unopened, four days past date. You bought what people said, not what they'd pay for.* → `chalkboard: oat_plus`, `till: tight`
- **c** — *Nadia tells you she gets her second coffee at the place by the station three mornings a week, because they do oat and you don't. Two others say the same thing without being asked. It was never really about milk.* → `regulars: thin`

**Follow-up — branch a** *(you tested first)*

> The crate arrives. Oat sells — nine cups, then eleven, then seven. Not the flood the card suggested. Priya, wiping down: *"So is that good or not?"*

| | Text |
|---|---|
| **a** | "Eleven people said yes to a card and nine actually bought. Use the gap between those two numbers to calibrate the next test, not the next order." |
| **b** | "Nine cups a day is nine cups a day. Bring the almond in too and give the whole range a fair run before judging any of it." |
| **c** | "Hold at one crate a week, leave the card up another fortnight, and let the reorder rate make the call instead of you." |

**Follow-up — branch b** *(you ordered both)*

> The almond's a write-off and the till is thinner than it should be in a good month. Priya, not looking up: *"We keeping the almond?"*

| | Text |
|---|---|
| **a** | "Keep both on. Pulling something a fortnight after adding it makes the place look like it doesn't know what it is." |
| **b** | "Cut the almond, and spend the afternoon finding out what the oat buyers actually came in for. The crate's already lost — it should at least buy the answer." |
| **c** | "Drop the almond, keep the oat, and from now on reorder against what sold last week rather than what you hoped would sell." |

**Follow-up — branch c** *(you asked, and found the real reason)*

> You know now: it's the commuters, and it's the station café. Priya's already worked out what you're going to say. *"So do we chase them, or do we not?"*

| | Text |
|---|---|
| **a** | "Bring oat in and aim the whole morning at commuters — faster service, a takeaway price, out of the door in ninety seconds." |
| **b** | "Oat, yes. But the thing you're actually fixing is the 7:50-to-8:20 window. Time the queue for a week, then design that half hour properly." |
| **c** | "Match the station café properly — oat, soy, all of it — so there's nothing left worth walking down the road for." |

**Leaf consequences** (abbreviated; full prose in `script.ts`)

Each leaf resolves in the room within 4–6 seconds: a line from Priya, one world-state change, and — where earned — one staged beat. Examples: `c.b` ends with Priya writing **7:50 – 8:20** on the corner of the chalkboard and leaving it there for the rest of the season, which the player will notice again in week 10.

---

### 9.4 Exemplar B — `C4-SCB-01` · "The Good Month" (Level B, fully worked)

**Station** `st_till_night` · **Host** none · **Week 8**

> **Stage.** 22:30. Chairs up, machine cooling and ticking as it goes. One pendant on over the till. The month's takings are stacked on the counter in front of you — the best four weeks since you took the place on.
>
> It's also August. You've run this room long enough to know what September looks like.

**Seed choices**

| | Text |
|---|---|
| **a** | "Treat the month as weather, not climate. Work out what this place costs to run through a bad October, ring-fence exactly that, and invest only what could vanish without touching anyone's wages." |
| **b** | "Cover the slow stretch first — a realistic number, not a comfortable one — then put whatever's left behind the single thing that earns the most back." |
| **c** | "Put it to work while it's working. Momentum is the hardest thing to buy and the easiest thing to lose; a good month is when you extend, not when you sit on it." |

**Seed consequences**

- **a** — *You write two numbers on the back of a receipt: what a bad October costs, and what's left over. The second number is small. You spend it on the grinder, which was going anyway, and go home.* → `till: healthy`
- **b** — *You take last year's slow-season number, add a fifth, and put it aside. What's left goes on the loyalty cards Priya's been asking about for a year. It isn't exciting. It's the kind of decision nobody ever notices.* → `till: healthy`, `staff: trusting`
- **c** — *You commit to the second machine and the extra weekend hours. For three weeks it feels like the right call. Then the schools go back, the mornings thin, and you're carrying a payment on a machine that's cold by eleven.* → `till: strained`, `machine: upgraded`

**Follow-up — branch a** *(you ring-fenced properly)*

> October comes in worse than your bad-October number — not catastrophically, about a fifth worse. The reserve holds, but it is visibly draining, and Priya has started asking, carefully, whether her hours are safe.

| | Text |
|---|---|
| **a** | "Tell her the truth with a number in it: how many weeks the reserve covers at this rate. Then trim what can be trimmed without touching hours." |
| **b** | "Reassure her it's fine and keep the number to yourself until you have to share it. Worrying the team about a month that might still turn is its own kind of damage." |
| **c** | "Say plainly how far the reserve goes — then give October a job. Use the quiet mornings for the 7:50 window you've never had time to fix." |

**Follow-up — branch b** *(you covered the season and invested the rest)*

> October undershoots your reserve by about a fortnight's worth. The loyalty cards are working — but slowly, and slowly is not what a fortnight short needs.

| | Text |
|---|---|
| **a** | "Push the loyalty scheme harder. Double the stamps for a month and buy the traffic back while there's still a scheme to push." |
| **b** | "Separate the two problems. Fund the fortnight from something reversible, and let the loyalty scheme run on its own timeline instead of asking it to rescue you." |
| **c** | "Trim a fortnight of hours by agreement, close an hour earlier on the dead days, and protect the reserve rather than the schedule." |

**Follow-up — branch c** *(you spent it)*

> The machine payment lands on the 3rd. The takings don't. For the first time since you took this place on, you are short.

| | Text |
|---|---|
| **a** | "Name it out loud, to Priya and to the supplier, before either works it out alone — then restructure the payment while you still have credibility to spend." |
| **b** | "Go to the supplier for terms and cut every single cost that isn't the coffee or the wages. This week, not next month." |
| **c** | "Trade through it. A tight month is a tight month, and the machine pays for itself the moment the mornings come back." |

---

### 9.5 The remaining sixteen trees — seed layer and follow-up specification

The seed layer below is the shipping text (post-rewrite). The follow-up branches are specified by **prompt and tier intent**; the leaf prose is authored against the rules in ADR-005 §11.4 and reviewed under §11.5.

#### C2 · Learning Agility

**Level A — `C2-SCA-01` "The Iced Drink"** · `st_bar` · Priya · Week 3
> Two weeks in. Priya has the numbers on the back of a docket and has clearly been waiting for you to ask.

- Ask the people who walked past it why they didn't order, then change the recipe on what they tell you.
- Keep pushing it. A drink that's this good takes a month to find its people, and pulling it early kills things that would have worked.
- Change exactly one thing — the price or the name — for a week, and let the difference decide it.

*Follow-ups:* **branch "asked customers"** → they say it's too sweet; do you fix the recipe and stop there, keep asking, or turn the finding into a habit? · **branch "kept pushing"** → a month gone, still flat; hold, quietly drop, or admit it to the team and rebuild? · **branch "one change"** → it lifted, but you changed price and name in the same week by accident; re-run clean, keep the win, or generalise the method?

**Level B — `C2-SCB-01` "The Drink You Championed"** · `st_bar` · Priya + Tomas · Week 3
> You told the team to get behind it. They did. It isn't working, and they are watching to see what you do about having been wrong.

- Run one clean test: change a single variable, measure it, and decide the keep-or-cut threshold before you look at the result.
- Hold the line. Reversing a fortnight after you asked the team to commit teaches them that your decisions are weather.
- Put the numbers on the counter in front of the team, ask them why they think it's missing, and change it on what they say.

*Follow-ups:* branch-specific, each turning on **whether the test was designed before or after the data** — the deepest form of the competency and the thing the follow-up exists to catch.

#### C3 · Courage to Commit

**Level A — `C3-SCA-01` "The Truck"** · `st_window` · Ray · Week 5
> The hottest day of the year. Ray's truck is at the kerb before he is at the door. He needs an answer tomorrow.

- Yes, but structured: you sell the drinks, he sells the food, and you split a combo so both sides have a reason to send people across.
- Say no. You'd be handing your Saturday lunch trade to a man with a fryer, and you can't model what that costs until it's already gone.
- Yes to a month, with a date in the diary to look at the numbers together and a clean way out if it isn't working.

*Follow-ups:* **"structured"** → his crowd is big but buys almost no coffee; renegotiate, ride it out, or redesign the combo? · **"declined"** → he parks outside the rival and takes the crowd with him; approach him, hold, or counter-programme? · **"one-month trial"** → the check-in date arrives with ambiguous numbers; extend, exit, or make the criteria explicit before extending?

**Level B — `C3-SCB-01` "Thirty Per Cent"** · `st_counter_end` · Ray (as supplier rep) · Week 5
> A bulk offer at 30% off, placed today or not at all. The saving is real. It would take most of your spare cash, and you have no idea what the quarter after next looks like.

- Pass. Tying that much cash to a forecast you don't have is the kind of risk that only looks smart in hindsight.
- Model your worst-case cash position honestly. If you'd survive it, take the whole deal and lock the saving in.
- Take a smaller order now with an option on the rest later — most of the discount, a fraction of the exposure.

#### C4 · Financial Discipline

**Level A — `C4-SCA-01` "The Good Month"** · `st_till_night` · none · Week 8
> Same staging as §9.4, smaller stakes and shorter horizon.

- Replace the machine. It's the oldest thing in the room, it's what everything runs through, and a good month is exactly when you fix it.
- Put most of it aside as a cushion and spend a little on the one thing customers have actually asked for.
- Back the single spend most likely to bring the same people through the door again next week, and leave the rest where it is.

**Level B — `C4-SCB-01`** — fully worked in §9.4.

#### C5 · Strategic Thinking

**Level A — `C5-SCA-01` "The App"** · `st_board` · Nadia (offhand) · Week 10
> A promo card on the community board you didn't pin. Nadia mentions she's been ordering through it. She means it kindly.

- Do the arithmetic on their cut first, then lift delivery prices enough to come out where you started.
- List with them. Reach you can't buy is worth a cut you don't like, and every order is an order you weren't getting.
- Use it to get found, then give every delivery bag a reason to order direct next time.

**Level B — `C5-SCB-01` "Forty Per Cent of You"** · `st_board` · Week 10
> The app now drives 40% of your orders. They've just raised the commission. Leaving costs you that volume overnight; staying costs you the margin. Whatever you decide today, you'll be living inside for two years.

- Absorb it. You cannot walk away from 40% of your orders on principle.
- Renegotiate, or price the app channel separately, and start nudging your repeat customers toward ordering direct.
- Build the direct channel properly, so that no single platform is ever again in a position to reprice you.

#### C6 · Power & Influence

**Level A — `C6-SCA-01` "Forty Off"** · `st_table_4` · Ellery Fitch · Week 12
> She's taken Marcus's table. Laptop open, coffee she bought herself, a number already decided.

- Ask what they actually need before you talk price, then build a package that serves it at a number that still works for you.
- Take the 40%. A standing weekly order is the only predictable revenue in this building, and predictable is worth paying for.
- Offer a smaller discount, tied to a minimum weekly order and a commitment up front, so the price you give matches the certainty you get.

**Level B — `C6-SCB-01` "The Account"** · `st_table_4` · Ellery Fitch · Week 12
> Steady revenue, a year's commitment, and terms that would leave you working at roughly nothing. She mentions, pleasantly, that she has other options.

- Meet the terms. Predictable revenue at thin margin still beats an empty diary.
- Hold the price and give ground on what costs you least — delivery windows, packaging, invoicing — and let them choose.
- Find out what they actually value, rebuild the deal around it, and be genuinely willing to walk.

#### C7 · People Management

**Level A — `C7-SCA-01` "Late"** · `st_passthrough` · Priya · Week 14
> First grey day. She's been late four times in two weeks and it's landing on everyone else. The pass-through is the only place in this room where a conversation stays between two people.

- Talk to her privately first, find out what's actually going on, and agree a fix together.
- Give a clear warning. Lateness that goes unaddressed in a team this size becomes everyone's lateness inside a month.
- Ask, listen, and deal with both the behaviour and its cause — adjust what you can support without moving the standard.

**Level B — `C7-SCB-01` "The Best One"** · `st_passthrough` · Tomas + Priya · Week 14
> Tomas is the fastest pair of hands you have and the reason two other people are miserable. Cracking down risks losing him. Not cracking down risks losing them.

- Back the performer. Results carry a small business, and the rest of the team adjusts to reality faster than they admit.
- Deal with the behaviour directly with him, and protect morale by being open with everyone else about what you're doing.
- Set one standard that applies to everybody, coach him toward it, and accept that holding it might cost you him.

#### C8 · Value Creation & Credibility

**Level A — `C8-SCA-01` "The Sample Bag"** · `st_counter_end` · the supplier's sample · Week 16
> A bag of the cheaper beans on the counter end and a number on the invoice that would fix this month. Marcus is in his chair behind you, reading.

- Keep the beans you use and start telling people why — put the roaster's name on the board and make the sourcing part of what this place is.
- Take the cheaper beans. The difference is real in a cupping room and nearly invisible under milk, and the margin is what keeps the lights on.
- Stay with the beans you use, absorb the thinner margin this month, and say nothing about it to customers or to the supplier.

**Level B — `C8-SCB-01` "The Quiet Cut"** · `st_counter_end` · Week 16
> There is a reduction you could make that this quarter needs and almost nobody would notice for a while.

- Make it. The numbers need it, the difference is marginal, and a quarter you survive is worth more than a principle you can't afford.
- Protect the quality and find the money somewhere harder — the rent, the hours, the two things on the menu nobody orders.
- Refuse it, and turn the standard into something people can see — build the kind of reputation that outlives any single quarter's numbers.

#### C9 · Perseverance & Adaptability

**Level A — `C9-SCA-01` "The New Awning"** · `st_window` · the street · Week 18
> A new café across the road, open a fortnight. Through two panes of glass you can see two of your regulars sitting in it. Marcus's chair is empty for the first time since you took this place on.

- Cut prices while they're still deciding. Habit is the whole business at this size, and habit is cheapest to defend before it breaks.
- Stay steady. Ask your regulars what they actually come here for, and then put everything you have into that one thing.
- Treat it as information. Work out what the new place does genuinely well, work out what you do that they can't, and compete on that.

**Level B — `C9-SCB-01` "Three Weeks Down"** · `st_window` · Week 18
> Well-funded competition, three straight weeks of decline, staff who have started reading the room, and cash that is tightening. This is the third hard stretch this year.

- Move first and move big. Three weeks of decline is a trend, and the worst thing you can do against funded competition is nothing.
- Steady the team, find out what is actually causing the drop, and adjust tactics without abandoning the direction.
- Absorb it. Work out precisely what to hold and what to change, and use the pressure to make both the business and yourself harder to move.

---

### 9.6 The transfer beat — beat three

Every mission's decision has a third beat, generated server-side from **both** prior choices and asked in the host's voice ([ADR-006 §7–§8](ADR-006_Missions_AI_Followups_and_Session_State.md)). Nothing about it is authored per-branch; what the Café authors is **who is speaking, what they may draw on, and what happens when the model is unavailable.**

#### 9.6.1 What it is for, in this building

The Café's two authored beats are about a small business under one pressure at a time. The transfer beat is where the same pressure comes back **wearing different clothes** — the station café moves its hours, the office wants a second site, the supplier who gave you 30% wants a reference. It is deliberately not a harder version of the follow-up; it is the next Tuesday.

#### 9.6.2 Persona cards

These go to the generator verbatim and are mirrored into `internal/registry/content/followups/cafe.json` so the fallback bank and the generated beat are written from one description of the character.

| NPC | Voice | Samples | Never |
|---|---|---|---|
| **Priya** *(anchor — resolves for any mission whose host is absent)* | Short sentences. Understatement. Asks questions she already knows the answer to, as a courtesy. | *"So is that good or not?"* · *"We keeping the almond?"* | Long speeches · management vocabulary · praising or criticising the player |
| **Nadia** | Friendly and compressed. Says the important thing on her way out the door. Has somewhere to be. | *"You still don't do oat, do you?"* | Sitting down · business vocabulary · dwelling |
| **Ray** | Fast, generous, a closer's rhythm. Entirely straight with you. | *"Your crowd, my fries, Saturday. Tell me what's wrong with that."* | Villainy · pressure tactics he would not actually use |
| **Ellery** | Warm, precise, comfortable with silence. Her pressure is never raised. | *"I should say we're also talking to the place by the station."* | Raising her voice · threatening · being unpleasant |
| **Marcus** | Unhurried. Says the true thing without any weight on it. | *"It's a bit different, isn't it. The coffee."* | Complaining · delivering a moral · being a lesson |
| **Tomas** | Confident, faintly amused, does not think he is being difficult. | *"I moved my Thursday. It's fine — I cleared it."* | Malice · self-awareness about the problem he is |
| **the room** *(missions 4, 8, 9)* | Second person, present tense, flat. Reports facts about objects. | *"The takings are still on the counter. It is twenty to eleven."* | Opinion · address · a voice of any kind |

**The rule that matters most here is the same one §11 makes about Priya: the persona card describes how they speak, never what they think of your decision.** A card that says "warmly approving when the player does well" would put a verdict in every generated line in the building.

#### 9.6.3 What the generator is given

| Input | Café value |
|---|---|
| Competency + subtopic | e.g. `C1 · empathy_pain` with the rubric's own definition |
| Fiction | *"A small neighbourhood coffee shop. Four staff, a set of regulars, six flat weeks, not much money. The player owns it."* |
| Mission staging | §8.2's staging line for that mission |
| Persona card | §9.6.2, for the resolved speaker |
| Prior choices | The **exact text** of the seed option and the follow-up option chosen |
| Track | `SCA` (16–21: fewer moving parts, shorter horizon) or `SCB` (35–50: competing legitimate interests, a real price) |
| World state | The ten keys of §12, current values only, from a closed enum |
| `aiWorldCandidates` | The 2–3 legal writes listed per mission in §8.2 |

#### 9.6.4 The fallback bank — 18 beats

**Nine competencies × two tracks.** Branch-agnostic but world-state aware: each may vary its opening clause on **one** named key. Authored to exactly the standard of §9.5, tier-mapped server-side, and audited by the same fresh reader.

| Mission | Track A fallback opens on | Track B fallback opens on | Varies on |
|---|---|---|---|
| C1 | the station café changes its hours | a second commuter group appears on a different line | `regulars` |
| C2 | a customer asks for the old version back | the team proposes their own change without asking you | `chalkboard` |
| C3 | Ray asks for a second weekend before the first is settled | the supplier offers the same discount to the café across the road | `truck` |
| C4 | the machine needs a part you did not budget for | the landlord raises the rent mid-season | `till` |
| C5 | a second app approaches with better terms | the app changes its terms again, quietly | `board` |
| C6 | Ellery's company opens a second office | a competitor offers her the same at your old price | `till` |
| C7 | the person you talked to asks for something the conversation implied | someone else asks for what you gave them | `staff` |
| C8 | a customer asks, directly, what changed | the supplier offers the good beans at the cheap price, once | `beans` |
| C9 | the new place runs an opening promotion | the new place quietly closes at three on weekdays | `rival` |

**Status: authored.** All eighteen live at `internal/registry/content/followups/cafe.json` in `backend-academy`, with the persona cards of §9.6.2 alongside them so the fallback and the generated beat are written from one description of each character. They pass the §11.5 machine pass — one of each tier per trio, 13–33 words per option, ≤ 8 words of spread, every option self-justifying, no verdict language, prompts under 60 words. **Not yet loaded**: `internal/registry/loader.go` reads only `content/c*.json`, so wiring the pack up is part of BE-17.

**Still owed:** the fresh-reader pass (§18.2.1). The machine pass is green; the human one has not run.

**A missing entry is a blocking defect** — `validate_registry` fails the build ([PRD_Backend_Missions §5.4](PRD_Backend_Missions.md)). This is what makes "no breaking at edge case" a property of the Café rather than an intention.

#### 9.6.5 The one thing a Café author must not do

Do not write a transfer fallback that **comments on the earlier decision**. *"The oat milk you rushed in has run out"* is a verdict with a timestamp on it. *"The oat's moving. The station café opens at seven from Monday"* is the same situation with no opinion in it, and it is the one to write.

---

## 10. Registry binding

### 10.1 Activity IDs and subtopics



Building slot **01** (ADR-005 §10.5). Subtopics are **authored to fit the decision**, not mechanically rotated; the allocation is coordinated across buildings by the registry maintainer so every subtopic lands exactly twice per competency-level.

| Competency | Level A id | Level B id | Subtopic | Title | Why this subtopic |
|---|---|---|---|---|---|
| C1 Problem Sensing | `C1-SCA-01` | `C1-SCB-01` | `empathy_pain` | The Dairy-Free Question | The Advanced path is finding out what the request actually costs the person asking |
| C2 Learning Agility | `C2-SCA-01` | `C2-SCB-01` | `experimentation` | The Iced Drink | Both tracks turn on whether a test was designed or improvised |
| C3 Courage to Commit | `C3-SCA-01` | `C3-SCB-01` | `smart_vs_reckless_risk` | The Truck / Thirty Per Cent | Level B is literally "stress-test the worst case, then commit" |
| C4 Financial Discipline | `C4-SCA-01` | `C4-SCB-01` | `cash_flow` | The Good Month | A seasonal spike misread as growth is the canonical cash-flow error |
| C5 Strategic Thinking | `C5-SCA-01` | `C5-SCB-01` | `scenario_thinking` | The App | "Today's call shapes the next two years" is the definition |
| C6 Power & Influence | `C6-SCA-01` | `C6-SCB-01` | `negotiation` | Forty Off / The Account | Direct |
| C7 People Management | `C7-SCA-01` | `C7-SCB-01` | `feedback` | Late / The Best One | The mechanism in both tracks is the honest conversation, held or avoided |
| C8 Value Creation | `C8-SCA-01` | `C8-SCB-01` | `quality_craftsmanship` | The Sample Bag / The Quiet Cut | The decision is literally about the product |
| C9 Perseverance | `C9-SCA-01` | `C9-SCB-01` | `adaptability_pivoting` | The New Awning / Three Weeks Down | The Advanced path is adapting without abandoning |

`type: "DECISION_TREE"` · `orderIndex: 1` · `estMinutes: 6` · `passCriteria: { "minProficiency": 2 }` for all eighteen.

### 10.2 Cross-building subtopic ledger

After the three launch buildings, per competency, three subtopics are used once and three are free. The remaining nine buildings must fill exactly nine slots: one more of each used subtopic, and two each of the free ones.

| Comp | Café (01) | MERIDIAN (02) | MAISON (03) | Still free (×2 each) |
|---|---|---|---|---|
| C1 | empathy_pain | root_cause | good_questions | observation · spotting_gaps · prioritizing_problems |
| C2 | experimentation | updating_beliefs | learning_from_feedback | curiosity · transfer · reflection |
| C3 | smart_vs_reckless_risk | deciding_uncertainty | saying_no_opportunity_cost | overcoming_fear · commitment_followthrough · accountability |
| C4 | cash_flow | budgeting | roi | needs_vs_wants · profit_loss · pricing |
| C5 | scenario_thinking | systems_thinking | tradeoffs | goal_setting_planning · prioritization · competitive_positioning |
| C6 | negotiation | reading_people | persuasion_storytelling | clear_communication · alliances_networking · ethical_influence |
| C7 | feedback | conflict_resolution | motivating_team | collaboration · leadership_delegation · customer_empathy |
| C8 | quality_craftsmanship | trust_reputation | real_value | branding_identity · delivering_promises · differentiation |
| C9 | adaptability_pivoting | handling_failure | resilience | grit_persistence · stress_management · growth_mindset |

### 10.3 Tier maps and rubrics

**Server-only. This table never ships to a client in any form.**

> **v2.0 — nothing below changed.** The transfer beat composes on top of the terminal, at `0.7 / 0.3`, so every value in this section is exactly as reviewed ([ADR-006 §10](ADR-006_Missions_AI_Followups_and_Session_State.md)). The only addition is the `aiBeat` block, which is identical in all eighteen Café rubrics:
>
> ```jsonc
> "aiBeat": {
>   "weight": 0.3,
>   "tierValues": { "developing": 15, "strong": 60, "advanced": 95 },
>   "required": false
> }
> ```
>
> `required: false` is what keeps a mission scoring correctly when the model is down *and* the fallback bank is unreachable: the authored terminal alone decides it.

`C1-SCA-01`

| Node | a | b | c |
|---|---|---|---|
| **seed** | Strong | Developing | Advanced |
| follow · branch a | Advanced | Developing | Strong |
| follow · branch b | Developing | Advanced | Strong |
| follow · branch c | Strong | Advanced | Developing |

Terminals, computed as `0.6 × seed + 0.4 × follow` over `Developing 15 · Strong 60 · Advanced 95` (ADR-005 §10.1):

```jsonc
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
}
```

`C4-SCB-01`

| Node | a | b | c |
|---|---|---|---|
| **seed** | Advanced | Strong | Developing |
| follow · branch a | Strong | Developing | Advanced |
| follow · branch b | Developing | Advanced | Strong |
| follow · branch c | Advanced | Strong | Developing |

```jsonc
"terminals": {
  "C4-SCB-01.a.a": 81, "C4-SCB-01.a.b": 63, "C4-SCB-01.a.c": 95,
  "C4-SCB-01.b.a": 42, "C4-SCB-01.b.b": 74, "C4-SCB-01.b.c": 60,
  "C4-SCB-01.c.a": 47, "C4-SCB-01.c.b": 33, "C4-SCB-01.c.c": 15
}
```

The remaining sixteen tier maps are authored alongside their leaf prose and must satisfy: the three seed tiers are each used exactly once; each follow-up branch uses each tier exactly once; and the letter permutation differs from every other activity in the building. A generator script producing these permutations from a tier assignment is a framework utility, not building code.

### 10.4 Trace paths on the wire

```jsonc
// Player picked "ask Nadia" (c), then "fix the 7:50 window" (b) → authored 95,
// then the transfer beat landed Strong → round(0.7×95 + 0.3×60) = 85 → P3 → 25 coins
{ "result": { "trace": {
    "path": ["C1-SCA-01.seed", "C1-SCA-01.c", "C1-SCA-01.c.follow", "C1-SCA-01.c.b"],
    "followupId": "fu_01J8ZQ0S8N4T1V6M",
    "followupChoice": "o_c104de"
} } }
```

The same path with the transfer beat missed (`Developing`) is `round(0.7×95 + 0.3×15) = 71 → P2`. **A blown transfer costs a perfect run its P3** — the full 27-cell table is [ADR-006 §10.2](ADR-006_Missions_AI_Followups_and_Session_State.md).

Autosave is per-building now, not per-activity: `PUT /api/v1/city/buildings/cafe/state` fires after every beat, carrying the partial path, the pending followup id and the current world state. See §19.

---

## 11. Silent tier & reward

Everything in ADR-005 §11 applies. The Café-specific commitments:

**What the player sees after a decision.** The consequence plays in the room — a line, an animation, a world-state change — and then they are simply free to walk again. There is no result panel. There is no "next" button that implies a score was computed. The season moves on.

**The coin tick.** The existing `Celebration` coin-fly runs at the HUD, magnitude proportional, **with no text and no differentiated sound.** A player earning 5 and a player earning 25 see the same animation at different lengths and are told nothing about the difference. Over nine weeks the balance is noticeably different between a strong run and a weak one, and the player will feel that without ever being told it.

**No hint button.** The player shell suppresses it in scenario mode. There is nothing to hint at here that is not a tier leak.

**The one place the Café is tempted to cheat, and must not.** It is very tempting to have Priya say something warm after a good decision and something flat after a weak one. That is a verdict wearing an apron. Priya's reaction is driven by **world state**, not by tier — she is short with you when the till is tight, whatever decision made it tight. The distinction is the whole design and reviewers should look for it specifically.

### 11.1 The mission tracker

The tracker (§8, [ADR-006 §6.3](ADR-006_Missions_AI_Followups_and_Session_State.md)) is the most tempting surface in this building to put a score on, and it is framework code precisely so the Café cannot. Café-specific commitments:

- **Completed missions disappear.** No tick, no strike-through, no "3/9 complete ✓". The ordinal `mission 4 of 9` is the only progress information, and it is pacing, not quality.
- **The tracker line is the room's words**, not the system's: *take the counter*, *8:05 — the bell*, *tell Priya where you landed*. Never *Objective 3: interact with NPC*.
- **The three pips are identical.** Same colour, same shape, same fill animation whichever beat they mark. A pip that looked different for the transfer beat would tell the player which one was generated.

### 11.2 Generated lines are held to the same rule

The transfer beat is written by a model, and a model's instinct is to be encouraging. [ADR-006 §8.4](ADR-006_Missions_AI_Followups_and_Session_State.md)'s gates block the vocabulary; what the Café adds is the **persona-card rule** (§9.6.2): a card describes *how* a character speaks and never *what they think of your decision*. A reviewer reading a persona card should be unable to tell, from it, what a good decision looks like.

**And the player must never learn which beat was generated.** No badge, no different typography, no spinner, no "personalised". If Priya's third question arrives late, she wipes down the counter first — she does not buffer.

---

## 12. World state

Ten keys. Every one maps to something the player can see.

| Key | Values | Visible as |
|---|---|---|
| `chalkboard` | `base` · `oat_asked` · `oat` · `oat_plus` · `plant_full` · `iced` · `iced_renamed` · `combo` · `app` · `direct` · `beans_story` | The board above the counter, rewritten in Priya's hand between weeks |
| `regulars` | `full` · `steady` · `thin` · `returning` | Marcus present/absent; ambient customer density; how many chairs at T3 are pulled out |
| `till` | `tight` · `healthy` · `strained` | The drawer's contents at week 8; Priya's idle animation (`work` vs `lean`); how fast she restocks |
| `staff` | `easy` · `strained` · `trusting` | Priya's and Tomas's idle set and gaze frequency; whether the rota by the pass-through has pencil corrections on it |
| `truck` | `absent` · `parked` · `gone_rival` | Ray's truck through the window, at your kerb or across the road |
| `machine` | `old` · `upgraded` | The hero prop's model variant, and its steam/noise cadence |
| `board` | `clean` · `app_card` · `direct_card` | The community noticeboard by the door |
| `beans` | `good` · `cheap` | The sack behind the counter; the colour of the crema in the cup Priya sets down |
| `rival` | `none` · `open` · `promo` | The awning across the street, and whether it has a sandwich board out |
| `season` | `spring` · `summer` · `autumn` · `night` | The window light, driven by week rather than decisions |

**Rules.** Presentation only — none of these influence scoring, which is entirely the trace path. Persisted with the interior resume blob and, once BE-8 lands, across sessions so a returning player walks back into the café they made.

---

## 13. End-of-journey report — *"The Year at the Corner"*

**Unlock:** all nine competencies on the player's track are `COMPLETED` (ADR-005 §13).

**The object.** A letter, in an envelope, propped against the pass-through hatch where the rota usually is. Priya wrote it. Walking up to it opens a full-screen reader.

**The letter** (framing copy, ~200 words) recaps the season in Priya's voice, built from the world-state trail: which decisions the café is visibly still living with, what the board says now, whether Marcus is in his chair. Warm, unsentimental, no grading. She signs off with something about next year.

**Behind the letter**, on the same screen and scrolled to, is your own record — and this is the **only place** in the entire building where tier vocabulary appears:

1. **Nine competencies, nine tiers** — Developing / Strong / Advanced, each with its one-line meaning and the week it was decided.
2. **The consequence trail** — what you chose, what happened, in two lines per competency.
3. **Consistency** — the seed/follow-up shape made legible. *"In week 1 you found the real reason people were leaving, and then tried to match the station café on range rather than fixing the morning. You see clearly and then reach for the obvious move."* This is the most useful sentence in the report and it comes directly from §10.2's arithmetic.
4. **Where to go next** — the two or three city buildings that draw hardest on your lowest competencies, named as places rather than as remediation.

**Tone.** No shame framing. Nothing is failed; some things are *not yet*. The report is a debrief from someone who worked the bar next to you all season, not a scorecard.

---

## 14. Level A vs Level B in this room

Same geometry. Same chalkboard. Different weight.

| | Level A (`SCA`, 16–21) | Level B (`SCB`, 35–50) |
|---|---|---|
| **Framing** | Your first place. The bank manager took a chance. | You've done this before, and that is why the flat six weeks worries you. |
| **Threshold question** | *"Is this your first place, or have you done this before?"* — asked by Priya on first entry, once for the whole city (ADR-005 §10.7) | same |
| **Cast at week 1** | Priya, Marcus, ambient | Priya, Tomas, Marcus, ambient — the staffing problem is in the room from the start |
| **Props added** | — | A supplier price-increase letter pinned by the pass-through; a second rota with corrections; the rival's awning **already visible** from week 1 |
| **Decisions** | Fewer moving parts, shorter horizon, one clear pressure at a time | Competing legitimate interests, irreversibility, and a second-order cost in every option |
| **Light** | Slightly brighter throughout | One stop cooler; the night beat is darker and longer |
| **What "Advanced" means** | Finding the real problem behind the presenting one | Finding it, and being willing to pay what acting on it costs |

Level B is **not Level A with longer sentences.** The register is the same plain English; what changes is that in Level B every option has a defensible case and a real price, and the follow-up is where the price arrives.

---

## 15. Accessibility for this interior

All of ADR-005 §14 applies. Café-specific:

- **Guided navigation labels** use the room's own words: *the counter · the counter flap · the jukebox · the tables · by the window · the door*, plus the hotspots *the board · the noticeboard · the pass-through · the window*. Plus NPCs by name and role: *"Priya, head barista"*. The list's **first entry is wherever the mission is waiting**.
- **Live-region announcements** on entering each zone, on arriving at a station, on the chalkboard changing (*"Priya has rewritten the board"* — the world-state change is announced, because a sighted player sees it and a blind player must too), on the season/light shift, **on every objective completing**, and **on every mission opening**.
- **The mission tracker is real, focusable DOM** with `aria-live="polite"` firing on objective change only — never per frame. A player who cannot see it still knows the objective moved.
- **During the transfer beat's generation window** the live region says what the room is doing (*"Priya wipes down the counter"*), never that something is loading. Same beat a sighted player sees.
- **The grinder duck** is an audio effect and must not be the only carrier of a beat — any line it precedes is also visible as text.
- **The pass-through privacy** is communicated in three channels: the audio ducks, the prompt text says *"out of earshot of the floor"*, and the live region announces the same.
- **Marcus's empty chair** — the single most important non-verbal beat in the building — is announced explicitly in week 18 (*"the four-top by the window is empty"*), because a consequence that only exists visually is a consequence half the audience never receives.
- **The night beat** (week 8) reduces light dramatically; contrast on all DOM text is unaffected (it is DOM), and the scene's minimum luminance is floored so the room never becomes unreadable for low-vision players.

---

## 16. Performance budget

Within ADR-005 §15. Café-specific targets:

| Metric | Café target | Notes |
|---|---|---|
| Sprites on screen | ≤ 220 | 120 cells of room, ~60 dressing props, ≤ 4 cast, ambient customers |
| Draw calls | ≤ 40 | Static dressing baked into a small number of containers |
| Baked textures | ≤ 26 unique | One wear overlay tint shared across all wood and lacquer |
| Animated characters | ≤ 4 on screen | Enforced by §8.1's mission table — the cast is never all present |
| Texture memory | ≤ 32 MB | `resolution: 2`; nothing upscaled past `MAX_UPSCALE` |
| Scene build (bake) | **≤ 250 ms** | Behind the fade. The Café is the smallest building and sets the bar |
| Interior chunk | **≤ 900 KB** added to the bundle | Under ADR-005's 1.5 MB ceiling |
| Enter / exit | ≤ 0.8 s | Prefetched on approach from Market Street |
| Ambient beats active | ≤ 8 | §6 table |
| Transfer-beat latency | ≤ 2.5 s p95 | ADR-006 §7.4. Fired in parallel with beat 2's consequence, so the player should never see the gap |

**Headroom is deliberate.** The Café is building 01 and the house standard; if it needs the full ceiling, the pattern is wrong, not the café.

---

## 17. Asset checklist

Every line requires an `ASSETS_LICENSES.md` entry with source URL, author, license, commercial-use proof and date **before** work builds on it.

**Shell & architecture** — room shell, window wall + glass, door + frame + bell, ceiling, floor tile, wall plaster, back-bar shelving, pass-through hatch.
**Counter run** — counter body, worn top, till, pastry case (+ contents), grinder, **espresso machine (hero, bespoke)**, sink end, bean sacks (2 variants for `beans`).
**Furniture** — two-top ×2, four-top, high two-top, chairs ×6, stools ×2, pendant lamps ×3.
**Signage & paper** — **chalkboard (hero, 11 text variants)**, community noticeboard (+ 3 card variants), rota sheet (2 variants), supplier letter, the report envelope.
**Dressing** — cups, saucers, takeaway cups, milk jugs, bottles, newspaper, crates, cloths, plant, coat hooks.
**Characters** — 6 procedural skins (Priya, Tomas, Marcus, Nadia, Ray, Ellery) + 3 ambient skins, built on `characterArt.ts`.
**Animation** — walk, idle, talk, and the Café-specific idle variants: `sit_read` (Marcus), `lean_counter` (Ray), `wipe` (Priya). Procedural transforms, not clips.
**Street (through glass)** — a low-detail exterior card: kerb, opposite shopfronts, the rival awning (2 states), Ray's truck.
**Audio** — room tone, instrumental bed *(hardest to source — see §6)*, espresso machine group + steam, grinder, door bell, street bed (muffled), cup/saucer, chair scrape, page turn, pigeon.

---

## 18. Phases, acceptance, testing, risks

### 18.1 Phases

| Phase | Deliverable | Gate | Status |
|---|---|---|---|
| **CAF-0** | The room: 12×10 grid, wall ring, collision, spawn, four zones, six stations, four hotspots, the counter flap, guided nav | Walk the room with a mouse and without one, at 30 fps on the reference laptop | **Done** (§0.1) |
| **CAF-1** | `cast.ts` — Priya + Marcus + the ambient customer loop; the chalkboard and the four-top wired to world state; the two framework debts closed (early `detach`, `.catch` on the build) | The room feels inhabited when nothing is being asked of you — assessed by someone who did not build it | **Next** |
| **CAF-2** | **The framework mission runner + tracker** (ADR-005 §17 G9) built here and shared; missions 1 and 4 playable as objective chains with no decision content behind them | Walk mission 1's chain end to end with the tracker top-left, keyboard-only, and mission 2 does not exist until it closes | |
| **CAF-3** | `C1-SCA-01` and `C4-SCB-01` end to end: staging → seed → consequence → follow-up → **transfer** → submit → world reaction. Includes the framework transfer client (G11) and the first two fallback entries | A real registry activity, server-scored across three beats, with **no tier visible anywhere on screen** and no way to tell which beat was generated | |
| **CAF-4** | Session sync (G10): debounced writes, the `sendBeacon` exit flush, the `localStorage` mirror | Kill the tab mid-mission; reopen on another device; resume at the same objective with the same transfer question waiting | |
| **CAF-5** | All nine missions × both tracks; full cast; the season light progression; all 18 fallback transfer beats | A complete nine-mission season in one sitting, and the same season played with the API key removed | |
| **CAF-6** | The report; a11y pass; perf pass; audio; asset licences complete | A keyboard-only, screen-reader player completes a full season and reads their letter | |

### 18.2 Acceptance criteria

1. **Plausible-peers audit passes.** A reviewer who did not write the content reads all 54 seed choices, 162 leaves and **all 18 fallback transfer beats** with tiers covered and cannot reliably identify the weak option. *Blocking.*
2. **Tier-leak audit passes.** No proficiency number, pass/fail phrasing, tier word, ranking affordance or comparative coin commentary appears anywhere outside §13's report — **including the mission tracker**. *Blocking.*
3. **Registry validates.** `go run ./cmd/validate_registry -competency=Cn` passes for all nine with the Café rows present; every rubric parses; every terminal set has nine entries matching the ADR-005 §10.1 arithmetic; **every activity with an `aiBeat` block has a fallback entry**. *Blocking.*
4. **Fallback parity.** With `ANTHROPIC_API_KEY` unset, a full nine-mission season plays end to end and **no rendered string, timing or affordance differs** from the generated path. Verified by an e2e run in both configurations. *Blocking.*
5. **Keyboard-only completion.** A full nine-mission season without a mouse, verified by e2e. Every `go_to` target is in `guide.ts`.
6. **Tracker cleanliness.** The tracker shows exactly one objective, no quality marker, identical pips, and completed missions vanish. Component test.
7. **Resume.** Quitting at any point in a mission — between objectives, between beats, with a transfer question pending — resumes at that exact point with world state intact and **the same transfer question**, not a regenerated one.
8. **Exit flush.** Closing the tab from inside the building persists the season. Verified by asserting the `POST .../state` beacon fired and the server row updated.
9. **Performance.** §16 numbers met on the reference profile at CAF-5 and CAF-6.
10. **Memory.** Five enter/exit cycles with no growth beyond noise, and no baked texture surviving exit.
11. **Consequence visibility.** Every mission produces at least one change a player can point at — guaranteed structurally by `closeWorldState` — and every such change is announced to a live region.
12. **No-verdict audit on generated content.** A sample of 30 generated transfer beats is read by the fresh reader; none comments on the earlier decision (§9.6.5), none carries verdict language, and none can be identified as generated. *Blocking before launch, not before CAF-3.*

### 18.3 Test plan

- **Unit** — the world-state reducer; the season/light mapping; the tier-map permutation generator (each tier once per node, no repeated permutation); the **mission runner** (mission *n+1* is unreachable while *n* is open; every mission's last three objectives are the three `decide` beats; every mission has a movement or conversation before its first `decide`; `closeWorldState` is non-empty); **speaker resolution** across all four steps including a world state with the host absent.
- **Content** — every `path` a player can construct terminates in a node present in the rubric's `terminals`; every terminal is reachable; every leaf has consequence prose and at least one world-state write; **exactly 18 fallback transfer beats exist**; every `aiWorldCandidates` entry is a legal value of a declared world key.
- **Choice parity (machine pass, ADR-005 §11.5)** — for every trio of choices **including the fallback bank**, longest minus shortest ≤ **8 words**; no capitalised tier label, proficiency number, `n/3` or pass/fail phrasing in any shipped string; no verdict language ("unfortunately", "you should have", "the better move", "correct", "well done") in any consequence; each tier used exactly once per node and no letter permutation repeated in the building. Runs in CI over `trees/` and `followups/`; it is the check that caught the length/tier correlation in this document's first draft.
- **Reachability** — every mission `go_to` target is present in `guide.ts`. A CI check, because an objective you cannot reach without a mouse is a blocked season.
- **Component** — the dialogue layer builds the correct `trace` result including `followupId`/`followupChoice`; the scenario presentation mode renders no result view; the status chip shows no proficiency; **the tracker renders one objective, no quality marker, identical pips**; the transfer beat renders through the same dialogue layer as the authored ones, with no distinguishing element.
- **E2E** — enter from Market Street → play mission 1 as an objective chain → verify the chalkboard changed → **kill the tab mid-mission** → re-enter → verify the objective, the world and the pending transfer question all resumed → complete the season → open the letter. **Run the whole spec twice: once with the generator configured, once with it disabled**, and assert the rendered output is indistinguishable.
- **Playtest** — a scripted 25-minute session run by someone who has never seen the content, with three questions afterwards: *"which choice do you think the game wanted?"* (if they can answer for more than two missions out of nine, §9 gets rewritten) · *"which of the three questions was written by a computer?"* (chance is 33%; better than that means §9.6 is leaking) · *"what were you doing when you left?"* (if they cannot say, the tracker is not working).

### 18.4 Risks

| Risk | Mitigation |
|---|---|
| **The room feels like a menu with furniture.** The failure mode where decisions are just modals in a nice backdrop. | §8's objective chains are a requirement, not flavour — every mission makes you walk, wait, talk or handle something before it asks you anything. CAF-1's gate is specifically "does it feel inhabited when nothing is asked of you". |
| **162 leaves plus 18 fallbacks is a lot of prose, and prose fatigue produces marked options.** | Two fully-worked exemplars fix the register; ADR-005 §11.4 gives measurable rules (word count, self-justification); the machine pass runs in CI; the fresh-reader audit is blocking. |
| **Priya becomes a verdict machine** — and now so could the generator. | Her reactions bind to world state, never to tier. The persona cards (§9.6.2) describe *how* she speaks and never *what she thinks of your decision*. §11.2 calls this out for reviewers explicitly. |
| **The transfer beat comments on the earlier decision** and becomes a graded reveal. | §9.6.5 is a normative writing rule for the fallback bank and a gate ([ADR-006 §8.4](ADR-006_Missions_AI_Followups_and_Session_State.md) gates 5 and 7) for generated output. Sampled in the launch audit (§18.2.12). |
| **The transfer beat is late and Priya buffers.** | Fired in parallel with beat 2's consequence; an in-character idle beat covers 2.5–4 s; a hard abandon to the fallback at 4 s. **Never a spinner.** |
| **The tracker turns into a scoreboard** by well-meaning increment. | It is framework code (ADR-006 §6.3) so the Café cannot add to it; §11.1 lists what it may show; a component test asserts it. |
| **The mission chain is fiddly and players get stuck** on a `wait_for` that never fires. | Every objective has a fallback completion path: `wait_for` completes on a timeout-to-arrival, and the guided-nav list's first entry always points at the live objective. Telemetry (BE-19) answers "which objective do players get stuck on". |
| **Audio does not exist and §6 makes it load-bearing.** | Ship on room tone alone if necessary — a quiet café is not a worse café — but the grinder duck and the pass-through duck are *informational* and must have a text mirror either way (§15). |
| **The window's exterior card breaks continuity with the iso city.** | The card is built from the same palette and reuses Market Street's silhouette; slight defocus hides the mismatch honestly. |
| **Week 8's darkness is an accessibility problem.** | Minimum scene luminance floor; all text is DOM; the beat is announced. |
| **A bake that throws leaves the city hidden and frozen** (§0.2). | Arm `detach` before the async build; `.catch` the build. This is the highest-severity known defect in the building and it is unfixed. |

### 18.5 Open decisions

- **The owner's name** — the letter in §13 is addressed to someone. Does the player have a name in this game, and if so where does it come from? (Display name from `/me` is the obvious answer; needs KK.)
- **Whether Marcus ever comes back** if the player's C9 run is weak. Current position: he does, in week 18's epilogue, and says nothing about it — but this is a tone call.
- **CC0 instrumental bed** — sourcing, or ship without.
- **Ray's dual role** in Level B (truck owner and supplier rep) — is doubling him up economical or confusing? Playtest it at CAF-5.
- **Does the season progress if the player leaves and returns weeks later in real time?** Current position: no — season advances with missions, not with clock time.
- **Whether mission 4's `report` objective should exist after all.** Currently the night beat ends with nobody to tell, which is the point. A quiet alternative: an objective-7 `inspect` on the chalkboard the next morning, so the mission closes in daylight. Playtest at CAF-5.
- **Whether the transfer beat appears in §13's letter.** It is the most personal question in the season. Recommendation: yes, quoted, as the third line of each competency's trail. Needs KK (tracked in [ADR-006 §16](ADR-006_Missions_AI_Followups_and_Session_State.md)).

---

## 19. Backend contract — the Café

Full endpoint specification: **[PRD_Backend_Missions.md](PRD_Backend_Missions.md)**. This section is the Café's concrete instance of it — real ids, real payloads, real triggers. If anything here disagrees with that document, that document is right.

### 19.1 What the Café calls, and when

| When | Call | Notes |
|---|---|---|
| Approaching the venue on Market Street | *(prefetch only)* `import("./Interior")` | No network |
| Entering | `GET /api/v1/city/state` | Track choice + FTUE. If `track` is unset, Priya asks the threshold question (§14) |
| Entering | `GET /api/v1/city/buildings/cafe/state` | The season. `{ rev: 0, blob: null }` on a first visit |
| Entering | `GET /api/v1/city/beacon-token?buildingId=cafe` | For the exit flush (§19.4) |
| Entering | `GET /api/v1/registry/{C1..C9}/{SCA\|SCB}` ×9 | Which missions are open. **One missing row must not blank the board** |
| Mission opens | `POST /api/v1/progress/{activityId}/start` | |
| Mission opens · objective completes · beat commits · world write · zone change | `PUT /api/v1/city/buildings/cafe/state` | Triggers and timing in §19.3 |
| Beat 2 commits | `POST /api/v1/ai/followup` | Fired **immediately**, in parallel with beat 2's consequence playing |
| Beat 3 commits | `POST /api/v1/ai/followup/{id}/commit` | Returns the consequence prose and the world write |
| Mission closes | `POST /api/v1/progress/{activityId}/submit` | Carries all three beats |
| Exit | `POST /api/v1/city/buildings/cafe/state` via `sendBeacon` | §19.4 |

The Café itself makes **none** of these calls. They are made by the framework's `ApiClient`, the mission runner and the session sync layer (ADR-005 §8.4 — buildings never call `fetch`). They are listed here so the Café dev knows what the room's behaviour costs and what breaks when a call fails.

### 19.2 The session blob

`PUT /api/v1/city/buildings/cafe/state`

```jsonc
{
  "rev": 22,
  "track": "SCA",
  "blob": {
    "missionOrder": 3,                 // 1..9 — "The Truck"
    "objectiveIndex": 4,               // decide · seed
    "partialPath": [],                 // no beat committed yet
    "pendingFollowupId": null,
    "world": {
      "chalkboard": "oat_asked", "regulars": "steady", "till": "healthy",
      "staff": "easy",  "truck": "absent",  "machine": "old",
      "board": "clean", "beans": "good",    "rival": "none", "season": "summer"
    },
    "playerCell": [9, 4],              // by the window
    "trackerCollapsed": false
  }
}
```

**Ten world keys, exactly §12's** — every one maps to something in the room. 16 KB is the server's cap and this blob is roughly 500 bytes, so there is no pressure to economise; there *is* pressure not to add an eleventh key that nothing renders.

### 19.3 Save triggers

| Trigger | Timing | Why |
|---|---|---|
| Mission opens | immediate | The season advanced; losing it loses a mission |
| Objective completes | debounced 800 ms | Cheap, frequent, individually unimportant |
| **Any beat commits** | **immediate** | The one write that must never be lost. A committed decision that vanishes is the worst bug this building can have |
| World-state write | debounced 800 ms, coalesced with the above | |
| Zone change | debounced 800 ms, position only | So a resume puts you back where you were |
| Panel opened/closed, tracker collapsed | debounced 800 ms | |
| **Exit** | **immediate, flushed** | §19.4 |

Debounced writes coalesce: five objectives completed inside a second produce one `PUT`.

### 19.4 The exit flush

```
player presses E at the door                     (or the tab is closing)
  → the mission runner freezes; no further objective can complete
  → build the blob (§19.2)
  → navigator.sendBeacon("/api/v1/city/buildings/cafe/state", JSON.stringify({
        rev, track, blob, beaconToken
    }))
  → if sendBeacon returns false:
        fetch(url, { method: "POST", keepalive: true, headers: { Authorization } , body })
  → write the same blob to localStorage regardless
  → fade to black · dispose the room's baked textures and containers
  → showWorld(); the city resumes at Market Street tile (24,8)
  → fade in
```

Also wired to `pagehide` and `visibilitychange → hidden`, because "leaving the building" and "closing the laptop" must have the same consequence.

**The flush never blocks the fade.** `sendBeacon` is fire-and-forget by design; if it fails, the `localStorage` mirror is pushed on the next successful load.

### 19.5 Generating the transfer beat

```jsonc
POST /api/v1/ai/followup
{
  "activityId": "C3-SCA-01",
  "track": "SCA",
  "buildingId": "cafe",
  "path": ["a", "c"],                     // "yes, but structured" → "redesign the combo"
  "speakerId": "ray",
  "worldState": { "truck": "parked", "regulars": "steady", "till": "healthy" }
}
→ 200
{
  "followupId": "fu_01J9…",
  "speaker": { "id": "ray", "name": "Ray", "role": "the food truck" },
  "prompt": "…in Ray's voice, about the combo the player actually redesigned…",
  "options": [ { "id": "o_1a2b", "text": "…" }, { "id": "o_9f04", "text": "…" },
               { "id": "o_44c7", "text": "…" } ]
}
```

`speakerId` is resolved client-side by [ADR-006 §9](ADR-006_Missions_AI_Followups_and_Session_State.md) and re-validated server-side. For the Café the resolution is nearly always step 1 (the mission's host). The cases that are not:

| Mission | Host | If absent | Resolves to |
|---|---|---|---|
| 1, 5 | Nadia | she has left (she always leaves) | **Priya** — step 3, the anchor |
| 3 | Ray | he is outside at the truck | **Priya** if she is behind the counter, else step 4 |
| 4 | *none by design* | — | **step 4** — the room narrates; the dialogue layer names *the takings on the counter* |
| 6 | Ellery | she has closed the laptop | **Marcus**, who is standing there holding his paper — step 2, and the best line in the building |
| 8 | *the sample bag* | — | **Priya** — step 1 via objective 3's `talk_to` |
| 9 | *the street* | — | **Priya** — anchor |

**Priya is the anchor and must be unremovable.** No world state may take her out of the room. This is an acceptance criterion, not a convention.

### 19.6 Submitting

```jsonc
POST /api/v1/progress/C3-SCA-01/submit
{
  "clientVersion": "city@0.3.0",
  "durationSec": 385,
  "hintsUsed": 0,
  "result": { "trace": {
    "path": ["C3-SCA-01.seed", "C3-SCA-01.a",
             "C3-SCA-01.a.follow", "C3-SCA-01.a.c"],
    "followupId": "fu_01J9…",
    "followupChoice": "o_9f04"
  } }
}
→ { "proficiency": 3, "bestProficiency": 3, "coinsEarned": 25,
    "coinBalance": 165, "badgesAwarded": [], "graded": "server" }
```

The Café renders `coinsEarned` as a silent, magnitude-proportional coin fly and **nothing else**. `proficiency` is received and discarded until §13's letter.

### 19.7 Degradation

Every failure mode, and what the player sees:

| Failure | Behaviour | Player sees |
|---|---|---|
| `GET /city/state` fails | `localStorage` track; if none, Priya asks the threshold question | Nothing |
| `GET .../buildings/cafe/state` fails | `localStorage` season; if none, a fresh season | Nothing, unless it is genuinely a new device — then mission 1 |
| Registry rows missing for a competency | That mission shows as *not yet open*; the others still play | A mission that will not start. **Must not blank the season board** |
| `POST /ai/followup` slow (> 4 s) or failing | Fallback bank (§9.6.4) | Priya wipes down the counter, then asks the question |
| `POST /ai/followup/{id}/commit` fails | The mission's `closeWorldState` applies; a generic in-voice acknowledgement plays | A slightly flatter line |
| `POST /submit` fails | The trace is kept in the session blob and retried on the next successful call | The room still moves — **it moves on the trace, never on the score** |
| `PUT .../state` fails | `localStorage` mirror; pushed when the backend returns | Nothing |
| Beacon fails on exit | `localStorage` mirror; pushed on next load | Nothing, on the same device |

**The rule this table encodes:** the Café is always playable. A backend outage costs cross-device continuity and scoring, and costs nothing else.

---

## 20. Implementation log

_Folded in from `cafedev.md`, which this document supersedes. The Café interior was built before the mission spine existed; these are the phases that produced the room described in §0.1, and the findings every subsequent building inherits._

### 20.1 Two decisions taken up front

**Isometric projection, `cafe.jpg` art direction.** The reference image is drawn top-down (Stardew style); the city is 2:1 isometric. The room is rendered **isometric** and everything else taken from the reference. Why:

| | Isometric | Top-down |
|---|---|---|
| Player sprite | `src/world/characterArt.ts` bakes it procedurally, four facings, zero PNGs | A whole new set — an iso person viewed from directly above reads wrong |
| Tile math | `src/lib/iso.ts`, done and tested | New file |
| Walking out the door | Angle never changes | Room flips overhead, street snaps back to iso — a hard visual cut |

One happy accident: **`cafe.jpg`'s black-and-white checkered floor is already drawn as diamonds**, so it translates to an iso grid one-for-one — alternate the tint on `(x + y) % 2`.

**Static fit-to-viewport camera.** The whole room fits on one screen at 1280×720, so there is no follow camera — the room is framed once and stays framed.

```ts
fitScale = Math.min(1, (screenW - PAD) / ROOM_PX_W, (screenH - PAD) / ROOM_PX_H);
```

Clamped to `≤ 1` so nothing is ever upscaled — `src/world/spriteDensity.test.ts` guards `MAX_UPSCALE = 2.3`, and a past bug shipped 12 px trees blown up 2.1× that "read as pills". Click-to-move still works under scale because `world.toLocal()` accounts for it.

### 20.2 The counter flap — the only moving part in any interior in the city

The grid is a **pure function of which gates are open**:

```ts
export function makeRoomGrid(openGates: ReadonlySet<GateId>): Grid;
```

`Grid` is just `{ width, height, isWalkable }` (`src/lib/pathfinding.ts`), so this stays pure and unit-testable with zero Pixi and zero React. State is `flapOpen: boolean` in [`cafeStore.ts`](../src/buildings/cafe/cafeStore.ts).

**Two triggers:** clicking the flap sprite (Pixi `eventMode: "static"`, `cursor: "pointer"`, `e.stopPropagation()` so the click does not fall through to click-to-move — the pattern already used for city props), or pressing `E` within manhattan ≤ 1 of the flap cell.

**On toggle:** rebuild the grid from the new gate set → **discard `pathTargets` and clear `pathLine`** (a queued path may be stale in either direction) → animate the hinge rotation over ~250 ms → play the sound → announce to the live region.

**Guards, and each one is a rule worth copying:**

- **Closing while standing on the flap is refused** — the prompt reads *"step off the flap first"*. Otherwise you seal yourself inside a wall.
- **No auto-close.** It stays as you left it, which is what a real counter flap does and what makes it read as *state* rather than as a button.
- **Reduced motion** snaps the rotation and keeps the sound and the announcement.

### 20.3 Module layout

```
src/buildings/cafe/
  manifest.ts      the only registration point
  Interior.tsx     default export — the React shell (returns pointer-events-none DOM)
  CafeCanvas.tsx   borrows the city's Application; returns null (§20.6)
  room.ts          PURE. dimensions, furniture, blocked set, gates, spawn, exit, zones
  room.test.ts     the invariants (§20.5)
  cafeStore.ts     building-owned Zustand store
  scene.ts         pure Pixi builders — floor, walls, furniture, the flap
  props.ts         palette + procedural Graphics → RenderTexture furniture
  assets.ts        the PROP_SPRITE seam (§20.4)
  index.ts         re-export the manifest
```

**Reused as-is, never modified:** `@/lib/iso`, `@/lib/pathfinding`, `@/lib/motion`, `@/world/characterArt` (`bakePersonTextures`, `bakeShadowTexture`, `destroyTextures`, `PLAYER_PALETTE` — **the same character walks indoors and out**), `@/framework/audio/audioManager`, `@/ui/Icon`.

**Pixi writes via `getState()`, React reads via selectors** — the split proven in `worldStore.ts`.

### 20.4 What the phases produced

| Phase | Delivered |
|---|---|
| **0 · Framework seam** | `framework/building/registry.ts`, `BuildingGate.tsx`, the `CityScreen` route, `interiorOpen` in `worldStore`, the city ticker early-returning while an interior is open |
| **1 · Walkable room** | `room.ts` + tests + `props.ts` + `scene.ts` + `CafeCanvas` + `Interior` + `manifest`. Checkered floor, plank walls, blocking furniture, the player from `bakePersonTextures`, click-to-move via `findPath`, WASD with per-axis slide, footsteps, y-sort (`zIndex = x + y`, player `+0.6`), fit-to-viewport camera |
| **2 · Door and flap** | Exit proximity + prompt + `onExit()`; the flap gate with dynamic walkability, path invalidation and the step-off guard; zone tracking |
| **3 · The room reads like `cafe.jpg`** | The wall ring; wall furniture drawn **on the wall's projected face**; five hero props rebuilt; the warmth pool; the sprite seam |
| **4 · Life and accessibility** | Four hotspots, steam, station navigation, the live region |
| **5 · Activity binding** | *Not done* — blocked on BE-12, and now superseded by §8's mission spine |

Three findings from phase 3 that are now framework rules ([ADR-005 §8.1, §16.3](ADR-005_Interior_Framework.md)):

- **The room must be enclosed, and the near edge is special.** The grid grew 10×8 → 12×10 with a wall ring. Far edges (`y0`, `x0`) are full-height and carry the windows, chalkboard, framed art, noticeboard and stairs; **near edges stay low sills**, because a full wall between the camera and the floor stands in front of anyone walking along the front. Every interior cell shifted by one and the tests carried the remap.
- **Wall furniture has to be drawn on the wall.** Hung things were drawn in flat screen space, so every window and picture collapsed into a small triangle. They are now drawn on the wall's projected face — parametrised `u` along, `v` down, with a frame as a rectangle in that space. The visible face follows from where the room is: from the `y0` row it lies down-left, from the `x0` column down-right.
- **A prop that spans two cells bakes twice.** A climbing rail drew once per cell and read as stray bars. Multi-cell props need a single owner cell.

**Warmth:** a soft pool of light over the floor, **masked to the room**. `cafe.jpg` is a lit island in a dark surround; an evenly-lit floor reads flat however good the props are, and unmasked the pool spills past the walls as a halo on the black.

**The sprite seam, and why it currently carries nothing.** `PROP_SPRITE` in [`assets.ts`](../src/buildings/cafe/assets.ts) maps a prop kind to a sprite and its draw width; `bakeCafeTextures` consults it before falling back to the procedural bake. Kenney's *Isometric Miniature Library* was tried and **rejected**: its "shelf" is a library bookcase and its "lamp" is a three-candle candelabra with a hard drop shadow baked into the PNG; both are drawn nearly front-on rather than on this room's 2:1 axes, so they sit visibly skewed; and both are light oak where the room is oxblood and dark wood. **Wrong subject, wrong projection, wrong palette** — the procedural shelving and pendant beat them on all three. The seam stays because it is built and tested; the next sprite that genuinely helps drops in with one line.

*If sprites are revisited:* they arrive at native resolution rather than tile-sized, so they are scaled on placement, and they must **not** go on the disposal list — Pixi's asset cache owns them; we destroy only what we generated.

**Prompt precedence.** Three things compete for the proximity slot, ordered deliberately: **exit → flap → hotspot**. The door wins when you are standing in it, because **leaving must never be harder than anything else in the room**. Opening a panel locks the room's input, and `Escape` closes the panel before it means "leave".

**Why `world/ambient.ts` is not reused indoors:** constructing it unconditionally builds 14 pedestrians, 6 cars, a cat pathfinding on the 45×45 city grid, pigeons and every lamp glow, in city coordinates, with no way to disable a subsystem. The *texture* is free, though — Pixi's `Assets` cache is global and the city always finishes loading before an interior can mount, so `tex("fx_smoke")` just works.

**Station navigation is polled in the ticker**, not handled in a store subscriber — the ticker already reads the store every frame, and a re-entrant `setState` inside a subscriber is a puzzle for no gain.

### 20.5 The room invariants

[`room.test.ts`](../src/buildings/cafe/room.test.ts) — colocated under `src/` (the include glob in `vite.config.ts` never sees `tests/`).

| # | Invariant |
|---|---|
| 1 | Spawn and exit are both walkable |
| 2 | Flap **open** → every non-blocked cell is reachable from spawn |
| 3 | Flap **closed** → no staff-zone cell is reachable from spawn — *the mechanic's contract* |
| 4 | Flap **open** → every staff-zone cell is reachable |
| 5 | No two furniture entries claim the same cell |
| 6 | Every furniture, gate, zone, spawn and exit cell is inside the grid |
| 7 | `makeRoomGrid()` reports `width`/`height` matching the room constants |
| 8 | Toggling the gate flips exactly one cell's walkability and nothing else |

**Manual pass:** `VITE_DEV_WORLD=1 npm run dev`, walk to `(24,8)` on Market Street, press `E`. Movement by click *and* WASD; collision on every furniture kind; the flap by click *and* `E`; staff zone gated; the step-off guard; the door prompt; the return position; window resize keeps the room framed; `prefers-reduced-motion` kills the tween but keeps the state change; five enter/exit cycles with no memory growth in the profiler.

### 20.6 Why an interior may not create its own `Application`

**This is the most expensive thing anyone has learned about this codebase, and it is why [ADR-005 §8.6](ADR-005_Interior_Framework.md) exists.**

**The bug.** After leaving the Café, the city never came back. It rendered nothing but its clear colour, forever, with one uncaught `TypeError: Cannot read properties of null (reading 'geometry' | 'clear')` from `DefaultBatcher.break` / `BatcherPipe`.

**Root cause.** Two Pixi v8 `Application`s alive in one page. **The second renderer's mere existence corrupts the first one's batcher**; the first then throws *out of its own ticker listener*, so its `requestAnimationFrame` loop never reschedules and the world is dead for the rest of the session. It only looked transient because the exception fires once — the freeze it leaves behind is permanent.

Everything plausible was eliminated first, in this order:

| Tried | Result |
|---|---|
| `autoStart: false`, render only once the scene is built | no change |
| Idempotent `teardown()` closing the StrictMode/Suspense race | no change |
| Disposing baked textures before vs. after `app.destroy()` | no change (the stack shifts, the error remains) |
| Skipping `destroyTextures()` entirely | no change |
| Skipping `app.destroy()` entirely — nothing torn down at all | no change, **so it is not teardown** |
| `application.stop()` on the city while the interior is open | **worse** — fires on entry, and on two visits instead of one |
| **An empty second Application: no textures, no scene, nothing drawn** | **still killed the city — the second renderer *is* the bug** |

**The fix.** Buildings borrow the city's renderer instead of making one. [`interiorStage.ts`](../src/framework/building/interiorStage.ts) lets the world layer publish its `Application`; an interior awaits it, hides the city's layers, adds its own container and ticker callback, and gives all of it back on exit. **The city's `Application` is never destroyed, because the interior never made it.**

Two consequences worth knowing when writing the next building:

- **Render no canvas DOM of your own.** The room draws into the city's existing canvas, so any element you mount sits on top of it. `CafeCanvas` returns `null`.
- **The DOM shell must be `pointer-events-none` with no background.** An opaque overlay hides the canvas; a solid hit area swallows every click meant for it. Interactive children opt back in with `pointer-events-auto`.

### 20.7 Traps

| Trap | Handling |
|---|---|
| **A second Pixi `Application`** | Never. It kills the city's renderer outright (§20.6). Borrow via `interiorStage.ts` |
| **StrictMode double-mount, texture leaks** | Copy `CityCanvas`'s `destroyed` flag and its exact teardown order |
| **Closed unions** | `SoundName` and `EventMap` are closed. The Café uses existing sounds only — a door bell or espresso hiss is a **framework request**, not a Café-folder change |
| **`origin/cafe` is a trap** | It forked before the graphics overhaul and **deletes** `ambient.ts`, `characterArt.ts`, `Modal`, `Icon`, `Toaster` and every `fx_*` asset. **Never merge it.** Extract files individually with `git show` |
| **A bake that throws leaves the city hidden and frozen** | Arm `detach` before the async build starts; `.catch` the build. **Still open** (§0.2) and the highest-severity known defect in this building |

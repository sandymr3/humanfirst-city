# Decision required — where the buildings' activities live

_For: KK · From: eng · 2026-08-07 · **Blocks: every building being playable against the live backend**_

_One decision, three options, a recommendation. Full technical detail in [ADR-005 §10.6.1](ADR-005_Interior_Framework.md); nothing here requires reading it._

---

## The ask

The twelve buildings need somewhere to put their activities in the content library. **The shelf we planned to use is already full**, and the plan assumed it was empty.

I need you to pick one of three options below. **My recommendation is Option C**, and I can execute it the same day.

## What is blocked until you do

Everything that makes a building *real*. The rooms are walkable and the writing is underway, but not one activity can be loaded into the backend until this is settled — so no scoring, no coins, no progress, no report. Café, MAISON and MERIDIAN are all equally blocked, on day one.

---

## Background, in four sentences

The content library is organised as **competency × difficulty level**, and each shelf holds exactly twelve activities. The plan was: twelve buildings, twelve slots, one slot per building — the Café takes slot 01 on every shelf, MERIDIAN 02, MAISON 03, and so on.

That works on eight of the nine competencies. It fails on **C9 (Perseverance)**, where the shelf we intended to use is already full of twelve activities somebody wrote earlier — and **learners have already played them.**

## The three activities in the way

| Slot | Already holds | Was going to be |
|---|---|---|
| `C9-HARD-01` | *Chaos Simulator* | the **Café's** C9 mission |
| `C9-HARD-02` | *Grit vs Sunk Cost* | **MERIDIAN's** C9 mission |
| `C9-HARD-03` | *The Setback Reflection* | **MAISON's** C9 mission |

…and nine more below them. The shelf is full at twelve.

**The complication that decides this:** there is learner progress recorded against those activities — 108 records in the test database alone, including two of the twelve. Those records are keyed by the activity's name. Rename or remove an activity and its records point at nothing.

---

## The options

| | Option | What it costs | Risk |
|---|---|---|---|
| **A** | **Clear the shelf.** Move C9's twelve existing activities elsewhere | There is nowhere to move them — C9's other two shelves are also full at twelve. In practice this means **deleting twelve authored activities** | **High.** Loses finished content and breaks existing learner records |
| **B** | **Make the shelf bigger** — hold 24 instead of 12, buildings on top, existing activities below | The existing twelve get renamed as they move down | **High.** Renaming is what breaks learner records |
| **C** ✅ | **Give the buildings their own shelves.** Two new levels for the twelve buildings; the existing shelves are not touched at all | Two new levels instead of one. 18 achievement badges instead of 9. The buildings' 54 activity names change — **but they only exist in documents today, nothing is loaded** | **Near zero.** No existing content moves, no learner record breaks |

---

## Recommendation: Option C

Three reasons.

**1. It is the only option that touches nothing that exists.** The buildings' activity names live in three documents and nowhere else — renaming them costs an afternoon of find-and-replace. Every other option renames or deletes content that learners have already played.

**2. The original reasoning no longer applies.** We chose to reuse the existing shelf because the age band happened to fit (17–21 against our 16–21). That was a judgment about *labels*. The problem turned out to be *space*, and no amount of age-band fit creates space on a full shelf.

**3. It fixes a second thing quietly.** The two audience tracks — Level A (16–21) and Level B (35–50) — would otherwise have been stored under two unrelated names, for reasons no future reader could reconstruct. Option C gives them a matched pair.

### What changes if you say yes

- **Nothing a learner has done is affected.** The existing C9 activities stay exactly where they are and keep working.
- **Nothing about the buildings' design changes** — same nine missions, same questions, same scoring, same reports. Only the internal filing changes.
- **One extra piece of work**: eighteen achievement badges to name instead of nine, and two "completed the track" badges instead of one. I need names for those, but not today.
- **The buildings can then be seeded** as soon as the validator fix lands, which is already specified and small.

### What I need from you

1. **Yes to Option C** (or a different pick).
2. Optional, and not urgent: whether you want the two levels called `SCA`/`SCB` or something you prefer. The names appear in internal ids and on badge records, never in front of a learner.

If Option C is a no, tell me which of A or B you prefer and I will cost the data migration properly before anyone touches anything.

---

## One thing worth saying plainly

Neither this nor the second blocker we found was visible from the design documents. Both showed up only by querying the live content library and the progress table. That is an argument for auditing the data before planning against it — and it is why the seeding step should be re-run against **production** before we commit to any of this, since the numbers I have are from the test database.

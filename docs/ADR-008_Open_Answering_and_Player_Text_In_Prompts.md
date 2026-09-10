# ADR-008 — The Café goes open-ended: typed answers become the instrument, and reach the generators

_The City · Interior Framework · v1.0 · 2026-09-09 · **Status: Built** · Deciders: KK (product), santhosh / hrithik / uganthan (eng), backend owner (§13 posture reversal)_

_Extends **[ADR-007](ADR-007_The_Career_Journey.md)** (the career, the stage graph, the evidence ledger) and **supersedes one row of its §13 table**. Everything else in ADR-007 stands. Backend contract: **[PRD_Backend_Missions.md](PRD_Backend_Missions.md)** §5.5, already rewritten once by ADR-007 §13. Consumer: [Café](PRD_Building_Cafe.md)._
_Content source: `FINAL_Cafe_Process_Flow.xlsx` — the same workbook ADR-007 was written from, now used **verbatim** rather than paraphrased._

> **Read this if you are about to put player text in front of a model, anywhere in the city.** ADR-007 §13 said that would never happen and named the mechanism that made it impossible. This ADR reverses that one line, on request, and replaces the mechanism with a different one. If you skip to a single section, make it §4.

---

## 1. TL;DR

Three things changed, and only the third needs an ADR:

1. **The blueprint's own words.** Every interview and review question is now the workbook's text, unedited, in American English and a formal register. What used to be dramatized paraphrase (_"Start me off. Who am I talking to?"_) is now the question as written (_"Tell me about yourself."_).
2. **Scenarios stopped being multiple choice.** The player types. The blueprint's three option texts were not deleted — they moved server-side and became the **grading rubric**, one tier descriptor each. What was the menu is now the answer key, and the answer key never leaves the server.
3. **Typed text now reaches a generator prompt.** The client asked for consequences layered on what the player wrote in the interview and the reviews. ADR-007 §13 promised the opposite, in a table, and called the promise load-bearing. **That row is superseded. §4 is the replacement guarantee.**

What does **not** change: proficiency is still 1–3, coins are still 5/15/25, revenue still moves only on the authored anchors, no tier ever reaches a client, no migration is required, and no other building is touched.

---

## 2. Context

### 2.1 What ADR-007 §13 promised

| Guarantee                              | ADR-007 §13                                                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Player text reaches a generator prompt | **never** — typed answers go to the grader only, and the grader's output is not fed to the generators |

and named the enforcement:

> the consequence generator's input struct has no field a typed answer could occupy

That was true, it was cheap, and it was enforced by a test (`TestConsequence_TheGeneratorNeverSeesAnythingTyped`). It is the kind of guarantee worth wanting: not a rule someone has to remember, but a shape that makes the mistake unrepresentable.

### 2.2 What the client asked for

> _Consequence for Level 1 (employee) should be layered on user answers in interview process followed by the option they chose in the scenario based question. Level 2 (branch manager) should be layered on user answers in review session followed by the option they choose in the scenario based question._

and, separately:

> _for the followup, scenario based, consequence questions leave em open ended, no options are required to be generated or shown — the user shall respond through text_

Both requests require exactly the field ADR-007 said would never exist. Read together they are not two asks but one: the Café's assessment moves from _what did you pick_ to _what did you write_, and the fiction has to respond to what was written or the writing does not matter.

### 2.3 Why this is not a quiet violation

The absent field was doing real work. Removing it without saying so would leave a document asserting a guarantee the code no longer keeps — which is worse than either the old design or the new one, because the next person to reason about prompt injection would reason from a false premise. ADR-007 §13 anticipated this in its own words about §5.5: _"there must not be one added later without revisiting this section."_ This is that revisit, one level up.

---

## 3. Options considered

### Option A — refuse the request; keep consequences keyed to the chosen letter

Cheapest, and preserves the guarantee exactly. Rejected: with scenarios open-ended there **is** no letter, so this is not "keep the current design" but "do not do the feature". The client asked for the feature twice, in two different sentences.

### Option B — summarize the answer server-side, feed the summary

Feed the model a derived artifact — a competency score, a three-word gist — rather than the prose. Tempting, and it technically keeps player prose out of the prompt. Rejected on two counts: a summary is itself model output derived from the same untrusted text, so the injection surface moves rather than closes; and a consequence written from a score is exactly the tier readout ADR-007 §11.1 forbids, wearing prose.

### Option C — pass the text, fenced, with an explicit data-not-instructions rule ✅

Accept that player prose enters the prompt. Replace a structural guarantee with an operational one, write it down, and test it. Costs: a real (if small) injection surface, and a rule that a future contributor could forget. Buys: the feature as asked, and one auditable place where every path that does this is listed.

### Option D — a separate, sandboxed model call for the untrusted text

A two-model arrangement where one reads the text and cannot act, the other acts and cannot read. Correct in principle, and roughly doubles the per-scene cost and latency of a path that already spends up to 30s on a stage close. Rejected as disproportionate to the blast radius (§4.3).

### Trade-off

|                                 | A    | B            | C ✅      | D                  |
| ------------------------------- | ---- | ------------ | --------- | ------------------ |
| Delivers the request            | ✗    | partly       | ✓         | ✓                  |
| Injection surface               | none | moved        | contained | none               |
| New machinery                   | none | a summarizer | one file  | a second call path |
| Cost / latency                  | —    | +1 call      | —         | +1 call            |
| Honest about what it guarantees | ✓    | ✗            | ✓         | ✓                  |

---

## 4. Decision — the replacement guarantee

**ADR-007 §13's first row is superseded.** The new row reads:

| Guarantee                              | ADR-008                                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Player text reaches a generator prompt | **yes, on three named paths, always bounded and always fenced** — and it can influence prose only, never a score, a tier, revenue or a coin |

Every other row of that table stands unchanged, including _"player text is rendered to another user: never"_.

### 4.1 The mechanism

One file, `internal/services/prompt_fencing.go`, holds both halves and lists every caller:

```go
const (
	fenceOpen  = "<<<LEARNER WROTE"
	fenceClose = "END LEARNER>>>"
)
```

- **`fenceTyped(text)`** wraps the text and breaks any forged marker inside it, so a payload cannot close its own fence and continue as prompt.
- **`typedTextRule`** is the sentence that gives the marker meaning. It goes in the **system** prompt, never the user prompt — a rule that arrives in the same block as the untrusted text is a rule the untrusted text can argue with.

Callers, and there are exactly four:

| Path                   | File                                       | What is fenced                        |
| ---------------------- | ------------------------------------------ | ------------------------------------- |
| The grader             | `journey_service.go` → `gradeAndRecord`    | every answer, one fence per question  |
| The consequence writer | `consequence_service.go` → `choiceTextFor` | the scene answer, when `scene.Open`   |
| The follow-up writer   | `followup_generator.go` → `userPrompt`     | any chain turn with `Typed: true`     |
| The grader's prompt    | `grading_ai.go`                            | carries the rule for the fences above |

Bounding happens first, in `boundedAnswer`: 1,500 runes, control characters stripped, newlines flattened. Stripping control characters is not cosmetic — it is what stops a payload forging a fence out of escapes.

Two of those paths also carry **background** — what the player said in the sitting that got them this posting. This is the client's other request, in their words: _"Consequence for Level 1 (employee) should be layered on user answers in interview process followed by the option they chose in the scenario based question."_ A consequence written from the scene alone is a consequence for a stranger; the point of the interview is that the room already knows something about this person.

It is sent by the client rather than read server-side because **the server does not have it** — `JourneyAttempt` stores scores, band and feedback and never a word of what was written. It is the same player's own text either way and it goes through the same fence, with one extra bound the single-field paths do not need: a **count cap of five**, because an array is the shape that turns a 1,500-rune limit into no limit at all.

### 4.2 What the text can and cannot cause

This is the guarantee that actually contains the damage, and it is structural rather than operational:

- A generated consequence is **prose only**. `ConsequenceResult` carries a string and an optional world write, and the world write must be one of the scene's own `worldCandidates` or it is discarded (`worldIsLegal`).
- **Score, tier, revenue and coins are computed from the grader's 1–5 marks against server-only rubrics.** The consequence generator's output reaches none of them. A perfectly successful injection changes a paragraph of fiction that one player reads once.
- The nine output gates (`followup_gates.go`) and `LintAuthoredConsequence` still run on every generation. Text that talks about tiers, gives a score, or delivers a verdict is discarded whether a player asked for it or not.

### 4.3 Blast radius, stated plainly

Worst case, a player who writes a successful injection makes the game print something odd **to themselves**. Answers are per-user, and a generated consequence is shown only to the player whose text produced it. There is no shared surface, no other reader, and no path to score. That is why Option D was disproportionate.

### 4.4 What is tested

`prompt_fencing_test.go`:

- a forged closing marker cannot end the fence early, and the payload stays inside it
- nothing typed produces no fence at all
- every prompt that can carry typed text carries the rule, and the rule names the markers it governs
- typed text is fenced and authored option text is not

`TestConsequence_TheGeneratorNeverSeesAnythingTyped` was **replaced, not patched**, by `TestConsequence_TypedTextReachesTheGeneratorOnlyBoundedAndFenced`. A test asserting a guarantee this ADR retires should not survive in a weakened form — that leaves a reader unsure which document is current.

---

## 5. The second decision — options become the rubric

The blueprint gives each scenario three options with a tier each. With the player typing, showing those options is impossible and discarding them would throw away the only authored statement of what good looks like.

They move server-side, into `internal/registry/content/journeykeys/cafe.json`, as `rubric` — one tier descriptor per scene, handed to the grader as the criterion and **never sent to a browser**.

This inverts a build check. `scripts/check_journey_mirror.mjs` used to assert every option text **was present** in the client bundle, because the browser rendered them. It now asserts the rubric anchors are **absent**, and reports leaks before it reports anything else. Getting that backwards ships the answer key, so it was the first thing changed and the first thing tested — with a deliberate leak, to confirm the check fails when it should.

### 5.1 Revenue without a chosen letter

Revenue was keyed off the letter. There is no letter now. Each scene already carried three authored anchors — developing, strong, advanced — so a 1–5 mark indexes them: **1, 3 and 5 are the authored numbers themselves; 2 and 4 are midpoints.** No new scale was invented, and every audited number in the workbook still means what it meant. `JourneyKey.RevenueForScore` is the sibling of the letter-based `RevenueFor`, which stays for anything still using it.

### 5.2 An unanswered question is not a weak answer

A question with nothing written against it is **not graded at all**: no criterion, no mark, no revenue. It is not scored 1.

This matters more than it looks. Sending an empty string to a grader gets it marked at the bottom, which would mean _walking away_ and _answering badly_ produce the same record — and the report's whole claim is that it measures where someone started and how they progressed. It is also the same rule the unreachable-grader path already followed one level up: an ungraded sitting is recorded honestly as ungraded.

---

## 6. Consequences

**Good:**

- The Café says what the blueprint says, and the assessment measures writing rather than recognition.
- One file lists every path that puts player text in front of a model. Before this there was no such list, because there was nothing to list — and if the guarantee had been broken quietly, there still would not have been.
- The empty-answer rule closed a real hole: before it, an unanswered open scene was sent to the grader as `""`.

**Bad, and accepted:**

- There is now a prompt-injection surface where there was none. §4.2 is why it is small; it is not zero.
- A future contributor can add a fifth path and forget to fence it. The mitigation is that `fenceTyped` is the only way typed text is written into any prompt today, so an unfenced one is visible in review as a raw `%s`.
- Open answering is slower and costlier to grade than picking a letter. Grading is still **one call per stage**, not per question, and that must stay true.

**Neutral:**

- ADR-007 §13's remaining rows are untouched and still binding.
- `PRD_Backend_Missions §5.5` has now been rewritten twice. It should be read as history plus two amendments, or consolidated — a decision for whoever next edits it.

---

## 7. Two decisions this one deliberately did not make

Both were left open when this ADR was first written, and both have since been taken. They are recorded here rather than in a new document because each is a boundary on §1's "the player types" — and a reader who finds an exception without finding the reason will assume it is an oversight and open it up.

### 7.1 The CEO round stays lettered

**L3 is not open, and that is the decision rather than the leftover.**

Its four scenes are two-beat decision trees with nine audited terminals each, written in the workbook. Opening them would collapse two moves into one typed answer and retire thirty-six authored outcomes as anything but revenue anchors — the largest piece of content in the building, spent to buy consistency.

It also gives the career a shape worth having: you **write** your way up through the counter and the flap, and at the top you **choose** between paths someone has already costed. That is a fair description of the job, and it means the instrument measures expression where expression is what is being tested and judgement where judgement is.

Reopening it is a per-scene `open` flag plus twelve rubric descriptors, because the tree prose is written as options and not as tier anchors. Cheap, but not free, and not to be done by accident.

### 7.2 Voice is not in the succession round

The succession asks the player to interview three candidates and pick one. There is no box to speak into because there is nothing to write: the assessment **is** the pick.

The client's request — voice in "interview, review process and ceo succession interview" — is met where the player actually speaks, which is the job interview and both reviews. Adding a microphone to a screen with no text field would be a control that does nothing, which is worse than its absence.

If this is revisited, the smallest honest version is one open "why them?" question after the pick — a box, so dictation attaches to it, and one more piece of evidence for the report. Rewriting the round so the player is interviewed **for** the CEO job is a different scene from the workbook's and removes the succession decision itself, which is the single most consequential choice in the journey; that one goes back to the client rather than being taken here.

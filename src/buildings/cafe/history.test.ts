import { describe, it, expect } from "vitest";
import { historyPhases, transcriptFor } from "./history";
import { MAX_TRANSCRIPT_ANSWER, recordStage } from "./journeySession";
import { stageById } from "./journey";

const interview = stageById("cafe.interview")!;
const l1 = stageById("cafe.l1")!;
const l3 = stageById("cafe.l3")!;

describe("what a finished phase remembers", () => {
  // The whole point: a player who walks back through a phase reads the question
  // and their own words, not a unit id and a letter.
  it("keeps the typed answer against the question it answered", () => {
    const entries = transcriptFor(
      interview,
      [
        { unitId: "cafe.interview.q1", text: "I have run a counter for two years." },
        { unitId: "cafe.interview.q2", text: "The hours suit me and I like the work." },
      ],
      [],
    );
    const [phase] = historyPhases([recordStage(interview.id, 1, entries, { band: "Good start" })]);

    expect(phase.title).toBe(interview.title);
    expect(phase.band).toBe("Good start");
    expect(phase.questions).toHaveLength(2);
    expect(phase.questions[0].prompt).toBe(interview.questions![0].prompt);
    expect(phase.questions[0].answer).toBe("I have run a counter for two years.");
  });

  // "c" is not a record of anything a person would recognise a week later, so a
  // lettered decision is stored as the text they actually read. The CEO trees
  // are the only scenes still answered this way.
  it("resolves a lettered CEO decision back to the words on the buttons", () => {
    const tree = l3.trees![0];
    const entries = transcriptFor(l3, [], [{ unitId: tree.unitId, choice: "a.c" }]);

    expect(entries).toHaveLength(1);
    expect(entries[0].answer).not.toBe("a.c");
    // Both beats: a tree scene is one decision made in two moves, and reporting
    // only the second would misreport what happened.
    expect(entries[0].answer).toContain("Then:");
  });

  // An open scene is answered in prose, and that prose is what gets kept.
  it("keeps what was written on an open scene", () => {
    const scene = l1.scenes![0];
    const entries = transcriptFor(
      l1,
      [{ unitId: scene.unitId, text: "I would ask her what she wanted and write it down." }],
      [],
    );
    expect(entries[0].answer).toBe("I would ask her what she wanted and write it down.");
  });

  // The save is capped at 16KB server-side and a career is twenty-odd answers,
  // so an untruncated transcript is the one field that could lose the run.
  it("truncates a very long answer rather than risking the save", () => {
    const long = "x".repeat(MAX_TRANSCRIPT_ANSWER + 500);
    const rec = recordStage(interview.id, 1, [{ unitId: "cafe.interview.q1", answer: long }]);

    expect(rec.entries[0].answer.length).toBeLessThanOrEqual(MAX_TRANSCRIPT_ANSWER + 1);
    expect(rec.entries[0].answer.endsWith("…")).toBe(true);
  });

  // A question nobody answered is not a record of anything.
  it("keeps no entry for a question left blank", () => {
    const rec = recordStage(interview.id, 1, [
      { unitId: "cafe.interview.q1", answer: "   " },
      { unitId: "cafe.interview.q2", answer: "A real answer." },
    ]);
    expect(rec.entries).toHaveLength(1);
    expect(rec.entries[0].unitId).toBe("cafe.interview.q2");
  });

  // The Café has changed shape twice. A record from a build whose stages no
  // longer exist is dropped, not rendered with a missing title.
  it("drops a record whose stage the content no longer knows", () => {
    expect(
      historyPhases([
        { stageId: "cafe.week3", attemptNo: 1, entries: [{ unitId: "x", answer: "y" }] },
      ]),
    ).toEqual([]);
  });

  // A save written before the history view existed has no records at all, which
  // is an empty run rather than a broken one.
  it("reads an empty run as an empty run", () => {
    expect(historyPhases([])).toEqual([]);
  });
});

describe("the generated questions, in the record", () => {
  // The client asked to see "all the questions the user have been asked and
  // what they responded". The authored half was already there; a generated
  // follow-up exists nowhere but the screen it was shown on, so it has to
  // carry its own prompt or the history shows an answer to nothing.
  it("shows a follow-up's own prompt beside the answer given to it", () => {
    const rec = recordStage(l1.id, 1, [
      { unitId: l1.scenes![0].unitId, answer: "The option I took." },
      {
        unitId: l1.scenes![0].unitId,
        prompt: "What did you write on the board, exactly?",
        answer: "The drink and the date, so a pattern would show.",
      },
    ]);
    const [phase] = historyPhases([rec]);

    expect(phase.questions).toHaveLength(2);
    const followUp = phase.questions[1];
    expect(followUp.prompt).toBe("What did you write on the board, exactly?");
    expect(followUp.answer).toBe("The drink and the date, so a pattern would show.");
    // Labelled, so it reads as the follow-up it was rather than as a second
    // authored question the content does not have.
    expect(followUp.title).toBe("Follow-up");
  });

  it("truncates a long follow-up answer like any other", () => {
    const rec = recordStage(l1.id, 1, [
      { unitId: "cafe.l1.s1", prompt: "Why?", answer: "y".repeat(MAX_TRANSCRIPT_ANSWER + 200) },
    ]);
    expect(rec.entries[0].answer.length).toBeLessThanOrEqual(MAX_TRANSCRIPT_ANSWER + 1);
    expect(rec.entries[0].prompt).toBe("Why?");
  });
});

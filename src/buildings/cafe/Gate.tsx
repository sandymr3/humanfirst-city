// The gate: what he said, and the three roads out of it.
//
// A gate is the only screen that shows a player more than one road, and the
// only one in a scenario building allowed to say how a sitting went — because
// what it is reporting on is free text, where there is nothing to pattern-match
// (ADR-007 §12).
//
// Three things it must never do, all of them tempting:
//   - use the words the end-of-journey report owns. The band label is authored
//     off them, and journey.test.ts fails the build if one creeps in.
//   - show a proficiency, an n/3, or the per-question marks as a total out of a
//     total that reads like a grade.
//   - present *exit* as a failure. Leaving is one of three roads, and a player
//     who takes the job and walks after the counter has played a complete
//     journey that scores exactly what they played.
import { castById } from "./cast";
import { ChoiceButton, Sheet } from "./Sheet";
import { currentStage, takeRoad, useJourneyStore, type Road } from "./journeyStore";
import { gateRoads, ROLE_LABEL, stageById } from "./journey";

export function Gate() {
  const outcome = useJourneyStore((s) => s.outcome);
  const stage = currentStage();
  const roads = gateRoads(stage);
  if (!roads) return null;

  const host = stage.hostNpc ? castById(stage.hostNpc as never) : null;
  const nextStage = stageById(roads.accept);
  const nextRole = nextStage ? ROLE_LABEL[nextStage.role] : "";

  const go = (road: Road) => () => takeRoad(road);

  // A verdict that came back with nothing in it reads the same as none
  // arriving at all — better an honest line than a heading with a blank
  // space under it, the same gap the decision sheet's own consequence once
  // had (an empty paragraph, standing in for what a player came here to read).
  const hasFeedback = Boolean(outcome && (outcome.band || outcome.feedback));

  return (
    <Sheet head={<h2 className="font-display text-lg font-semibold text-gold">{stage.title}</h2>}>
      {hasFeedback ? (
        <Feedback host={host?.name ?? "Owen"} band={outcome!.band} feedback={outcome!.feedback} />
      ) : (
        <p className="text-sm leading-relaxed text-muted">
          {/*
            An honest line for the case where nothing graded the sitting — a
            grader outage, or an offline close. Saying so is better than
            inventing a verdict, and better than silence. Named rather than
            pronouned: the host differs by stage, and the sentence should read
            the same whoever is sitting across the table.
          */}
          {host?.name ?? "The interviewer"} heard you out. Nothing came back on the record this
          time, so take this as a conversation rather than a decision — the roads below are all
          still open.
        </p>
      )}

      <ul className="mt-6 space-y-2">
        <li>
          <ChoiceButton onClick={go("accept")} primary>
            <span className="block text-sm font-medium text-text">
              {nextRole ? `Take it — ${nextRole}` : "Take it"}
            </span>
            <span className="mt-0.5 block text-xs text-muted">Start the next posting.</span>
          </ChoiceButton>
        </li>
        <li>
          <ChoiceButton onClick={go("retry")}>
            <span className="block text-sm font-medium text-text">Go again</span>
            {/* Not "try harder" and not a penalty. The earlier attempt stays on
                the record either way — it is the baseline the report measures
                improvement from, and it is never overwritten. */}
            <span className="mt-0.5 block text-xs text-muted">
              Sit it a second time. What you said the first time stays on the record.
            </span>
          </ChoiceButton>
        </li>
        <li>
          <ChoiceButton onClick={go("exit")}>
            <span className="block text-sm font-medium text-text">Leave the café</span>
            <span className="mt-0.5 block text-xs text-muted">Take what you have and go.</span>
          </ChoiceButton>
        </li>
      </ul>
    </Sheet>
  );
}

/**
 * What he thought.
 *
 * The band is a word, never a number and never a tier name. The per-question
 * marks are deliberately not rendered here as a running total: five numbers
 * beside five questions is a grade sheet, and the point of asking in a room is
 * that it is not one.
 */
function Feedback({ host, band, feedback }: { host: string; band: string; feedback: string }) {
  return (
    <>
      {band && <p className="text-xs uppercase tracking-widest text-gold">{band}</p>}
      {feedback && (
        <p className="mt-3 text-sm leading-relaxed text-text">
          <span className="font-semibold text-gold">{host}: </span>
          {feedback}
        </p>
      )}
    </>
  );
}

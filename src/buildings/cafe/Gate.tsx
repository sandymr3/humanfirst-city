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

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex justify-center p-4">
      <div
        role="dialog"
        aria-label={stage.title}
        className="animate-slide-up w-[min(38rem,100%)] rounded-2xl border border-line/70 bg-surface/95 p-6 shadow-2xl backdrop-blur"
      >
        <h2 className="font-display text-lg font-semibold text-gold">{stage.title}</h2>

        {outcome ? (
          <Feedback host={host?.name ?? "Owen"} band={outcome.band} feedback={outcome.feedback} />
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {/*
              An honest line for the case where nothing graded the sitting — a
              grader outage, or an offline close. Saying so is better than
              inventing a verdict, and better than silence.
            */}
            He heard you out. Nothing came back on the record this time, so take this as a
            conversation rather than a decision.
          </p>
        )}

        <ul className="mt-6 space-y-2">
          <li>
            <Road
              onClick={go("accept")}
              label={nextRole ? `Take it — ${nextRole}` : "Take it"}
              hint="Start the next posting."
              primary
            />
          </li>
          <li>
            <Road
              onClick={go("retry")}
              label="Go again"
              // Not "try harder" and not a penalty. The earlier attempt stays on
              // the record either way — it is the baseline the report measures
              // improvement from, and it is never overwritten.
              hint="Sit it a second time. What you said the first time stays on the record."
            />
          </li>
          <li>
            <Road onClick={go("exit")} label="Leave the café" hint="Take what you have and go." />
          </li>
        </ul>
      </div>
    </div>
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
      {band && <p className="mt-3 text-xs uppercase tracking-widest text-gold">{band}</p>}
      {feedback && (
        <p className="mt-3 text-sm leading-relaxed text-text">
          <span className="font-semibold text-gold">{host}: </span>
          {feedback}
        </p>
      )}
    </>
  );
}

function Road({
  onClick,
  label,
  hint,
  primary,
}: {
  onClick: () => void;
  label: string;
  hint: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={
        primary
          ? "w-full rounded-xl border border-gold/60 bg-gold/10 px-4 py-3 text-left transition hover:bg-gold/20"
          : "w-full rounded-xl border border-line/70 bg-surface-2/60 px-4 py-3 text-left transition hover:border-gold/60 hover:bg-surface-2"
      }
    >
      <span className="block text-sm font-medium text-text">{label}</span>
      <span className="mt-0.5 block text-xs text-muted">{hint}</span>
    </button>
  );
}

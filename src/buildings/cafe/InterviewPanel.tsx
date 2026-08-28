// Who is asking, and how far in you are.
//
// Everything this panel does NOT say is the point of it. There is no tier, no
// proficiency, no score, no tick against an answered question and no running
// total — the blueprint's own rules are explicit that the tier is scored
// silently and "never surfaced to the learner mid-play", and a panel that put a
// mark beside a finished question would be doing exactly that by arithmetic.
//
// The ordinal stays because it is pacing, not judgement: knowing there are four
// left is information a person sitting an interview is entitled to, and it says
// nothing at all about how the last five went.
import { castById } from "./cast";
import { INTERVIEWER, QUESTIONS, ordinal } from "./interview";
import { useCafeStore } from "./cafeStore";

export function InterviewPanel() {
  const progress = useCafeStore((s) => s.progress);
  const interviewer = castById(INTERVIEWER);

  return (
    <div className="pointer-events-none absolute left-5 top-24 z-10">
      <div className="rounded-2xl border border-line/70 bg-surface/85 px-4 py-3 backdrop-blur">
        <p className="text-[11px] uppercase tracking-widest text-muted">
          Question {ordinal(progress)} of {QUESTIONS.length}
        </p>
        <p className="mt-1 text-sm font-semibold text-gold">
          {interviewer?.name ?? "The interview"}
        </p>
        {interviewer && <p className="text-xs text-muted">{interviewer.role}</p>}
      </div>
    </div>
  );
}

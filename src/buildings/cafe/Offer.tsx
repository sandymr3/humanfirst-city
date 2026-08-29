// What he decided.
//
// The end of the sitting, and the only screen in the building that is allowed to
// talk about how it went — the blueprint puts the tier "only in the end-of-journey
// report", and this is that. It does not have one yet: proficiency is computed on
// the server and there is no endpoint that hands a learner their own tiers back,
// so this says what happened and stops, rather than inventing a verdict.
//
// What it can say honestly is what he asked and what you told him, in order.
// That trail is the record, and it is the thing the player actually wants to see.
import { castById } from "./cast";
import { INTERVIEWER, QUESTIONS } from "./interview";
import { closeOffer, useCafeStore } from "./cafeStore";
import { treeFor } from "./trees";
import { Modal } from "@/ui/Modal";

export function Offer() {
  const open = useCafeStore((s) => s.offerOpen);
  const answered = useCafeStore((s) => s.answered);
  const interviewer = castById(INTERVIEWER);
  if (!open) return null;

  return (
    <div className="pointer-events-auto">
      <Modal onClose={closeOffer} width="md">
        <h2 className="font-display text-xl font-semibold text-gold">The job is yours</h2>
        <p className="mt-3 text-sm leading-relaxed text-text">
          <span className="font-semibold text-gold">{interviewer?.name ?? "Owen"}: </span>“That’s
          the nine. You start on the floor with the customers — everyone does, including me. Come
          back Monday and we’ll see how you get on.”
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Nobody is going to tell you which answers were the good ones. That is the point of asking
          them this way.
        </p>

        <h3 className="mt-6 text-xs uppercase tracking-widest text-muted">What he asked you</h3>
        <ol className="mt-3 space-y-2.5">
          {answered.map((a, i) => {
            const tree = treeFor(a.activityId);
            const chose = tree?.seed.find((c) => c.id === a.seed);
            return (
              <li key={a.activityId} className="text-sm leading-relaxed">
                <span className="mr-2 tabular-nums text-muted">{i + 1}.</span>
                <span className="text-text">{tree?.prompt ?? a.competency}</span>
                {chose && (
                  <span className="mt-0.5 block pl-6 text-xs text-muted">{chose.text}</span>
                )}
              </li>
            );
          })}
        </ol>
        {answered.length < QUESTIONS.length && (
          <p className="mt-4 text-xs text-muted">
            {QUESTIONS.length - answered.length} of the nine did not reach the server. They will be
            sent the next time you come in.
          </p>
        )}

        <button
          onClick={closeOffer}
          className="mt-6 rounded-lg bg-gold px-5 py-2 font-medium text-ink hover:brightness-110"
        >
          Back to the room
        </button>
      </Modal>
    </div>
  );
}

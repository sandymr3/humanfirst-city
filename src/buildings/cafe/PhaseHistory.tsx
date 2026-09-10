// Looking back at a phase you have finished.
//
// Read-only, and the reason is in `history.ts`: the gate's `retry` road is how
// you sit a stage again, and it appends an attempt rather than editing one. A
// panel that could rewrite a closed answer would quietly undo the property the
// evaluation report rests on — that attempt 1 stays the baseline.
//
// It is a panel and not a route because the career is one room. Leaving the room
// to read what you said in it would lose the room's own state, and the player is
// mid-career: they are looking something up, not going somewhere.
import { useEffect, useState } from "react";
import { ModalClose } from "@/ui/Modal";
import { useRoomStore } from "./roomStore";
import { historyPhases } from "./history";
import { useJourneyStore } from "./journeyStore";

export function PhaseHistory({ onClose }: { onClose: () => void }) {
  const records = useJourneyStore((s) => s.history);
  const phases = historyPhases(records);
  // Newest first: someone opening this almost always wants the phase they just
  // finished, not the interview they sat an hour ago.
  const ordered = [...phases].reverse();
  const [openPhase, setOpenPhase] = useState<string | null>(ordered[0]?.stageId ?? null);

  // The room must not read keystrokes while this is up — the same lock every
  // other panel in the building takes.
  useEffect(() => {
    useRoomStore.getState().setInputLocked(true);
    return () => useRoomStore.getState().setInputLocked(false);
  }, []);

  // Escape is deliberately NOT handled here. The room owns it — see the note in
  // Interior.tsx: two `window` listeners cannot stop one another, and the one
  // that registered first wins, which was the room walking the player out.

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="What you have answered so far"
        className="animate-slide-up flex max-h-[min(44rem,92vh)] w-[min(42rem,100%)] flex-col rounded-2xl border border-line/70 bg-surface/95 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line/50 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">Your career so far</p>
            <p className="mt-1 font-display text-lg text-text">What you have answered</p>
          </div>
          {/*
            The same close affordance every other panel in the building uses —
            a real 32px target, not the bare text button this one had drifted
            onto. `ModalClose` alone, not `Modal`: this dialog keeps its own
            hand-rolled frame on purpose (see the note below on Escape), it
            only borrowed the button.
          */}
          <ModalClose onClose={onClose} label="Close what you have answered" />
        </header>

        {ordered.length === 0 ? (
          // Not an error, and not phrased as one: a player who has not finished
          // a phase yet is at the beginning, which is a fine place to be.
          <p className="px-6 py-10 text-center text-sm text-muted">
            Nothing to look back on yet. Finish a phase and it will be here.
          </p>
        ) : (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-6 py-4">
            {ordered.map((phase) => {
              const key = `${phase.stageId}#${phase.attemptNo}`;
              const open = openPhase === key || openPhase === phase.stageId;
              return (
                <section key={key} className="rounded-xl border border-line/50 bg-surface-2/30">
                  <button
                    onClick={() => setOpenPhase(open ? null : key)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                  >
                    <span>
                      <span className="block text-sm font-medium text-text">
                        {phase.title}
                        {phase.attemptNo > 1 && (
                          <span className="ml-2 text-xs font-normal text-muted">
                            second sitting
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {phase.role} · {phase.questions.length}{" "}
                        {phase.questions.length === 1 ? "answer" : "answers"}
                      </span>
                    </span>
                    <span aria-hidden className="text-xs text-muted">
                      {open ? "−" : "+"}
                    </span>
                  </button>

                  {open && (
                    <div className="space-y-4 border-t border-line/40 px-4 py-4">
                      {phase.questions.map((q) => (
                        <div key={q.unitId}>
                          {q.title && (
                            <p className="text-[11px] uppercase tracking-widest text-gold/80">
                              {q.title}
                            </p>
                          )}
                          <p className="mt-0.5 text-sm leading-relaxed text-text">{q.prompt}</p>
                          {/*
                            The player's own words, set apart the way a quote is
                            — this panel is a record, and a record that looks
                            like the question it answers is unreadable.
                          */}
                          <p className="mt-2 border-l-2 border-line/60 pl-3 text-sm leading-relaxed text-muted">
                            {q.answer}
                          </p>
                        </div>
                      ))}

                      {phase.feedback && (
                        <div className="rounded-lg bg-surface/60 p-3">
                          {phase.band && (
                            <p className="text-[11px] uppercase tracking-widest text-gold/80">
                              {phase.band}
                            </p>
                          )}
                          <p className="mt-1 text-sm leading-relaxed text-text">{phase.feedback}</p>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        <footer className="border-t border-line/50 px-6 py-3">
          {/*
            Said plainly, because the alternative is a player hunting for an
            edit button that is missing on purpose.
          */}
          <p className="text-xs text-muted">
            This is a record of what happened. To answer a phase again, take the retry road when it
            is offered.
          </p>
        </footer>
      </div>
    </div>
  );
}

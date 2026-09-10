// The typed question on screen.
//
// This is the one place in the building where the player writes rather than
// chooses, and it is the one place feedback is allowed. ADR-007 §12 draws the
// line: a branching scene shows three options a learner can pattern-match
// against, so feedback there teaches the answer — but a free-text question shows
// nothing to correlate against, and Owen telling you what went well is what a
// job interview *is*.
//
// What is still absent, and must stay absent: any proficiency, any n/3, any
// comparison to a previous attempt, and any band label using the words the
// end-of-journey report owns.
import { useState } from "react";
import { Dictation } from "@/ui/Dictation";
import { castById } from "./cast";
import { Sheet } from "./Sheet";
import { currentQuestion, currentStage, useJourneyStore, answer, advance } from "./journeyStore";

export function QA() {
  const index = useJourneyStore((s) => s.index);
  const saved = useJourneyStore((s) => s.answers);
  const stage = currentStage();
  const question = currentQuestion();

  // Keyed on the question so moving on starts an empty box rather than
  // inheriting the last answer's text.
  const existing = question ? (saved.find((a) => a.unitId === question.unitId)?.text ?? "") : "";
  const [draft, setDraft] = useState(existing);

  if (!question) return null;

  const host = stage.hostNpc ? castById(stage.hostNpc as never) : null;
  const total = stage.questions?.length ?? 0;
  const ready = draft.trim().length > 0;

  const commit = () => {
    if (!ready) return;
    answer(question.unitId, draft);
    setDraft("");
    advance();
  };

  return (
    <Sheet
      head={
        <>
          {/*
            The ordinal is the pacing information a player legitimately needs —
            how much of this sitting is left — and it says nothing about how
            they are doing.
          */}
          <p className="text-xs uppercase tracking-widest text-muted">
            {stage.title} · {Math.min(index + 1, total)} of {total}
          </p>

          <p className="mt-3 text-sm leading-relaxed text-text">
            {host && <span className="font-semibold text-gold">{host.name}: </span>}
            {host ? `“${question.prompt}”` : question.prompt}
          </p>
        </>
      }
    >
      <label className="sr-only" htmlFor={`answer-${question.unitId}`}>
        Your answer
      </label>
      <textarea
        id={`answer-${question.unitId}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends, because this is a conversation. Shift+Enter is a
          // paragraph, because some of these answers want one.
          //
          // stopPropagation as well as preventDefault: the room listens for
          // Enter on the window, and without the second call answering a
          // question also walks you into whoever is standing nearby. The
          // panel's input lock covers this too — this is the belt to that
          // pair of braces.
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            commit();
          }
        }}
        rows={4}
        autoFocus
        className="w-full resize-y rounded-xl border border-line/70 bg-surface-2/50 px-4 py-3 text-sm leading-relaxed text-text outline-none transition-colors placeholder:text-muted/70 focus:border-gold/50"
        placeholder="Type your response, or use the microphone."
      />

      <div className="mt-3">
        <Dictation value={draft} onChange={setDraft} label={`your answer to ${stage.title}`} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-xs text-muted">Enter to answer · Shift+Enter for a new line</p>
        <button
          onClick={commit}
          disabled={!ready}
          className="rounded-lg bg-gold px-5 py-2 text-sm font-medium text-ink transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
        >
          {index + 1 >= total ? "That's me done" : "Next"}
        </button>
      </div>
    </Sheet>
  );
}

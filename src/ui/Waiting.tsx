// The one place the city admits it is thinking.
//
// There was no loading component in this codebase, and that was mostly on
// purpose: a spinner over a *generated* beat tells the player which beats were
// written by a model and which were authored, and a player who can tell treats
// them differently (ADR-006 §7.4, `framework/interior/transfer.ts`). That rule
// is about generation and it still stands.
//
// This is the other case. Closing a stage is a commitment the player made — an
// interview they sat, an answer they are owed a mark for — and it can take as
// long as the grader takes. Before this, the room showed nothing at all for
// that whole window: the question card had unmounted and the gate had not yet
// mounted. Saying nothing there does not protect the instrument, it just looks
// broken.
//
// A cup rather than a spinner, because the room is a café and a spinner is a
// piece of software. The three wisps are on staggered delays so the loop never
// resolves into a countable beat — nothing here should imply a duration the
// server has not promised.
import { useEffect, useState } from "react";

/**
 * Lines shown in order, one every few seconds, while a stage settles.
 *
 * They describe what is happening, and none of them hints at how it went.
 * "Reading it back" is honest; "checking your answers" invites the player to
 * wonder what the answer was, which is the wondering the auto-close exists to
 * avoid in the first place.
 *
 * Nobody is named and no pronoun is used. This component is mounted by three
 * different stages with three different people running them, and a line that
 * says "he" is wrong in two of them and presumptuous in all three.
 */
const DEFAULT_LINES = ["One moment.", "Reading it back.", "Still reading."];

export function Waiting({
  lines = DEFAULT_LINES,
  className = "",
}: {
  lines?: readonly string[];
  className?: string;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (lines.length < 2) return;
    // Stops at the last line rather than cycling. A message that loops forever
    // reads as a stuck process; one that settles reads as a slow one.
    const id = window.setInterval(() => {
      setStep((n) => (n + 1 < lines.length ? n + 1 : n));
    }, 3200);
    return () => window.clearInterval(id);
  }, [lines]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto absolute inset-0 grid animate-fade-in place-items-center bg-ink/80 backdrop-blur-sm ${className}`}
    >
      <div className="flex flex-col items-center gap-5">
        <Cup />
        <p className="text-sm text-muted">{lines[step]}</p>
      </div>
    </div>
  );
}

/** A cup, and steam off it. Decorative — the paragraph carries the meaning. */
function Cup() {
  return (
    <div aria-hidden className="relative h-20 w-20">
      <div className="absolute inset-x-0 top-0 flex justify-center gap-2">
        {[0, 0.8, 1.6].map((delay) => (
          <span
            key={delay}
            style={{ animationDelay: `${delay}s` }}
            className="h-4 w-1 origin-bottom rounded-full bg-gold/50 animate-steam"
          />
        ))}
      </div>
      <svg viewBox="0 0 48 32" className="absolute bottom-0 left-0 h-12 w-20" fill="none">
        {/* The cup body, and a handle that reads at this size without detail. */}
        <path
          d="M6 6h28v14a10 10 0 0 1-10 10h-8A10 10 0 0 1 6 20z"
          className="fill-surface-2 stroke-line"
          strokeWidth="2"
        />
        <path
          d="M34 10h4a6 6 0 0 1 0 12h-4"
          className="stroke-line"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* The surface of the drink, the one warm note in the mark. */}
        <path d="M9 9h22v3a11 11 0 0 1-22 0z" className="fill-gold/25" />
      </svg>
    </div>
  );
}

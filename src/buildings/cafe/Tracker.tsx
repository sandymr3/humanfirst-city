// The mission tracker — top-left, one line, and nothing else.
//
// This is the most tempting surface in the building to put a score on, so what
// it may show is written down rather than left to taste (PRD §11.1):
//
//   * one objective at a time, in the room's own words;
//   * an ordinal, which is pacing information and not quality;
//   * three pips, **identical to each other**, because a pip that looked
//     different for the transfer beat would tell the player which of the three
//     questions a model wrote.
//
// And what it may never show: a tick, a strike-through, a "3/9 complete", a
// proficiency, or any mark that distinguishes a good week from a bad one.
// Completed missions simply disappear.
//
// Real focusable DOM with a polite live region, firing on objective change only
// and never per frame — a player who cannot see it still knows the line moved.
import { useEffect, useRef, useState } from "react";
import { beatsBehind, trackerLine, trackerOrdinal } from "./missionRunner";
import { useCafeStore } from "./cafeStore";

const BEATS = 3;

export function Tracker() {
  const progress = useCafeStore((s) => s.progress);
  const line = trackerLine(progress);
  const ordinal = trackerOrdinal(progress);
  const done = beatsBehind(progress);

  // Announce the line only when it actually changes. The store updates on every
  // step of the chain and most of those leave the tracker saying the same thing.
  const [spoken, setSpoken] = useState("");
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (line && line !== last.current) {
      last.current = line;
      setSpoken(line);
    }
  }, [line]);

  if (!line) return null;

  return (
    <section
      aria-label="What you are doing"
      className="pointer-events-auto absolute left-5 top-20 z-10 max-w-[16rem] rounded-xl border border-line/70 bg-surface/85 px-4 py-3 backdrop-blur"
    >
      <p className="text-[10px] uppercase tracking-widest text-muted">{ordinal}</p>
      <p className="mt-1 text-sm leading-snug text-text">{line}</p>

      {/* Three pips, one per beat. Same colour, same shape, same size — the only
          thing that changes is how many are filled. */}
      <div className="mt-2.5 flex gap-1.5" aria-hidden="true">
        {Array.from({ length: BEATS }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              i < done ? "bg-gold" : "bg-line"
            }`}
          />
        ))}
      </div>

      <p aria-live="polite" className="sr-only">
        {spoken}
      </p>
    </section>
  );
}

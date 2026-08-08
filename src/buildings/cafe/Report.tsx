// "The Year at the Corner" on screen (PRD §13) — a full-screen reader, opened by
// walking up to the envelope propped against the pass-through hatch.
//
// Unlike every other surface in this building it is allowed to be a document: it
// is the one thing here you read rather than play, it is the last thing in the
// season, and it is the only place tier vocabulary may ever appear. What is
// still absent is a score, a chart and a "next" button — the report is a debrief
// from somebody who worked the bar next to you, not a scorecard, and it ends by
// naming places in the city rather than by setting homework.
import { useEffect, useRef } from "react";
import { TIERS_PENDING, letter, nextPlaces, shape, tiersAvailable, trail } from "./report";
import { closeReport, useCafeStore } from "./cafeStore";

export function Report() {
  const open = useCafeStore((s) => s.reportOpen);
  const world = useCafeStore((s) => s.world);
  const decided = useCafeStore((s) => s.decided);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus lands on the way out of the letter rather than on the letter itself:
  // a screen reader should start at the top of what Priya wrote, and the button
  // is where you go when you have finished reading it.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeReport();
      }
    };
    // Capture, because the interior's own Escape handler means "leave the
    // building" and closing the letter must come first.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  if (!open) return null;

  const rows = trail(decided);
  const beats = shape(decided);
  const places = nextPlaces(world);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="The Year at the Corner"
      className="pointer-events-auto absolute inset-0 z-40 overflow-y-auto bg-ink/97 animate-fade-in"
    >
      <div className="mx-auto w-[min(46rem,92vw)] py-12">
        <header className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">
              Propped against the hatch, where the rota usually is
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-gold">
              The Year at the Corner
            </h1>
          </div>
          <button
            ref={closeRef}
            onClick={closeReport}
            className="shrink-0 rounded-full border border-line/70 bg-surface/80 px-4 py-2 text-sm text-text backdrop-blur hover:brightness-110"
          >
            Put it back
            <span className="ml-2 rounded bg-line/50 px-1.5 py-0.5 text-xs text-muted">Esc</span>
          </button>
        </header>

        {/* The letter. Set wider and looser than anything else in the building,
            because it is the one thing here that is meant to be read slowly. */}
        <section aria-label="Priya's letter" className="mt-10 space-y-4">
          {letter(world).map((para, i) => (
            <p key={i} className="text-[15px] leading-8 text-text">
              {para}
            </p>
          ))}
        </section>

        <hr className="my-10 border-line/50" />

        <section aria-label="Your record">
          <h2 className="font-display text-xl font-semibold text-text">And behind it, your own</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{TIERS_PENDING}</p>
          {/* The nine tiers go here when the season has been scored. Nothing is
              rendered in their place: an empty section is honest and a filled one
              would be the building's only lie. */}
          {tiersAvailable() && null}
        </section>

        <section aria-label="What you chose, and what happened" className="mt-10">
          <h2 className="font-display text-xl font-semibold text-text">
            What you chose, and what happened
          </h2>
          <ol className="mt-5 space-y-6">
            {rows.map((row) => (
              <li key={row.competency} className="border-l-2 border-line/60 pl-4">
                <p className="text-xs uppercase tracking-widest text-muted">
                  Week {row.week} · {row.title}
                </p>
                {row.chose ? (
                  <>
                    <p className="mt-2 text-sm leading-relaxed text-text">{row.chose}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{row.happened}</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted">Not decided.</p>
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* §13.3 — the seed/follow shape, laid side by side. The reading of the
            pattern is §10.2's arithmetic over two server-side tiers and arrives
            with them; the pattern itself is here now, and is most of the value. */}
        <section aria-label="How each week went" className="mt-10">
          <h2 className="font-display text-xl font-semibold text-text">How each week went</h2>
          <ol className="mt-5 space-y-5">
            {beats.map((row) => (
              <li key={row.competency}>
                <p className="text-xs uppercase tracking-widest text-muted">Week {row.week}</p>
                <dl className="mt-1.5 space-y-1 text-sm leading-relaxed">
                  <Beat label="When it came up" text={row.sawIt} />
                  <Beat label="Once you knew what it was" text={row.thenDid} />
                  <Beat label="When it came back" text={row.andThen} />
                </dl>
              </li>
            ))}
          </ol>
        </section>

        {places.length > 0 && (
          <section aria-label="Where to go next" className="mt-10">
            <h2 className="font-display text-xl font-semibold text-text">
              Places you might walk to next
            </h2>
            <ul className="mt-5 space-y-4">
              {places.map((place) => (
                <li key={place.name}>
                  <p className="text-sm font-semibold text-gold">{place.name}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted">{place.why}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <button
          onClick={closeReport}
          className="mt-12 rounded-lg bg-gold px-5 py-2 font-medium text-ink hover:brightness-110"
        >
          Put it back
        </button>
      </div>
    </div>
  );
}

function Beat({ label, text }: { label: string; text: string | null }) {
  if (!text) return null;
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="shrink-0 text-muted sm:w-52">{label}</dt>
      <dd className="text-text">{text}</dd>
    </div>
  );
}

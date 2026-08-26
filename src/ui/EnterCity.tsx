// The one question CEO City asks about you, asked at the gate.
//
// It sets the track for the whole city (ADR-006 §11.1), so it is asked once,
// here, before the first street — not by the first shopkeeper who happens to be
// standing there. Priya used to ask it on the Café's threshold, and her wording
// is kept verbatim, because it was the right wording: it is a question about
// experience, asked plainly, where neither answer is the harder one to admit to.
//
// What is deliberately absent: an age, a difficulty label, a recommendation, and
// any mark suggesting one of these is the ambitious answer. "Level B" on a
// button turns a question about who you are into a difficulty select, and takes
// the whole season's register with it.
import { useEffect, useRef, useState } from "react";
import { audio } from "@/framework/audio/audioManager";
import { chooseTrack } from "@/framework/city/cityState";
import type { Track } from "@/framework/city/track";

export const ASK = {
  stage:
    "The gate warden has your paperwork in one hand and a coffee in the other, and has clearly decided to get this out of the way before you are through the arch.",
  prompt: "Is this your first place, or have you done this before?",
  options: [
    {
      track: "SCA" as Track,
      text: "First one. The bank manager took a chance on me and I have been awake since four thinking about it.",
      says: "Right. Then we work it out as you go, and you ask people things, and nobody here will be precious about it.",
    },
    {
      track: "SCB" as Track,
      text: "I have done this before. Which is exactly why the last six flat weeks are bothering me more than they should.",
      says: "Thought so. Then nobody will explain what you already know, and you can tell them when they are wrong.",
    },
  ],
} as const;

export function EnterCity({ onAnswered }: { onAnswered: () => void }) {
  const [said, setSaid] = useState<string | null>(null);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => first.current?.focus(), []);

  const answer = (track: Track, says: string) => {
    audio.play("ui_confirm");
    setSaid(says);
    // The write is not awaited: the answer is already true locally, and holding
    // the gate shut on a round trip would make a slow connection feel like a
    // broken one. cityState retries and mirrors on its own.
    void chooseTrack(track);
    window.setTimeout(onAnswered, 1400);
  };

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-ink/95 p-4 backdrop-blur">
      <div
        role="dialog"
        aria-label="Entering CEO City"
        aria-live="polite"
        className="w-[min(38rem,100%)] animate-slide-up rounded-2xl border border-line/70 bg-surface/95 p-7 shadow-2xl"
      >
        <p className="text-xs uppercase tracking-widest text-muted">CEO City · the gate</p>

        {said ? (
          <p className="mt-5 text-sm leading-relaxed text-text">
            <span className="font-semibold text-gold">The warden: </span>“{said}”
          </p>
        ) : (
          <>
            <p className="mb-4 mt-4 text-sm leading-relaxed text-muted">{ASK.stage}</p>
            <p className="text-sm leading-relaxed text-text">
              <span className="font-semibold text-gold">The warden: </span>“{ASK.prompt}”
            </p>
            <ul className="mt-5 space-y-2">
              {ASK.options.map((option, i) => (
                <li key={option.track}>
                  <button
                    ref={i === 0 ? first : undefined}
                    onClick={() => answer(option.track, option.says)}
                    className="w-full rounded-xl border border-line/70 bg-surface-2/60 px-4 py-3 text-left text-sm leading-relaxed text-text transition hover:border-gold/60 hover:bg-surface-2"
                  >
                    {option.text}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

// Priya's question at the door (PRD §14, ADR-005 §10.7) — the one time the
// building asks the player something about themselves rather than about the
// café.
//
// It is asked once for the whole city and answered before the first mission,
// which is why it is a small blocking sheet rather than a settings screen: it
// is a person asking, in the room, while she is holding a cloth. Neither answer
// is the harder one to admit to, and neither is marked as the ambitious one —
// a "Level B" badge here would turn a question about experience into a
// difficulty select, and the whole season's register with it.
//
// Deliberately the same surface as a decision, because it is one.
import { useEffect } from "react";
import { THRESHOLD, setTrack, type Track } from "./track";
import { castById } from "./cast";
import { resetCafeState, useCafeStore } from "./cafeStore";
import { audio } from "@/framework/audio/audioManager";

export function Threshold({ onAnswered }: { onAnswered?: () => void }) {
  const asked = useCafeStore((s) => s.thresholdOpen);
  const priya = castById(THRESHOLD.speakerId);

  useEffect(() => {
    if (asked) {
      useCafeStore.getState().announce(`${THRESHOLD.stage} ${priya?.name}: “${THRESHOLD.prompt}”`);
    }
  }, [asked, priya]);

  if (!asked) return null;

  const answer = (track: Track, says: string) => {
    audio.play("ui_confirm");
    setTrack(track);
    // The season is rebuilt from the answer: on Level B the room she is standing
    // in is a different room by the time she has finished the sentence — Tomas
    // is on the floor, the letter is on the hatch, the awning is already up.
    resetCafeState();
    useCafeStore.setState({ thresholdOpen: false, inputLocked: false });
    useCafeStore.getState().announce(`${priya?.name}: “${says}”`);
    onAnswered?.();
  };

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex justify-center p-4">
      <div
        role="dialog"
        aria-label="Priya asks"
        className="w-[min(38rem,100%)] animate-slide-up rounded-2xl border border-line/70 bg-surface/95 p-6 shadow-2xl backdrop-blur"
      >
        <p className="mb-4 text-sm leading-relaxed text-muted">{THRESHOLD.stage}</p>
        <p className="text-sm leading-relaxed text-text">
          <span className="font-semibold text-gold">{priya?.name}: </span>“{THRESHOLD.prompt}”
        </p>
        <ul className="mt-5 space-y-2">
          {THRESHOLD.options.map((option) => (
            <li key={option.track}>
              <button
                onClick={() => answer(option.track, option.says)}
                className="w-full rounded-xl border border-line/70 bg-surface-2/60 px-4 py-3 text-left text-sm leading-relaxed text-text transition hover:border-gold/60 hover:bg-surface-2"
              >
                {option.text}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

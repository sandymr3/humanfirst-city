// The decision on screen.
//
// Three options that look exactly alike: same weight, same colour, same shape,
// listed in the order the content declares them, with no letter, no icon and no
// affordance that could be read as a ranking. The player is choosing between
// three things people believe, not picking the right one.
//
// What is deliberately absent: a result view, a proficiency, a pass/fail line, a
// "next" button implying something was computed, a spinner on the third beat, and
// any mark distinguishing the generated question from the authored ones. The Café
// does not route through PlayerShell for exactly this reason.
import { useCafeStore, chooseOption, closeConsequence } from "./cafeStore";
import { castById } from "./cast";

export function Dialogue() {
  const dialogue = useCafeStore((s) => s.dialogue);
  const consequence = useCafeStore((s) => s.consequence);

  if (consequence) {
    return (
      <Sheet>
        <p className="text-sm leading-relaxed text-text">{consequence}</p>
        <button
          onClick={closeConsequence}
          className="mt-5 rounded-lg border border-line/70 px-4 py-1.5 text-xs text-muted transition hover:border-gold/60 hover:text-text"
        >
          Back to the room
        </button>
      </Sheet>
    );
  }

  if (!dialogue) return null;

  const speaker = dialogue.speaker === "room" ? null : castById(dialogue.speaker as never);

  return (
    <Sheet>
      {dialogue.stage && (
        <p className="mb-4 text-sm leading-relaxed text-muted">{dialogue.stage}</p>
      )}

      <p className="text-sm leading-relaxed text-text">
        {speaker && <span className="font-semibold text-gold">{speaker.name}: </span>}
        {speaker ? `“${dialogue.prompt}”` : dialogue.prompt}
      </p>

      <ul className="mt-5 space-y-2">
        {dialogue.options.map((o) => (
          <li key={o.id}>
            <button
              onClick={() => chooseOption(o.id)}
              className="w-full rounded-xl border border-line/70 bg-surface-2/60 px-4 py-3 text-left text-sm leading-relaxed text-text transition hover:border-gold/60 hover:bg-surface-2"
            >
              {o.text}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/**
 * The decision's own surface. Not the hotspot Modal: a decision is the room
 * talking to you, so it sits in the room rather than covering it, and it never
 * offers a way to dismiss it without answering.
 */
function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex justify-center p-4">
      <div
        role="dialog"
        aria-label="A decision"
        className="w-[min(38rem,100%)] rounded-2xl border border-line/70 bg-surface/95 p-6 shadow-2xl backdrop-blur animate-slide-up"
      >
        {children}
      </div>
    </div>
  );
}

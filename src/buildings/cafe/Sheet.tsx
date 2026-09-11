// The room's own dialog shape — shared by every screen that is the room
// talking to you: a decision, a typed question, a gate, the third beat.
//
// Not the hotspot `Modal`: none of these cover the screen or dim the world
// behind them. They sit at the foot of the room the way a person would stand
// in front of you and say something, and none of them offer a way to dismiss
// without answering.
//
// Extracted rather than left in `Decision.tsx`, where it was first built and
// first fixed: `QA.tsx` and `Gate.tsx` are the same category of screen and had
// drifted onto an older, unbounded version of this same markup — one with no
// ceiling and no focus ring. A long interview prompt or a long piece of AI
// feedback could grow either of those cards straight off the top of the
// screen with no way to scroll back to it, the exact failure this file's own
// history records for the decision sheet itself. One component now, so a fix
// made once reaches every screen that needs it.
import type { ReactNode } from "react";

/**
 * The bounded card. `head` is pinned while the rest scrolls, so the question
 * you are answering stays on screen while you read past the bottom of a long
 * option or a long piece of feedback — scrolling away from the thing you are
 * deciding about is how you forget what it asked.
 *
 * `label` is what the dialog announces itself as, and every caller must pass
 * its own. The shape is shared; the name is not. When this was extracted the
 * label came with it hardcoded, and three different screens — a decision, an
 * interview question, a gate offering three roads — all told a screen reader
 * they were "A decision". The card being identical is the point; the screens
 * being indistinguishable is a bug.
 */
export function Sheet({
  label,
  head,
  children,
}: {
  label: string;
  head?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-5 pt-4">
      <div
        role="dialog"
        aria-label={label}
        className="animate-slide-up relative flex max-h-[min(72vh,34rem)] w-[min(38rem,100%)] flex-col overflow-hidden rounded-2xl border border-line/70 bg-gradient-to-b from-surface/95 to-surface-2/90 shadow-[0_28px_60px_-24px_rgb(0_0_0/0.9)] ring-1 ring-inset ring-white/[0.07] backdrop-blur-md"
      >
        {head && <div className="shrink-0 border-b border-line/50 px-6 pb-4 pt-6">{head}</div>}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {children}
        </div>
        {/* The room is dark and the card fades into it, so a cut-off option
            would look like the end of the list rather than the edge of the box. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-surface-2/90 to-transparent"
        />
      </div>
    </div>
  );
}

/**
 * One thing you can choose, or one road out. Both shapes used to be separate
 * markup — a plain option button here, a two-line `Road` button in
 * `Gate.tsx` — that had quietly grown apart by a class or two each, `Gate`'s
 * with no focus-visible ring at all. `primary` is the one visual difference
 * between them, for the one road a gate wants to read as the suggested one.
 *
 * The rail on the left lights on hover, on keyboard focus, and — for a
 * primary road — always, and `active:scale` gives the tap itself something to
 * feel on a touch screen, where hover never fires at all.
 */
export function ChoiceButton({
  onClick,
  children,
  primary = false,
}: {
  onClick: () => void;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "group relative w-full overflow-hidden rounded-xl border py-3 pl-5 pr-4 text-left text-sm leading-relaxed text-text transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 active:scale-[0.99]",
        primary
          ? "border-gold/60 bg-gold/10 hover:bg-gold/20 focus-visible:border-gold/70"
          : "border-line/70 bg-surface-2/50 hover:border-gold/50 hover:bg-surface-2 focus-visible:border-gold/60",
      ].join(" ")}
    >
      <span
        aria-hidden
        className={[
          "absolute inset-y-0 left-0 w-[3px] transition-colors duration-200",
          primary
            ? "bg-gold/70"
            : "bg-transparent group-hover:bg-gold/70 group-focus-visible:bg-gold/70",
        ].join(" ")}
      />
      {children}
    </button>
  );
}

// The posting, and what you are doing in it.
//
// ADR-006 §6.3's tracker, retitled. Every rule in its table still binds: no
// tier, no proficiency, no coin figure, no tick on a completed scene, and
// **no revenue** — this is where a running total would most tempt someone, and
// a number that moves after each decision is a directional readout of the tier.
//
// The ordinal changed meaning. A season showed "Mission 3 of 9" because season
// length was pacing information a player legitimately needed. A career has no
// honest denominator — you do not know how many jobs you will hold — so the
// posting replaces it, which is the same information a real employee has.
import { ROLE_LABEL } from "./journey";
import { currentItem, currentStage, useJourneyStore } from "./journeyStore";

export function StageChip() {
  const role = useJourneyStore((s) => s.role);
  const index = useJourneyStore((s) => s.index);
  const stage = currentStage();
  const item = currentItem();
  if (!item) return null;

  const line =
    item.kind === "scene"
      ? item.scene.title
      : item.kind === "tree"
        ? item.tree.title
        : item.kind === "pick"
          ? "Three people want it"
          : stage.title;

  return (
    <div className="pointer-events-none absolute left-5 top-24 z-10 max-w-[16rem]">
      <p className="text-xs uppercase tracking-widest text-gold">{ROLE_LABEL[role]}</p>
      <p className="mt-0.5 font-display text-sm text-text">{line}</p>
      {/* Position, not quality: identical shape and colour for every pip. */}
      {(stage.scenes?.length ?? 0) + (stage.trees?.length ?? 0) > 1 && (
        <p className="mt-1 text-xs text-muted" aria-hidden>
          {"\u25cf".repeat(Math.min(index + 1, 9))}
        </p>
      )}
    </div>
  );
}

// The decision on screen.
//
// Named for the beat rather than the content, because `scene.ts` is the Pixi
// builder and two files differing only in case fold into one another on a
// case-insensitive filesystem — which is exactly the collision `Dialogue.tsx`
// and `dialogue.ts` have been failing typecheck on all along.
//
// Three options that look exactly alike: same weight, same colour, same shape,
// with no letter, no icon and no affordance that could be read as a ranking. The
// player is choosing between three things people believe, not picking the right
// one.
//
// The order is shuffled deterministically per unit. Authored trios are written
// weakest-first because that is the readable order to write and review in, and
// shipping them that way would put the weak option first at almost every scene —
// a tier leak with no tier vocabulary in it at all, learnable in two beats. The
// shuffle is seeded off the unit id, so replaying a decision is not a shell game
// (ADR-005 §9.2.1).
//
// What is deliberately absent: a result view, a proficiency, a pass/fail line, a
// spinner while the consequence is being written, and any mark distinguishing a
// generated consequence from an authored one.
import { useMemo } from "react";
import { presentationOrder } from "@/lib/decisionTree";
import { castById } from "./cast";
import {
  advance,
  choose,
  chooseTransferBeat,
  chooseTreeBeat,
  currentItem,
  currentScene,
  pickSuccessor,
  useJourneyStore,
} from "./journeyStore";
import { currentStage } from "./journeyStore";
import { treeFor } from "./trees";

export function Decision() {
  const consequence = useJourneyStore((s) => s.consequence);
  const scene = currentScene();

  const options = useMemo(() => {
    if (!scene) return [];
    const items = Object.entries(scene.choices).map(([id, text]) => ({ id, text }));
    return presentationOrder(scene.unitId, [], items);
  }, [scene]);

  // Reading the consequence and moving on are the same act. Clearing the sheet
  // without advancing would re-open the scene you just decided — which is what
  // it did, until an end-to-end run walked into the same decision forever.
  if (consequence !== null) {
    return (
      <Sheet>
        <p className="text-sm leading-relaxed text-text">{consequence}</p>
        <button
          onClick={advance}
          className="mt-5 rounded-lg border border-line/70 px-4 py-1.5 text-xs text-muted transition hover:border-gold/60 hover:text-text"
        >
          Back to the room
        </button>
      </Sheet>
    );
  }

  if (!scene) return <NotAScene />;
  const speaker = scene.speaker === "room" ? null : castById(scene.speaker as never);

  return (
    <Sheet>
      {scene.stage && <p className="mb-4 text-sm leading-relaxed text-muted">{scene.stage}</p>}

      <p className="text-sm leading-relaxed text-text">
        {speaker && <span className="font-semibold text-gold">{speaker.name}: </span>}
        {speaker ? `\u201c${scene.prompt}\u201d` : scene.prompt}
      </p>

      <ul className="mt-5 space-y-2">
        {options.map((o) => (
          <li key={o.id}>
            <button
              onClick={() => void choose(o.id)}
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
        className="animate-slide-up w-[min(38rem,100%)] rounded-2xl border border-line/70 bg-surface/95 p-6 shadow-2xl backdrop-blur"
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The two things a stage can ask that are not a one-beat scene.
 *
 * A CEO scene is one of the authored decision trees played whole — seed, then
 * the branch-specific follow-up — so its prose comes from `trees.ts` rather than
 * from the journey's own content. The succession asks you to choose a person
 * before it asks them anything.
 */
function NotAScene() {
  const item = currentItem();
  if (item?.kind === "tree") return <TreeBeat />;
  if (item?.kind === "pick") return <Successors />;
  return null;
}

function TreeBeat() {
  const taken = useJourneyStore((s) => s.taken);
  const transferBeat = useJourneyStore((s) => s.transferBeat);
  const item = currentItem();
  if (item?.kind !== "tree") return null;
  const tree = treeFor(item.tree.activityId);
  if (!tree) return null;

  // The third beat: written for the path this player actually took, once the
  // seed and follow-up have both landed (ADR-007 §16). Nothing here tells a
  // player it might be generated rather than authored — same sheet, same
  // shape, same absence of a spinner while it was still being written.
  if (taken.seed && taken.follow && !taken.transfer) {
    if (!transferBeat) return null;
    const options = presentationOrder(
      `${item.tree.unitId}:transfer`,
      [],
      transferBeat.options.map((o) => ({ id: o.id, text: o.text })),
    );
    return (
      <Sheet>
        <p className="text-sm leading-relaxed text-text">
          {transferBeat.speakerName && (
            <span className="font-semibold text-gold">{transferBeat.speakerName}: </span>
          )}
          {transferBeat.prompt}
        </p>
        <ul className="mt-5 space-y-2">
          {options.map((o) => (
            <li key={o.id}>
              <button
                onClick={() => void chooseTransferBeat(o.id)}
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

  // The seed first, then the branch the seed opened. The follow-up is
  // branch-specific: what you are asked second depends on what you did first.
  const onSeed = !taken.seed;
  const branch = onSeed ? null : tree.follow[taken.seed!];
  const prompt = onSeed ? tree.prompt : (branch?.prompt ?? "");
  const choices = onSeed ? tree.seed : (branch?.choices ?? []);
  const options = presentationOrder(
    `${item.tree.unitId}:${onSeed ? "seed" : taken.seed}`,
    [],
    choices.map((c) => ({ id: c.id, text: c.text })),
  );

  return (
    <Sheet>
      {onSeed && tree.stage && (
        <p className="mb-4 text-sm leading-relaxed text-muted">{tree.stage}</p>
      )}
      <p className="text-sm leading-relaxed text-text">{prompt}</p>
      <ul className="mt-5 space-y-2">
        {options.map((o) => (
          <li key={o.id}>
            <button
              onClick={() => chooseTreeBeat(onSeed ? "seed" : "follow", o.id)}
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
 * Three people who want the café.
 *
 * Each card carries the same three lines — what they are, what is good, what to
 * watch — because a candidate described in more detail than the others is a
 * candidate the layout is recommending.
 */
function Successors() {
  const stage = currentStage();
  const candidates = stage.successors ?? [];
  const options = presentationOrder(
    stage.pickUnitId ?? stage.id,
    [],
    candidates.map((c) => c),
  );

  return (
    <Sheet>
      <p className="text-sm leading-relaxed text-text">
        Three people want it. You can only hand it to one.
      </p>
      <ul className="mt-5 space-y-2">
        {options.map((c) => (
          <li key={c.key}>
            <button
              onClick={() => {
                pickSuccessor(c.key);
                advance();
              }}
              className="w-full rounded-xl border border-line/70 bg-surface-2/60 px-4 py-3 text-left transition hover:border-gold/60 hover:bg-surface-2"
            >
              <span className="block text-sm font-medium text-gold">{c.name}</span>
              <span className="mt-1 block text-sm leading-relaxed text-text">{c.profile}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">{c.positive}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">{c.watchOut}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

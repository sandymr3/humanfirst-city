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
import { useMemo, useState } from "react";
import { presentationOrder } from "@/lib/decisionTree";
import { Dictation } from "@/ui/Dictation";
import { castById } from "./cast";
import {
  advance,
  answerScene,
  answerSceneBeat,
  answerSceneBeatText,
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
  const sceneBeat = useJourneyStore((s) => s.sceneBeat);
  const scene = currentScene();

  const options = useMemo(() => {
    if (!scene) return [];
    const items = Object.entries(scene.choices ?? {}).map(([id, text]) => ({ id, text }));
    return presentationOrder(scene.unitId, [], items);
  }, [scene]);

  // Reading the consequence and moving on are the same act. Clearing the sheet
  // without advancing would re-open the scene you just decided — which is what
  // it did, until an end-to-end run walked into the same decision forever.
  // Blank counts as nothing to read, not as something to show. The store no
  // longer writes "", and this is the belt to that pair of braces: a sheet whose
  // paragraph is empty renders as a lone "Back to the room" button hanging over
  // the room, which is how this was first noticed.
  if (consequence !== null && consequence.trim() !== "") {
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

  // A generated question stands in the scene's place until it is answered. It
  // uses the same sheet, the same prompt shape and the same option buttons as an
  // authored decision, and carries no badge, no spinner and no "AI" anywhere: a
  // player who could tell which questions were written would answer them
  // differently, and the measurement would stop measuring.
  if (sceneBeat) return <SceneBeat />;

  if (!scene) return <NotAScene />;
  const speaker = scene.speaker === "room" ? null : castById(scene.speaker as never);

  return (
    <Sheet
      head={
        <>
          {scene.stage && <p className="mb-4 text-sm leading-relaxed text-muted">{scene.stage}</p>}
          <p className="text-sm leading-relaxed text-text">
            {speaker && <span className="font-semibold text-gold">{speaker.name}: </span>}
            {speaker ? `\u201c${scene.prompt}\u201d` : scene.prompt}
          </p>
        </>
      }
    >
      {scene.open ? (
        <OpenAnswer unitId={scene.unitId} />
      ) : (
        <ul className="space-y-2">
          {options.map((o) => (
            <li key={o.id}>
              <ChoiceButton onClick={() => void choose(o.id)}>{o.text}</ChoiceButton>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

/**
 * An open scene answered in the player's own words.
 *
 * Deliberately the same box, the same hint and the same key handling as the
 * interview (`QA.tsx`) — a scenario and an interview question are the same act
 * for the player now, and two different-looking text boxes in one room would
 * imply a difference that is not there.
 *
 * Enter submits and Shift+Enter is a newline, and both `preventDefault` and
 * `stopPropagation` fire: the room's own key handler is listening on the window
 * for `Enter`, and without the second call answering a question also walks you
 * into whoever is standing nearby.
 */
function OpenAnswer({ unitId }: { unitId: string }) {
  const [draft, setDraft] = useState("");
  const ready = draft.trim().length > 0;

  const commit = () => {
    if (!ready) return;
    void answerScene(draft);
    setDraft("");
  };

  return (
    <div>
      <label htmlFor={`scene-${unitId}`} className="sr-only">
        Your answer
      </label>
      <textarea
        id={`scene-${unitId}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            commit();
          }
        }}
        rows={4}
        autoFocus
        placeholder="Describe what you would do, or use the microphone."
        className="w-full resize-y rounded-xl border border-line/70 bg-surface-2/50 px-4 py-3 text-sm leading-relaxed text-text outline-none transition-colors placeholder:text-muted/70 focus:border-gold/50"
      />
      <div className="mt-3">
        <Dictation value={draft} onChange={setDraft} label="your answer to this scene" />
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-xs text-muted">Enter to answer · Shift+Enter for a new line</p>
        <button
          onClick={commit}
          disabled={!ready}
          className="rounded-lg bg-gold px-4 py-1.5 text-xs font-semibold text-ink transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Answer
        </button>
      </div>
    </div>
  );
}

/**
 * The decision's own surface. Not the hotspot Modal: a decision is the room
 * talking to you, so it sits in the room rather than covering it, and it never
 * offers a way to dismiss it without answering.
 *
 * It is BOUNDED, which it was not. Anchored to the bottom with no ceiling, a
 * long prompt and three long options grew the card straight off the top of the
 * screen and the text was simply gone — no scrollbar, no way back to it. The
 * generated questions made that routine rather than rare: an authored option is
 * written to a length, a generated one is written to a rule.
 *
 * `head` is pinned while the rest scrolls, so the question you are answering
 * stays on screen while you read past the bottom of the third option. Scrolling
 * away from the thing you are deciding about is how you forget what it asked.
 */
function Sheet({ head, children }: { head?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-5 pt-4">
      <div
        role="dialog"
        aria-label="A decision"
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
 * One thing you can choose. Five copies of this markup had already drifted apart
 * by a class or two; they are one component now.
 *
 * The rail on the left lights on hover and on keyboard focus — the focus ring
 * was missing entirely, which made the whole decision surface unusable without
 * a mouse.
 */
function ChoiceButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-xl border border-line/70 bg-surface-2/50 py-3 pl-5 pr-4 text-left text-sm leading-relaxed text-text transition-colors duration-200 hover:border-gold/50 hover:bg-surface-2 focus-visible:border-gold/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] bg-transparent transition-colors duration-200 group-hover:bg-gold/70 group-focus-visible:bg-gold/70"
      />
      {children}
    </button>
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

/**
 * One of the two or three questions a scenario scene generates from what this
 * player actually said.
 *
 * Two shapes, and which one arrives is the server's decision rather than this
 * component's: an OPEN scene generates open questions, so the beat comes back
 * with no options and is answered in prose (ADR-008 §1). A lettered scene — the
 * CEO trees — still generates a trio, and those are run through
 * presentationOrder like every other decision so the server's shuffle and the
 * client's ordering agree and position carries nothing.
 *
 * Rendering the trio when there is one and the box when there is not is the
 * whole of the difference. A player answering a written question after writing
 * their way through the scene should not notice a seam.
 */
function SceneBeat() {
  const beat = useJourneyStore((s) => s.sceneBeat);
  const options = useMemo(
    () =>
      beat
        ? presentationOrder(
            `${beat.unitId}:${beat.followupId}`,
            [],
            beat.options.map((o) => ({ id: o.id, text: o.text })),
          )
        : [],
    [beat],
  );
  if (!beat) return null;

  return (
    <Sheet
      head={
        <p className="text-sm leading-relaxed text-text">
          {beat.speakerName && (
            <span className="font-semibold text-gold">{beat.speakerName}: </span>
          )}
          {beat.prompt}
        </p>
      }
    >
      {options.length === 0 ? (
        // Keyed on the question so the box is empty for each one rather than
        // inheriting the last answer's text.
        <OpenReply key={beat.followupId} unitId={beat.followupId} />
      ) : (
        <ul className="space-y-2">
          {options.map((o) => (
            <li key={o.id}>
              <ChoiceButton onClick={() => void answerSceneBeat(o.id)}>{o.text}</ChoiceButton>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

/**
 * The box a generated question is answered in.
 *
 * Deliberately the same box as `OpenAnswer` above and as the interview's — the
 * player is doing one thing, in one room, and three text boxes that looked
 * different would imply three different acts.
 */
function OpenReply({ unitId }: { unitId: string }) {
  const [draft, setDraft] = useState("");
  const ready = draft.trim().length > 0;

  const commit = () => {
    if (!ready) return;
    void answerSceneBeatText(draft);
    setDraft("");
  };

  return (
    <div>
      <label htmlFor={`beat-${unitId}`} className="sr-only">
        Your answer
      </label>
      <textarea
        id={`beat-${unitId}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            commit();
          }
        }}
        rows={3}
        autoFocus
        placeholder="Type your reply, or use the microphone."
        className="w-full resize-y rounded-xl border border-line/70 bg-surface-2/50 px-4 py-3 text-sm leading-relaxed text-text outline-none transition-colors placeholder:text-muted/70 focus:border-gold/50"
      />
      <div className="mt-3">
        <Dictation value={draft} onChange={setDraft} label="your reply" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-xs text-muted">Enter to answer · Shift+Enter for a new line</p>
        <button
          onClick={commit}
          disabled={!ready}
          className="rounded-lg bg-gold px-4 py-1.5 text-xs font-semibold text-ink transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Answer
        </button>
      </div>
    </div>
  );
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
      <Sheet
        head={
          <p className="text-sm leading-relaxed text-text">
            {transferBeat.speakerName && (
              <span className="font-semibold text-gold">{transferBeat.speakerName}: </span>
            )}
            {transferBeat.prompt}
          </p>
        }
      >
        <ul className="space-y-2">
          {options.map((o) => (
            <li key={o.id}>
              <ChoiceButton onClick={() => void chooseTransferBeat(o.id)}>{o.text}</ChoiceButton>
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
            <ChoiceButton onClick={() => chooseTreeBeat(onSeed ? "seed" : "follow", o.id)}>
              {o.text}
            </ChoiceButton>
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
            <ChoiceButton
              onClick={() => {
                pickSuccessor(c.key);
                advance();
              }}
            >
              <span className="block text-sm font-medium text-gold">{c.name}</span>
              <span className="mt-1 block text-sm leading-relaxed text-text">{c.profile}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">{c.positive}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">{c.watchOut}</span>
            </ChoiceButton>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

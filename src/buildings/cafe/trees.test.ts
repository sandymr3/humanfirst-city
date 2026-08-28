import { describe, it, expect } from "vitest";
import { TREES, tracePath, treeFor } from "./trees";
import { FOLLOWUPS } from "./followups";
import { QUESTIONS } from "./interview";
import { activityIdFor } from "@/framework/city/track";

/** Both tracks. Everything in this file holds for eighteen rows or for none. */
const ACTIVITY_IDS = (["SCA", "SCB"] as const).flatMap((track) =>
  QUESTIONS.map((c) => activityIdFor(c, track)),
);
import { OPENING_WORLD, WORLD_KEYS, isLegal, isWorldKey, type WorldKey } from "./world";
import { CAST, type CastId } from "./cast";

const words = (s: string) => s.trim().split(/\s+/).length;
const castIds = new Set(CAST.map((m) => m.id as string));

/** Every trio of options that ships: the seeds, the follow-ups, the transfers. */
function everyTrio(): { where: string; texts: string[] }[] {
  const out: { where: string; texts: string[] }[] = [];
  for (const tree of Object.values(TREES)) {
    out.push({ where: `${tree.activityId} seed`, texts: tree.seed.map((c) => c.text) });
    for (const [branch, follow] of Object.entries(tree.follow)) {
      out.push({
        where: `${tree.activityId} follow.${branch}`,
        texts: follow.choices.map((c) => c.text),
      });
    }
  }
  for (const beat of Object.values(FOLLOWUPS)) {
    out.push({ where: `${beat.activityId} transfer`, texts: beat.options.map((o) => o.text) });
  }
  return out;
}

function everyLine(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  for (const tree of Object.values(TREES)) {
    out.push({ where: `${tree.activityId} stage`, text: tree.stage });
    out.push({ where: `${tree.activityId} prompt`, text: tree.prompt });
    for (const c of tree.seed) {
      out.push({ where: `${tree.activityId} seed.${c.id}`, text: c.text });
      out.push({ where: `${tree.activityId} seed.${c.id} says`, text: c.consequence });
    }
    for (const [b, follow] of Object.entries(tree.follow)) {
      out.push({ where: `${tree.activityId} follow.${b} prompt`, text: follow.prompt });
      for (const c of follow.choices) {
        out.push({ where: `${tree.activityId} ${b}.${c.id}`, text: c.text });
        out.push({ where: `${tree.activityId} ${b}.${c.id} says`, text: c.consequence });
      }
    }
  }
  for (const beat of Object.values(FOLLOWUPS)) {
    out.push({ where: `${beat.activityId} transfer prompt`, text: beat.prompt(OPENING_WORLD) });
    for (const o of beat.options) {
      out.push({ where: `${beat.activityId} transfer.${o.id}`, text: o.text });
      out.push({ where: `${beat.activityId} transfer.${o.id} says`, text: o.consequence });
    }
  }
  return out;
}

describe("the shape of a decision", () => {
  it("gives every tree nine leaves — three seeds, three follow-ups each", () => {
    for (const tree of Object.values(TREES)) {
      expect(tree.seed, `${tree.activityId} seed`).toHaveLength(3);
      expect(tree.seed.map((c) => c.id)).toEqual(["a", "b", "c"]);
      for (const c of tree.seed) {
        const branch = tree.follow[c.id];
        expect(branch, `${tree.activityId} has no follow-up for ${c.id}`).toBeTruthy();
        expect(branch.choices, `${tree.activityId} follow.${c.id}`).toHaveLength(3);
        expect(branch.choices.map((x) => x.id)).toEqual(["a", "b", "c"]);
      }
      expect(Object.keys(tree.follow).sort()).toEqual(["a", "b", "c"]);
    }
  });

  it("gives every option a consequence the room can play", () => {
    for (const tree of Object.values(TREES)) {
      const all = [...tree.seed, ...Object.values(tree.follow).flatMap((f) => f.choices)];
      for (const c of all) {
        expect(c.consequence.trim(), `${tree.activityId}.${c.id} says nothing`).toBeTruthy();
        expect(words(c.consequence), `${tree.activityId}.${c.id} is long`).toBeLessThanOrEqual(60);
      }
    }
  });

  it("only ever writes legal world state", () => {
    const patches = [
      ...Object.values(TREES).flatMap((t) => [
        ...t.seed,
        ...Object.values(t.follow).flatMap((f) => f.choices),
      ]),
      ...Object.values(FOLLOWUPS).flatMap((f) => f.options),
    ];
    for (const p of patches) {
      for (const [k, v] of Object.entries(p.world ?? {})) {
        expect(isWorldKey(k), `unknown key ${k}`).toBe(true);
        expect(isLegal(k as WorldKey, v as string), `${k}=${v}`).toBe(true);
      }
    }
  });

  it("builds the trace path the backend's evalTrace walks", () => {
    // PRD §10.4 verbatim. It reads the path backwards for the last node it
    // knows, so the leaf has to be last and named `id.seed.follow`.
    expect(tracePath("C1-SCA-01", "c", "b")).toEqual([
      "C1-SCA-01.seed",
      "C1-SCA-01.c",
      "C1-SCA-01.c.follow",
      "C1-SCA-01.c.b",
    ]);
  });

  it("names a tree by an activity the interview actually asks", () => {
    for (const id of Object.keys(TREES)) {
      expect(ACTIVITY_IDS.includes(id), `${id} is asked by no question`).toBe(true);
    }
    expect(treeFor("nothing-like-this")).toBeNull();
  });
});

// The check that caught the length/tier correlation in this document's own first
// draft: measured across all the choices, the Advanced options ran systematically
// longer than their peers, which made "pick the longest" a partial strategy with
// no tier vocabulary involved at all (PRD §9.2).
describe("choice parity — the tier leak nobody looks for", () => {
  it("keeps every option between 13 and 33 words", () => {
    for (const { where, texts } of everyTrio()) {
      for (const t of texts) {
        expect(words(t), `${where}: ${words(t)} words — "${t}"`).toBeGreaterThanOrEqual(13);
        expect(words(t), `${where}: ${words(t)} words — "${t}"`).toBeLessThanOrEqual(33);
      }
    }
  });

  it("keeps every trio within 8 words end to end", () => {
    for (const { where, texts } of everyTrio()) {
      const lengths = texts.map(words);
      const spread = Math.max(...lengths) - Math.min(...lengths);
      expect(spread, `${where}: spread ${spread} across ${lengths.join("/")}`).toBeLessThanOrEqual(
        8,
      );
    }
  });

  it("gives every option its own justification rather than a bare instruction", () => {
    // The weak option's classic tell is being the only bare imperative in a trio
    // of arguments, so every option has to argue for itself.
    //
    // ADR-005's gate for this counts connectives from a small set, which is the
    // right check for generated text but too narrow for authored text: "Keep both
    // on. Pulling something a fortnight after adding it makes the place look like
    // it doesn't know what it is." is PRD §9.3 verbatim, carries its reason in a
    // second sentence, and has none of those words in it. Either form counts here.
    const connective = /\b(because|since|so|and|while|but|before|rather than|instead)\b|—/i;
    const twoClauses = (t: string) =>
      t
        .trim()
        .split(/[.?!]\s+/)
        .filter(Boolean).length > 1;
    for (const { where, texts } of everyTrio()) {
      for (const t of texts) {
        expect(connective.test(t) || twoClauses(t), `${where}: no reasoning in "${t}"`).toBe(true);
      }
    }
  });

  it("never puts a tier, a score or a verdict in anything that ships", () => {
    // "pass" and "fail" are matched only as verdicts: the room has a
    // pass-through in it, and that is a hatch rather than a grade.
    const banned =
      /\b(developing|strong|advanced|proficiency|\d\s*\/\s*3|passed|failed|incorrect|well done|good (call|job|choice)|mistake|you should have|the better move|the right (call|choice)|wisely|unfortunately|sadly)\b|\bpass\/fail\b/i;
    for (const { where, text } of everyLine()) {
      expect(banned.test(text), `${where}: "${text}"`).toBe(false);
    }
  });
});

describe("the interview is completely written", () => {
  it("gives every question a decision", () => {
    for (const id of ACTIVITY_IDS) {
      expect(TREES[id], `${id} has no tree`).toBeTruthy();
    }
  });

  it("gives every question a transfer beat to fall back on", () => {
    // PRD §5.4 makes a missing fallback a build failure rather than a runtime
    // surprise, and this is the Café's version of that check. It is what makes
    // "nothing breaks with the generator switched off" a property of the
    // building rather than an intention about it.
    for (const id of ACTIVITY_IDS) {
      expect(FOLLOWUPS[id], `${id} has no fallback beat`).toBeTruthy();
    }
  });

  it("writes a distinct decision for every question", () => {
    const prompts = Object.values(TREES).map((t) => t.prompt);
    expect(new Set(prompts).size, "two weeks ask the same question").toBe(prompts.length);
    const stages = Object.values(TREES).map((t) => t.stage);
    expect(new Set(stages).size, "two weeks open on the same scene").toBe(stages.length);
  });

  it("never repeats an option anywhere in the season", () => {
    // Nine trees times nine leaves is a lot of prose, and prose fatigue shows up
    // first as a line quietly doing service twice.
    const seen = new Map<string, string>();
    for (const { where, texts } of everyTrio()) {
      for (const t of texts) {
        const prior = seen.get(t);
        expect(prior, `"${t}" appears in both ${prior} and ${where}`).toBeUndefined();
        seen.set(t, where);
      }
    }
  });
});

describe("the transfer beat", () => {
  it("belongs to a question and speaks as somebody in the building", () => {
    for (const beat of Object.values(FOLLOWUPS)) {
      expect(ACTIVITY_IDS.includes(beat.activityId)).toBe(true);
      expect(beat.speakerId === "room" || castIds.has(beat.speakerId)).toBe(true);
      expect(beat.options).toHaveLength(3);
      expect(new Set(beat.options.map((o) => o.id)).size).toBe(3);
    }
  });

  it("varies with the room without ever mentioning what you chose", () => {
    // §9.6.5's one rule for a Café author: the beat is the next Tuesday, not a
    // report card. It may notice the room; it may not notice the decision.
    for (const beat of Object.values(FOLLOWUPS)) {
      const seen = new Set<string>();
      for (const value of WORLD_KEYS[beat.variesOn]) {
        seen.add(beat.prompt({ ...OPENING_WORLD, [beat.variesOn]: value }));
      }
      expect(seen.size, `${beat.activityId} reads identically in every room`).toBeGreaterThan(1);
      for (const text of seen) {
        expect(text, `${beat.activityId}`).not.toMatch(/you (chose|decided|went with|rushed)/i);
      }
    }
  });

  it("carries no option ids that could be read as a ranking", () => {
    // Opaque per PRD §4.4: never derived from tier or position.
    for (const beat of Object.values(FOLLOWUPS)) {
      for (const o of beat.options) {
        expect(o.id, `${beat.activityId}: ${o.id}`).not.toMatch(/^(a|b|c|1|2|3)$/i);
      }
    }
  });
});

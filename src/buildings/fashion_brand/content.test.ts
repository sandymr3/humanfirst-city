import { describe, it, expect } from "vitest";
import { maisonContent } from "./content";
import { MAISON_ACTIVITY_IDS, beatForActivity } from "./season";
import { ACTIVITY_CONTENT } from "@/activities/content";
import {
  allPaths,
  choiceSpread,
  nodeEntries,
  wordCount,
  type DecisionTreeContent,
} from "@/lib/decisionTree";

// The machine half of the plausible-peers gate (docs/maison.md §18.2.1, §18.3).
//
// This is the check that catches the failure mode the PRD's own first draft had:
// the weak option written shorter and flatter than its peers, so a player can
// spot the intended answer by shape without reading a word of it. A tree that
// fails here is not a typo — it is a decision that isn't really a decision.
//
// It cannot check WHICH option is which: the tier map is server-only (§0.5). The
// human pass over the prose is still owed and still blocking (§19.3).

const trees = Object.entries(maisonContent) as [string, DecisionTreeContent][];

/** Every authored string in the building, labelled by where it lives. */
function allStrings(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  for (const [id, tree] of trees) {
    for (const { where, node } of nodeEntries(tree)) {
      node.stage.forEach((s, i) => out.push({ where: `${id}.${where}.stage[${i}]`, text: s }));
      for (const c of node.choices) {
        out.push({ where: `${id}.${where}.${c.key}`, text: c.text });
        if (c.consequence) {
          out.push({ where: `${id}.${where}.${c.key}!`, text: c.consequence });
        }
      }
    }
  }
  return out;
}

function allConsequences(): { where: string; text: string }[] {
  return allStrings().filter((s) => s.where.endsWith("!"));
}

describe("MAISON content — coverage", () => {
  it("authors all eighteen beats, and nothing that is not a beat", () => {
    expect(Object.keys(maisonContent).slice().sort()).toEqual(MAISON_ACTIVITY_IDS.slice().sort());
    for (const [id] of trees) expect(beatForActivity(id), id).toBeDefined();
  });

  it("registers every tree in the framework content lookup", () => {
    for (const [id, tree] of trees) expect(ACTIVITY_CONTENT[id], id).toBe(tree);
  });

  it("is a decision tree in every case, with its station, host and countdown", () => {
    for (const [id, tree] of trees) {
      const beat = beatForActivity(id)!;
      expect(tree.kind, id).toBe("decision_tree");
      expect(tree.station, id).toBe(beat.station);
      expect(tree.host.length, id).toBeGreaterThan(0);
      expect(tree.countdown.length, id).toBeGreaterThan(0);
    }
  });
});

describe("MAISON content — structure", () => {
  it("gives every node three choices with distinct keys and a staged room", () => {
    for (const [id, tree] of trees) {
      for (const { where, node } of nodeEntries(tree)) {
        const keys = node.choices.map((c) => c.key);
        expect(keys.length, `${id}.${where}`).toBe(3);
        expect(new Set(keys).size, `${id}.${where} duplicate keys`).toBe(3);
        expect(node.stage.length, `${id}.${where} stage`).toBeGreaterThan(0);
        // Measured across the node, not per paragraph: a one-line beat is often
        // the best line in the tree ("Élise sets her glasses down.").
        const staged = node.stage.reduce((n, p) => n + wordCount(p), 0);
        expect(staged, `${id}.${where} stage is a room, not a stub`).toBeGreaterThan(20);
        for (const para of node.stage)
          expect(para.trim(), `${id}.${where} empty line`).not.toBe("");
      }
    }
  });

  it("runs two beats to nine leaves, with a follow-up per seed branch", () => {
    for (const [id, tree] of trees) {
      expect(Object.keys(tree.followUps).slice().sort(), `${id} branches`).toEqual(
        tree.seed.choices
          .map((c) => c.key)
          .slice()
          .sort(),
      );
      const paths = allPaths(tree);
      expect(paths.length, `${id} leaves`).toBe(9);
      for (const p of paths) expect(p.length, `${id} ${p.join(".")}`).toBe(2);
    }
  });

  it("lands every choice — a decision the room does not answer is not a decision", () => {
    for (const [id, tree] of trees) {
      for (const { where, node } of nodeEntries(tree)) {
        for (const c of node.choices) {
          expect(c.consequence, `${id}.${where}.${c.key}`).toBeTruthy();
          expect(wordCount(c.consequence ?? ""), `${id}.${where}.${c.key}`).toBeGreaterThan(12);
        }
      }
    }
  });
});

describe("MAISON content — choice parity (§18.3 machine pass)", () => {
  it("keeps longest minus shortest at eight words or under, at every node", () => {
    for (const [id, tree] of trees) {
      for (const { where, node } of nodeEntries(tree)) {
        const lengths = node.choices.map((c) => wordCount(c.text));
        expect(
          choiceSpread(node),
          `${id}.${where} — word counts ${lengths.join("/")}`,
        ).toBeLessThanOrEqual(8);
      }
    }
  });

  it("writes every option like someone means it — no throwaway peers", () => {
    for (const [id, tree] of trees) {
      for (const { where, node } of nodeEntries(tree)) {
        for (const c of node.choices) {
          expect(wordCount(c.text), `${id}.${where}.${c.key}`).toBeGreaterThan(14);
        }
      }
    }
  });

  it("leaks no tier label, proficiency number or pass/fail phrasing", () => {
    // These are deliberately narrow, because the wide version bans the language
    // this venue is written in. "strong" is ordinary English here ("pre-orders
    // are strong") — "Strong" mid-sentence is the grading system leaking, so
    // tier labels are matched case-SENSITIVELY. "a house one tier above you" is
    // the trade's own word; "Tier 3" is not. And a line can fail — "whether the
    // line or the structure was what failed" is a business failing, not a
    // player being marked, so bare pass/fail is allowed and pass/fail aimed at
    // the player is not.
    const tierLabel = /\b(Developing|Strong|Advanced)\b/;
    const scoring =
      /\b(proficiency|(tier|level)\s*\d|\d\s*\/\s*3|you (passed|failed)|(passed|failed) (this|the activity|the beat)|pass(ing)? (mark|grade))\b/i;
    for (const { where, text } of allStrings()) {
      expect(tierLabel.test(text), `${where} — "${text}"`).toBe(false);
      expect(scoring.test(text), `${where} — "${text}"`).toBe(false);
    }
  });

  it("renders no verdict in any consequence — the room reports, it does not judge", () => {
    const verdicts =
      /\b(unfortunately|you should have|the (better|right|wrong) (move|option|choice|call)|correct|incorrect|well done|good job|wisely|foolish|rightly)\b/i;
    for (const { where, text } of allConsequences()) {
      expect(verdicts.test(text), `${where} — "${text}"`).toBe(false);
    }
  });

  it("offers the mentor path at both C2 beats, on both tracks (§9.6, §18.3)", () => {
    // The blueprint asked for a usage-counted "lifeline"; §9.6 resolves that into
    // one consultation option at each of the two beats, so the signal lands in
    // the tier map instead of a counter. If a C2 node loses its mentor option,
    // the competency quietly stops being about asking.
    for (const id of ["C2-SCA-03", "C2-SCB-03"]) {
      const tree = maisonContent[id] as DecisionTreeContent | undefined;
      expect(tree, `${id} authored`).toBeDefined();
      for (const { where, node } of nodeEntries(tree!)) {
        const mentors = node.choices.filter((c) => c.mentor).length;
        expect(mentors, `${id}.${where} consultation options`).toBe(1);
      }
    }
  });

  it("keeps the mentor option the same size as its peers — asking is not a shortcut", () => {
    for (const [id, tree] of trees) {
      for (const { where, node } of nodeEntries(tree)) {
        const mentor = node.choices.find((c) => c.mentor);
        if (!mentor) continue;
        const others = node.choices.filter((c) => !c.mentor).map((c) => wordCount(c.text));
        const shortest = Math.min(...others);
        expect(
          wordCount(mentor.text),
          `${id}.${where} mentor option is the runt of the node`,
        ).toBeGreaterThanOrEqual(shortest - 4);
      }
    }
  });
});

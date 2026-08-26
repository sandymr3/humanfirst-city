import { describe, it, expect } from "vitest";
import {
  allPaths,
  choiceSpread,
  choicesAlong,
  isComplete,
  nodeAt,
  nodeEntries,
  pathKey,
  presentationOrder,
  wordCount,
  worldDeltaAlong,
  type DecisionTreeContent,
} from "./decisionTree";

/** A miniature two-beat tree — same shape as a real one, no prose to maintain. */
const tree: DecisionTreeContent = {
  kind: "decision_tree",
  station: "st_rail",
  host: "Ines",
  countdown: "11 weeks out",
  seed: {
    stage: ["The rail, and a question that has been asked three times this week."],
    choices: [
      { key: "a", text: "one two three", consequence: "It happened.", world: { rail: "mixed" } },
      { key: "b", text: "one two three four", world: { cash: "tight" } },
      { key: "c", text: "one two", world: { rail: "thin" } },
    ],
  },
  followUps: {
    a: {
      stage: ["A week later."],
      choices: [
        { key: "a", text: "x", world: { rail: "neutral" } },
        { key: "b", text: "y", world: { press: "warm" } },
        { key: "c", text: "z" },
      ],
    },
    b: {
      stage: ["A week later."],
      choices: [
        { key: "a", text: "x" },
        { key: "b", text: "y" },
        { key: "c", text: "z" },
      ],
    },
    c: {
      stage: ["A week later."],
      choices: [
        { key: "a", text: "x" },
        { key: "b", text: "y" },
        { key: "c", text: "z" },
      ],
    },
  },
};

describe("decision tree traversal", () => {
  it("stands on the seed before anything is decided", () => {
    expect(pathKey([])).toBe("");
    expect(nodeAt(tree, [])).toBe(tree.seed);
    expect(isComplete(tree, [])).toBe(false);
  });

  it("routes each seed branch to its own follow-up", () => {
    expect(nodeAt(tree, ["a"])).toBe(tree.followUps.a);
    expect(nodeAt(tree, ["b"])).toBe(tree.followUps.b);
    expect(isComplete(tree, ["a"])).toBe(false);
  });

  it("ends where the path runs out of nodes", () => {
    expect(nodeAt(tree, ["a", "b"])).toBeUndefined();
    expect(isComplete(tree, ["a", "b"])).toBe(true);
  });

  it("treats an impossible path as ended rather than throwing", () => {
    expect(isComplete(tree, ["z"])).toBe(true);
    expect(choicesAlong(tree, ["z"])).toEqual([]);
  });

  it("replays the choices taken, in order", () => {
    const taken = choicesAlong(tree, ["a", "b"]);
    expect(taken.map((c) => c.key)).toEqual(["a", "b"]);
    expect(taken[0].consequence).toBe("It happened.");
  });

  it("stops replaying at the first step that does not exist", () => {
    expect(choicesAlong(tree, ["a", "q"]).map((c) => c.key)).toEqual(["a"]);
  });

  it("merges the world delta along a path, later beats winning", () => {
    expect(worldDeltaAlong(tree, ["a", "a"])).toEqual({ rail: "neutral" });
    expect(worldDeltaAlong(tree, ["a", "b"])).toEqual({ rail: "mixed", press: "warm" });
    expect(worldDeltaAlong(tree, ["a", "c"])).toEqual({ rail: "mixed" });
    expect(worldDeltaAlong(tree, [])).toEqual({});
  });

  it("enumerates nine leaves, every one two beats deep", () => {
    const paths = allPaths(tree);
    expect(paths).toHaveLength(9);
    for (const p of paths) expect(p).toHaveLength(2);
    expect(new Set(paths.map((p) => p.join(".")))).toEqual(
      new Set(["a.a", "a.b", "a.c", "b.a", "b.b", "b.c", "c.a", "c.b", "c.c"]),
    );
  });

  it("lists every node with its path key", () => {
    expect(nodeEntries(tree).map((e) => e.where)).toEqual(["seed", "a", "b", "c"]);
  });
});

describe("authoring guards", () => {
  it("counts words, ignoring the shape of the whitespace", () => {
    expect(wordCount("one two three")).toBe(3);
    expect(wordCount("  one \n two  ")).toBe(2);
    expect(wordCount("")).toBe(0);
  });

  it("measures the spread between the longest and shortest choice", () => {
    // 4 words minus 2 words: a real tree must keep this at 8 or under (§18.3),
    // because a weak option written short is a tell a player can read.
    expect(choiceSpread(tree.seed)).toBe(2);
    expect(choiceSpread(tree.followUps.a)).toBe(0);
  });
});

describe("presentation order", () => {
  const keys = (id: string, path: string[]) =>
    presentationOrder(id, path, tree.seed.choices)
      .map((c) => c.key)
      .join("");

  it("shows every choice exactly once", () => {
    expect(keys("C1-SCA-03", []).split("").sort().join("")).toBe("abc");
  });

  it("is stable — replaying a beat is not a shell game", () => {
    expect(keys("C1-SCA-03", [])).toBe(keys("C1-SCA-03", []));
    expect(keys("C4-SCB-03", ["b"])).toBe(keys("C4-SCB-03", ["b"]));
  });

  it("varies by beat, so a pattern learned at the seed does not survive", () => {
    const perNode = new Set([[], ["a"], ["b"], ["c"]].map((p) => keys("C7-SCA-03", p as string[])));
    expect(perNode.size).toBeGreaterThan(1);
  });

  it("does not leave the same key first across the whole building", () => {
    // The reason this function exists: §9.5 lists options weakest-first, so the
    // authored arrays are weakest-first too. Unshuffled, "a" would open almost
    // every node in MAISON and the weak option would be learnable by position.
    const ids = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"].flatMap((c) => [
      `${c}-HARD-03`,
      `${c}-PRO-03`,
    ]);
    const firsts = ids.flatMap((id) =>
      [[], ["a"], ["b"], ["c"]].map((p) => keys(id, p as string[])[0]),
    );
    const counts = new Map<string, number>();
    for (const f of firsts) counts.set(f, (counts.get(f) ?? 0) + 1);
    expect(counts.size, "every key opens a beat somewhere").toBe(3);
    // No key opens more than half the beats in the building.
    for (const [key, n] of counts) {
      expect(n / firsts.length, `${key} opens ${n}/${firsts.length} beats`).toBeLessThan(0.5);
    }
  });
});

import { describe, it, expect } from "vitest";
import { ACTIVITY_CONTENT } from "./content";
import { allPaths } from "@/lib/decisionTree";

// Authored content must line up with the server's hidden answer/order keys — a
// typo in an itemId or option value silently scores 1/3 no matter how well the
// player does (we shipped exactly that bug once). These guards are structural:
// they can't check the answers (server-only), but they catch malformed keys.
describe("authored activity content", () => {
  const entries = Object.entries(ACTIVITY_CONTENT);

  // BEG/MED/HARD hold the school-style drill mix; SCA and SCB are the scenario
  // grids the twelve buildings live on (DECISION_scenario_level_namespace.md).
  // This regex and the season spine's TRACK_LEVEL are the two places that change
  // if the level codes ever move again.
  it("keys every entry by a canonical registry id", () => {
    for (const [id] of entries) expect(id).toMatch(/^C\d-(BEG|MED|HARD|SCA|SCB)-\d{2}$/);
  });

  it("MCQ content uses q-numbered items with unique a–d options", () => {
    for (const [id, c] of entries) {
      if (c.kind !== "mcq") continue;
      expect(c.questions.length, `${id} question count`).toBeGreaterThan(0);
      const qids = c.questions.map((q) => q.id);
      expect(new Set(qids).size, `${id} duplicate question ids`).toBe(qids.length);
      for (const q of c.questions) {
        expect(q.id, `${id}.${q.id} id shape`).toMatch(/^q\d+$/);
        expect(q.text.length, `${id}.${q.id} empty text`).toBeGreaterThan(0);
        const values = q.options.map((o) => o.value);
        expect(new Set(values).size, `${id}.${q.id} duplicate option values`).toBe(values.length);
        for (const v of values) expect(v, `${id}.${q.id} option value`).toMatch(/^[a-d]$/);
      }
    }
  });

  it("drag-match content has unique item keys and only declared zones", () => {
    for (const [id, c] of entries) {
      if (c.kind !== "drag_match") continue;
      const keys = c.items.map((i) => i.key);
      expect(new Set(keys).size, `${id} duplicate item keys`).toBe(keys.length);
      const zoneIds = c.zones.map((z) => z.id);
      expect(new Set(zoneIds).size, `${id} duplicate zone ids`).toBe(zoneIds.length);
      expect(zoneIds.length, `${id} needs at least two zones`).toBeGreaterThan(1);
    }
  });

  it("sort-order content has unique item keys", () => {
    for (const [id, c] of entries) {
      if (c.kind !== "sort_order") continue;
      const keys = c.items.map((i) => i.key);
      expect(new Set(keys).size, `${id} duplicate item keys`).toBe(keys.length);
      expect(keys.length, `${id} needs at least two items`).toBeGreaterThan(1);
    }
  });

  it("budget content has unique keys, positive costs and at least one essential", () => {
    for (const [id, c] of entries) {
      if (c.kind !== "budget") continue;
      const keys = c.items.map((i) => i.key);
      expect(new Set(keys).size, `${id} duplicate item keys`).toBe(keys.length);
      expect(c.budget, `${id} budget`).toBeGreaterThan(0);
      expect(
        c.items.some((i) => i.essential),
        `${id} needs at least one essential`,
      ).toBe(true);
      for (const i of c.items) expect(i.cost, `${id}.${i.key} cost`).toBeGreaterThan(0);
    }
  });

  // A decision tree scores off the PATH, so a structural break here is not a
  // wrong answer — it is a submission that lands on no rubric terminal at all.
  it("decision trees terminate, and every branch has a follow-up beat", () => {
    for (const [id, c] of entries) {
      if (c.kind !== "decision_tree") continue;
      const seedKeys = c.seed.choices.map((ch) => ch.key);
      expect(seedKeys.length, `${id} seed choices`).toBe(3);
      expect(new Set(seedKeys).size, `${id} duplicate seed keys`).toBe(3);
      expect(c.seed.stage.length, `${id} seed stage`).toBeGreaterThan(0);

      // Two-beat contract: one follow-up node per seed branch, no orphans.
      expect(Object.keys(c.followUps).slice().sort(), `${id} follow-up branches`).toEqual(
        seedKeys.slice().sort(),
      );

      for (const [branch, node] of Object.entries(c.followUps)) {
        const keys = node.choices.map((ch) => ch.key);
        expect(keys.length, `${id}.${branch} choices`).toBe(3);
        expect(new Set(keys).size, `${id}.${branch} duplicate keys`).toBe(3);
        expect(node.stage.length, `${id}.${branch} stage`).toBeGreaterThan(0);
      }

      // Nine leaves, and every constructible path is exactly two beats deep.
      const paths = allPaths(c);
      expect(paths.length, `${id} leaf count`).toBe(9);
      for (const p of paths) expect(p.length, `${id} path ${p.join(".")}`).toBe(2);
    }
  });

  it("sim content declares a positive round count and starting cash", () => {
    for (const [id, c] of entries) {
      if (c.kind !== "sim") continue;
      expect(c.rounds, `${id} rounds`).toBeGreaterThan(0);
      expect(c.startingCash, `${id} startingCash`).toBeGreaterThan(0);
      expect(c.weather.length, `${id} weather flavor`).toBeGreaterThan(0);
    }
  });
});

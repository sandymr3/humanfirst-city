import { describe, it, expect } from "vitest";
import {
  STAGES,
  START_STAGE,
  stageById,
  gateRoads,
  unitsOf,
  outranks,
  mayPassFlap,
  type Stage,
  type Scene,
} from "./journey";
import { isLegal, isWorldKey, type WorldKey } from "./world";
import { stationsFor } from "./room";
import { CAST, castFor } from "./cast";
import { TREES } from "./trees";

/**
 * The journey's content lint, matching trees.test.ts.
 *
 * This is the second of two enforcement points for one rule — the backend runs
 * the same checks over its own copy of this content in
 * internal/services/journey_content_test.go. Two points is deliberate: the
 * server's copy is what the generator and the grader see, and this one is what
 * a browser actually renders, and a rule that only holds on one side of the wire
 * is a rule that will eventually not hold on the other.
 */

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const castIds = new Set<string>(CAST.map((m) => m.id as string));

/** Every one-beat scene that ships its own trio. */
function everyScene(): { stage: Stage; scene: Scene }[] {
  const out: { stage: Stage; scene: Scene }[] = [];
  for (const stage of STAGES) for (const scene of stage.scenes ?? []) out.push({ stage, scene });
  return out;
}

describe("the stage graph", () => {
  it("starts somewhere real", () => {
    expect(stageById(START_STAGE)).toBeDefined();
  });

  it("resolves every road it offers", () => {
    for (const s of STAGES) {
      for (const [name, target] of [
        ["next", s.next],
        ["accept", s.accept],
        ["retry", s.retry],
        ["exit", s.exit],
      ] as const) {
        if (!target) continue;
        expect(stageById(target), `${s.id}.${name} → ${target}`).toBeDefined();
      }
    }
  });

  it("gives every gate all three roads, exit included", () => {
    for (const s of STAGES.filter((s) => s.kind === "gate")) {
      const roads = gateRoads(s);
      expect(roads, `${s.id} is a gate with a missing road`).not.toBeNull();
      // Leaving is a first-class outcome, not a failure state. A gate that only
      // offers accept and retry is a corridor.
      expect(roads!.exit).toBe("cafe.exit");
    }
  });

  it("terminates, and only at the door", () => {
    for (const s of STAGES) {
      const roads = [s.next, s.accept, s.retry, s.exit].filter(Boolean);
      if (s.kind === "exit") expect(roads, `${s.id} leads on`).toHaveLength(0);
      else expect(roads.length, `${s.id} is a dead end`).toBeGreaterThan(0);
    }
  });

  it("is wholly reachable from the start", () => {
    const seen = new Set<string>();
    const walk = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      const s = stageById(id);
      if (!s) return;
      for (const next of [s.next, s.accept, s.retry, s.exit]) if (next) walk(next);
    };
    walk(START_STAGE);
    for (const s of STAGES) expect(seen.has(s.id), `${s.id} is unreachable`).toBe(true);
  });

  it("never lets a posting go backwards", () => {
    expect(outranks("ceo", "employee")).toBe(true);
    expect(outranks("employee", "ceo")).toBe(false);
    expect(outranks("candidate", "candidate")).toBe(false);
  });

  it("opens the flap on promotion and not before", () => {
    // The gate that was shut for the whole first act is the promotion beat.
    expect(mayPassFlap("candidate")).toBe(false);
    expect(mayPassFlap("employee")).toBe(false);
    expect(mayPassFlap("branch_manager")).toBe(true);
    expect(mayPassFlap("ceo")).toBe(true);
  });

  it("gives every unit a stable, prefixed id", () => {
    const seen = new Set<string>();
    for (const s of STAGES) {
      for (const id of unitsOf(s)) {
        expect(id.startsWith(`${s.id}.`), `${id} does not belong to ${s.id}`).toBe(true);
        expect(seen.has(id), `duplicate unit id ${id}`).toBe(false);
        seen.add(id);
      }
      for (const q of s.questions ?? []) {
        expect(q.unitId.startsWith(`${s.id}.`), `${q.unitId} does not belong to ${s.id}`).toBe(
          true,
        );
        expect(seen.has(q.unitId), `duplicate unit id ${q.unitId}`).toBe(false);
        seen.add(q.unitId);
      }
    }
  });
});

describe("the scenes", () => {
  it("offer exactly a, b and c", () => {
    for (const { scene } of everyScene()) {
      expect(Object.keys(scene.choices).sort(), scene.unitId).toEqual(["a", "b", "c"]);
    }
  });

  it("keeps every option between 13 and 33 words", () => {
    for (const { scene } of everyScene()) {
      for (const [letter, text] of Object.entries(scene.choices)) {
        const n = words(text);
        expect(n, `${scene.unitId}.${letter} is ${n} words`).toBeGreaterThanOrEqual(13);
        expect(n, `${scene.unitId}.${letter} is ${n} words`).toBeLessThanOrEqual(33);
      }
    }
  });

  it("keeps every trio within eight words of itself", () => {
    // The tier leak with no tier vocabulary in it. If the thoughtful option is
    // reliably the longest, "pick the longest" is a winning strategy and the
    // assessment has stopped measuring judgment. The source workbook's own draft
    // ran a 42-word spread on this exact content.
    for (const { scene } of everyScene()) {
      const lengths = Object.values(scene.choices).map(words);
      const spread = Math.max(...lengths) - Math.min(...lengths);
      expect(spread, `${scene.unitId} spread ${spread} (${lengths.join("/")})`).toBeLessThanOrEqual(
        8,
      );
    }
  });

  it("makes every option explain itself", () => {
    const connective = /\b(because|since|so|and|while|if)\b|—|, which|rather than/i;
    for (const { scene } of everyScene()) {
      for (const [letter, text] of Object.entries(scene.choices)) {
        expect(connective.test(text), `${scene.unitId}.${letter} carries no reason`).toBe(true);
      }
    }
  });

  it("gives every choice an authored consequence", () => {
    // A generated consequence can fail six ways. Every one of them lands here,
    // so a missing entry is a scene that breaks in front of a player.
    for (const { scene } of everyScene()) {
      for (const letter of ["a", "b", "c"]) {
        const text = scene.consequences[letter];
        expect(text, `${scene.unitId}.${letter} has no consequence`).toBeTruthy();
        expect(words(text), `${scene.unitId}.${letter} consequence`).toBeLessThanOrEqual(45);
      }
    }
  });

  it("writes only legal world state", () => {
    for (const { scene } of everyScene()) {
      for (const [letter, patch] of Object.entries(scene.world ?? {})) {
        for (const [k, v] of Object.entries(patch)) {
          expect(isWorldKey(k), `${scene.unitId}.${letter}: unknown key ${k}`).toBe(true);
          expect(isLegal(k as WorldKey, v as string), `${scene.unitId}.${letter}: ${k}=${v}`).toBe(
            true,
          );
        }
      }
    }
  });

  it("is spoken by someone who is actually in the room", () => {
    for (const { scene } of everyScene()) {
      if (scene.speaker === "room") continue;
      expect(castIds.has(scene.speaker), `${scene.unitId}: no cast member ${scene.speaker}`).toBe(
        true,
      );
    }
  });
});

describe("the silent-tier contract", () => {
  it("leaks no tier, score or verdict vocabulary anywhere that ships", () => {
    // Same regex as trees.test.ts. The qa stages are covered too: a band label
    // is the most tempting place in the product to write "Strong", and it is the
    // place that would spend the report's own vocabulary a stage early.
    const banned =
      /\b(developing|strong|advanced|proficiency|tier|passed|failed|correct|incorrect|well done|unfortunately)\b|\d\s*\/\s*3/i;

    const check = (where: string, text: string) => {
      expect(banned.test(text), `${where}: ${text}`).toBe(false);
    };

    for (const s of STAGES) {
      check(`${s.id}.title`, s.title);
      for (const q of s.questions ?? []) check(`${q.unitId}.prompt`, q.prompt);
      for (const scene of s.scenes ?? []) {
        check(`${scene.unitId}.title`, scene.title);
        check(`${scene.unitId}.stage`, scene.stage);
        check(`${scene.unitId}.prompt`, scene.prompt);
        for (const [l, t] of Object.entries(scene.choices)) check(`${scene.unitId}.${l}`, t);
        for (const [l, t] of Object.entries(scene.consequences))
          check(`${scene.unitId}.consequence.${l}`, t);
      }
      for (const c of s.successors ?? []) {
        check(`${s.id}.${c.key}.profile`, c.profile);
        check(`${s.id}.${c.key}.positive`, c.positive);
        check(`${s.id}.${c.key}.watchOut`, c.watchOut);
      }
    }
  });

  it("uses no line twice", () => {
    const seen = new Map<string, string>();
    const note = (where: string, text: string) => {
      const key = text.trim().toLowerCase();
      const prev = seen.get(key);
      expect(prev, `${where} repeats ${prev}: "${text}"`).toBeUndefined();
      seen.set(key, where);
    };
    for (const s of STAGES) {
      for (const q of s.questions ?? []) note(`${q.unitId}.prompt`, q.prompt);
      for (const scene of s.scenes ?? []) {
        note(`${scene.unitId}.prompt`, scene.prompt);
        note(`${scene.unitId}.stage`, scene.stage);
        for (const [l, t] of Object.entries(scene.choices)) note(`${scene.unitId}.${l}`, t);
        for (const [l, t] of Object.entries(scene.consequences))
          note(`${scene.unitId}.consequence.${l}`, t);
      }
    }
  });
});

describe("the CEO level", () => {
  it("reuses trees that actually exist", () => {
    // The four CEO scenes are the existing authored decision trees, played
    // whole. A scene naming a tree the bundle does not have is a scene with no
    // prose at runtime.
    const l3 = stageById("cafe.l3")!;
    expect(l3.trees).toHaveLength(4);
    for (const t of l3.trees ?? []) {
      expect(TREES[t.activityId], `no tree ${t.activityId}`).toBeDefined();
    }
  });

  it("has no one-beat scenes of its own", () => {
    // If a CEO scene ever grew its own trio, it would be scored twice — once
    // through the tree's nine terminals and once through the trio.
    expect(stageById("cafe.l3")!.scenes ?? []).toHaveLength(0);
  });
});

describe("succession", () => {
  it("offers three candidates and scores the pick", () => {
    const s = stageById("cafe.succession")!;
    expect(s.successors).toHaveLength(3);
    expect(s.pickUnitId).toBeTruthy();
    expect(new Set((s.successors ?? []).map((c) => c.key))).toEqual(new Set(["a", "b", "c"]));
  });
});

describe("the room, by posting", () => {
  it("opens the flap on promotion, in the guided list as well as physically", () => {
    // Two halves of one rule. The flap is a gate a player walks through; the
    // guided list is how a player who cannot steer crosses the room. If they
    // disagreed, the keyboard path would offer a chip leading somewhere the
    // player cannot actually go — or, worse, somewhere they should not be.
    const ids = (role: string) => stationsFor(role).map((s) => s.id);

    expect(ids("candidate")).not.toContain("st_counter");
    expect(ids("candidate")).not.toContain("st_pass");

    expect(ids("employee")).toContain("st_counter");
    expect(ids("employee")).not.toContain("st_pass");

    // The gate that was shut for the whole first act.
    expect(ids("branch_manager")).toContain("st_pass");
    expect(mayPassFlap("branch_manager")).toBe(true);
    expect(ids("employee").includes("st_pass")).toBe(mayPassFlap("employee"));

    // The door is always yours. Leaving is a road at every gate.
    for (const role of ["candidate", "employee", "branch_manager", "ceo"]) {
      expect(ids(role), `${role} cannot reach the door`).toContain("st_door");
    }
  });

  it("sends every stage somewhere its posting can actually stand", () => {
    for (const stage of STAGES) {
      const open = stationsFor(stage.role).map((s) => s.id);
      expect(open, `${stage.id} sends a ${stage.role} to ${stage.station}`).toContain(
        stage.station,
      );
    }
  });

  it("brings the benched cast back with the stages that need them", () => {
    // They stayed in CAST "because the stages after the interview will want
    // them". These are those stages — and they still arrive by posting, because
    // somebody you cannot do anything with reads as clutter rather than as life.
    expect(castFor("candidate")).toEqual(["priya", "owen"]);
    expect(castFor("employee")).toContain("marcus");
    expect(castFor("branch_manager")).toContain("tomas");
    expect(castFor("ceo")).toContain("ray");

    // Owen stops coming once the whole thing is yours: there is nobody left to
    // review you.
    expect(castFor("ceo")).not.toContain("owen");

    // Priya is unremovable. A café with nobody behind the counter is not a café.
    for (const role of ["candidate", "employee", "branch_manager", "ceo"]) {
      expect(castFor(role), `${role} walks into an empty café`).toContain("priya");
    }
  });

  it("only ever puts real cast in the room", () => {
    const known = new Set(CAST.map((m) => m.id as string));
    for (const role of ["candidate", "employee", "branch_manager", "ceo"]) {
      for (const id of castFor(role)) {
        expect(known.has(id), `${role}: no cast member ${id}`).toBe(true);
      }
      expect(new Set(castFor(role)).size, `${role} has a duplicate`).toBe(castFor(role).length);
    }
  });
});

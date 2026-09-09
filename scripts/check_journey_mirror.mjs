#!/usr/bin/env node
/**
 * Checks that the Café journey's two copies still say the same thing.
 *
 * `src/buildings/cafe/journey.ts` ships the prose to the browser; the backend's
 * `internal/registry/content/journeys/cafe.json` holds the same prose plus the
 * grading criteria and, separately, the answer key. Two copies is a deliberate
 * trade — the bundle needs the content so a backend outage leaves a playable
 * room, and the server needs its own so nothing a client sends reaches a prompt
 * — but two copies drift, and a drifted mirror is worse than no mirror: the
 * player reads one option and the grader is told about a different one.
 *
 * This runs only when the backend is checked out beside the frontend. It skips
 * cleanly otherwise, because CI clones one repo and a check that fails on a
 * missing sibling is a check people learn to ignore.
 *
 *   node scripts/check_journey_mirror.mjs
 *   BACKEND_DIR=../academy-backend node scripts/check_journey_mirror.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..");
const backend = process.env.BACKEND_DIR
  ? resolve(process.env.BACKEND_DIR)
  : resolve(repo, "..", "academy-backend");

const packPath = join(backend, "internal/registry/content/journeys/cafe.json");
if (!existsSync(packPath)) {
  console.log(`skip: no backend at ${backend} — nothing to compare against`);
  process.exit(0);
}

const pack = JSON.parse(readFileSync(packPath, "utf8"));
const bundle = readFileSync(join(repo, "src/buildings/cafe/journey.ts"), "utf8");

// The answer key, which is the file this check exists to keep OUT of the bundle
// for open scenes. Absent is tolerated: a checkout without it simply skips the
// inverse half rather than failing on a missing sibling.
const keyPath = join(backend, "internal/registry/content/journeykeys/cafe.json");
const keys = existsSync(keyPath) ? JSON.parse(readFileSync(keyPath, "utf8")) : { units: {} };

const problems = [];
const leaks = [];

// Every line the server thinks it is grading must be a line the browser shows.
for (const stage of pack.stages ?? []) {
  for (const scene of stage.scenes ?? []) {
    if (scene.activity) continue; // a two-beat scene lives in trees.ts

    // An OPEN scene inverts this whole check. Its three option texts are the
    // grading rubric now, which makes them answer key, and answer key must not
    // travel to a browser — so here the requirement is that they are ABSENT.
    // Getting this backwards ships the answers to the player, which is why it
    // is checked rather than trusted.
    if (scene.open) {
      const rubric = keys.units?.[scene.unitId]?.rubric ?? {};
      for (const [tier, text] of Object.entries(rubric)) {
        if (bundle.includes(text))
          leaks.push(`${scene.unitId}.${tier} — rubric anchor is in the bundle`);
      }
      if (scene.choices || scene.consequences) {
        leaks.push(`${scene.unitId} — open scene still carries options in the pack`);
      }
      if (scene.fallbackConsequence && !bundle.includes(scene.fallbackConsequence)) {
        problems.push(`${scene.unitId}.fallbackConsequence`);
      }
      continue;
    }
    for (const [letter, text] of Object.entries(scene.choices ?? {})) {
      if (!bundle.includes(text)) problems.push(`${scene.unitId}.${letter} — choice`);
    }
    for (const [letter, text] of Object.entries(scene.consequences ?? {})) {
      if (!bundle.includes(text)) problems.push(`${scene.unitId}.consequence.${letter}`);
    }
    for (const field of ["prompt", "stage"]) {
      if (scene[field] && !bundle.includes(scene[field])) {
        problems.push(`${scene.unitId}.${field}`);
      }
    }
  }
  for (const q of stage.questions ?? []) {
    if (!bundle.includes(q.prompt)) problems.push(`${q.unitId}.prompt`);
  }
  for (const c of stage.successors ?? []) {
    for (const field of ["profile", "positive", "watchOut"]) {
      if (c[field] && !bundle.includes(c[field])) problems.push(`${stage.id}.${c.key}.${field}`);
    }
  }
  // And the stage graph itself, which is the part a store depends on.
  for (const [field, want] of [
    ["id", stage.id],
    ["next", stage.next],
    ["accept", stage.accept],
    ["retry", stage.retry],
  ]) {
    if (want && !bundle.includes(`"${want}"`)) problems.push(`${stage.id}.${field} → ${want}`);
  }
}

// The leak is reported first and on its own, because it is the more serious of
// the two failures by a distance: a drifted mirror shows the player one line and
// grades another, but a leak shows the player the answer.
if (leaks.length) {
  console.error("ANSWER KEY IN THE BUNDLE. An open scene's grading rubric reached the browser:\n");
  for (const l of leaks) console.error(`  - ${l}`);
  console.error(
    `\n${leaks.length} leak(s). Those texts are what the grader scores against —` +
      ` they belong in internal/registry/content/journeykeys/cafe.json and nowhere a client can read.`,
  );
  process.exit(1);
}

if (problems.length) {
  console.error(
    "The journey's two copies have drifted. Present on the server, missing in the bundle:\n",
  );
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    `\n${problems.length} difference(s). Update src/buildings/cafe/journey.ts to match, or the` +
      ` grader is being told about text the player never saw.`,
  );
  process.exit(1);
}

console.log("journey mirror OK — every server line is in the bundle, and no answer key is");

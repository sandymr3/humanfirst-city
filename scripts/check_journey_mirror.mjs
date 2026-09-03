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

const problems = [];

// Every line the server thinks it is grading must be a line the browser shows.
for (const stage of pack.stages ?? []) {
  for (const scene of stage.scenes ?? []) {
    if (scene.activity) continue; // a two-beat scene lives in trees.ts
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

console.log("journey mirror OK — every server line is in the bundle");

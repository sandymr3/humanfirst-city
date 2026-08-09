// MAISON's authored content, keyed by canonical registry activity id and merged
// into ACTIVITY_CONTENT by the framework registry (docs/maison.md §19.2.1).
//
// Eighteen trees: nine beats × two tracks, nine leaves each. A tree only belongs
// here once its full two-beat layer is written — a one-beat submission cannot
// reach a two-deep rubric terminal (§10.2), so a half-built tree must never be
// playable. content.test.ts holds that line.
import type { ActivityContent } from "@/activities/content";
import { c1Hard03, c1Pro03 } from "./trees/c1";
import { c2Hard03 } from "./trees/c2-hard-03";
import { c2Pro03 } from "./trees/c2-pro-03";
import { c3Hard03, c3Pro03 } from "./trees/c3";
import { c4Hard03, c4Pro03 } from "./trees/c4";
import { c5Hard03 } from "./trees/c5-hard-03";
import { c5Pro03 } from "./trees/c5-pro-03";
import { c6Hard03, c6Pro03 } from "./trees/c6";
import { c7Hard03, c7Pro03 } from "./trees/c7";
import { c8Hard03, c8Pro03 } from "./trees/c8";
import { c9Hard03, c9Pro03 } from "./trees/c9";

export const maisonContent: Record<string, ActivityContent> = {
  "C1-SCA-03": c1Hard03,
  "C1-SCB-03": c1Pro03,
  "C2-SCA-03": c2Hard03,
  "C2-SCB-03": c2Pro03,
  "C3-SCA-03": c3Hard03,
  "C3-SCB-03": c3Pro03,
  "C4-SCA-03": c4Hard03,
  "C4-SCB-03": c4Pro03,
  "C5-SCA-03": c5Hard03,
  "C5-SCB-03": c5Pro03,
  "C6-SCA-03": c6Hard03,
  "C6-SCB-03": c6Pro03,
  "C7-SCA-03": c7Hard03,
  "C7-SCB-03": c7Pro03,
  "C8-SCA-03": c8Hard03,
  "C8-SCB-03": c8Pro03,
  "C9-SCA-03": c9Hard03,
  "C9-SCB-03": c9Pro03,
};

export { c2Hard03, c5Pro03 };

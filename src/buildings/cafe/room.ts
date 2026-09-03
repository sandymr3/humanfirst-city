// The Café's room — pure data and pure logic. No Pixi, no React, no DOM, so the
// layout invariants that actually matter (is the staff zone sealed? can you reach
// every corner?) are unit-testable on their own (room.test.ts).
//
// The room is laid out on the city's own isometric grid (TILE_W 132 × TILE_H 66,
// @/lib/iso) so walking in from Market Street never changes the camera angle.
// Contents, palette and prop list come from cafe.jpg — see cafedev.md §2-3.
//
// A one-cell wall ring encloses the play area, because cafe.jpg is a closed room.
// The two FAR edges (y0, x0) are full-height walls and carry the windows, menu
// board, framed art and stairs. The two NEAR edges (y9, x11) are low sills: a
// full wall there would stand between the camera and anyone walking along the
// front of the room.
//
//        x0  x1  x2  x3  x4  x5  x6  x7  x8  x9 x10 x11
//  y0    ▓▓  ▓W  ▓P  ▓M  ▓E  ▓▓  ▓A  ▓T  ▓T  ▓W  ▓A  ▓▓   far wall
//  y1    ▓▓  ·p  ·p  ·   ·   ·   ·   ▓L  ·   ·   ·   ▒▒   STAFF ZONE
//  y2    ▓▓  ▓C  ▓C  ▓C  ╪F  ▓C  ▓C  ·   ·   ▓X  ▓X  ▒▒   counter run
//  y3    ▓▓  ▓s  ▓s  ·   ·   ▓s  ·   ·   ▓J  ·   ▓X  ▒▒
//  y4    ▓▓  ·   ·   ·   ▒r  ▒r  ·   ▒o  ·   ·   ▓R  ▒▒   open lane
//  y5    ▓▓  ▓1  ▓c  ·   ▒r  ▒r  ▓2  ·   ·   ·   ·   ▒▒
//  y6    ▓▓  ▓c  ·   ·   ·   ·   ▓c  ·   ▓3  ▓c  ·   ▒▒
//  y7    ▓▓  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ▒▒
//  y8    ▓▓  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ▒▒
//  y9    ▒▒  ▒▒  ▒▒  ▒▒  ▒D  ▒▒  ▒▒  ▒▒  ▒▒  ▒▒  ▒▒  ▒▒   near sill + door
import { TILE_W, TILE_H } from "@/lib/iso";
import type { Cell, Grid } from "@/lib/pathfinding";

export const ROOM_W = 12;
export const ROOM_H = 10;

/** On-screen size of the whole room, in world pixels — drives the fit-to-viewport camera. */
export const ROOM_PX_W = (ROOM_W + ROOM_H) * (TILE_W / 2);
export const ROOM_PX_H = (ROOM_W + ROOM_H) * (TILE_H / 2);

export const SPAWN: Cell = { x: 4, y: 8 }; // just inside the door, facing into the room
export const EXIT: Cell = { x: 4, y: 9 }; // the door threshold, in the near sill

// ── Props ─────────────────────────────────────────────────────────────────────

export type PropKind =
  // walls and architecture
  | "wall_plank"
  | "wall_window"
  | "wall_menu"
  | "wall_art"
  | "wall_board"
  /**
   * The near edge of the room. Kept low on purpose: a full-height wall between
   * the camera and the floor would stand in front of the player every time they
   * walked along the front of the room.
   */
  | "wall_sill"
  | "stairs"
  // the counter run
  | "counter"
  | "flap"
  | "stool"
  // furniture
  | "table"
  | "chair"
  | "dresser"
  | "shelf"
  | "jukebox"
  | "radiator"
  | "plant"
  // walk-over dressing
  | "rug_persian"
  | "rug_oval"
  | "door_mat"
  // overlays — drawn on a host cell without claiming it
  | "pastry_case"
  | "espresso_machine"
  | "till"
  | "laptop"
  | "pendant";

export interface Furniture {
  kind: PropKind;
  cell: Cell;
  /** false → you can walk over it (rugs, the doormat, the door threshold). */
  blocking: boolean;
  /**
   * Drawn on top of its host cell without claiming it. Overlays are how the
   * pastry case, espresso machine and till exist without eating cells the staff
   * zone needs to stay navigable.
   */
  overlay?: boolean;
}

const f = (kind: PropKind, x: number, y: number, blocking = true): Furniture => ({
  kind,
  cell: { x, y },
  blocking,
});
const over = (kind: PropKind, x: number, y: number): Furniture => ({
  kind,
  cell: { x, y },
  blocking: false,
  overlay: true,
});

/** The far wall runs along y0 and down x0; the near sill along y9 and down x11. */
function ring(): Furniture[] {
  const out: Furniture[] = [];
  for (let x = 0; x < ROOM_W; x++) out.push(f("wall_plank", x, 0));
  for (let y = 1; y < ROOM_H; y++) out.push(f("wall_plank", 0, y));
  for (let x = 1; x < ROOM_W; x++) out.push(f("wall_sill", x, ROOM_H - 1));
  for (let y = 1; y < ROOM_H - 1; y++) out.push(f("wall_sill", ROOM_W - 1, y));
  return out;
}

/** Cells on the far wall that carry something other than bare planking. */
const FAR_WALL_FEATURES: Array<[PropKind, number]> = [
  ["wall_window", 1],
  ["wall_menu", 3],
  ["wall_art", 6],
  ["stairs", 7],
  ["stairs", 8],
  ["wall_window", 9],
  ["wall_art", 10],
];

export const FURNITURE: readonly Furniture[] = [
  // The enclosing ring, then the cells that override bare planking.
  ...ring().filter(
    (p) =>
      !(p.cell.y === 0 && FAR_WALL_FEATURES.some(([, x]) => x === p.cell.x)) &&
      !(p.cell.x === 0 && p.cell.y === 4) &&
      !(p.cell.y === ROOM_H - 1 && p.cell.x === 4),
  ),
  ...FAR_WALL_FEATURES.map(([kind, x]) => f(kind, x, 0)),
  // The community noticeboard, on the far-left wall where the lane passes it.
  f("wall_board", 0, 4),
  // The door and its mat, in the near sill.
  f("door_mat", 4, ROOM_H - 1, false),

  // …with the tall units standing in front of the far wall, drawn but not blocking.
  over("pastry_case", 2, 0),
  over("espresso_machine", 4, 0),
  over("shelf", 5, 0),

  // y1 — the staff zone. Walkable, and sealed except through the flap. The plant
  // at (7,1) is what closes the right-hand approach; see the reachability tests.
  f("plant", 7, 1),

  // y2 — the counter run. (4,2) is the flap: a gate, not furniture — see GATES.
  f("counter", 1, 2),
  f("counter", 2, 2),
  f("counter", 3, 2),
  f("counter", 5, 2),
  f("counter", 6, 2),
  over("till", 2, 2),
  // Open on the four-top, facing Owen. The reason the table is a desk today.
  over("laptop", 8, 6),
  over("pendant", 3, 2),
  f("dresser", 9, 2),
  f("dresser", 10, 2),

  // y3 — stools along the bar, the jukebox against the wall, cabinets right.
  f("stool", 1, 3),
  f("stool", 2, 3),
  f("stool", 5, 3),
  f("jukebox", 8, 3),
  f("dresser", 10, 3),

  // y4 — the open lane. Rugs are walk-over; the radiator is not.
  f("rug_persian", 4, 4, false),
  f("rug_persian", 5, 4, false),
  f("rug_oval", 7, 4, false),
  f("radiator", 10, 4),

  // y5 / y6 — the dining floor. The four-top at (8,6) is the interview table:
  // one chair either side of it, Owen on the room side at (7,6) and the window
  // seat opposite at (9,6). Both are on y6 rather than y5 so the lane along the
  // front of the tables stays open — room.test.ts walks it.
  f("table", 1, 5),
  f("chair", 2, 5),
  f("rug_persian", 4, 5, false),
  f("rug_persian", 5, 5, false),
  f("table", 6, 5),
  f("chair", 1, 6),
  f("chair", 6, 6),
  f("chair", 7, 6),
  f("table", 8, 6),
  f("chair", 9, 6),
];

/** Kinds that must never draw over the player — the near edge of the room. */
export const NEAR_EDGE: ReadonlySet<PropKind> = new Set<PropKind>(["wall_sill"]);

// ── The counter flap ──────────────────────────────────────────────────────────

export type GateId = "counter_flap";

export interface Gate {
  id: GateId;
  cell: Cell;
  /** Prompt shown when you are next to it and it is closed / open. */
  openPrompt: string;
  closePrompt: string;
  /** Announced to the live region on each transition. */
  openedSays: string;
  closedSays: string;
}

export const GATES: readonly Gate[] = [
  {
    id: "counter_flap",
    cell: { x: 4, y: 2 },
    openPrompt: "lift the counter flap",
    closePrompt: "lower the counter flap",
    openedSays: "The counter flap is up. You can get behind the bar.",
    closedSays: "The counter flap is down.",
  },
];

// ── Walkability ───────────────────────────────────────────────────────────────

const key = (x: number, y: number) => `${x},${y}`;

const BLOCKED: ReadonlySet<string> = new Set(
  FURNITURE.filter((p) => p.blocking && !p.overlay).map((p) => key(p.cell.x, p.cell.y)),
);

const GATE_AT: ReadonlyMap<string, Gate> = new Map(GATES.map((g) => [key(g.cell.x, g.cell.y), g]));

export const NO_GATES_OPEN: ReadonlySet<GateId> = new Set();

/**
 * The room's collision grid, as a pure function of which gates are open. Satisfies
 * the `Grid` interface `findPath` takes (@/lib/pathfinding), so pathing needs no
 * special-casing — a closed flap is simply a wall.
 */
export function makeRoomGrid(openGates: ReadonlySet<GateId>): Grid {
  return {
    width: ROOM_W,
    height: ROOM_H,
    isWalkable(col, row) {
      if (col < 0 || row < 0 || col >= ROOM_W || row >= ROOM_H) return false;
      const gate = GATE_AT.get(key(col, row));
      if (gate) return openGates.has(gate.id);
      return !BLOCKED.has(key(col, row));
    },
  };
}

// ── Zones ─────────────────────────────────────────────────────────────────────

export type ZoneId = "z_pass" | "z_behind" | "z_window" | "z_floor";

export interface Zone {
  id: ZoneId;
  /** The room's own words, used for prompts and live-region announcements. */
  label: string;
  contains: (cell: Cell) => boolean;
}

/** Ordered — first match wins, so the pass-through beats the wider staff zone. */
export const ZONES: readonly Zone[] = [
  { id: "z_pass", label: "the pass-through", contains: (c) => c.y === 1 && c.x <= 2 },
  { id: "z_behind", label: "behind the counter", contains: (c) => c.y === 1 && c.x <= 6 },
  { id: "z_window", label: "by the window", contains: (c) => c.x >= 9 },
  { id: "z_floor", label: "the floor", contains: () => true },
];

export function zoneAt(cell: Cell): Zone {
  return ZONES.find((z) => z.contains(cell)) ?? ZONES[ZONES.length - 1];
}

/** Every cell the flap gates access to — the sealed side of the counter. */
export const STAFF_CELLS: readonly Cell[] = Array.from({ length: 6 }, (_, i) => ({
  x: i + 1,
  y: 1,
}));

// ── Proximity ─────────────────────────────────────────────────────────────────

const manhattan = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Standing on or beside the door. */
export function exitNear(cell: Cell): boolean {
  return manhattan(cell, EXIT) <= 1;
}

/** The gate you are close enough to work, if any. */
export function gateNear(cell: Cell): Gate | null {
  return GATES.find((g) => manhattan(cell, g.cell) <= 1) ?? null;
}

// ── Guided navigation (PRD §14.2) ─────────────────────────────────────────────

export interface Station {
  id: string;
  /** Labelled in the room's own words, never "object_04". */
  label: string;
  cell: Cell;
}

/**
 * Somewhere worth being sent, without steering.
 *
 * There were six of these under the season, then one under the interview, and
 * four now — because the career works at three places and leaves by a fourth,
 * and a chip that leads nowhere is worse than no chip at all. The jukebox and
 * the window are not back: nothing in the journey sends anybody to either, and
 * re-adding them would undo the thing the emptying got right.
 *
 * `st_tables` is the four-top Owen has his laptop open on. It is where you are
 * interviewed, where you are reviewed, and — once the whole thing is yours —
 * where you sit on the other side of it.
 */
export const STATIONS: readonly Station[] = [
  { id: "st_counter", label: "the counter", cell: { x: 3, y: 3 } },
  // (2,1), not (2,2): the counter run is furniture and the staff zone is the
  // row behind it. This is inside the sealed zone, so it is reachable only once
  // the flap is yours — which is the point of it being where a branch manager
  // works.
  { id: "st_pass", label: "the pass-through", cell: { x: 2, y: 1 } },
  { id: "st_tables", label: "the table", cell: { x: 8, y: 5 } },
  { id: "st_door", label: "the door", cell: { x: 4, y: 8 } },
];

/**
 * Which stations a posting may be sent to.
 *
 * This is the guided-navigation half of the promotion beat. A candidate has no
 * business behind the counter and an employee has no business at the pass, so
 * the chips that would send them there are not offered — the same rule the flap
 * enforces physically, applied to the keyboard-only path so the two do not
 * disagree. A player who cannot steer must meet the same room as one who can
 * (ADR-005 §14.2).
 */
const STATIONS_BY_ROLE: Readonly<Record<string, readonly string[]>> = {
  candidate: ["st_tables", "st_door"],
  employee: ["st_counter", "st_tables", "st_door"],
  branch_manager: ["st_counter", "st_pass", "st_tables", "st_door"],
  ceo: ["st_counter", "st_pass", "st_tables", "st_door"],
};

/** The stations open to a posting, in room order. */
export function stationsFor(role: string): Station[] {
  const allowed = STATIONS_BY_ROLE[role] ?? STATIONS_BY_ROLE.candidate;
  return STATIONS.filter((s) => allowed.includes(s.id));
}

/** Somewhere the player can be sent without steering. */
export type GuidePlace = Station;

/**
 * The guided-navigation list: the stations, and then whoever is in the room
 * (see `guideWithCast`).
 *
 * A keyboard-only path across the room is not optional (ADR-005 §14) — it is
 * the only way a player who cannot steer reaches anybody. `GUIDE` is every
 * station; `guideFor(role)` is the ones a given posting may actually walk to,
 * and that is what the interior should render.
 */
export const GUIDE: readonly GuidePlace[] = STATIONS;

/** The guided-navigation list for one posting. */
export function guideFor(role: string): GuidePlace[] {
  return stationsFor(role);
}

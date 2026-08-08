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

  // y5 / y6 — the dining floor. Table 3's chair sits at (9,6) rather than (7,5)
  // so the (7,6) corner keeps a way out; room.test.ts locks that in.
  f("table", 1, 5),
  f("chair", 2, 5),
  f("rug_persian", 4, 5, false),
  f("rug_persian", 5, 5, false),
  f("table", 6, 5),
  f("chair", 1, 6),
  f("chair", 6, 6),
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

// ── Hotspots ──────────────────────────────────────────────────────────────────

export interface Hotspot {
  id: string;
  /** Prompt verb, in the room's own words. */
  prompt: string;
  /**
   * How this place is named in the guided-navigation list — a place, not an
   * action, so it sits beside the stations without changing voice. "the board",
   * not "read the board".
   */
  guideLabel: string;
  /** The walkable cell you stand on; the prompt fires within one cell of it. */
  cell: Cell;
  title: string;
  /**
   * Only there for the week that needs it. Seasonal hotspots stay out of the
   * standing guided-nav list — a button reading "the sample bag" in week one is
   * a promise about week sixteen — and the runner puts the live one at the front
   * of the list while its objective is open.
   */
  seasonal?: boolean;
}

// What each of these *says* lives in world.ts, not here. All four are views onto
// state now — the board is what you sell, the four-top is who still comes in, the
// window is what is happening to you from outside, and the rota by the hatch is
// how the team is doing — so their prose is derived rather than written down once
// and left to go stale.

export const HOTSPOTS: readonly Hotspot[] = [
  {
    id: "ht_chalkboard",
    prompt: "read the board",
    guideLabel: "the board",
    cell: { x: 3, y: 3 },
    title: "The chalkboard",
  },
  {
    id: "ht_board",
    prompt: "read the noticeboard",
    guideLabel: "the noticeboard",
    cell: { x: 1, y: 4 },
    title: "The community board",
  },
  {
    id: "ht_window",
    prompt: "look out the window",
    guideLabel: "the window",
    cell: { x: 9, y: 1 },
    title: "Market Street",
  },
  {
    id: "ht_sample",
    prompt: "open the sample bag",
    guideLabel: "the sample bag",
    // The end of the counter run, staff side: the delivery comes in through the
    // flap and gets put down where there is room for it.
    cell: { x: 6, y: 1 },
    title: "The sample bag",
    seasonal: true,
  },
  {
    id: "ht_pass",
    prompt: "check the pass-through",
    guideLabel: "the pass-through",
    cell: { x: 1, y: 1 },
    title: "The pass-through",
  },
];

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

/** The hotspot you are close enough to read, if any. */
export function hotspotNear(cell: Cell): Hotspot | null {
  return HOTSPOTS.find((h) => manhattan(cell, h.cell) <= 1) ?? null;
}

// ── Guided navigation (PRD §14.2) ─────────────────────────────────────────────

export interface Station {
  id: string;
  /** Labelled in the room's own words, never "object_04". */
  label: string;
  cell: Cell;
}

export const STATIONS: readonly Station[] = [
  { id: "st_counter", label: "the counter", cell: { x: 3, y: 3 } },
  { id: "st_flap", label: "the counter flap", cell: { x: 4, y: 3 } },
  { id: "st_jukebox", label: "the jukebox", cell: { x: 7, y: 3 } },
  { id: "st_tables", label: "the tables", cell: { x: 3, y: 5 } },
  { id: "st_window", label: "by the window", cell: { x: 9, y: 4 } },
  { id: "st_door", label: "the door", cell: { x: 4, y: 8 } },
];

/** Somewhere the player can be sent without steering. */
export interface GuidePlace {
  id: string;
  /** The room's own words, never "object_04". */
  label: string;
  cell: Cell;
}

/**
 * The whole guided-navigation list: the six stations, then the four hotspots.
 *
 * The hotspots are in it because they are destinations, not just things to read
 * — the season sends you to the noticeboard and to the pass-through by name, and
 * a place only a mouse can reach is a mission a keyboard player cannot finish.
 *
 * `the counter` and `the board` share a cell on purpose. One is where you stand
 * to work and one is the thing above it you stop to read; naming both is how the
 * list stays in the room's language rather than the grid's.
 */
export const GUIDE: readonly GuidePlace[] = [
  ...STATIONS,
  ...HOTSPOTS.filter((h) => !h.seasonal).map((h) => ({
    id: h.id,
    label: h.guideLabel,
    cell: h.cell,
  })),
];

// Ambient customers (PRD §5.7). Three unnamed skins on one shared loop: come
// in, queue, order at the till, then sit down or take it away.
//
// They never speak a line the player has to read and they are never an
// objective. Their whole job is to make the room feel like it exists when
// nothing is being asked of you — the difference between a café and a set.
//
// Pure: the phases, the route, and how many of them there are. customersView.ts
// walks them. Splitting it that way is what makes the two facts that actually
// matter testable without a renderer — nobody is ever routed into a wall, and
// the room is empty on the night the mission says it is closed.
import type { Cell } from "@/lib/pathfinding";
import { EXIT } from "./room";
import { MISSIONS } from "./missions";
import type { World, WorldValue } from "./world";

/**
 * One customer's life, in order. `away` is the resting state — a customer who
 * is not in the room is not drawn and costs nothing but a hidden sprite.
 */
export type Phase =
  "away" | "entering" | "queueing" | "ordering" | "leaving" | "seating" | "seated";

/** The door threshold. They arrive and leave through the player's own door. */
export const DOOR: Cell = EXIT;

/** Just inside it, on the floor, where they become a person rather than a bell. */
export const INSIDE: Cell = { x: 4, y: 8 };

/**
 * Where the order is mimed. In front of the till at (2,2), on the customer side
 * of the counter run — (2,3) is a stool, so the first walkable cell facing the
 * till is one along.
 */
export const ORDER_AT: Cell = { x: 3, y: 3 };

/**
 * The queue, nearest the counter first. A customer takes the first free slot and
 * shuffles up as the one ahead of them moves off, which is the read that makes a
 * queue a queue rather than three people standing near each other.
 */
export const QUEUE: readonly Cell[] = [
  { x: 3, y: 4 },
  { x: 3, y: 5 },
  { x: 4, y: 6 },
];

/**
 * Where they sit. Walkable cells beside the three tables, never a chair cell —
 * chairs block, and a customer routed onto one would be pathfinding into
 * furniture. (9,6) is left alone because it is Marcus's, and (7,6) because it is
 * where Ellery stands in week 12.
 */
export const SEATS: readonly Cell[] = [
  { x: 1, y: 4 },
  { x: 7, y: 5 },
  { x: 8, y: 5 },
  { x: 5, y: 5 },
];

/** Seconds standing at the till, miming an order nobody has to read. */
export const ORDER_S = 3.5;
/** Seconds at a table before they gather their things. */
export const SIT_S: readonly [number, number] = [26, 70];
/** Seconds between one bell and the next, before density is applied. */
export const BELL_S: readonly [number, number] = [25, 45];

/** How many bodies the room carries at once, by who still comes in (PRD §12). */
const BY_REGULARS: Record<WorldValue<"regulars">, number> = {
  full: 3,
  returning: 3,
  steady: 2,
  thin: 1,
};

/**
 * The week-8 night beat is the only closed-café mission in the season, and it is
 * closed: chairs up, machine cooling, nobody to perform for. An ambient customer
 * wandering through it would take the one moment in the building where you are
 * alone and make it not that.
 */
export function roomIsClosed(missionOrder: number): boolean {
  return MISSIONS.find((m) => m.order === missionOrder)?.week === 8;
}

/**
 * How many customers are in the room at once.
 *
 * Reduced motion drops the loop to a third (ADR-005 §14.5) rather than to zero:
 * an empty café is a different room, not a calmer one, so what goes is the
 * movement budget and not the population.
 */
export function crowdSize(world: World, missionOrder: number, reduced: boolean): number {
  if (roomIsClosed(missionOrder)) return 0;
  const n = BY_REGULARS[world.regulars];
  return reduced ? Math.max(1, Math.ceil(n / 3)) : n;
}

/**
 * Seconds until the next bell. Busier rooms ring more often, and `rand` is
 * passed in rather than reached for so the schedule is testable.
 */
export function nextBell(world: World, reduced: boolean, rand: number): number {
  const [lo, hi] = BELL_S;
  const base = lo + (hi - lo) * clamp01(rand);
  const busy = world.regulars === "full" || world.regulars === "returning" ? 0.75 : 1;
  return base * busy * (reduced ? 3 : 1);
}

/** Seconds at the table. */
export function sitFor(rand: number): number {
  const [lo, hi] = SIT_S;
  return lo + (hi - lo) * clamp01(rand);
}

/**
 * Takeaway or stay. Two in three sit down when there is somewhere to sit, which
 * is the ratio that keeps the tables looking used without filling them — a café
 * where every single customer sits reads as a restaurant.
 */
export function staysIn(rand: number, freeSeats: number): boolean {
  return freeSeats > 0 && clamp01(rand) < 0.66;
}

/** The next phase after this one finishes, given whether they are staying. */
export function nextPhase(phase: Phase, stays: boolean): Phase {
  switch (phase) {
    case "away":
      return "entering";
    case "entering":
      return "queueing";
    case "queueing":
      return "ordering";
    case "ordering":
      return stays ? "seating" : "leaving";
    case "seating":
      return "seated";
    case "seated":
      return "leaving";
    case "leaving":
      return "away";
  }
}

/** Where a customer in this phase is walking to, or null when they are standing. */
export function goalFor(phase: Phase, slot: number, seat: Cell | null): Cell | null {
  switch (phase) {
    case "entering":
      return INSIDE;
    case "queueing":
      return QUEUE[Math.min(slot, QUEUE.length - 1)];
    case "ordering":
      return ORDER_AT;
    case "seating":
      return seat;
    case "leaving":
      return DOOR;
    case "away":
    case "seated":
      return null;
  }
}

/** Every cell this loop can ever route somebody to. Checked against the grid. */
export function everyRouteCell(): Cell[] {
  return [INSIDE, ORDER_AT, ...QUEUE, ...SEATS];
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

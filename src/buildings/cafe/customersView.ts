// Walking the ambient customers. Same shape as castView.ts — given a renderer it
// returns an update(dt), the textures it baked, and a destroy() — and added to
// the same sorted container, so a customer crossing the floor passes in front of
// the near tables and behind the counter run without any of it being special.
//
// Three skins for however many bodies the room carries, because they are
// unnamed: §5.7's point is that they are the room's population, not its cast.
// Recycling one sprite per slot rather than spawning means the texture bill is
// three palettes for the whole season, whatever the door does.
//
// The routing is real pathfinding on the room's own grid with the flap down —
// customers never go behind the bar, and giving them the same A* the player uses
// means a table that becomes unreachable takes the customers with it rather than
// leaving them walking through the counter.
import { Container, Sprite, type Renderer, type Texture } from "pixi.js";
import { mapToWorld, roundCell, worldToMap } from "@/lib/iso";
import { findPath, type Cell, type Grid } from "@/lib/pathfinding";
import { bakePersonTextures, bakeShadowTexture, type PersonTextures } from "@/world/characterArt";
import { NPC_PALETTES } from "@/world/characterArt";
import type { Cardinal } from "@/world/assets";
import { NO_GATES_OPEN, makeRoomGrid } from "./room";
import { Z_CAST } from "./scene";
import {
  DOOR,
  ORDER_S,
  QUEUE,
  SEATS,
  crowdSize,
  goalFor,
  nextBell,
  nextPhase,
  sitFor,
  staysIn,
  type Phase,
} from "./customers";
import { facingFrom } from "./cast";
import type { World } from "./world";

/** A shade slower than the cast: nobody is in a hurry in here. */
const WALK_SPEED = 46;
const STEP_S = 0.28;
const BOB_PX = 2;

/** Three unnamed skins, pulled off the city's own NPC palette bank. */
const SKINS = [NPC_PALETTES[1], NPC_PALETTES[5], NPC_PALETTES[7]];

/**
 * Sorted a hair behind the cast, so a customer sharing a cell with Priya reads
 * as being on the far side of the counter from her rather than in front of her.
 */
const Z_CUSTOMER = Z_CAST - 0.02;

interface Body {
  tex: PersonTextures;
  view: Container;
  body: Sprite;
  pixel: { x: number; y: number };
  cell: Cell;
  facing: Cardinal;
  phase: Phase;
  /** Cells still to walk, from `findPath`. */
  path: Cell[];
  /** Seconds still to stand here, for the phases that are a pause. */
  hold: number;
  /** Their place in the queue, 0 nearest the till. */
  slot: number;
  seat: Cell | null;
  stays: boolean;
  stepClock: number;
  phaseOffset: number;
}

export interface CustomersView {
  textures: Texture[];
  /**
   * `world` decides how many of them the room carries; the
   * night beat carries none. `onBell` fires when somebody opens the door, so the
   * ambient layer can ring it and swell the street for a moment.
   */
  update(dtS: number, world: World, onBell: () => void): void;
  /** How many are on screen, for the ambient budget and for the tests. */
  countInside(): number;
  destroy(): void;
}

export function createCustomers(
  renderer: Renderer,
  reduced: boolean,
  parent: Container,
): CustomersView {
  const textures: Texture[] = [];
  const shadowTex = bakeShadowTexture(renderer);
  textures.push(shadowTex);

  // The flap-down grid, baked once. Customers never go behind the counter, so
  // the grid they path on does not depend on what the player is doing with it.
  const grid: Grid = makeRoomGrid(NO_GATES_OPEN);

  // One body per seat is the ceiling — a room that could seat everybody at once
  // never has to decide who is left standing.
  const bodies: Body[] = SEATS.map((_, i) => {
    const tex = bakePersonTextures(renderer, SKINS[i % SKINS.length]);
    textures.push(...tex.all);

    const holder = new Container();
    const shadow = new Sprite(shadowTex);
    shadow.anchor.set(0.5, 0.5);
    shadow.position.set(0, 1);
    const body = new Sprite(tex.idle.N);
    body.anchor.set(0.5, 1);
    holder.addChild(shadow, body);
    holder.visible = false;

    const start = mapToWorld(DOOR.x, DOOR.y);
    holder.position.set(start.x, start.y);
    parent.addChild(holder);

    return {
      tex,
      view: holder,
      body,
      pixel: { x: start.x, y: start.y },
      cell: { ...DOOR },
      facing: "N" as Cardinal,
      phase: "away" as Phase,
      path: [],
      hold: 0,
      slot: i,
      seat: null,
      stays: false,
      stepClock: 0,
      phaseOffset: i * 2.3,
    };
  });

  let bell = nextBell({ regulars: "full" } as World, reduced, Math.random());
  let elapsed = 0;

  /** Send somebody in, if the room has room for them. */
  function admit(world: World, onBell: () => void): void {
    const inside = bodies.filter((b) => b.phase !== "away");
    if (inside.length >= crowdSize(world, reduced)) return;
    const next = bodies.find((b) => b.phase === "away");
    if (!next) return;

    const seatsFree = SEATS.filter((s) => !bodies.some((b) => b.seat === s));
    next.stays = staysIn(Math.random(), seatsFree.length);
    next.seat = next.stays
      ? (seatsFree[Math.floor(Math.random() * seatsFree.length)] ?? null)
      : null;
    if (!next.seat) next.stays = false;
    next.slot = inside.length;
    next.cell = { ...DOOR };
    next.pixel = { ...mapToWorld(DOOR.x, DOOR.y) };
    next.view.position.set(next.pixel.x, next.pixel.y);
    next.view.visible = true;
    enter(next, "entering");
    onBell();
  }

  /** Move somebody into a phase and give them the route it implies. */
  function enter(b: Body, phase: Phase): void {
    b.phase = phase;
    b.stepClock = 0;
    if (phase === "away") {
      b.view.visible = false;
      b.seat = null;
      b.path = [];
      return;
    }
    b.hold = phase === "ordering" ? ORDER_S : phase === "seated" ? sitFor(Math.random()) : 0;
    routeTo(b, goalFor(phase, b.slot, b.seat));
  }

  function routeTo(b: Body, goal: Cell | null): void {
    if (!goal) {
      b.path = [];
      return;
    }
    const path = findPath(grid, b.cell, goal);
    // No route means the room has been re-laid under them. Sending them home is
    // the only honest answer — a customer stuck on an unreachable table would
    // stand there for the rest of the season.
    b.path = path.length > 1 ? path.slice(1) : [];
    if (path.length === 0 && b.phase !== "leaving") enter(b, "leaving");
  }

  /** Everyone behind a departing customer moves up one. */
  function reshuffle(): void {
    const queueing = bodies.filter((b) => b.phase === "queueing").sort((a, c) => a.slot - c.slot);
    queueing.forEach((b, i) => {
      if (b.slot === i) return;
      b.slot = i;
      routeTo(b, QUEUE[Math.min(i, QUEUE.length - 1)]);
    });
  }

  return {
    textures,

    countInside: () => bodies.filter((b) => b.phase !== "away").length,

    update(dtS, world, onBell) {
      elapsed += dtS;

      bell -= dtS;
      if (bell <= 0) {
        bell = nextBell(world, reduced, Math.random());
        admit(world, onBell);
      }

      // The room closing under them — the night beat, or the regulars thinning
      // out mid-visit. They finish their drink on the way to the door rather
      // than blinking out of existence.
      const cap = crowdSize(world, reduced);
      const inside = bodies.filter((b) => b.phase !== "away");
      if (inside.length > cap) {
        for (const b of inside.slice(cap)) {
          if (b.phase !== "leaving") enter(b, "leaving");
        }
      }

      for (const b of bodies) {
        if (b.phase === "away") continue;

        if (b.path.length > 0) {
          walk(b, dtS);
          continue;
        }

        // Standing: queueing until the slot in front frees up, ordering, or
        // sitting. `hold` at zero and no path left means this phase is over.
        if (b.hold > 0) {
          b.hold -= dtS;
          stand(b, elapsed, reduced);
          continue;
        }

        if (b.phase === "queueing") {
          // Only the front of the queue may go to the till, and only when it is
          // free. Everybody else waits where they are — which is the entire
          // behaviour that makes three people look like a queue.
          const tillBusy = bodies.some((o) => o !== b && o.phase === "ordering");
          if (b.slot === 0 && !tillBusy) {
            enter(b, "ordering");
          } else {
            b.facing = "N";
            stand(b, elapsed, reduced);
          }
          continue;
        }

        const was = b.phase;
        const now = nextPhase(was, b.stays);
        enter(b, now);
        // Somebody leaving the till frees the queue up; somebody leaving the
        // building rings the bell on the way out, exactly as they did coming in.
        if (was === "ordering" || now === "away") reshuffle();
        if (now === "away") onBell();
        stand(b, elapsed, reduced);
      }
    },

    destroy() {
      for (const b of bodies) b.view.destroy({ children: true });
      bodies.length = 0;
    },
  };
}

function walk(b: Body, dtS: number): void {
  const next = b.path[0];
  const to = mapToWorld(next.x, next.y);
  const dx = to.x - b.pixel.x;
  const dy = to.y - b.pixel.y;
  const gap = Math.hypot(dx, dy);
  const step = WALK_SPEED * dtS;

  if (gap <= step) {
    b.pixel.x = to.x;
    b.pixel.y = to.y;
    b.path.shift();
  } else {
    b.pixel.x += (dx / gap) * step;
    b.pixel.y += (dy / gap) * step;
  }

  b.facing = facingFrom(b.cell, next);
  b.stepClock += dtS;
  const frame = Math.floor(b.stepClock / STEP_S) % 2;
  b.body.texture = b.tex.walk[b.facing][frame];
  b.body.position.y = -Math.abs(Math.sin((b.stepClock * Math.PI) / STEP_S)) * BOB_PX;
  b.body.scale.set(b.facing === "W" ? -1 : 1, 1);

  b.view.position.set(b.pixel.x, b.pixel.y);
  const cell = roundCell(worldToMap(b.pixel.x, b.pixel.y));
  if (cell.x !== b.cell.x || cell.y !== b.cell.y) {
    b.cell = cell;
    b.view.zIndex = cell.x + cell.y + Z_CUSTOMER;
  }
}

/**
 * Standing about. Sitting is the standing frame squashed against the chair, the
 * same trick castView.ts uses for Marcus — there is no seated frame in the rig
 * and one is not worth baking for a body nobody is asked to look at.
 */
function stand(b: Body, elapsed: number, reduced: boolean): void {
  const seated = b.phase === "seated";
  b.body.texture = b.tex.idle[b.facing];
  b.body.position.y = seated ? 4 : 0;
  const rest = seated ? 0.82 : 1;
  b.body.scale.set(
    b.facing === "W" ? -1 : 1,
    reduced ? rest : rest * (1 + 0.012 * Math.sin(elapsed * 2 + b.phaseOffset)),
  );
}

// Pure Pixi scene builders for the Café — no React, no store, no ticker. Given a
// baked texture set they return containers the canvas can drop into its layer
// graph. Placement follows the city's own conventions exactly (world/CityCanvas
// .tsx §makeProp): anchor (0.5, 1) at `mapToWorld(cell) + TILE_H/2`, depth via
// `zIndex = cell.x + cell.y` plus a per-class epsilon.
import { Container, Graphics, Sprite } from "pixi.js";
import { TILE_H, TILE_W, mapToWorld } from "@/lib/iso";
import { CAFE_PALETTE, type CafeTextures } from "./props";
import { PROP_SPRITE } from "./assets";
import { FURNITURE, GATES, NEAR_EDGE, ROOM_H, ROOM_W, type Gate, type PropKind } from "./room";

/** Depth offsets, so props sharing a cell stack in a sensible order. */
const Z_FLAT = -0.1; // rugs and the doormat, under everything upright
const Z_OVERLAY = 0.2; // the pastry case in front of its wall
/**
 * The near-edge sills sort *behind* everything on their own row. They are the
 * frontmost row in the room, so by depth alone they would clip the feet of
 * anyone standing along the front — and there is nothing between them and the
 * camera for them to occlude anyway.
 */
const Z_NEAR_EDGE = -0.5;
export const Z_PLAYER = 0.6; // matches the city's own player offset
/**
 * The cast sort just behind the player, so when you walk onto the cell somebody
 * is standing on it is you in front — the room should never hide you from
 * yourself.
 */
export const Z_CAST = 0.55;

function place(sprite: Sprite, cx: number, cy: number): Sprite {
  const w = mapToWorld(cx, cy);
  sprite.anchor.set(0.5, 1);
  sprite.position.set(w.x, w.y + TILE_H / 2);
  return sprite;
}

/**
 * The whole floor as a single Graphics: one filled diamond, a warm pool drawn
 * into it, and grid seams for scale.
 *
 * It used to be ROOM_W × ROOM_H individual Sprites (120 of them) in a sorted
 * container, plus a separate warmth Sprite with a Graphics mask on top. That
 * shape only earns its keep if tiles differ from each other or need to y-sort —
 * a flat single-colour surface under everything does neither. One Graphics is
 * one geometry and one draw call, the sorted container is gone, the mask's
 * stencil pass is gone, and two baked textures no longer exist to allocate or
 * dispose.
 *
 * The pool is clipped for free here: we only ever draw inside the floor's own
 * polygons, so nothing can spill onto the dark surround the way the masked
 * sprite did.
 */
export function buildFloor(): Graphics {
  const g = new Graphics();

  // Outer edge of the floor: the four corners of the room's diamond.
  const t = mapToWorld(0, 0);
  const r = mapToWorld(ROOM_W - 1, 0);
  const b = mapToWorld(ROOM_W - 1, ROOM_H - 1);
  const l = mapToWorld(0, ROOM_H - 1);
  g.poly([
    t.x,
    t.y - TILE_H / 2,
    r.x + TILE_W / 2,
    r.y,
    b.x,
    b.y + TILE_H / 2,
    l.x - TILE_W / 2,
    l.y,
  ]).fill(CAFE_PALETTE.floor);

  // The warm pool the room sits in — concentric diamonds shrinking toward the
  // middle. cafe.jpg is a lit island in a dark surround; an evenly-lit floor
  // reads flat however good the props are.
  const mid = mapToWorld((ROOM_W - 1) / 2, (ROOM_H - 1) / 2);
  for (let i = 10; i >= 1; i--) {
    const k = i / 10;
    g.poly([
      mid.x,
      mid.y - (ROOM_H + ROOM_W) * (TILE_H / 4) * k,
      mid.x + (ROOM_W + ROOM_H) * (TILE_W / 4) * k,
      mid.y,
      mid.x,
      mid.y + (ROOM_H + ROOM_W) * (TILE_H / 4) * k,
      mid.x - (ROOM_W + ROOM_H) * (TILE_W / 4) * k,
      mid.y,
    ]).fill({ color: CAFE_PALETTE.lamp, alpha: 0.022 });
  }

  // Grid seams, so the floor still has a sense of scale without a pattern
  // competing with the furniture. Half-cell offsets put them on tile edges.
  const seam = { color: CAFE_PALETTE.floorSeam, width: 1.5, alpha: 0.5 };
  for (let x = 0; x <= ROOM_W; x++) {
    const a = mapToWorld(x - 0.5, -0.5);
    const b = mapToWorld(x - 0.5, ROOM_H - 0.5);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke(seam);
  }
  for (let y = 0; y <= ROOM_H; y++) {
    const a = mapToWorld(-0.5, y - 0.5);
    const b = mapToWorld(ROOM_W - 0.5, y - 0.5);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke(seam);
  }

  return g;
}

export interface FurnitureLayer {
  /** Everything that y-sorts against the player. */
  root: Container;
  /** The flap, wrapped so it can swing about its hinge. */
  flap: Container;
  /**
   * The espresso machine, so the ambient layer can shake it when the grinder
   * runs. It is the hero prop and the one thing in the room loud enough to be
   * worth animating for a beat and a half (PRD §6).
   */
  machine: Sprite | null;
}

/**
 * Every prop in the room, plus the counter flap as a separately-addressable
 * hinged container. `root.sortableChildren` is on: Pixi re-sorts it each render,
 * which is what lets the player walk in front of and behind the furniture.
 */
export function buildFurniture(tex: CafeTextures): FurnitureLayer {
  const root = new Container();
  root.sortableChildren = true;
  let machine: Sprite | null = null;

  for (const p of FURNITURE) {
    const sprite = place(new Sprite(tex.prop[p.kind]), p.cell.x, p.cell.y);
    if (p.kind === "espresso_machine") machine = sprite;
    fitSprite(sprite, p.kind);
    const base = p.cell.x + p.cell.y;
    sprite.zIndex = NEAR_EDGE.has(p.kind)
      ? base + Z_NEAR_EDGE
      : p.overlay
        ? base + Z_OVERLAY
        : p.blocking
          ? base
          : base + Z_FLAT;
    root.addChild(sprite);
  }

  const flap = buildFlap(tex, GATES[0]);
  root.addChild(flap);

  return { root, flap, machine };
}

/**
 * The counter flap. The sprite hangs off a container parked on the diamond's
 * left corner, so rotating the container swings the free end up — a hinge, not a
 * sprite spinning about its middle. Closed is rotation 0.
 */
function buildFlap(tex: CafeTextures, gate: Gate): Container {
  const hinge = new Container();
  const w = mapToWorld(gate.cell.x, gate.cell.y);
  hinge.position.set(w.x - TILE_W / 2, w.y);
  hinge.zIndex = gate.cell.x + gate.cell.y;

  const sprite = new Sprite(tex.prop.flap);
  sprite.anchor.set(0.5, 1);
  sprite.position.set(TILE_W / 2, TILE_H / 2);
  sprite.eventMode = "static";
  sprite.cursor = "pointer";
  hinge.addChild(sprite);

  return hinge;
}

/**
 * Procedural bakes already come out tile-sized; a real sprite arrives at its own
 * native resolution, so it has to be scaled to the width the layout expects.
 */
function fitSprite(sprite: Sprite, kind: PropKind): void {
  const spec = PROP_SPRITE[kind];
  if (!spec || !sprite.texture.width) return;
  sprite.scale.set(spec.width / sprite.texture.width);
}

/** How far the flap swings when it is up. Negative lifts the free end. */
export const FLAP_OPEN_ROTATION = -0.95;

// The Café's look — procedural. Every prop is drawn once with vector Graphics and
// baked to a texture (renderer.generateTexture), the same technique the city uses
// for its people (world/characterArt.ts) and its sky. No binary assets, so the
// room ships without waiting on an art pipeline; PROP_SPRITE (assets.ts) is the
// seam where a real sprite takes over per-kind.
//
// Palette and prop list are read off cafe.jpg: warm wood, oxblood, cream, and a
// black-and-white checkered floor, all sitting in a dark surround.
import { Graphics, Texture, type Renderer } from "pixi.js";
import { TILE_W, TILE_H } from "@/lib/iso";
import type { PropKind } from "./room";
import { PROP_SPRITE, cafeTex } from "./assets";

const HW = TILE_W / 2; // 66 — half a tile diamond, on the x axis
const HH = TILE_H / 2; // 33 — half a tile diamond, on the y axis

export const CAFE_PALETTE = {
  /** Beyond the walls. The room is a lit island in this. */
  void: 0x140f10,
  /** Warm putty stone. Lighter than the walls so furniture keeps its silhouette,
   *  and desaturated so the oxblood counter and rugs stay the loudest thing. */
  floor: 0xb8a086,
  floorSeam: 0x9a8168,
  wallPlank: 0x8a6242,
  wallPlankLine: 0x6e4c33,
  oxblood: 0x96453f,
  counterTop: 0xb5836a,
  woodDark: 0x5c3a28,
  woodMid: 0x7a4f36,
  cream: 0xe8dfd0,
  steel: 0xcfcbc2,
  espresso: 0x3a3134,
  green: 0x4e7a3c,
  brass: 0xc9a227,
  glass: 0x9fb7bd,
  /** The warm pool of light the room sits in. */
  lamp: 0xffc98a,
} as const;

const P = CAFE_PALETTE;

/** Darken or lift a hex colour by `k` (1 = unchanged). */
function shade(color: number, k: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * k));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * k));
  const b = Math.min(255, Math.round((color & 0xff) * k));
  return (r << 16) | (g << 8) | b;
}

const LEFT_FACE = 0.74;
const RIGHT_FACE = 0.56;

/**
 * Every prop bakes against the same invisible full-tile box, so `anchor(0.5, 1)`
 * always lands on the tile's bottom vertex no matter how tall or small the prop
 * is. Without this pin each texture would anchor to its own bounds and the room
 * would jitter between prop sizes.
 */
function pin(g: Graphics): Graphics {
  return g.rect(-HW, -HH, TILE_W, TILE_H).fill({ color: 0x000000, alpha: 0 });
}

/** A box standing on the tile: `f` is its footprint as a fraction of the tile. */
function isoBox(g: Graphics, f: number, h: number, color: number, topColor = color): Graphics {
  const w = HW * f;
  const d = HH * f;
  g.poly([-w, -h, 0, d - h, 0, d, -w, 0]).fill(shade(color, LEFT_FACE));
  g.poly([0, d - h, w, -h, w, 0, 0, d]).fill(shade(color, RIGHT_FACE));
  g.poly([0, -d - h, w, -h, 0, d - h, -w, -h]).fill(topColor);
  return g;
}

/** A flat diamond lying on the floor: rugs, mats, the floor itself. */
function isoFlat(g: Graphics, f: number, color: number, alpha = 1): Graphics {
  const w = HW * f;
  const d = HH * f;
  g.poly([0, -d, w, 0, 0, d, -w, 0]).fill({ color, alpha });
  return g;
}

/** A flat diamond raised to `y` — table tops, counter tops. */
function isoFlatAt(g: Graphics, f: number, color: number, y: number): Graphics {
  const w = HW * f;
  const d = HH * f;
  g.poly([0, -d + y, w, y, 0, d + y, -w, y]).fill(color);
  return g;
}

// ── Wall faces ────────────────────────────────────────────────────────────────
//
// Anything hung on a wall has to be drawn ON the wall's projected face, not in
// flat screen space — that was the bug that turned every window and picture into
// a small triangle. A face is parametrised (u along the wall, v down it), so a
// frame is just a rectangle in face space.
//
// Which face is visible depends on where the room is: from the y=0 row the room
// lies down-left, so its inward face is the LEFT one; from the x=0 column the
// room lies down-right, so its inward face is the RIGHT one.

type Face = "left" | "right";

function facePoint(face: Face, h: number, u: number, v: number): [number, number] {
  return face === "left" ? [-HW + u * HW, -h + u * HH + v * h] : [u * HW, HH - h - u * HH + v * h];
}

/** A rectangle in face space (u,v ∈ 0..1), as a polygon on the wall. */
function faceRect(face: Face, h: number, u0: number, v0: number, u1: number, v1: number): number[] {
  const a = facePoint(face, h, u0, v0);
  const b = facePoint(face, h, u1, v0);
  const c = facePoint(face, h, u1, v1);
  const d = facePoint(face, h, u0, v1);
  return [...a, ...b, ...c, ...d];
}

const WALL_H = 84;

/** The plank wall itself: a tall slab with horizontal board lines on both faces. */
function wall(g: Graphics): Graphics {
  isoBox(g, 1, WALL_H, P.wallPlank, shade(P.wallPlank, 0.9));
  for (let i = 1; i < 7; i++) {
    const v = i / 7;
    g.poly(faceRect("left", WALL_H, 0, v, 1, v + 0.012)).fill({
      color: P.wallPlankLine,
      alpha: 0.55,
    });
    g.poly(faceRect("right", WALL_H, 0, v, 1, v + 0.012)).fill({
      color: shade(P.wallPlankLine, 0.8),
      alpha: 0.55,
    });
  }
  return g;
}

/** A framed thing on the wall: outer frame, mat, and the picture itself. */
function framed(
  g: Graphics,
  face: Face,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  inner: number,
  frame: number = P.brass,
): Graphics {
  g.poly(faceRect(face, WALL_H, u0, v0, u1, v1)).fill(frame);
  const iu = (u1 - u0) * 0.12;
  const iv = (v1 - v0) * 0.12;
  g.poly(faceRect(face, WALL_H, u0 + iu, v0 + iv, u1 - iu, v1 - iv)).fill(inner);
  return g;
}

// ── Individual props ──────────────────────────────────────────────────────────

function drawProp(kind: PropKind): Graphics {
  const g = pin(new Graphics());

  switch (kind) {
    case "wall_plank":
      return wall(g);

    case "wall_sill":
      // Knee-high: it bounds the near edge of the room without ever standing
      // between the camera and someone walking along the front.
      isoBox(g, 1, 16, P.wallPlank, shade(P.wallPlank, 1.1));
      return g;

    case "wall_window": {
      wall(g);
      // Recessed frame, glass, then slatted blinds hanging over the top half.
      framed(g, "left", 0.16, 0.14, 0.84, 0.62, shade(P.glass, 0.85), shade(P.cream, 0.75));
      for (let i = 0; i < 6; i++) {
        const v = 0.17 + i * 0.052;
        g.poly(faceRect("left", WALL_H, 0.2, v, 0.8, v + 0.03)).fill({
          color: P.cream,
          alpha: 0.5,
        });
      }
      // Sill.
      g.poly(faceRect("left", WALL_H, 0.14, 0.62, 0.86, 0.67)).fill(shade(P.wallPlank, 1.2));
      return g;
    }

    case "wall_menu": {
      wall(g);
      // The chalkboard: dark slate in a wood frame, with chalk lines on it.
      framed(g, "left", 0.12, 0.12, 0.88, 0.64, P.espresso, P.woodMid);
      for (let i = 0; i < 5; i++) {
        const v = 0.2 + i * 0.075;
        const len = i % 2 === 0 ? 0.5 : 0.38;
        g.poly(faceRect("left", WALL_H, 0.2, v, 0.2 + len, v + 0.018)).fill({
          color: P.cream,
          alpha: 0.62,
        });
        g.poly(faceRect("left", WALL_H, 0.76, v, 0.82, v + 0.018)).fill({
          color: P.brass,
          alpha: 0.55,
        });
      }
      return g;
    }

    case "wall_art": {
      wall(g);
      framed(g, "left", 0.2, 0.16, 0.6, 0.48, shade(P.green, 0.85));
      framed(g, "left", 0.64, 0.24, 0.86, 0.46, shade(P.oxblood, 1.1));
      return g;
    }

    case "wall_board": {
      wall(g);
      // The community noticeboard, on the x=0 wall — so it faces right.
      framed(g, "right", 0.12, 0.14, 0.9, 0.62, shade(P.woodMid, 1.15), P.woodDark);
      // Overlapping paper scraps, pinned at angles.
      const scraps: Array<[number, number, number, number, number]> = [
        [0.18, 0.2, 0.38, 0.36, P.cream],
        [0.42, 0.24, 0.62, 0.42, shade(P.cream, 0.92)],
        [0.66, 0.19, 0.85, 0.35, shade(P.brass, 1.15)],
        [0.24, 0.42, 0.46, 0.57, shade(P.cream, 0.96)],
        [0.56, 0.46, 0.82, 0.58, shade(P.glass, 1.05)],
      ];
      for (const [u0, v0, u1, v1, c] of scraps) {
        g.poly(faceRect("right", WALL_H, u0, v0, u1, v1)).fill(c);
      }
      return g;
    }

    case "stairs": {
      // A flight climbing away from the camera — decorative, never walked.
      for (let i = 0; i < 5; i++) {
        const h = 18 + i * 18;
        const off = -i * 6;
        g.poly([off - HW, -h, off, HH - h, off, HH - h + 16, off - HW, -h + 16]).fill(
          shade(P.woodDark, LEFT_FACE),
        );
        g.poly([off, HH - h, off + HW, -h, off + HW, -h + 16, off, HH - h + 16]).fill(
          shade(P.woodDark, RIGHT_FACE),
        );
        g.poly([off, -HH - h, off + HW, -h, off, HH - h, off - HW, -h]).fill(P.woodMid);
      }
      // Newel post only. A full rail spans two tiles and this prop is baked
      // per-cell, so a climbing rail draws twice and reads as stray bars.
      g.rect(HW - 14, -46, 7, 46).fill(shade(P.woodDark, 0.8));
      g.rect(HW - 16, -52, 11, 7).fill(P.woodMid);
      return g;
    }

    case "counter":
      isoBox(g, 1, 40, P.oxblood);
      isoFlatAt(g, 1, P.counterTop, -40);
      return g;

    case "flap":
      // Same body as the counter run, drawn a touch lighter so the break in the
      // line reads before you are close enough for the prompt.
      isoBox(g, 1, 40, shade(P.oxblood, 1.18));
      isoFlatAt(g, 1, shade(P.counterTop, 1.1), -40);
      g.poly([-HW + 6, -40, 0, HH - 46, HW - 6, -40, 0, -HH - 34]).stroke({
        color: P.brass,
        width: 2,
        alpha: 0.8,
      });
      return g;

    case "stool":
      isoBox(g, 0.18, 24, shade(P.woodDark, 0.7));
      isoBox(g, 0.34, 4, P.oxblood);
      isoFlatAt(g, 0.42, shade(P.oxblood, 1.25), -28);
      return g;

    case "table": {
      g.rect(-3, -30, 6, 30).fill(shade(P.woodDark, 0.55));
      isoFlat(g, 0.34, shade(P.woodDark, 0.5));
      isoBox(g, 0.72, 30, P.woodDark, P.woodMid);
      return g;
    }

    case "chair": {
      isoBox(g, 0.36, 20, P.woodDark, P.woodMid);
      // Back rest, angled toward the camera's right face.
      g.poly([2, -20, 20, -10, 20, -34, 2, -44]).fill(shade(P.woodDark, 0.85));
      g.poly([4, -32, 18, -25, 18, -22, 4, -29]).fill(shade(P.woodMid, 1.1));
      return g;
    }

    case "dresser":
      isoBox(g, 0.92, 52, P.oxblood, P.woodMid);
      for (let i = 0; i < 2; i++) {
        const t = -44 + i * 18;
        g.poly([6, t, 52, t + 24, 52, t + 34, 6, t + 10]).fill(shade(P.oxblood, 0.46));
        g.circle(30, t + 21, 2).fill(P.brass);
      }
      return g;

    case "shelf": {
      // Back-bar shelving: uprights, three shelves, a row of bottles.
      isoBox(g, 0.86, 8, P.woodDark, P.woodMid);
      for (let i = 0; i < 3; i++) {
        const y = -20 - i * 26;
        isoFlatAt(g, 0.86, shade(P.woodMid, 1 - i * 0.06), y);
        for (let b = 0; b < 5; b++) {
          const bx = -34 + b * 17;
          const by = y - 4 - (b % 2) * 3;
          g.rect(bx, by - 16, 5, 16).fill(b % 3 === 0 ? P.glass : shade(P.brass, 0.85 + b * 0.05));
        }
      }
      return g;
    }

    case "jukebox": {
      isoBox(g, 0.62, 30, P.woodDark, P.woodMid);
      isoBox(g, 0.56, 84, P.woodDark, P.woodMid);
      // The lit arch — the one warm glow on the far wall.
      g.poly([-20, -86, 20, -86, 26, -52, -26, -52]).fill(shade(P.brass, 0.7));
      g.poly([-15, -83, 15, -83, 20, -56, -20, -56]).fill({ color: P.lamp, alpha: 0.7 });
      g.ellipse(0, -84, 20, 7).fill(shade(P.brass, 0.8));
      // Chrome trim and the selection grille.
      g.rect(-24, -50, 48, 4).fill(P.steel);
      for (let i = 0; i < 6; i++) g.rect(-20 + i * 7, -44, 3, 10).fill(shade(P.espresso, 1.3));
      return g;
    }

    case "radiator": {
      isoBox(g, 0.72, 26, P.steel);
      for (let i = 0; i < 5; i++) {
        const o = -18 + i * 9;
        g.poly([o, -26, o + 4, -24, o + 4, -4, o, -6]).fill(shade(P.steel, 0.7));
      }
      return g;
    }

    case "plant": {
      // Tapered pot, soil, then layered fronds rather than three flat blobs.
      g.poly([-13, -16, 13, -16, 9, 0, -9, 0]).fill(P.oxblood);
      g.poly([-13, -16, 13, -16, 13, -13, -13, -13]).fill(shade(P.oxblood, 0.7));
      g.ellipse(0, -16, 10, 3).fill(shade(P.woodDark, 0.6));
      const fronds: Array<[number, number, number, number]> = [
        [-16, -30, 13, 7],
        [15, -28, 12, 7],
        [-7, -40, 12, 8],
        [8, -42, 11, 7],
        [0, -50, 10, 7],
      ];
      fronds.forEach(([x, y, rx, ry], i) => {
        g.ellipse(x, y, rx, ry).fill(shade(P.green, 0.85 + i * 0.09));
      });
      g.rect(-1.5, -46, 3, 30).fill(shade(P.green, 0.6));
      return g;
    }

    case "rug_persian":
      // Drawn slightly under a tile so the four rug cells read as one carpet.
      isoFlat(g, 1, P.oxblood);
      isoFlat(g, 0.72, shade(P.oxblood, 0.7));
      isoFlat(g, 0.34, P.brass, 0.5);
      return g;

    case "rug_oval":
      isoFlat(g, 0.9, P.woodMid);
      isoFlat(g, 0.62, shade(P.oxblood, 0.9));
      isoFlat(g, 0.32, shade(P.woodMid, 1.15));
      return g;

    case "door_mat":
      isoFlat(g, 0.8, P.espresso);
      isoFlat(g, 0.58, shade(P.espresso, 1.5));
      return g;

    // ── Overlays: drawn on a host cell without claiming it ──
    case "pastry_case": {
      isoBox(g, 0.68, 26, P.woodMid);
      // Glass box: two shelves of pastries, then a translucent front.
      for (let s = 0; s < 2; s++) {
        const y = -34 - s * 20;
        isoFlatAt(g, 0.58, shade(P.steel, 1.05), y);
        for (let i = 0; i < 3; i++) {
          g.ellipse(-18 + i * 18, y - 4, 7, 4).fill(shade(P.brass, 0.9 + i * 0.08));
        }
      }
      g.poly([-30, -30, 0, -15, 30, -30, 30, -66, 0, -81, -30, -66]).fill({
        color: P.glass,
        alpha: 0.26,
      });
      g.poly([-30, -66, 0, -81, 30, -66]).stroke({ color: P.steel, width: 2, alpha: 0.8 });
      return g;
    }

    case "espresso_machine": {
      isoBox(g, 0.62, 34, P.espresso, shade(P.steel, 0.92));
      // Brushed body, two group heads, a steam wand, cups warming on top.
      g.poly([-26, -36, 0, -23, 26, -36, 26, -58, 0, -71, -26, -58]).fill(shade(P.steel, 0.95));
      for (const x of [-11, 11]) {
        g.rect(x - 4, -40, 8, 9).fill(shade(P.espresso, 1.2));
        g.circle(x, -30, 3).fill(P.brass);
      }
      g.rect(24, -56, 2, 22).fill(P.steel);
      g.circle(25, -33, 2.5).fill(shade(P.steel, 0.8));
      for (let i = 0; i < 3; i++) g.ellipse(-16 + i * 15, -70, 5, 3).fill(P.cream);
      return g;
    }

    case "till":
      isoBox(g, 0.34, 16, P.espresso, P.steel);
      g.poly([-10, -18, 0, -13, 10, -18, 10, -30, 0, -35, -10, -30]).fill(shade(P.steel, 0.85));
      g.rect(-6, -28, 12, 6).fill(shade(P.glass, 0.9));
      return g;

    case "laptop":
      // Screen up, lid angled away from the player so the room can see the back
      // of it and not what is on it — what he is typing is not the player's.
      g.poly([-11, -2, 0, 3, 11, -2, 0, -7]).fill(shade(P.steel, 0.92));
      g.poly([-10, -6, 0, -1, 0, -13, -10, -18]).fill(shade(P.steel, 1.02));
      g.poly([0, -1, 10, -6, 10, -18, 0, -13]).fill(shade(P.steel, 0.8));
      return g;

    case "pendant": {
      // Hangs from above the counter: flex, shade, and the bulb's glow.
      g.rect(-1, -128, 2, 46).fill(shade(P.woodDark, 0.7));
      g.poly([-16, -82, 16, -82, 9, -96, -9, -96]).fill(P.oxblood);
      g.ellipse(0, -82, 16, 5).fill(shade(P.lamp, 1.05));
      g.ellipse(0, -76, 9, 5).fill({ color: P.lamp, alpha: 0.5 });
      return g;
    }
  }
}

// ── Baking ────────────────────────────────────────────────────────────────────

export interface CafeTextures {
  prop: Record<PropKind, Texture>;
  /** Every unique texture, for disposal on unmount. */
  all: Texture[];
}

const ALL_KINDS: PropKind[] = [
  "wall_plank",
  "wall_window",
  "wall_menu",
  "wall_art",
  "wall_board",
  "wall_sill",
  "stairs",
  "counter",
  "flap",
  "stool",
  "table",
  "chair",
  "dresser",
  "shelf",
  "jukebox",
  "radiator",
  "plant",
  "rug_persian",
  "rug_oval",
  "door_mat",
  "pastry_case",
  "espresso_machine",
  "till",
  "pendant",
];

function bake(renderer: Renderer, g: Graphics): Texture {
  const texture = renderer.generateTexture({ target: g, resolution: 2 });
  g.destroy();
  return texture;
}

export function bakeCafeTextures(renderer: Renderer): CafeTextures {
  const all: Texture[] = [];
  const prop = {} as Record<PropKind, Texture>;
  for (const kind of ALL_KINDS) {
    const sprite = PROP_SPRITE[kind];
    const fromPack = sprite ? cafeTex(sprite.key) : undefined;
    if (fromPack) {
      prop[kind] = fromPack;
      continue;
    }
    const t = bake(renderer, drawProp(kind));
    prop[kind] = t;
    all.push(t);
  }
  return { prop, all };
}

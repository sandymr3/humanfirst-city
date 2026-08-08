// A wisp of steam off the espresso machine — the one moving thing in the room.
//
// Room-local on purpose. `world/ambient.ts` cannot be reused here: constructing
// it unconditionally builds 14 pedestrians, 6 cars, a cat that pathfinds on the
// 45×45 city grid, pigeons and every lamp glow, all in city coordinates, with no
// way to disable a subsystem. Getting one puff out of that costs more than the
// forty lines below.
//
// The texture is free, though — Pixi's asset cache is global and the city has
// always finished loading before an interior can mount, so `tex("fx_smoke")`
// just works. Parameters match the wisp already rising off the Café's exterior
// (world/ambient.ts §steam) so indoors and outdoors agree.
import { Container, Sprite } from "pixi.js";
import { tex } from "@/world/assets";

/** Small pool, pre-allocated. The city's 64-particle budget is separate from ours. */
export const MAX_STEAM_PUFFS = 8;

const EVERY_S = 0.9; // seconds between puffs
const RISE = -12; // px/sec upward
const LIFE_S = 1.6;
const SWAY = 4;
const START_ALPHA = 0.22;
const GROWTH = 0.35;
const SIZE = 30; // on-screen width of a puff, before growth

interface Puff {
  sprite: Sprite;
  x: number;
  y: number;
  life: number;
  base: number;
}

export interface Steam {
  /** Add to the scene wherever the wisp should sort. */
  view: Container;
  /**
   * `emitting` false keeps the existing puffs rising and fading but starts no
   * new ones — §6 gives the machine steam only while somebody is working it, and
   * steam off an unattended group head is a room that runs itself.
   */
  update(dtS: number, emitting?: boolean): void;
  destroy(): void;
}

/**
 * `at` is the world point the steam rises from. Returns a no-op under reduced
 * motion rather than making every caller check.
 */
export function createSteam(at: { x: number; y: number }, reduced: boolean): Steam {
  const view = new Container();
  if (reduced) {
    return { view, update: () => {}, destroy: () => view.destroy({ children: true }) };
  }

  const texture = tex("fx_smoke");
  const scale = SIZE / (texture.width || SIZE);
  const pool: Puff[] = [];
  const free: Puff[] = [];

  for (let i = 0; i < MAX_STEAM_PUFFS; i++) {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.tint = 0xd8dade;
    sprite.visible = false;
    view.addChild(sprite);
    const puff: Puff = { sprite, x: 0, y: 0, life: 0, base: scale };
    pool.push(puff);
    free.push(puff);
  }

  let clock = 0;

  return {
    view,
    update(dtS, emitting = true) {
      // Clamped rather than left to accumulate: a wisp that was switched off for
      // half a minute would otherwise discharge thirty puffs on the frame it
      // came back.
      clock = emitting ? clock + dtS : Math.min(clock, EVERY_S);
      while (emitting && clock >= EVERY_S) {
        clock -= EVERY_S;
        const p = free.pop();
        if (!p) break; // pool exhausted: drop the puff, never allocate
        p.x = at.x;
        p.y = at.y;
        p.life = 0;
        p.sprite.visible = true;
        p.sprite.scale.set(p.base);
        p.sprite.alpha = START_ALPHA;
      }

      for (const p of pool) {
        if (!p.sprite.visible) continue;
        p.life += dtS;
        if (p.life >= LIFE_S) {
          p.sprite.visible = false;
          free.push(p);
          continue;
        }
        const k = p.life / LIFE_S;
        p.y += RISE * dtS;
        p.x += Math.sin(p.life * 4) * SWAY * dtS;
        p.sprite.position.set(p.x, p.y);
        p.sprite.alpha = START_ALPHA * (1 - k);
        p.sprite.scale.set(p.base * (1 + k * GROWTH * 3));
      }
    },
    destroy() {
      view.destroy({ children: true });
    },
  };
}

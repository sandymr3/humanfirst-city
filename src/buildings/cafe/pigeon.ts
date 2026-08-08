// The pigeon on the window ledge (PRD §6) — a callback to the city billboard's
// "the pigeons remain unbothered". Rare, silent, and gone again in ten seconds.
//
// Continuity is cheap and people love it, which is the whole justification: it
// costs one Graphics and it is the only thing in the room that says the street
// outside is the same street.
//
// Shaped like steam.ts: a view to drop into the scene, an update(dt), a
// destroy(). Drawn rather than baked because it is one shape at one size and a
// texture for it would be a texture nobody reuses.
import { Container, Graphics } from "pixi.js";

/** How long it stays on the ledge. */
const VISIT_S = 9;
/** Hops per visit, spread across it. */
const HOPS = 3;
const HOP_H = 5;
const HOP_S = 0.45;
const FADE_S = 0.5;

export interface Pigeon {
  view: Container;
  /** Put one on the ledge. Ignored while one is already there. */
  land(): void;
  update(dtS: number): void;
  destroy(): void;
}

export function createPigeon(at: { x: number; y: number }, reduced: boolean): Pigeon {
  const view = new Container();
  view.position.set(at.x, at.y);
  view.visible = false;

  const bird = new Graphics();
  // Body, head, beak, eye, tail. Small enough that shape is all it has, so the
  // silhouette does the work: a low oval and a round head reads as pigeon.
  bird
    .ellipse(0, -4, 6, 4)
    .fill(0x6f7480)
    .circle(4.5, -8, 3)
    .fill(0x7c8290)
    .poly([7, -8, 10, -7, 7, -6])
    .fill(0xd9a05b)
    .circle(5.4, -8.6, 0.8)
    .fill(0x1b1b1f)
    .poly([-6, -5, -11, -2, -6, -2])
    .fill(0x5b6069);
  view.addChild(bird);

  let left = 0;
  let hopClock = 0;
  let hopsLeft = 0;

  return {
    view,

    land() {
      if (left > 0) return;
      left = VISIT_S;
      hopsLeft = reduced ? 0 : HOPS;
      hopClock = 0;
      bird.position.set(0, 0);
      view.alpha = 0;
      view.visible = true;
    },

    update(dtS) {
      if (left <= 0) return;
      left -= dtS;
      if (left <= 0) {
        view.visible = false;
        return;
      }

      // In on arrival, out on the way off. Nothing about a pigeon should pop.
      const inK = Math.min(1, (VISIT_S - left) / FADE_S);
      const outK = Math.min(1, left / FADE_S);
      view.alpha = Math.min(inK, outK);

      if (hopsLeft <= 0) return;
      hopClock += dtS;
      // One hop every third of the visit, each an arc rather than a slide.
      const period = VISIT_S / (HOPS + 1);
      if (hopClock >= period) {
        hopClock -= period;
        hopsLeft--;
      }
      const t = Math.min(1, hopClock / HOP_S);
      bird.position.y = -Math.sin(t * Math.PI) * HOP_H;
      bird.position.x += (hopClock < HOP_S ? 6 : 0) * dtS;
    },

    destroy() {
      view.destroy({ children: true });
    },
  };
}

// A teardown stack for everything an interior borrows from the city.
//
// The Café does not own its renderer — it hides the city's layers, adds its own
// containers, listeners and ticker callback to the city's Application, and gives
// all of it back on the way out (framework/building/interiorStage.ts).
//
// Two properties of that hand-back matter enough to be their own module:
//
//  1. It unwinds in reverse. The ticker callback comes off before the container
//     it draws, the container goes before the textures it holds, and the city is
//     only shown again once nothing of ours is left on its stage.
//
//  2. It has to exist BEFORE the first thing is taken. The room's build is async
//     and can throw part-way through — a bad bake, a missing asset — and if that
//     happens while the city is hidden and no teardown has been built yet, the
//     street stays hidden for the rest of the session, React's cleanup finds
//     nothing to run, and the player is inside a building they cannot leave. It
//     is the worst failure this building has, so the stack is armed empty and
//     grown as each thing is borrowed, rather than assembled once at the end.
//
// Pure and Pixi-free so both properties are unit-testable on their own.

export interface Teardown {
  /**
   * Record how to give back the thing you have just taken. Call it immediately
   * after taking it, never in a batch at the end.
   */
  onUndo(step: () => void): void;
  /**
   * Give everything back, most recently borrowed first. Safe to call twice — the
   * second call is a no-op, so a failed build and a normal unmount can both run
   * it without double-freeing.
   */
  run(): void;
  /** How many steps are still owed. Test seam. */
  readonly size: number;
}

export function createTeardown(): Teardown {
  const steps: Array<() => void> = [];

  return {
    onUndo(step) {
      steps.push(step);
    },
    run() {
      // Pop as we go rather than iterating a copy: if a step throws we have
      // already dropped it, so a second run() cannot repeat it.
      while (steps.length > 0) {
        const step = steps.pop();
        try {
          step?.();
        } catch {
          // One step failing must not strand the rest — in particular it must
          // never prevent the city being shown again, which is the last step.
        }
      }
    },
    get size() {
      return steps.length;
    },
  };
}

import { describe, it, expect } from "vitest";
import { createTeardown } from "./teardown";

// These are the properties the frozen-city defect turned on. A build that threw
// part-way left the street hidden with no teardown built yet, so the cleanup had
// nothing to run and the city never came back — with the player still inside.
describe("the interior teardown stack", () => {
  it("gives things back in reverse", () => {
    const order: string[] = [];
    const t = createTeardown();
    t.onUndo(() => order.push("show the city"));
    t.onUndo(() => order.push("free the textures"));
    t.onUndo(() => order.push("remove the container"));
    t.onUndo(() => order.push("stop the ticker"));

    t.run();

    expect(order).toEqual([
      "stop the ticker",
      "remove the container",
      "free the textures",
      "show the city",
    ]);
  });

  it("keeps unwinding when a step throws", () => {
    const done: string[] = [];
    const t = createTeardown();
    t.onUndo(() => done.push("show the city"));
    t.onUndo(() => {
      throw new Error("this container was already destroyed");
    });
    t.onUndo(() => done.push("stop the ticker"));

    expect(() => t.run()).not.toThrow();
    // The city being shown again is the last step, so it is the one a throw
    // earlier in the stack would otherwise swallow.
    expect(done).toEqual(["stop the ticker", "show the city"]);
  });

  it("is a no-op the second time, so a failed build and an unmount can both run it", () => {
    let shown = 0;
    const t = createTeardown();
    t.onUndo(() => (shown += 1));

    t.run();
    t.run();

    expect(shown).toBe(1);
    expect(t.size).toBe(0);
  });

  it("runs clean when nothing was ever borrowed", () => {
    const t = createTeardown();
    expect(() => t.run()).not.toThrow();
    expect(t.size).toBe(0);
  });

  it("owes one step per thing borrowed until it is run", () => {
    const t = createTeardown();
    expect(t.size).toBe(0);
    t.onUndo(() => {});
    t.onUndo(() => {});
    expect(t.size).toBe(2);
    t.run();
    expect(t.size).toBe(0);
  });
});

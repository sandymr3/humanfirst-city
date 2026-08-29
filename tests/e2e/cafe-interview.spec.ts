import { test, expect, type Page } from "@playwright/test";

// The interview, walked (docs/PRD_Building_Cafe.md). Runs only against a dev
// server started with the auth bypass:
//   DEV_WORLD=1 VITE_DEV_WORLD=1 npm run e2e
//
// The unit suite holds the invariants. This holds the thing they cannot: that a
// person can enter the city, walk into the café, sit down, answer twenty-seven
// beats and be offered the job, without anything on the page throwing.
test.describe("the Café interview (dev world bypass)", () => {
  test.skip(
    process.env.DEV_WORLD !== "1",
    "needs a VITE_DEV_WORLD=1 dev server — run: DEV_WORLD=1 VITE_DEV_WORLD=1 npm run e2e",
  );
  test.setTimeout(600_000);

  /**
   * Everything the page complained about, so a silent failure cannot stay silent.
   *
   * The one thing tolerated is the backend not being there. That is not a
   * loophole, it is the property under test: the room moves on the trace and
   * never on the score, so an unreachable or unauthenticated API must cost the
   * player nothing. Anything else — a thrown exception, a React error, a Pixi
   * failure — fails the run.
   */
  const BACKEND_DOWN = /ERR_CONNECTION|ERR_FAILED|Failed to load resource|localhost:8080/i;

  function collectProblems(page: Page): string[] {
    const problems: string[] = [];
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const text = m.text();
      if (BACKEND_DOWN.test(text)) return;
      problems.push(`console.error: ${text}`);
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}\n${e.stack ?? ""}`));
    return problems;
  }

  /**
   * The words that must never reach a player mid-interview.
   *
   * The blueprint's Rules sheet is explicit — the tier is scored silently and
   * "never surfaced to the learner mid-play" — and this is the only check that
   * looks at what was actually on the screen rather than at what a component
   * intended to render.
   */
  const FORBIDDEN = /\b(developing|strong|advanced|proficiency|passed|failed|correct)\b/i;

  async function bootCity(page: Page) {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("WASD")).toBeVisible({ timeout: 60_000 });
  }

  /**
   * Cross the room to Owen and sit down.
   *
   * By the GO TO chip rather than by steering, because that is the path a player
   * without a mouse takes and it is the one that used to be broken: his chair is
   * blocked furniture, and a chip aimed at it found no route at all.
   */
  async function sitDownWithOwen(page: Page) {
    await page.getByRole("button", { name: /Owen, the area manager/i }).click();
    const prompt = page.getByRole("button", { name: /sit down with Owen/i });
    await expect(prompt).toBeVisible({ timeout: 30_000 });
    await prompt.click();
  }

  /** The level question, asked once at the gate. */
  async function answerTheGate(page: Page) {
    const gate = page.getByRole("dialog", { name: /Entering CEO City/i });
    if (await gate.isVisible().catch(() => false)) {
      await gate.getByRole("button").first().click();
      await expect(gate).toHaveCount(0, { timeout: 15_000 });
    }
  }

  /**
   * Stand at the café's door without walking the whole of Market Street.
   *
   * The city publishes the venue you are next to on `worldStore`, and
   * CityScreen's E handler reads it straight back — so this is the same door the
   * player uses, not a back way in.
   */
  async function enterTheCafe(page: Page) {
    await page.evaluate(async () => {
      const mod = await import("/src/world/worldStore.ts");
      mod.useWorldStore.setState({ nearVenueId: "cafe" });
    });
    await page.getByRole("button", { name: /Enter\s+Café/i }).click();
    await expect(page.getByText("Back to the street")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Pushing the door open…")).toHaveCount(0, { timeout: 60_000 });
  }

  test("nine questions, twenty-seven answers, and the job", async ({ page }) => {
    const problems = collectProblems(page);
    const seen: string[] = [];

    await bootCity(page);
    await answerTheGate(page);

    // The city asks for one thing, and it says where.
    await expect(page.getByText(/Owen is expecting you at ten/i)).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: "test-results/cafe-00-objective.png" });

    await enterTheCafe(page);
    await page.screenshot({ path: "test-results/cafe-01-room.png", fullPage: false });

    // One destination in the room, and it is a person's table. This is the
    // assertion the emptying is for: five hotspots and a twelve-chip GO TO list
    // used to be here, and every one of them read as a job to do.
    const goTo = page.getByRole("navigation", { name: /Places in the café/i });
    await expect(goTo.getByRole("button")).toHaveCount(3); // the table, Priya, Owen
    await expect(goTo.getByRole("button", { name: /the interview table/i })).toBeVisible();

    // Sitting down with Owen is the one thing there is to do in here.
    await sitDownWithOwen(page);

    const decision = page.getByRole("dialog", { name: "A decision" });
    await expect(decision).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Question 1 of 9/)).toBeVisible();
    await page.screenshot({ path: "test-results/cafe-02-question-one.png" });

    // Twenty-seven beats: pick an option, read the consequence, carry on.
    for (let i = 0; i < 27; i++) {
      await expect(decision).toBeVisible({ timeout: 30_000 });
      seen.push((await decision.textContent()) ?? "");
      // Three look-alike options; which one is taken does not matter here.
      await decision
        .getByRole("button")
        .nth(i % 3)
        .click();

      const back = decision.getByRole("button", { name: "Back to the room" });
      await expect(back).toBeVisible({ timeout: 30_000 });
      seen.push((await decision.textContent()) ?? "");
      await back.click();
    }

    // He makes his decision the moment the twenty-seventh commits.
    const offer = page.getByRole("heading", { name: /The job is yours/i });
    await expect(offer).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: "test-results/cafe-03-offer.png" });

    // Every question was asked, and the panel counted to nine and stopped.
    expect(seen.length).toBe(54);
    const everything = seen.join("\n");
    expect(
      everything.match(FORBIDDEN),
      `tier vocabulary reached the player: ${everything.match(FORBIDDEN)?.[0]}`,
    ).toBeNull();

    expect(problems, `the page complained:\n${problems.join("\n")}`).toEqual([]);
  });

  test("walking out mid-interview and coming back lands on the same question", async ({ page }) => {
    const problems = collectProblems(page);
    await bootCity(page);
    await answerTheGate(page);
    await enterTheCafe(page);

    await sitDownWithOwen(page);
    const decision = page.getByRole("dialog", { name: "A decision" });
    await expect(decision).toBeVisible({ timeout: 30_000 });

    // Answer one whole question, so the second is the one waiting.
    for (let i = 0; i < 3; i++) {
      await expect(decision).toBeVisible({ timeout: 30_000 });
      await decision.getByRole("button").first().click();
      const back = decision.getByRole("button", { name: "Back to the room" });
      await expect(back).toBeVisible({ timeout: 30_000 });
      await back.click();
    }
    await expect(page.getByText(/Question 2 of 9/)).toBeVisible({ timeout: 30_000 });

    await page.getByText("Back to the street").click();
    await expect(page.getByText("WASD")).toBeVisible({ timeout: 30_000 });
    await enterTheCafe(page);
    await sitDownWithOwen(page);

    await expect(page.getByText(/Question 2 of 9/)).toBeVisible({ timeout: 30_000 });
    expect(problems, `the page complained:\n${problems.join("\n")}`).toEqual([]);
  });

  test("the city stops asking once the interview has been sat", async ({ page }) => {
    const problems = collectProblems(page);
    await bootCity(page);
    await answerTheGate(page);
    await expect(page.getByText(/Owen is expecting you at ten/i)).toBeVisible({ timeout: 30_000 });

    await enterTheCafe(page);
    await sitDownWithOwen(page);
    const decision = page.getByRole("dialog", { name: "A decision" });

    // One whole question — the objective is "go and attend the interview", and
    // by the time the first one has closed they have done that.
    for (let i = 0; i < 3; i++) {
      await expect(decision).toBeVisible({ timeout: 30_000 });
      await decision.getByRole("button").first().click();
      const back = decision.getByRole("button", { name: "Back to the room" });
      await expect(back).toBeVisible({ timeout: 30_000 });
      await back.click();
    }

    await page.getByText("Back to the street").click();
    await expect(page.getByText("WASD")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Owen is expecting you at ten/i)).toHaveCount(0);
    await page.screenshot({ path: "test-results/cafe-04-objective-cleared.png" });

    expect(problems, `the page complained:\n${problems.join("\n")}`).toEqual([]);
  });
});

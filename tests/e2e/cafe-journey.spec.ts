import { test, expect, type Page } from "@playwright/test";

// The career, walked (docs/ADR-007). Runs only against a dev server started with
// the auth bypass:
//   DEV_WORLD=1 VITE_DEV_WORLD=1 npm run e2e
//
// The unit suite holds the invariants. This holds the thing it cannot: that a
// person can enter the city, walk into the café, be interviewed, take the job,
// work the counter, be reviewed, be promoted, run the place and leave — without
// anything on the page throwing, and without a tier reaching them on the way.
test.describe("the Café career (dev world bypass)", () => {
  test.skip(
    process.env.DEV_WORLD !== "1",
    "needs a VITE_DEV_WORLD=1 dev server — run: DEV_WORLD=1 VITE_DEV_WORLD=1 npm run e2e",
  );
  test.setTimeout(600_000);

  /**
   * Everything the page complained about, so a silent failure cannot stay silent.
   *
   * The one thing tolerated is the backend not being there. That is not a
   * loophole, it is the property under test: **the room moves on the decision
   * and never on the score**, so an unreachable or unauthenticated API must cost
   * the player nothing. Anything else — a thrown exception, a React error, a
   * Pixi failure — fails the run.
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
   * The words that must never reach a player mid-career.
   *
   * "Strong" is not in this list and that is deliberate: it is an ordinary
   * English word and banning it here would fail on a line like "a firm opinion"
   * being rewritten badly. The content lint bans it in *authored content*, which
   * is where it would be a tier label; here we are reading whatever the page
   * happened to render, including feedback written by a model.
   */
  const FORBIDDEN =
    /\b(developing|advanced|proficiency|passed|failed|incorrect)\b|\b\d\s*\/\s*3\b/i;

  async function bootCity(page: Page) {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("WASD")).toBeVisible({ timeout: 60_000 });
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

  /**
   * Wait for a locator, and say so rather than throwing when it never arrives.
   *
   * The helpers below step between stages, and a stage close is a round trip —
   * so "the decision sheet is not on screen right now" and "this level is over"
   * look identical for a beat. Polling without a wait reads the gap as the end,
   * which is how the first run of this spec walked past a whole performance
   * review and blamed the room.
   */
  async function appears(locator: ReturnType<Page["getByRole"]>, ms = 20_000) {
    try {
      await locator.first().waitFor({ state: "visible", timeout: ms });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Answer every question of the sitting on screen.
   *
   * The panel is identified by the button that moves it on, not by being the
   * first dialog on the page. There are two boxes in this building now — the
   * sitting's and an open scene's — and `getByRole("dialog").first()` picked
   * whichever happened to be mounted, so a level that failed to finish showed up
   * here as "the interview has no Next button" ten minutes later.
   */
  function sittingPanel(page: Page) {
    return page
      .getByRole("dialog")
      .filter({ has: page.getByRole("button", { name: /Next|That's me done/ }) });
  }

  async function sitTheQuestions(
    page: Page,
    seen: string[],
    answer = "I did the thing and it worked out.",
  ) {
    for (let asked = 0; asked < 12; asked++) {
      const panel = sittingPanel(page);
      if (!(await appears(panel, asked === 0 ? 20_000 : 4_000))) return;
      seen.push((await panel.textContent()) ?? "");
      await panel.getByRole("textbox").fill(answer);
      await panel.getByRole("button", { name: /Next|That's me done/ }).click();
    }
  }

  /**
   * Wait out a stage close, and say whether one was happening.
   *
   * The room puts a loading state up while a sitting settles (`ui/Waiting`), and
   * with no backend that is the client's full retry budget — several seconds of
   * looking like nothing at all is happening.
   */
  async function settled(page: Page): Promise<boolean> {
    const busy = page.getByText(/One moment\.|Reading it back\.|Still reading\./);
    if (
      !(await busy
        .first()
        .isVisible()
        .catch(() => false))
    )
      return false;
    await busy.first().waitFor({ state: "hidden", timeout: 90_000 });
    return true;
  }

  /**
   * Work through every decision of the level on screen.
   *
   * A beat is now one of three things, and the spec has to tell them apart the
   * way a player does — by what the panel is offering:
   *
   *  - a consequence to read, which has one button and no question
   *  - an OPEN decision, which has a text box (ADR-008): every L1 and L2 scene,
   *    and every question those scenes generate
   *  - a lettered decision, which has a list of options: the CEO trees, which
   *    stayed lettered because their nine audited terminals are the outcome
   *    scale
   *
   * Reading the box first matters. An open panel also carries buttons — "Speak"
   * and "Answer" — so a helper that clicks `getByRole("button").nth(n)` starts
   * the microphone instead of answering, which is how this spec hung for ten
   * minutes on the first run after the change.
   */
  async function workTheLevel(
    page: Page,
    seen: string[],
    pick = 0,
    said = "I would ask what they actually wanted, write it on the board, and tell the manager at shift change.",
  ) {
    const decision = page.getByRole("dialog", { name: "A decision" });
    for (let beat = 0; beat < 40; beat++) {
      if (!(await appears(decision, beat === 0 ? 20_000 : 4_000))) {
        // No panel — but "the level is over" and "the room is settling a stage"
        // look identical from out here, and a close can take the grader's whole
        // deadline. Wait the room out before concluding anything.
        //
        // This is what the spec got wrong the first time the career went
        // open-ended: L3 finishes, the close takes ~9s, and a helper that gave
        // up after 4 walked past the entire succession round.
        if (!(await settled(page))) return;
        if (!(await appears(decision, 10_000))) return;
      }
      seen.push((await decision.textContent()) ?? "");

      const back = decision.getByRole("button", { name: "Back to the room" });
      if (await back.isVisible().catch(() => false)) {
        await back.click();
        continue;
      }

      const box = decision.getByRole("textbox");
      if (await box.isVisible().catch(() => false)) {
        await box.fill(said);
        await decision.getByRole("button", { name: /^Answer$/ }).click();
        continue;
      }

      const options = decision.getByRole("button");
      await options.nth(pick % (await options.count())).click();
    }
  }

  test("hired, promoted twice, and out of the door", async ({ page }) => {
    const problems = collectProblems(page);
    const seen: string[] = [];

    await bootCity(page);
    await answerTheGate(page);
    await enterTheCafe(page);
    await page.screenshot({ path: "test-results/cafe-01-room.png" });

    // A candidate is offered the table and the door, and nothing behind the
    // counter — the guided list and the flap agree about where they may stand.
    const goTo = page.getByRole("navigation", { name: /Places in the café/i });
    await expect(goTo.getByRole("button", { name: /the table/i })).toBeVisible();
    await expect(goTo.getByRole("button", { name: /the pass-through/i })).toHaveCount(0);

    // The interview starts itself: it is the stage you are on when you walk in.
    await expect(page.getByRole("textbox")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/1 of 5/)).toBeVisible();
    await page.screenshot({ path: "test-results/cafe-02-interview.png" });

    await sitTheQuestions(page, seen);

    // The gate: three roads, and leaving is one of them.
    const takeIt = page.getByRole("button", { name: /Take it/i });
    await expect(takeIt).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Go again")).toBeVisible();
    await expect(page.getByText("Leave the café")).toBeVisible();
    await page.screenshot({ path: "test-results/cafe-03-offer.png" });
    await takeIt.click();

    // The counter, then the first review, then the branch.
    await workTheLevel(page, seen, 0);
    await sitTheQuestions(
      page,
      seen,
      "I kept the board up to date and told the manager what I saw.",
    );
    await expect(page.getByRole("button", { name: /Take it/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Take it/i }).click();

    // The career shape, drawn. It is an ordered list of three postings and the
    // one you hold is marked — never a percentage and never a score, which is
    // the whole reason it is a list of rungs and not a bar.
    const ladder = page.getByRole("list", { name: /^Career: / });
    await expect(ladder).toHaveAttribute("aria-label", /Branch Manager/i, { timeout: 30_000 });

    // Behind the flap now — and the pass has appeared in the guided list, which
    // is the promotion beat in the half of the room a keyboard player uses.
    await expect(goTo.getByRole("button", { name: /the pass-through/i })).toBeVisible({
      timeout: 30_000,
    });
    await page.screenshot({ path: "test-results/cafe-04-branch.png" });

    await workTheLevel(page, seen, 1);
    await sitTheQuestions(page, seen, "I fixed the rota rather than the person.");
    await expect(page.getByRole("button", { name: /Take it/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Take it/i }).click();

    // Running it: four two-beat decisions. These stayed lettered on purpose —
    // ADR-008 §7.1 — so this is the one level still answered by choosing.
    await workTheLevel(page, seen, 2);

    // The loop above carries straight on into the succession: it waits out the
    // stage close now rather than reading it as the end of the career, so by
    // the time it returns the handover has been made too.
    //
    // So the succession is asserted from the RECORD rather than from the
    // screen. Expecting the panel at a fixed moment would be a race with the
    // walk itself — and what actually matters is that the round happened, not
    // that it was on screen when this line ran. It is the one decision in the
    // career with no follow-up and no undo, so a walk that silently skipped it
    // would be reporting a career nobody played.
    expect(
      seen.join("\n"),
      "the succession round never happened — the walk went from CEO straight to the door",
    ).toMatch(/Three people want it/i);

    // And out.
    //
    // When this does not arrive, the useful question is "what was the room
    // showing instead" — the career is eleven stages and a bare "heading not
    // found" says nothing about which one it stopped on.
    const report = page.getByRole("heading", { name: /The year at the corner/i });
    await expect(
      report,
      `never reached the report. The last panels the walk saw:\n${seen
        .slice(-3)
        .map((s, i) => `[${i}] ${s.replace(/\s+/g, " ").slice(0, 300)}`)
        .join("\n")}\n\nOn screen now: ${(await page.locator("body").textContent())
        ?.replace(/\s+/g, " ")
        .slice(0, 400)}`,
    ).toBeVisible({ timeout: 60_000 });
    await page.screenshot({ path: "test-results/cafe-05-report.png" });

    // Nothing on the way through told them how they were doing.
    const everything = seen.join("\n");
    expect(
      everything.match(FORBIDDEN),
      `tier vocabulary reached the player: ${everything.match(FORBIDDEN)?.[0]}`,
    ).toBeNull();

    expect(problems, `the page complained:\n${problems.join("\n")}`).toEqual([]);
  });

  test("a finished phase can be walked back through, and read-only", async ({ page }) => {
    const problems = collectProblems(page);
    const seen: string[] = [];

    await bootCity(page);
    await answerTheGate(page);
    await enterTheCafe(page);

    // Nothing to look back on yet, so nothing offers to.
    const openHistory = page.getByRole("button", { name: /What I have answered/i });
    await expect(openHistory).toHaveCount(0);

    await sitTheQuestions(
      page,
      seen,
      "I have run a counter for two years and I am steady when it is busy.",
    );
    await expect(page.getByRole("button", { name: /Take it/i })).toBeVisible({ timeout: 60_000 });

    // One phase closed, so now it does.
    await expect(openHistory).toBeVisible({ timeout: 30_000 });
    await openHistory.click();

    const history = page.getByRole("dialog", { name: /What you have answered so far/i });
    await expect(history).toBeVisible();
    // The blueprint's question, and the player's own words against it.
    await expect(history.getByText("Tell me about yourself.")).toBeVisible();
    await expect(history.getByText(/I have run a counter for two years/).first()).toBeVisible();
    await page.screenshot({ path: "test-results/cafe-07-history.png" });

    // Read-only by construction: a record, with nothing to type into.
    await expect(history.getByRole("textbox")).toHaveCount(0);

    // Escape closes the panel and leaves the player in the café. It used to walk
    // them out of the building: two window listeners cannot stop one another,
    // and the room's registered first.
    await page.keyboard.press("Escape");
    await expect(history).toHaveCount(0);
    await expect(page.getByText("Back to the street")).toBeVisible();
    await expect(page.getByRole("button", { name: /Take it/i })).toBeVisible();

    expect(problems, `the page complained:\n${problems.join("\n")}`).toEqual([]);
  });

  test("leaving at a gate is a complete run, not a failure", async ({ page }) => {
    const problems = collectProblems(page);
    const seen: string[] = [];

    await bootCity(page);
    await answerTheGate(page);
    await enterTheCafe(page);

    await sitTheQuestions(page, seen);
    await page.getByRole("button", { name: /Take it/i }).click();
    await workTheLevel(page, seen, 0);
    await sitTheQuestions(page, seen);

    // Second gate. Walk out instead of taking the branch.
    await expect(page.getByText("Leave the café")).toBeVisible({ timeout: 30_000 });
    await page.getByText("Leave the café").click();

    // They left as an employee, and the report says so rather than treating it
    // as an abandoned run.
    await expect(page.getByRole("heading", { name: /The year at the corner/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/left as an Employee/i)).toBeVisible();
    await page.screenshot({ path: "test-results/cafe-06-left-early.png" });

    expect(problems, `the page complained:\n${problems.join("\n")}`).toEqual([]);
  });

  test("walking out mid-career and coming back lands where you left", async ({ page }) => {
    const problems = collectProblems(page);
    const seen: string[] = [];

    await bootCity(page);
    await answerTheGate(page);
    await enterTheCafe(page);

    // Answer two of the five, so the third is the one waiting.
    for (let i = 0; i < 2; i++) {
      const panel = sittingPanel(page);
      await expect(panel).toBeVisible({ timeout: 30_000 });
      await panel.getByRole("textbox").fill("Something true about me.");
      await panel.getByRole("button", { name: /Next|That's me done/ }).click();
      await page.waitForTimeout(200);
    }
    await expect(page.getByText(/3 of 5/)).toBeVisible({ timeout: 30_000 });

    await page.getByText("Back to the street").click();
    await expect(page.getByText("WASD")).toBeVisible({ timeout: 30_000 });
    await enterTheCafe(page);

    await expect(page.getByText(/3 of 5/)).toBeVisible({ timeout: 30_000 });
    expect(seen).toEqual([]);
    expect(problems, `the page complained:\n${problems.join("\n")}`).toEqual([]);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Lookbook } from "./Lookbook";
import { useMaisonStore, type Decision } from "./maisonStore";
import { INITIAL_WORLD, applyDelta } from "./world";
import { BEATS } from "./season";
import { maisonContent } from "./content";
import { worldDeltaAlong, type DecisionTreeContent } from "@/lib/decisionTree";
import type { LevelActivity } from "@/framework/api/schemas";

/** A finished Level A season: every beat decided down the same two letters. */
function playWholeSeason(path: string[]): { decided: Decision[]; world: typeof INITIAL_WORLD } {
  let world = { ...INITIAL_WORLD };
  const decided: Decision[] = [];
  for (const beat of BEATS) {
    const id = beat.A.id;
    const tree = maisonContent[id] as DecisionTreeContent;
    decided.push({ id, path });
    world = applyDelta(world, worldDeltaAlong(tree, path));
  }
  return { decided, world };
}

const row = (id: string, best: number | null): LevelActivity =>
  ({ id, bestProficiency: best }) as LevelActivity;

describe("The Lookbook (§13)", () => {
  beforeEach(() => {
    const { decided, world } = playWholeSeason(["b", "a"]);
    useMaisonStore.setState({
      track: "A",
      opening: { ...INITIAL_WORLD },
      world,
      decided,
    });
  });

  it("shows the collection as it finished and the version it started as", () => {
    render(<Lookbook track="A" activities={undefined} onClose={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "The Lookbook" })).toBeVisible();
    expect(
      screen.getByText(/You started with: the rail is eight pieces, all vermilion/),
    ).toBeVisible();
  });

  it("walks the whole season, one row per beat, with what was chosen", () => {
    render(<Lookbook track="A" activities={undefined} onClose={vi.fn()} />);
    for (const beat of BEATS) expect(screen.getByText(beat.A.title)).toBeVisible();
    expect(screen.getAllByText(/What you chose:/)).toHaveLength(BEATS.length);
    expect(screen.queryByText(/Not decided this season/)).toBeNull();
  });

  it("says a beat was not decided rather than inventing one", () => {
    useMaisonStore.setState({ decided: [{ id: "C1-SCA-03", path: ["a", "a"] }] });
    render(<Lookbook track="A" activities={undefined} onClose={vi.fn()} />);
    expect(screen.getAllByText(/Not decided this season/)).toHaveLength(BEATS.length - 1);
  });

  it("repeats the server's tier and never fills in one the server did not give", () => {
    // §13.3: the ONLY place tier vocabulary appears in this building — and only
    // for the beats the backend actually scored. The client holds no rubric.
    const activities = new Map([
      ["C1-SCA-03", row("C1-SCA-03", 3)],
      ["C2-SCA-03", row("C2-SCA-03", null)],
    ]);
    render(<Lookbook track="A" activities={activities} onClose={vi.fn()} />);

    expect(screen.getByText(/the server recorded 3 of 3/)).toBeVisible();
    expect(screen.getAllByText(/the server recorded/)).toHaveLength(1);
  });

  it("describes the shape of the season without grading it", () => {
    const { container } = render(<Lookbook track="A" activities={undefined} onClose={vi.fn()} />);
    expect(screen.getByText(/You took every beat of the season/)).toBeVisible();

    const text = container.textContent ?? "";
    expect(text).not.toMatch(/★|✓|✗/);
    expect(text).not.toMatch(/\b(Developing|Strong|Advanced)\b/);
    expect(text).not.toMatch(/\b(well done|good job|unfortunately|you should have)\b/i);
  });
});

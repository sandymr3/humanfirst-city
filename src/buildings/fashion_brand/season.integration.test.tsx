import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { MaisonPanel } from "./MaisonPanel";
import { useMaisonStore } from "./maisonStore";
import { INITIAL_WORLD } from "./world";
import { MAISON_DEV_ACTIVITIES } from "./devFixture";
import { PlayerShell } from "@/activities/PlayerShell";
import { api } from "@/framework/api";
import type { CityBuilding } from "@/world/cityMap";
import type { LevelActivity } from "@/framework/api/schemas";

// The whole loop, wired the way CityScreen wires it: board → beat → decide →
// submit → the house moves. This is the gate P6 exists for — without a backend
// the venue still has to be walkable end to end (docs/maison.md §0.4), and the
// rail has to move on the trace rather than on anything the server said.

const venue = {
  id: "fashion_brand",
  displayName: "MAISON",
  district: "market",
  kind: "scenario",
  footprintTiles: [],
  entranceTile: { x: 0, y: 0 },
  hostedActivities: [],
  interactable: true,
} as unknown as CityBuilding;

/** Stands in for CityScreen: the panel, and the player it opens. */
function Venue() {
  const [playing, setPlaying] = useState<LevelActivity | null>(null);
  return playing ? (
    <PlayerShell activity={playing} venueName="MAISON" onClose={() => setPlaying(null)} />
  ) : (
    <MaisonPanel venue={venue} onPlay={setPlaying} onClose={vi.fn()} />
  );
}

function renderVenue() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<Venue />, { wrapper });
}

describe("MAISON end to end, without a backend", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useMaisonStore.setState({
      track: "A",
      opening: { ...INITIAL_WORLD },
      world: { ...INITIAL_WORLD },
      decided: [],
    });
    // The dev fixture's rows, served the way the season board would get them.
    vi.spyOn(api, "getLevel").mockImplementation(async (comp: string, level: string) => ({
      competency: comp,
      level,
      activities: MAISON_DEV_ACTIVITIES.filter(
        (a) => a.competencyCode === comp && a.level === level,
      ),
    }));
    vi.spyOn(api, "startActivity").mockResolvedValue({});
    // A real scored submit. The response is the SERVER's — the point of the
    // assertions below is that none of it reaches the player in this venue,
    // and that the rail moves off the trace rather than off the proficiency.
    vi.spyOn(api, "submit").mockResolvedValue({
      activityId: "C2-SCA-03",
      proficiency: 3,
      bestProficiency: 3,
      passed: true,
      status: "COMPLETED",
      feedback: "Excellent work!",
      graded: "server",
      badgesAwarded: [],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("opens every one of the nine beats from the board", async () => {
    renderVenue();
    expect(await screen.findAllByRole("button", { name: "Open" })).toHaveLength(9);
    expect(screen.queryByText("not yet")).toBeNull();
  });

  it("walks a beat and moves the rail on the decision, not on a score", async () => {
    renderVenue();

    // Beat 2 on Level A is "Three Times Faster" — hold the colour, then cut.
    const open = await screen.findAllByRole("button", { name: "Open" });
    await userEvent.click(open[1]);

    expect(await screen.findByText(/Élise sets her glasses down/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /Hold the colour/ }));
    await userEvent.click(screen.getByRole("button", { name: /Cut the vermilion order/ }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    // The server said 3/3, "Passed!" and "Excellent work!". None of it appears —
    // that is the silent-tier contract doing its job on a real response (§11).
    expect(await screen.findByText("Recorded.")).toBeVisible();
    const closed = screen.getByRole("dialog").textContent ?? "";
    expect(closed).not.toMatch(/\b(proficiency|passed|failed)\b/i);
    expect(closed).not.toMatch(/\d\s*\/\s*3/);
    expect(closed).not.toContain("Excellent work!");

    await userEvent.click(screen.getByRole("button", { name: /back to the floor/i }));

    // The house moved off the trace: rail → thin, cash → tight (§9.3).
    expect(await screen.findByText(/the rail is four pieces/)).toBeVisible();
    expect(useMaisonStore.getState().world.rail).toBe("thin");
    expect(useMaisonStore.getState().decided).toEqual([{ id: "C2-SCA-03", path: ["c", "b"] }]);
  });

  it("opens the lookbook only once the whole season is decided", async () => {
    renderVenue();
    await screen.findAllByRole("button", { name: "Open" });
    expect(screen.queryByText(/The lookbook is printed/)).toBeNull();

    act(() =>
      useMaisonStore.setState({
        decided: MAISON_DEV_ACTIVITIES.filter((a) => a.level === "SCA").map((a) => ({
          id: a.id,
          path: ["a", "a"],
        })),
      }),
    );

    await userEvent.click(await screen.findByText(/The lookbook is printed/));
    expect(await screen.findByRole("heading", { name: "The Lookbook" })).toBeVisible();
    expect(screen.getByText(/You took every beat of the season/)).toBeVisible();
  });
});

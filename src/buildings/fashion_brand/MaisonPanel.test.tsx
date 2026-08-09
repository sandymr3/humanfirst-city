import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MaisonPanel } from "./MaisonPanel";
import { useMaisonStore } from "./maisonStore";
import { INITIAL_WORLD } from "./world";
import { BEATS } from "./season";
import { api } from "@/framework/api";
import { events } from "@/framework/events";
import type { CityBuilding } from "@/world/cityMap";
import type { SubmitResponse } from "@/framework/api/schemas";

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

const activity = (id: string) => ({
  id,
  competencyCode: id.slice(0, 2),
  level: id.includes("SCA") ? "SCA" : "SCB",
  activityType: "DECISION_TREE",
  title: id,
  status: "NOT_STARTED",
});

function renderPanel(onPlay = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    onPlay,
    ...render(<MaisonPanel venue={venue} onPlay={onPlay} onClose={vi.fn()} />, { wrapper }),
  };
}

describe("MaisonPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useMaisonStore.setState({ track: null, world: { ...INITIAL_WORLD }, decided: [] });
    // Every level list resolves empty unless a test says otherwise.
    vi.spyOn(api, "getLevel").mockResolvedValue({
      competency: "C1",
      level: "SCA",
      activities: [],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("asks the threshold question before anything else (§14)", () => {
    renderPanel();
    expect(screen.getByText(/label you're starting, or the one you're taking over/)).toBeVisible();
    expect(screen.queryByText(/The season/)).toBeNull();
  });

  it("starts the season on the track you answer with", async () => {
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: /the label you started/i }));

    expect(useMaisonStore.getState().track).toBe("A");
    expect(await screen.findByText(/The season/)).toBeVisible();
    expect(screen.getByText(/eight pieces, all vermilion/)).toBeVisible();
  });

  it("lists all nine beats, counting down, with their host and station", async () => {
    useMaisonStore.setState({ track: "A" });
    renderPanel();

    await screen.findByText(/The season/);
    for (const beat of BEATS) {
      expect(screen.getByText(beat.A.title)).toBeVisible();
      expect(screen.getByText(beat.countdown)).toBeVisible();
    }
    expect(screen.getByText(/Élise's bench · Élise/)).toBeVisible();
  });

  it("shows a beat as not yet open while its registry row is missing (§0.4)", async () => {
    useMaisonStore.setState({ track: "A" });
    renderPanel();
    expect((await screen.findAllByText("not yet")).length).toBe(BEATS.length);
  });

  it("opens a beat whose row exists, and hands the activity up", async () => {
    vi.spyOn(api, "getLevel").mockImplementation(async (comp: string, level: string) => ({
      competency: comp,
      level,
      activities: comp === "C2" && level === "SCA" ? [activity("C2-SCA-03")] : [],
    }));
    useMaisonStore.setState({ track: "A" });
    const { onPlay } = renderPanel();

    const open = await screen.findByRole("button", { name: "Open" });
    await userEvent.click(open);
    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ id: "C2-SCA-03" }));
  });

  it("moves the rail when a beat is submitted, and marks it decided", async () => {
    useMaisonStore.setState({ track: "A" });
    renderPanel();
    expect(await screen.findByText(/eight pieces, all vermilion/)).toBeVisible();

    // Holding the colour then cutting the order: rail → thin (docs/maison.md §9.3).
    // This is the real path — PlayerShell emits exactly this after a submit.
    act(() =>
      events.emit("activity_submitted", {
        activityId: "C2-SCA-03",
        result: { trace: { path: ["c", "b"] } },
        response: {} as SubmitResponse,
      }),
    );

    expect(await screen.findByText(/the rail is four pieces/)).toBeVisible();
    expect(useMaisonStore.getState().decided).toEqual([{ id: "C2-SCA-03", path: ["c", "b"] }]);
    expect(screen.getByText("1 of 9 decided", { exact: false })).toBeVisible();
  });

  it("shows no tier, star, proficiency or pass-fail on the board (§11)", async () => {
    useMaisonStore.setState({ track: "A", decided: [{ id: "C2-SCA-03", path: ["c", "b"] }] });
    const { container } = renderPanel();
    await screen.findByText(/The season/);

    const text = container.textContent ?? "";
    expect(text).not.toMatch(/★|✓|✗/);
    expect(text).not.toMatch(/\b(Developing|Strong|Advanced)\b/);
    expect(text).not.toMatch(/\b(proficiency|passed|failed)\b/i);
    expect(text).not.toMatch(/\d\s*\/\s*3/);
  });

  it("starts the collection over without forgetting the track", async () => {
    useMaisonStore.setState({ track: "B", decided: [{ id: "C5-SCB-03", path: ["b", "a"] }] });
    renderPanel();

    await userEvent.click(
      await screen.findByRole("button", { name: /start the collection over/i }),
    );
    const s = useMaisonStore.getState();
    expect(s.track).toBe("B");
    expect(s.decided).toEqual([]);
    expect(within(screen.getByRole("dialog")).getByText(/0 of 9 decided/)).toBeVisible();
  });
});

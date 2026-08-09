import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The dev-world offline branch (docs/maison.md §0.4). `devWorldBypass` is
// computed at module load from import.meta.env, so it has to be mocked rather
// than stubbed — and it is mocked HERE, in its own file, so no other test sees
// a dev flag that production never has.
vi.mock("@/framework/config/appConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/framework/config/appConfig")>()),
  devWorldBypass: true,
}));

import { PlayerShell } from "@/activities/PlayerShell";
import { api } from "@/framework/api";
import { useMaisonStore } from "./maisonStore";
import { INITIAL_WORLD } from "./world";
import type { LevelActivity } from "@/framework/api/schemas";

const activity = {
  id: "C2-SCA-03",
  competencyCode: "C2",
  level: "SCA",
  activityType: "DECISION_TREE",
  title: "Three Times Faster",
  status: "NOT_STARTED",
} as LevelActivity;

describe("MAISON in the dev world, with no backend", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useMaisonStore.setState({
      track: "A",
      opening: { ...INITIAL_WORLD },
      world: { ...INITIAL_WORLD },
      decided: [],
    });
    vi.spyOn(api, "startActivity").mockResolvedValue({});
    vi.spyOn(api, "submit").mockRejectedValue(new Error("network"));
  });
  afterEach(() => vi.restoreAllMocks());

  it("records the decision and says plainly that nothing scored it", async () => {
    render(<PlayerShell activity={activity} venueName="MAISON" onClose={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: /Hold the colour/ }));
    await userEvent.click(screen.getByRole("button", { name: /Cut the vermilion order/ }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText(/this was not scored/)).toBeVisible();

    // The house still moved, because the house moves on the decision — but
    // nothing invented a proficiency out of a failed request.
    const s = useMaisonStore.getState();
    expect(s.decided).toEqual([{ id: "C2-SCA-03", path: ["c", "b"] }]);
    expect(s.world.rail).toBe("thin");

    const text = screen.getByRole("dialog").textContent ?? "";
    expect(text).not.toMatch(/\b(proficiency|passed)\b/i);
    expect(text).not.toMatch(/\d\s*\/\s*3/);
  });
});

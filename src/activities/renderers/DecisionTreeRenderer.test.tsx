import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DecisionTreeRenderer } from "./DecisionTreeRenderer";
import { c2Hard03 } from "@/buildings/fashion_brand/content";

// The component half of the contract: the dialogue layer builds the right trace,
// and the venue shows no tier anywhere (docs/maison.md §11, §18.3).
const ID = "C2-SCA-03";

describe("DecisionTreeRenderer", () => {
  it("reports nothing until the tree ends, then the whole path", async () => {
    const onChange = vi.fn();
    render(<DecisionTreeRenderer content={c2Hard03} activityId={ID} onChange={onChange} />);

    expect(onChange).toHaveBeenLastCalledWith(null);

    // Beat one: hold the colour.
    await userEvent.click(screen.getByRole("button", { name: /Hold the colour/ }));
    expect(onChange).toHaveBeenLastCalledWith(null);

    // Beat two: ring Véra — the late change of mind §10.2 calls the most
    // important cell in the building.
    await userEvent.click(screen.getByRole("button", { name: /Call Véra/ }));
    expect(onChange).toHaveBeenLastCalledWith({ trace: { path: ["c", "c"] } });
  });

  it("routes each seed branch to its own follow-up beat", async () => {
    render(<DecisionTreeRenderer content={c2Hard03} activityId={ID} onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /Shift the next drop/ }));
    expect(screen.getByText(/less shouty this season/)).toBeInTheDocument();
    expect(screen.queryByText(/started folding the unsold pieces/)).toBeNull();
  });

  it("announces the consequence in a live region", async () => {
    render(<DecisionTreeRenderer content={c2Hard03} activityId={ID} onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /Get Véra on the phone/ }));
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent(/Véra asks you three questions/);
  });

  it("offers exactly three choices at each beat and none after the last", async () => {
    render(<DecisionTreeRenderer content={c2Hard03} activityId={ID} onChange={vi.fn()} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: /Hold the colour/ }));
    expect(screen.getAllByRole("button")).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: /Cut the vermilion order/ }));
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText(/That is the season/)).toBeInTheDocument();
  });

  it("shuffles the choices per beat, without touching the trace tokens", async () => {
    // Authored weakest-first (§9.5's order); shown shuffled (§9.1), so the weak
    // option does not sit first at every node in the building. The path the
    // server scores is still the authored key, whatever slot it was shown in.
    const onChange = vi.fn();
    const { container } = render(
      <DecisionTreeRenderer content={c2Hard03} activityId={ID} onChange={onChange} />,
    );

    const shown = Array.from(container.querySelectorAll("button")).map((b) => b.textContent ?? "");
    const authored = c2Hard03.seed.choices.map((c) => c.text);
    expect(shown.slice().sort()).toEqual(authored.slice().sort());
    expect(shown).not.toEqual(authored);

    await userEvent.click(screen.getByRole("button", { name: /Hold the colour/ }));
    await userEvent.click(screen.getByRole("button", { name: /Call Véra/ }));
    expect(onChange).toHaveBeenLastCalledWith({ trace: { path: ["c", "c"] } });
  });

  it("shows no tier, star, proficiency or pass-fail anywhere (§11)", async () => {
    const { container } = render(
      <DecisionTreeRenderer content={c2Hard03} activityId={ID} onChange={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Hold the colour/ }));
    await userEvent.click(screen.getByRole("button", { name: /Call Véra/ }));

    const text = container.textContent ?? "";
    expect(text).not.toMatch(/★|✓|✗/);
    expect(text).not.toMatch(/\b(Developing|Strong|Advanced)\b/); // case-sensitive: the labels
    expect(text).not.toMatch(/\b(proficiency|passed|failed)\b/i);
    expect(text).not.toMatch(/\d\s*\/\s*3/);
  });
});

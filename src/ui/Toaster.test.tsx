import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { Toaster } from "./Toaster";
import { events } from "@/framework/events";
import { audio } from "@/framework/audio/audioManager";

describe("the toast lane", () => {
  afterEach(() => vi.restoreAllMocks());

  // The production incident this guards against: a retry burst firing the
  // same "Reconnecting…" toast several times a second, with nothing here to
  // stop each one stacking as its own chip — three identical copies sitting
  // on screen at once was the visible half of that bug.
  it("collapses a repeated identical toast into the one already showing", () => {
    vi.spyOn(audio, "play").mockImplementation(() => {});
    render(<Toaster />);

    act(() => events.emit("toast", { message: "Reconnecting…", kind: "info" }));
    act(() => events.emit("toast", { message: "Reconnecting…", kind: "info" }));
    act(() => events.emit("toast", { message: "Reconnecting…", kind: "info" }));

    expect(screen.getAllByText("Reconnecting…")).toHaveLength(1);
  });

  it("does not collapse two different messages, even the same kind", () => {
    vi.spyOn(audio, "play").mockImplementation(() => {});
    render(<Toaster />);

    act(() => events.emit("toast", { message: "Reconnecting…", kind: "info" }));
    act(() => events.emit("toast", { message: "Signed out.", kind: "info" }));

    expect(screen.getByText("Reconnecting…")).toBeInTheDocument();
    expect(screen.getByText("Signed out.")).toBeInTheDocument();
  });
});

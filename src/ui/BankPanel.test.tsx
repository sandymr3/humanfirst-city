import { describe, it, expect, vi, afterEach } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { BankPanel } from "./BankPanel";
import { api } from "@/framework/api";
import { useEconomyStore } from "@/framework/economy/economyStore";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => useEconomyStore.setState({ coinBalance: null, lifetimeCoins: null }));
});

const ledger = () => {
  vi.spyOn(api, "getWallet").mockResolvedValue({ coins: 140, lifetimeCoins: 165 });
  vi.spyOn(api, "getWalletTransactions").mockResolvedValue({
    transactions: [
      {
        id: "t1",
        amount: 25,
        reason: "ACTIVITY_COMPLETE",
        refType: "activity",
        refId: "C1-SCA-01",
        balanceAfter: 140,
        createdAt: "",
      },
      {
        id: "t2",
        amount: 5,
        reason: "ACTIVITY_COMPLETE",
        refType: "activity",
        refId: "C2-SCA-01",
        balanceAfter: 115,
        createdAt: "",
      },
    ],
  });
};

describe("the bank", () => {
  it("shows the balance the server holds", async () => {
    ledger();
    await act(async () => {
      render(<BankPanel onClose={() => {}} />);
    });
    await waitFor(() => expect(screen.getByText("140")).toBeInTheDocument());
    expect(screen.getByText(/165 earned in all/)).toBeInTheDocument();
  });

  // Twenty-five coins next to a week's name IS the tier, spelled out. The ledger
  // may say what a row was for and what it was worth; it may not rank the weeks,
  // and nothing in it may name a proficiency.
  it("never puts a tier, a score or a verdict beside a week", async () => {
    ledger();
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<BankPanel onClose={() => {}} />));
    });
    await waitFor(() => expect(screen.getByText("140")).toBeInTheDocument());
    const text = container.textContent ?? "";
    for (const word of [
      "Developing",
      "Strong",
      "Advanced",
      "proficiency",
      "passed",
      "failed",
      "score",
      "/3",
      "best",
    ]) {
      expect(text.toLowerCase(), `"${word}" is on the ledger`).not.toContain(word.toLowerCase());
    }
  });

  // A balance is not something a browser gets to be wrong about. If the counter
  // cannot be reached, it says so rather than showing a number it invented.
  it("shows no number it cannot vouch for", async () => {
    vi.spyOn(api, "getWallet").mockRejectedValue(new Error("offline"));
    vi.spyOn(api, "getWalletTransactions").mockRejectedValue(new Error("offline"));
    await act(async () => {
      render(<BankPanel onClose={() => {}} />);
    });
    await waitFor(() => expect(screen.getByText(/counter is closed/)).toBeInTheDocument());
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

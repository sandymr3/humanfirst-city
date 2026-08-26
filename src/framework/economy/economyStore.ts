// The wallet, mirrored (PRD §9, §12.1).
//
// **Updated only from server responses.** It holds no fake data and computes no
// balance of its own: coins are granted server-side, once, against an
// idempotency key, and a client that added them up locally would be a client
// that could be wrong about somebody's money. Until a real balance arrives the
// HUD shows an em dash rather than a zero, because "we do not know yet" and "you
// have none" are different things and only one of them is true.
import { create } from "zustand";

interface EconomyState {
  coinBalance: number | null;
  /** Everything ever earned, which is not the same as what is left. */
  lifetimeCoins: number | null;
  applyCoinBalance: (balance: number | undefined) => void;
  applyWallet: (wallet: { coins?: number; lifetimeCoins?: number } | undefined) => void;
}

export const useEconomyStore = create<EconomyState>((set) => ({
  coinBalance: null,
  lifetimeCoins: null,
  applyCoinBalance: (balance) => {
    if (typeof balance === "number") set({ coinBalance: balance });
  },
  applyWallet: (wallet) => {
    if (!wallet) return;
    const next: Partial<EconomyState> = {};
    if (typeof wallet.coins === "number") next.coinBalance = wallet.coins;
    if (typeof wallet.lifetimeCoins === "number") next.lifetimeCoins = wallet.lifetimeCoins;
    set(next);
  },
}));

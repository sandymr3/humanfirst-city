// The bank — where the money you earned actually is.
//
// Coins are granted server-side, once, against an idempotency key, and this
// reads the ledger rather than adding anything up: a client that computed a
// balance would be a client that could be wrong about somebody's money.
//
// **No proficiency, no tier, no per-week score, and no ✓ on a good week.** The
// ledger is the most tempting place in the whole product to leak the answer key
// — twenty-five coins next to a week's name IS the tier, spelled out — so a row
// says what it was for and what it was worth, in the city's own words, and the
// player draws their own conclusions. That is the same contract the room runs
// on, and it does not stop at the café door.
import { useEffect, useState } from "react";
import { api } from "@/framework/api";
import { useEconomyStore } from "@/framework/economy/economyStore";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import type { CoinTransaction } from "@/framework/api";

/** The ledger's machine codes, in the city's words. */
const REASONS: Record<string, string> = {
  ACTIVITY_COMPLETE: "a week's work",
  BADGE_AWARD: "an award",
  SHOP_PURCHASE: "spent at the shop",
  STARTER_GRANT: "opening balance",
  ADMIN_GRANT: "a deposit",
};

export function BankPanel({ onClose }: { onClose: () => void }) {
  const coins = useEconomyStore((s) => s.coinBalance);
  const lifetime = useEconomyStore((s) => s.lifetimeCoins);
  const applyWallet = useEconomyStore((s) => s.applyWallet);
  const [ledger, setLedger] = useState<CoinTransaction[] | null>(null);
  const [reachable, setReachable] = useState(true);

  useEffect(() => {
    let live = true;
    void Promise.all([api.getWallet(), api.getWalletTransactions(25)])
      .then(([wallet, history]) => {
        if (!live) return;
        applyWallet(wallet);
        setLedger(history.transactions);
      })
      .catch(() => {
        if (live) setReachable(false);
      });
    return () => {
      live = false;
    };
  }, [applyWallet]);

  return (
    <Modal onClose={onClose} width="md">
      <h2 className="font-display text-xl font-semibold text-gold">The Bank</h2>
      <p className="mt-1 text-sm text-muted">Everything you have earned in CEO City.</p>

      <div className="mt-5 flex items-baseline gap-3 rounded-xl border border-line/70 bg-surface-2/50 px-5 py-4">
        <Icon name="coin" className="h-6 w-6 text-coin" />
        <span className="font-display text-3xl tabular-nums text-text">
          {coins === null ? "—" : coins}
        </span>
        {lifetime !== null && (
          <span className="ml-auto text-xs uppercase tracking-widest text-muted">
            {lifetime} earned in all
          </span>
        )}
      </div>

      <h3 className="mt-6 text-xs uppercase tracking-widest text-muted">Recent</h3>
      {!reachable ? (
        <p className="mt-3 text-sm text-muted">
          The counter is closed for the moment. Your balance is safe — it is kept here, not in this
          browser.
        </p>
      ) : ledger === null ? (
        <p className="mt-3 text-sm text-muted">Looking it up…</p>
      ) : ledger.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nothing yet. Go and run something.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line/50">
          {ledger.map((row, i) => (
            <li key={row.id || i} className="flex items-baseline gap-3 py-2.5 text-sm">
              <span className="text-text">{REASONS[row.reason] ?? "an adjustment"}</span>
              {row.refId && (
                <span className="truncate text-xs text-muted" title={row.refId}>
                  {row.refId}
                </span>
              )}
              <span
                className={`ml-auto tabular-nums ${row.amount < 0 ? "text-muted" : "text-coin"}`}
              >
                {row.amount > 0 ? `+${row.amount}` : row.amount}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

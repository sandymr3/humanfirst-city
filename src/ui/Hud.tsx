import { useEffect, useState } from "react";
import { useAuth } from "@/framework/auth/AuthProvider";
import { signOutUser } from "@/framework/auth/firebase";
import { useEconomyStore } from "@/framework/economy/economyStore";
import { events } from "@/framework/events";
import { useWorldStore } from "@/world/worldStore";
import { useCountUp } from "./useCountUp";
import { audio } from "@/framework/audio/audioManager";
import { Icon } from "./Icon";

// Persistent minimal HUD (PRD §9.1). Coin balance is server-authoritative; until
// the economy endpoints land (§21 BE-1) it shows "—" — never fake data. The
// count-up tween and +N floater only ever animate between real server values.
export function Hud() {
  const { user, configured } = useAuth();
  const coins = useEconomyStore((s) => s.coinBalance);
  const displayCoins = useCountUp(coins);
  const [floater, setFloater] = useState<{ id: number; amount: number } | null>(null);
  const [soundOn, setSoundOn] = useState(audio.isEnabled());
  // A panel is open (inputLocked) while the result modal covers the screen.
  const panelOpen = useWorldStore((s) => s.inputLocked);
  const initial = (user?.displayName || user?.email || "?").charAt(0).toUpperCase();

  // "+N" floater on real earnings (server's coinsEarned, not a client guess).
  useEffect(
    () =>
      // The tick is the same in every venue, silent-tier included: identical in
      // presentation at 5 and at 25, which is what §11 asks for — the number
      // differs, the fanfare never does.
      events.on("activity_completed", ({ response: r }) => {
        // Every venue's submit moves the balance, so the HUD takes it from the
        // response rather than from whichever screen happened to be open.
        useEconomyStore.getState().applyCoinBalance(r.coinBalance);
        if (typeof r.coinsEarned === "number" && r.coinsEarned > 0) {
          setFloater({ id: Date.now(), amount: r.coinsEarned });
        }
      }),
    [],
  );

  useEffect(() => audio.subscribe(setSoundOn), []);

  // Earnings arrive while the result modal is still up, so hold the floater
  // until it closes — otherwise it would animate and expire behind the panel.
  useEffect(() => {
    if (!floater || panelOpen) return;
    const { id } = floater;
    const t = window.setTimeout(() => setFloater((cur) => (cur?.id === id ? null : cur)), 1600);
    return () => window.clearTimeout(t);
  }, [floater, panelOpen]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* Top-left: avatar chip */}
      <div className="pointer-events-auto absolute left-4 top-4 flex items-center gap-2 rounded-full border border-line/70 bg-surface/80 py-1 pl-1 pr-3 backdrop-blur">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-gold font-semibold text-ink">
          {initial}
        </div>
        <span className="max-w-[140px] truncate text-sm text-text">
          {user?.displayName || user?.email || "Player"}
        </span>
      </div>

      {/* Top-right: coins + logout */}
      <div className="pointer-events-auto absolute right-4 top-4 flex items-center gap-2">
        <div className="relative">
          <div
            key={coins ?? "empty"}
            className="flex animate-pop-in items-center gap-1.5 rounded-full border border-line/70 bg-surface/80 px-3 py-1.5 backdrop-blur"
            title={coins === null ? "Your wallet isn't connected yet" : "Coins"}
          >
            <Icon name="coin" className="h-4 w-4 text-coin" />
            <span className="tabular-nums text-sm text-text">
              {displayCoins === null ? "—" : displayCoins}
            </span>
          </div>
          {floater && !panelOpen && (
            <span
              key={floater.id}
              className="absolute -bottom-1 right-2 animate-float-up text-sm font-semibold text-coin"
            >
              +{floater.amount}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            const on = audio.toggle();
            if (on) audio.play("ui_click"); // confirm it works the moment it's on
          }}
          className="grid h-9 w-9 place-items-center rounded-full border border-line/70 bg-surface/80 text-muted backdrop-blur transition hover:text-text"
          aria-label={soundOn ? "Mute sound" : "Unmute sound"}
          aria-pressed={soundOn}
          title={soundOn ? "Sound on" : "Sound off"}
        >
          <Icon name={soundOn ? "audio-on" : "audio-off"} className="h-4 w-4" />
        </button>
        {configured && (
          <button
            onClick={() => void signOutUser()}
            className="rounded-full border border-line/70 bg-surface/80 px-3 py-1.5 text-sm text-muted backdrop-blur hover:text-text"
          >
            Log out
          </button>
        )}
      </div>
    </div>
  );
}

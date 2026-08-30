// Toast lane — the first consumer of the event bus's `toast` channel, plus a
// gold variant for easter-egg discoveries. Max 3 stacked, auto-dismissed.
import { useEffect, useState } from "react";
import { events, type ToastKind } from "@/framework/events";
import { useEggStore } from "@/framework/eggStore";
import { EGG_COUNT } from "@/lib/eggs";
import { Icon } from "./Icon";
import { audio } from "@/framework/audio/audioManager";

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind | "egg";
}

let nextToastId = 1;

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const push = (message: string, kind: ToastItem["kind"]) => {
      // A repeated connectivity notice — several beat-commits retrying in the
      // same second is the case this exists for — must read as one thing still
      // true, not as three copies of itself stacking up. Skip the append (and
      // its own dismiss timer) when an identical toast is already showing.
      let id: number | null = null;
      setToasts((cur) => {
        if (cur.some((t) => t.message === message && t.kind === kind)) return cur;
        id = nextToastId++;
        return [...cur.slice(-2), { id, message, kind }];
      });
      if (id !== null) {
        window.setTimeout(() => setToasts((cur) => cur.filter((t) => t.id !== id)), 3500);
      }
    };
    const offToast = events.on("toast", ({ message, kind }) => {
      audio.play(kind === "error" ? "ui_error" : "ui_confirm");
      push(message, kind);
    });
    const offEgg = events.on("egg_found", ({ title }) => {
      audio.play("jingle_badge", { volume: 0.8 });
      const found = useEggStore.getState().found.length;
      push(`Easter egg found — ${title} (${found}/${EGG_COUNT})`, "egg");
    });
    return () => {
      offToast();
      offEgg();
    };
  }, []);

  if (toasts.length === 0) return null;

  const styles: Record<ToastItem["kind"], string> = {
    info: "border-line/70 bg-surface/90 text-text",
    success: "border-success/50 bg-surface/90 text-success",
    error: "border-danger/50 bg-surface/90 text-danger",
    egg: "border-gold/70 bg-surface/95 text-gold shadow-[0_0_24px_rgba(226,190,120,0.25)]",
  };

  return (
    <div className="pointer-events-none absolute left-1/2 top-16 z-40 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-slide-up rounded-full border px-4 py-2 text-sm shadow-lg backdrop-blur ${styles[t.kind]}`}
        >
          {t.kind === "egg" && <Icon name="diamond" className="mr-1.5 h-3.5 w-3.5" />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

import { useEffect, useState } from "react";
import type { InteriorProps } from "@/framework/building/manifest";
import { CafeCanvas } from "./CafeCanvas";
import { Dialogue } from "./Dialogue";
import { openDialogue, resetCafeState, useCafeStore } from "./cafeStore";

/** Focused café mode: the blueprint question cloud is the only interaction surface. */
export default function CafeInterior({ onExit }: InteriorProps) {
  const [ready, setReady] = useState(false);
  const dialogue = useCafeStore((state) => state.dialogue);

  useEffect(() => {
    resetCafeState();
    const timer = window.setTimeout(() => openDialogue("seed"), 250);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="pointer-events-none absolute inset-0 z-20" aria-label="Blueprint questions">
      <CafeCanvas onReady={() => setReady(true)} onError={onExit} />
      {!ready && <p className="sr-only" role="status">Loading the blueprint questions</p>}
      <Dialogue />
      {!dialogue && ready && (
        <p className="sr-only" role="status">The blueprint questions are complete.</p>
      )}
    </main>
  );
}

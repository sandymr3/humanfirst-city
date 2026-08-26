import { useCallback, useEffect, useRef, useState } from "react";
import { CityCanvas } from "@/world/CityCanvas";
import { VENUES, type CityBuilding } from "@/world/cityMap";
import { useWorldStore } from "@/world/worldStore";
import { events } from "@/framework/events";
import { BuildingGate } from "@/framework/building/BuildingGate";
import { getBuildingManifest } from "@/framework/building/registry";
import { useEggStore } from "@/framework/eggStore";
import { EGG_COUNT, KONAMI, konamiStep } from "@/lib/eggs";
import { audio } from "@/framework/audio/audioManager";
import { Modal } from "./Modal";
import { Hud } from "./Hud";
import { Toaster } from "./Toaster";
import { Celebration } from "./Celebration";
import { TrophyHall } from "./TrophyHall";
import { ActivityListPanel } from "@/activities/ActivityListPanel";
import { EnterCity } from "./EnterCity";
import { hydrateCityState } from "@/framework/city/cityState";
import { api } from "@/framework/api";
import { useEconomyStore } from "@/framework/economy/economyStore";
import { BankPanel } from "./BankPanel";
import { trackIsDue } from "@/framework/city/track";
import { PlayerShell } from "@/activities/PlayerShell";
import { MaisonPanel } from "@/buildings/fashion_brand/MaisonPanel";
import type { LevelActivity } from "@/framework/api/schemas";
import type { VenueKind } from "@/world/cityMap";

type WorldPanel = "billboard" | "plaque";

/** Kinds with a panel of their own; everything else falls back to InfoPanel. */
const PANELLED_KINDS: ReadonlySet<VenueKind> = new Set<VenueKind>([
  "competency",
  "trophy",
  "scenario",
  "bank",
]);

export function CityScreen() {
  const nearVenueId = useWorldStore((s) => s.nearVenueId);
  const setInputLocked = useWorldStore((s) => s.setInputLocked);
  const setInteriorOpen = useWorldStore((s) => s.setInteriorOpen);
  const [openVenue, setOpenVenue] = useState<CityBuilding | null>(null);
  const [playing, setPlaying] = useState<LevelActivity | null>(null);
  const [worldPanel, setWorldPanel] = useState<WorldPanel | null>(null);
  const [worldReady, setWorldReady] = useState(false);
  const [loadPct, setLoadPct] = useState(0);
  const konamiRef = useRef(0);
  // The level question. `null` until the city document has been read, so a
  // player who answered on another device is never asked twice.
  const [askTrack, setAskTrack] = useState<boolean | null>(null);

  const nearVenue = nearVenueId ? (VENUES.find((v) => v.id === nearVenueId) ?? null) : null;
  const panelOpen = openVenue !== null || playing !== null || worldPanel !== null;

  // A venue with a registered building module gets a real walkable interior;
  // everything else keeps the framework's overlay panels (PRD §7.2).
  const interior = openVenue ? getBuildingManifest(openVenue.id) : null;
  const inInterior = interior?.interior != null && !playing;

  const enterVenue = useCallback((v: CityBuilding) => {
    audio.play("ui_open");
    setOpenVenue(v);
    events.emit("venue_opened", v.id); // the world pops the building in response
  }, []);

  // The city document is read once, on arrival. The track lives in it, so the
  // gate question waits for it rather than asking on top of an answer that is
  // already on its way.
  useEffect(() => {
    let live = true;
    void hydrateCityState().then(() => {
      if (live) setAskTrack(trackIsDue());
    });
    // The first authed call. It performs the starter grant server-side, which is
    // why the HUD can show a real number from the first second rather than an em
    // dash that fills in after the first activity.
    void api
      .getMe()
      .then((me) => {
        if (live) useEconomyStore.getState().applyWallet(me.wallet);
      })
      .catch(() => {
        // No wallet is a wallet we do not know about, and the HUD says so.
      });
    return () => {
      live = false;
    };
  }, []);

  // The gate holds the street the same way a panel does: nothing walks, nothing
  // is clickable behind it, and the question cannot be dismissed unanswered.
  useEffect(() => {
    setInputLocked(panelOpen || askTrack !== false);
  }, [panelOpen, askTrack, setInputLocked]);

  useEffect(() => {
    setInteriorOpen(inInterior);
    return () => setInteriorOpen(false);
  }, [inInterior, setInteriorOpen]);

  // World-side prop clicks (billboard headlines, founders' plaque) open DOM panels.
  useEffect(() => events.on("world_interact", ({ kind }) => setWorldPanel(kind)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // The code. Tracked only while roaming the streets — some codes never die.
      if (!panelOpen) {
        konamiRef.current = konamiStep(konamiRef.current, e.key.toLowerCase());
        if (konamiRef.current === KONAMI.length) {
          konamiRef.current = 0;
          useEggStore.getState().markFound("konami");
          events.emit("konami", null); // the world throws the block party
        }
      }
      if (e.key === "Escape") {
        // An interior owns its own Escape (it has to work standalone per the
        // InteriorProps contract) — don't close it twice and double the sound.
        if (playing) setPlaying(null);
        else if (inInterior) return;
        else if (openVenue) setOpenVenue(null);
        else if (worldPanel) setWorldPanel(null);
        return;
      }
      if ((e.key === "e" || e.key === "E" || e.key === "Enter") && !panelOpen && nearVenue) {
        enterVenue(nearVenue);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nearVenue, panelOpen, openVenue, playing, worldPanel, inInterior, enterVenue]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-ink">
      <CityCanvas onReady={() => setWorldReady(true)} onProgress={setLoadPct} />
      {!worldReady && <CityLoader pct={loadPct} />}

      {/* Asked once, at the gate, over a city that has finished loading behind
          it — the first thing a player sees is the place, not a form. */}
      {worldReady && askTrack === true && <EnterCity onAnswered={() => setAskTrack(false)} />}
      {/* An interior owns the whole screen and brings its own chrome, so the
          street's HUD and control hint step aside rather than sit on top of it.
          Toasts and celebrations stay — they are about the player, not the view. */}
      {!inInterior && <Hud />}
      <Toaster />
      <Celebration />
      {!inInterior && <ControlsHint />}

      {nearVenue && !panelOpen && (
        <div className="pointer-events-none absolute bottom-10 left-1/2 z-10 -translate-x-1/2 animate-slide-up">
          <button
            onClick={() => enterVenue(nearVenue)}
            className="pointer-events-auto rounded-full border border-gold/60 bg-surface/90 px-5 py-2.5 text-sm text-text shadow-lg backdrop-blur"
          >
            Enter <span className="font-semibold text-gold">{nearVenue.displayName}</span>
            <span className="ml-2 rounded bg-line/50 px-1.5 py-0.5 text-xs text-muted">E</span>
          </button>
        </div>
      )}

      {inInterior && interior && (
        <BuildingGate manifest={interior} onExit={() => setOpenVenue(null)} />
      )}

      {!inInterior && openVenue && !playing && openVenue.kind === "competency" && (
        <ActivityListPanel
          venue={openVenue}
          onClose={() => setOpenVenue(null)}
          onPlay={(a) => setPlaying(a)}
        />
      )}
      {!inInterior && openVenue && !playing && openVenue.kind === "trophy" && (
        <TrophyHall onClose={() => setOpenVenue(null)} />
      )}
      {/* The bank is where the money is, not another level list. */}
      {!inInterior && openVenue && !playing && openVenue.kind === "bank" && (
        <BankPanel onClose={() => setOpenVenue(null)} />
      )}
      {/* A scenario venue owns its own panel — a storyline, not a level list —
          until it registers an interior, at which point the room replaces it. */}
      {!inInterior && openVenue && !playing && openVenue.kind === "scenario" && (
        <MaisonPanel
          venue={openVenue}
          onClose={() => setOpenVenue(null)}
          onPlay={(a) => setPlaying(a)}
        />
      )}
      {!inInterior && openVenue && !playing && !PANELLED_KINDS.has(openVenue.kind) && (
        <InfoPanel venue={openVenue} onClose={() => setOpenVenue(null)} />
      )}

      {playing && openVenue && (
        <PlayerShell
          activity={playing}
          venueName={openVenue.displayName}
          onClose={() => setPlaying(null)}
        />
      )}

      {worldPanel === "billboard" && <BillboardPanel onClose={() => setWorldPanel(null)} />}
      {worldPanel === "plaque" && <FoundersPanel onClose={() => setWorldPanel(null)} />}
    </div>
  );
}

/** Boot screen with real asset-load progress (PRD §12.3 asks for it, and the
 * splash otherwise sits blank through the whole load). */
function CityLoader({ pct }: { pct: number }) {
  const shown = Math.round(Math.min(1, Math.max(0, pct)) * 100);
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-ink">
      <div className="w-[min(20rem,80vw)] text-center">
        <h1 className="font-display text-3xl font-semibold tracking-wide text-gold">CEO CITY</h1>
        <p className="mt-2 text-sm text-muted">
          {shown < 100 ? "Laying out the streets…" : "Opening the gates…"}
        </p>
        <div
          className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={shown}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Loading the city"
        >
          <div
            className="h-full rounded-full bg-gold transition-[width] duration-200 ease-out"
            style={{ width: `${shown}%` }}
          />
        </div>
        <p className="mt-2 text-xs tabular-nums text-muted">{shown}%</p>
      </div>
    </div>
  );
}

// City billboard headlines — half flavor, half genuinely useful training tips.
const CITY_TIPS = [
  "DOWNTOWN GAZETTE: Coin balances are server-verified. No funny business, ever.",
  "TRANSIT NOTICE: Crosswalks lead to venue doors. Follow the gold markers.",
  "MARKET WATCH: Needs before wants — the Bank's first lesson is free.",
  "CITY WIRE: Trophy Hall shelves polished daily. Bring badges.",
  "CLASSIFIEDS: Ice cream cart seeks apprentice who can price a scoop profitably.",
  "WEATHER: Clouds drifting northeast. The pigeons remain unbothered.",
  "TECH PARK BULLETIN: The rooftop pool is strictly for cooling servers. Sure.",
  "COMMUNITY: Try wishing at the civic fountain. Five wishes tell a story.",
];

function BillboardPanel({ onClose }: { onClose: () => void }) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * CITY_TIPS.length));
  return (
    <Modal onClose={onClose} width="sm" className="text-center">
      <p className="text-xs uppercase tracking-widest text-muted">City Billboard</p>
      <h2 className="mt-2 font-display text-xl font-semibold text-gold">Today's headline</h2>
      <p className="mt-4 min-h-[3.5rem] text-sm text-text">{CITY_TIPS[idx]}</p>
      <div className="mt-5 flex justify-center gap-2">
        <button
          onClick={() => setIdx((i) => (i + 1) % CITY_TIPS.length)}
          className="rounded-lg border border-line bg-surface-2 px-4 py-2 text-sm text-text hover:brightness-110"
        >
          Next headline
        </button>
        <button
          onClick={onClose}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-ink hover:brightness-110"
        >
          Back to the street
        </button>
      </div>
    </Modal>
  );
}

function FoundersPanel({ onClose }: { onClose: () => void }) {
  const found = useEggStore((s) => s.found);
  return (
    <Modal onClose={onClose} width="sm" className="text-center">
      <p className="text-xs uppercase tracking-widest text-muted">Founders' Plaque</p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-gold">CEO CITY — EST. 2026</h2>
      <p className="mt-4 text-sm text-muted">
        Raised brick by brick for the WarRoom Academy, so learning a competency feels like walking
        into a building, not opening a form.
      </p>
      <p className="mt-3 text-xs text-muted">
        Sprite art from the wonderful CC0 isometric packs by Kenney (kenney.nl) — thank you.
      </p>
      <p className="mt-4 text-xs text-gold/80">
        Secrets discovered: {found.length}/{EGG_COUNT} — keep exploring.
      </p>
      <button
        onClick={onClose}
        className="mt-5 rounded-lg bg-gold px-5 py-2 font-medium text-ink hover:brightness-110"
      >
        Tip your hat
      </button>
    </Modal>
  );
}

function InfoPanel({ venue, onClose }: { venue: CityBuilding; onClose: () => void }) {
  const copy: Record<string, { title: string; body: string }> = {
    shop: {
      title: "The Shop",
      body: "Racks of hats, jackets and questionable sunglasses for your future self. The till opens once the economy endpoints land — window shopping is free.",
    },
    trophy: {
      title: "Trophy Hall",
      body: "Your earned badges will stand on these shelves. Coming in a later phase.",
    },
    locked: {
      title: "Custom venue",
      body: "Paper over the windows, permits on the door. A client-configurable venue — ships disabled until a client is set up.",
    },
    // No `cafe` entry: the Café is a registered building now and opens its own
    // walkable interior instead of a panel (framework/building/registry.ts).
  };
  const c = copy[venue.kind] ?? { title: venue.displayName, body: "Coming soon." };
  return (
    <Modal onClose={onClose} width="sm" className="text-center">
      <h2 className="font-display text-2xl font-semibold text-gold">{c.title}</h2>
      <p className="mt-3 text-sm text-muted">{c.body}</p>
      <button
        onClick={onClose}
        className="mt-5 rounded-lg bg-gold px-5 py-2 font-medium text-ink hover:brightness-110"
      >
        Got it
      </button>
    </Modal>
  );
}

function ControlsHint() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-lg border border-line/60 bg-surface/70 px-3 py-2 text-xs text-muted backdrop-blur">
      <span className="text-text">WASD</span> / <span className="text-text">click</span> to move ·{" "}
      <span className="text-text">E</span> to enter
    </div>
  );
}

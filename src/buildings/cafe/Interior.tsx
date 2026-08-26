// The Café interior — the DOM half. Owns the contextual prompts, the hotspot
// panel, the station list, the live region and the keyboard, and hosts
// <CafeCanvas> for the room itself. Default-exported because the framework
// mounts it through `lazy()` (framework/building/BuildingGate.tsx).
//
// The prompts here deliberately read like the city's "Enter <venue>" pill — same
// shape, same key badge — so stepping indoors doesn't change the vocabulary.
import { useCallback, useEffect, useState } from "react";
import type { InteriorProps } from "@/framework/building/manifest";
import { audio } from "@/framework/audio/audioManager";
import { Icon } from "@/ui/Icon";
import { Modal } from "@/ui/Modal";
import { CafeCanvas } from "./CafeCanvas";
import { armBeacon, hydrateSession, setSessionTrack } from "@/framework/session/sync";
import { trackOrDefault } from "@/framework/city/track";

/** How long the bell takes to go after a `wait_for` opens. */
const ARRIVAL_MS = 2200;
/** The beat in which whoever is asking finishes what they were doing first. */
const BEAT_MS = 900;
import {
  arrive,
  closeHotspot,
  openDialogue,
  openReport,
  flushNow,
  openHotspot,
  resetCafeState,
  speakTo,
  stopSpeaking,
  toggleFlap,
  useCafeStore,
} from "./cafeStore";
import { GATES, HOTSPOTS, zoneAt } from "./room";
import { atAnchors, castById, castFor, guideWithCast, type CastId } from "./cast";
import { hotspotBody } from "./world";
import { Tracker } from "./Tracker";
import { Dialogue } from "./Dialogue";
import { currentObjective, seasonIsOver, type Progress } from "./missionRunner";
import { BUILDING_ID } from "./session";
import { Report } from "./Report";
import type { Beat } from "./missions";
import { HOTSPOTS as ALL_SPOTS, STATIONS as ALL_STATIONS } from "./room";

/**
 * The envelope is at the pass-through, where the rota usually is, and only after
 * the ninth week has closed (PRD §13). It replaces the hatch's own panel rather
 * than sitting beside it: there is one thing propped there and it is the letter.
 */
function letterIsAt(hotspotId: string | null, progress: Progress): boolean {
  return hotspotId === "ht_pass" && seasonIsOver(progress);
}

export default function CafeInterior({ manifest, onExit }: InteriorProps) {
  const [ready, setReady] = useState(false);
  const charCell = useCafeStore((s) => s.charCell);
  const nearExit = useCafeStore((s) => s.nearExit);
  const nearGateId = useCafeStore((s) => s.nearGateId);
  const nearHotspotId = useCafeStore((s) => s.nearHotspotId);
  const nearCastId = useCafeStore((s) => s.nearCastId);
  const openHotspotId = useCafeStore((s) => s.openHotspotId);
  const speakingToId = useCafeStore((s) => s.speakingToId);
  const spokenLine = useCafeStore((s) => s.spokenLine);
  const flapOpen = useCafeStore((s) => s.flapOpen);
  const announcement = useCafeStore((s) => s.announcement);
  const world = useCafeStore((s) => s.world);
  const progress = useCafeStore((s) => s.progress);
  const visitors = useCafeStore((s) => s.visitors);

  // Every visit starts at the door with the flap down, which keeps the store and
  // the canvas's own gate set in step (the canvas boots with no gates open).
  //
  // Priya used to ask the level question here, before the first mission. The
  // city asks it at the gate now (ADR-006 §11.1) — one choice for the whole
  // city, and the room is already the right room by the time the door opens.
  //
  // The season is pulled down first. It is the one await on this path, and it
  // happens behind the door-opening line the room already shows, so a player who
  // left mid-week on another device walks back in standing where they left it.
  const [seasonIn, setSeasonIn] = useState(false);
  useEffect(() => {
    let live = true;
    setSessionTrack(BUILDING_ID, trackOrDefault());
    void hydrateSession(BUILDING_ID).finally(() => {
      if (!live) return;
      resetCafeState();
      setSeasonIn(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const objective = currentObjective(progress);

  // A `wait_for` completes on arrival, and arrival is on a short timer rather
  // than on anything the player does. It is the one objective kind they cannot
  // make happen, so it must never be a place to get stuck (PRD §18.4).
  const waitingFor = objective?.kind === "wait_for" ? (objective.target as CastId) : null;
  useEffect(() => {
    if (!waitingFor) return;
    const t = window.setTimeout(() => arrive(waitingFor), ARRIVAL_MS);
    return () => window.clearTimeout(t);
  }, [waitingFor]);

  // A `decide` objective going live is the question arriving. The pause before
  // it is the room finishing what it was doing — never a spinner, and never
  // anything that marks out which beat came from a model (PRD §11.2).
  const dueBeat = objective?.kind === "decide" ? (objective.target as Beat) : null;
  useEffect(() => {
    if (!dueBeat) return;
    const t = window.setTimeout(() => openDialogue(dueBeat), BEAT_MS);
    return () => window.clearTimeout(t);
  }, [dueBeat]);

  const gate = nearGateId ? (GATES.find((g) => g.id === nearGateId) ?? null) : null;
  const hotspot = nearHotspotId ? (HOTSPOTS.find((h) => h.id === nearHotspotId) ?? null) : null;
  const openSpot = openHotspotId ? (HOTSPOTS.find((h) => h.id === openHotspotId) ?? null) : null;
  const person = nearCastId ? castById(nearCastId) : null;
  const speaking = speakingToId ? castById(speakingToId) : null;

  // The list is rebuilt from where people are standing, so walking to Priya
  // means walking to Priya rather than to the spot she left. Anchors are the
  // fallback for the frame or two before the canvas has reported in.
  // Derived from the store's own fields rather than from presentCast(), which
  // reads getState() and so would not re-render this list when Nadia walks in.
  const present = [...new Set([...castFor(world), ...visitors])];
  const guide = guideWithCast(atAnchors(present));
  // The list's first entry is wherever the mission is waiting (PRD §15). It is
  // also how a seasonal place like the sample bag becomes reachable at all —
  // those are kept out of the standing list on purpose.
  const waitingAt = objective
    ? (ALL_STATIONS.find((p) => p.id === objective.target) ??
      ALL_SPOTS.find((h) => h.id === objective.target))
    : undefined;
  const nav = waitingAt
    ? [
        {
          id: waitingAt.id,
          label: "label" in waitingAt ? waitingAt.label : waitingAt.guideLabel,
          cell: waitingAt.cell,
        },
        ...guide.filter((p) => p.id !== waitingAt.id),
      ]
    : guide;

  /**
   * Leaving flushes the season first. "Leaving the building" and "closing the
   * laptop" have to have the same consequence, so the same flush is wired to
   * pagehide and to the tab going hidden — those are the paths where nothing
   * else is going to run.
   */
  const leaveNow = useCallback(() => {
    flushNow();
    onExit();
  }, [onExit]);

  /**
   * One prompt slot, four things competing for it. The door wins when you are
   * standing in it — leaving must never be harder than anything else in the room.
   * Then the flap, which has to beat the person behind it: Priya works at the
   * machine one cell from the hinge, and if she won there you could never lower
   * the flap from the staff side. Then people, because someone standing in front
   * of you outranks a noticeboard. Then whatever you can read.
   *
   * Reads live state rather than closing over props, so the keyboard and the
   * button can share it.
   */
  const act = useCallback(() => {
    const s = useCafeStore.getState();
    if (s.nearExit) {
      audio.play("ui_close");
      leaveNow();
    } else if (s.nearGateId) {
      toggleFlap();
    } else if (s.nearCastId) {
      speakTo(s.nearCastId);
    } else if (letterIsAt(s.nearHotspotId, s.progress)) {
      openReport();
    } else if (s.nearHotspotId) {
      openHotspot(s.nearHotspotId);
    }
  }, [leaveNow]);

  useEffect(() => {
    const flush = () => flushNow();
    window.addEventListener("pagehide", flush);
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
      // Unmounting is also leaving — the framework can take the interior away
      // without going through the door.
      flush();
    };
  }, []);

  // The beacon token is minted while the player is still in the room. Minting it
  // on the way out would put a round trip on the one path that must not have one,
  // and it expires in five minutes, so a long season re-arms as it goes.
  useEffect(() => {
    if (!seasonIn) return;
    void armBeacon(BUILDING_ID);
  }, [seasonIn, progress.missionOrder]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // A panel closes first; only then does Escape mean "leave".
        const s = useCafeStore.getState();
        if (s.speakingToId) stopSpeaking();
        else if (s.openHotspotId) closeHotspot();
        else leave();
        return;
      }
      if (e.key !== "e" && e.key !== "E" && e.key !== "Enter") return;
      if (useCafeStore.getState().inputLocked) return;
      act();
    }
    function leave() {
      audio.play("ui_close");
      leaveNow();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leaveNow, act]);

  const prompt = nearExit
    ? "leave the café"
    : gate
      ? flapOpen
        ? gate.closePrompt
        : gate.openPrompt
      : person
        ? person.name
        : letterIsAt(nearHotspotId, progress)
          ? "read the letter"
          : (hotspot?.prompt ?? null);

  return (
    // Transparent, and click-through by default. The room is drawn into the
    // city's own canvas underneath this layer, so an opaque background would
    // hide it and a solid hit area would swallow every click meant for it.
    // Interactive children opt back in with `pointer-events-auto`.
    <div className="pointer-events-none absolute inset-0 z-20 animate-fade-in">
      {/* If the room cannot be built there is nothing to stand in, so we go back
          to the street rather than hold the door-opening line forever. The canvas
          has already given the city back by the time this fires. */}
      <CafeCanvas onReady={() => setReady(true)} onError={onExit} />

      {ready && seasonIn && <Tracker />}
      <Dialogue />
      <Report />

      {(!ready || !seasonIn) && (
        <div className="absolute inset-0 grid place-items-center bg-ink">
          <p className="text-sm text-muted">Pushing the door open…</p>
        </div>
      )}

      {/* Where you are, in the room's own words. */}
      <div className="pointer-events-none absolute left-5 top-5 z-10">
        <p className="font-display text-lg font-semibold text-gold">{manifest.displayName}</p>
        <p className="text-xs uppercase tracking-widest text-muted">{zoneAt(charCell).label}</p>
      </div>

      {/* The door is never blocked — you can always go, from anywhere. */}
      <button
        onClick={() => {
          audio.play("ui_close");
          leaveNow();
        }}
        className="pointer-events-auto absolute right-5 top-5 z-10 flex items-center gap-2 rounded-full border border-line/70 bg-surface/80 px-4 py-2 text-sm text-text backdrop-blur hover:brightness-110"
      >
        <Icon name="home" className="h-4 w-4" />
        Back to the street
        <span className="rounded bg-line/50 px-1.5 py-0.5 text-xs text-muted">Esc</span>
      </button>

      {prompt && !openSpot && !speaking && (
        <div className="pointer-events-none absolute bottom-10 left-1/2 z-10 -translate-x-1/2 animate-slide-up">
          <button
            onClick={act}
            className="pointer-events-auto rounded-full border border-gold/60 bg-surface/90 px-5 py-2.5 text-sm text-text shadow-lg backdrop-blur"
          >
            <span className="font-semibold text-gold">{prompt}</span>
            <span className="ml-2 rounded bg-line/50 px-1.5 py-0.5 text-xs text-muted">E</span>
          </button>
        </div>
      )}

      {/* Guided navigation (PRD §14.2): cross the room without steering. The
          room's own words, never "object_04". */}
      <nav
        aria-label="Places in the café"
        className="pointer-events-auto absolute bottom-4 left-5 z-10 flex flex-wrap items-center gap-1.5"
      >
        <span className="mr-1 text-xs uppercase tracking-widest text-muted">go to</span>
        {nav.map((s) => (
          <button
            key={s.id}
            onClick={() => useCafeStore.getState().setWalkTo(s.cell)}
            className="rounded-full border border-line/70 bg-surface/70 px-2.5 py-1 text-xs text-muted backdrop-blur hover:border-gold/60 hover:text-text"
          >
            {s.label}
          </button>
        ))}
      </nav>

      <p className="pointer-events-none absolute bottom-4 right-5 z-10 text-xs text-muted">
        WASD or click to move · E to interact
      </p>

      {openSpot && (
        <div className="pointer-events-auto">
          <Modal onClose={closeHotspot} width="sm">
            <h2 className="font-display text-xl font-semibold text-gold">{openSpot.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {hotspotBody(openSpot.id, world)}
            </p>
            <button
              onClick={closeHotspot}
              className="mt-5 rounded-lg bg-gold px-5 py-2 font-medium text-ink hover:brightness-110"
            >
              Back to the room
            </button>
          </Modal>
        </div>
      )}

      {/* Somebody talking to you. Deliberately not the hotspot panel's shape: a
          line of speech is a person, not an exhibit, so it sits low and narrow
          near where they are standing rather than taking over the screen. */}
      {speaking && (
        <div className="pointer-events-auto absolute bottom-16 left-1/2 z-20 w-[min(30rem,90vw)] -translate-x-1/2 animate-slide-up">
          <div className="rounded-2xl border border-line/70 bg-surface/95 p-5 shadow-xl backdrop-blur">
            <p className="text-xs uppercase tracking-widest text-gold">
              {speaking.name}
              <span className="ml-2 normal-case tracking-normal text-muted">{speaking.role}</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-text">{spokenLine}</p>
            <button
              onClick={stopSpeaking}
              className="mt-4 rounded-lg border border-line/70 px-4 py-1.5 text-xs text-muted hover:border-gold/60 hover:text-text"
            >
              Leave it there
              <span className="ml-2 rounded bg-line/50 px-1.5 py-0.5 text-[10px]">Esc</span>
            </button>
          </div>
        </div>
      )}

      {/* A change a sighted player sees must reach everyone else too. The city has
          no live region of its own yet, so the Café carries one. */}
      <p aria-live="polite" className="sr-only">
        {announcement.text}
      </p>
    </div>
  );
}

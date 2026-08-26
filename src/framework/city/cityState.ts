// The city-wide session document: the track, the FTUE flags, where they were.
//
// Small, and the only thing in it that matters today is the track — but it is
// the difference between a player who answers the level question once and a
// player who answers it again on every device they own.
//
// Written last-write-wins on an explicit `rev`. A 409 is not an error anybody
// sees: the server hands back its current document and we adopt it, because a
// second tab having already answered is a resolution, not a conflict.
import { api } from "@/framework/api";
import { loadJson, saveJson } from "@/lib/persist";
import { activeTrack, setTrack, type Track } from "./track";

export interface CityBlob {
  track?: Track;
  ftue?: Record<string, boolean>;
  lastDistrict?: string;
  lastTile?: [number, number];
}

const MIRROR = "city.state";

interface Mirror {
  rev: number;
  blob: CityBlob;
}

const isMirror = (v: unknown): v is Mirror =>
  typeof v === "object" && v !== null && typeof (v as Mirror).rev === "number";

let rev = 0;
let blob: CityBlob = {};
let hydrated = false;

function readMirror(): void {
  const m = loadJson<Mirror>(MIRROR, isMirror);
  if (m) {
    rev = m.rev;
    blob = m.blob ?? {};
  }
}

function writeMirror(): void {
  saveJson(MIRROR, { rev, blob });
}

const isTrack = (v: unknown): v is Track => v === "SCA" || v === "SCB";

/**
 * Pull the city document once, on boot.
 *
 * The server wins where it has an answer, because it is the copy that followed
 * the player here. Where it has none and this browser does, the local answer is
 * pushed up — that is the offline session catching up, and it is why a backend
 * outage costs nothing permanent.
 *
 * Never throws. A city you cannot reach is a city you can still walk around.
 */
export async function hydrateCityState(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  readMirror();

  try {
    const envelope = await api.getCityState();
    rev = envelope.rev;
    const server = (envelope.blob ?? {}) as CityBlob;
    blob = { ...blob, ...server };
    writeMirror();

    if (isTrack(server.track)) {
      setTrack(server.track);
      return;
    }
    // The server has no track and this browser does: an answer given while the
    // backend was unreachable, or before this document existed.
    const local = activeTrack();
    if (local) await push({ track: local });
  } catch {
    // Offline. The mirror already holds whatever we knew.
  }
}

/** The track, remembered locally and pushed up. Safe to call before hydration. */
export async function chooseTrack(track: Track): Promise<void> {
  setTrack(track);
  await push({ track });
}

/** Record an FTUE flag. Coalesced into the same document. */
export async function markFtue(flag: string): Promise<void> {
  await push({ ftue: { ...(blob.ftue ?? {}), [flag]: true } });
}

async function push(patch: CityBlob): Promise<void> {
  blob = { ...blob, ...patch };
  writeMirror();
  try {
    const res = await api.putCityState(rev, blob);
    if (res.ok) {
      rev = res.rev;
    } else {
      // Somebody else wrote first. Take their document, re-apply our patch on
      // top of it, and try once — two tabs answering the same question should
      // agree rather than fight.
      rev = res.rev;
      blob = { ...((res.blob ?? {}) as CityBlob), ...patch };
      const retry = await api.putCityState(rev, blob);
      if (retry.ok) rev = retry.rev;
    }
    writeMirror();
  } catch {
    // The mirror holds it; hydrateCityState pushes it on the next good boot.
  }
}

/** Tests only. */
export function resetCityState(): void {
  rev = 0;
  blob = {};
  hydrated = false;
}

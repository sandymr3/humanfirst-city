// The Café's world state — ten keys, and every one of them maps to something the
// player can point at (PRD §12).
//
// Two rules hold this file together.
//
// **It is presentation, never score.** Nothing here reaches the submitted trace.
// The room says what happened; how well it went is decided server-side from the
// path alone. If a value ever starts influencing a proficiency, the silent-tier
// contract has been broken from the inside.
//
// **Every value is a member of a closed set.** Decisions write world state, and a
// decision that writes `chalkboard: "oat-ish"` is a decision that silently stops
// rendering. The reducer drops anything it does not recognise instead of storing
// it, so a bad write is a no-op rather than a room with a hole in it — the same
// stance the backend takes on the world state it is sent.
import type { Cell } from "@/lib/pathfinding";
import { trackOrDefault, type Track } from "./track";

export const WORLD_KEYS = {
  /** The board above the counter, rewritten in Priya's hand between weeks. */
  chalkboard: [
    "base",
    "oat_asked",
    "oat",
    "oat_plus",
    "plant_full",
    "iced",
    "iced_renamed",
    "combo",
    "app",
    "direct",
    "beans_story",
  ],
  /** Marcus present or not, ambient density, how many chairs at T3 are pulled out. */
  regulars: ["full", "steady", "thin", "returning"],
  /** The drawer at week 8, and how Priya stands when there is nothing to do. */
  till: ["tight", "healthy", "strained"],
  /** Idle sets and gaze, and whether the rota has pencil on it. */
  staff: ["easy", "strained", "trusting"],
  /** Ray's truck through the glass, at your kerb or across the road. */
  truck: ["absent", "parked", "gone_rival"],
  /** The hero prop's variant, and its steam and noise cadence. */
  machine: ["old", "upgraded"],
  /** The community noticeboard by the door. */
  board: ["clean", "app_card", "direct_card"],
  /** The sack behind the counter, and the colour of the crema in the cup. */
  beans: ["good", "cheap"],
  /** The awning across the street, and whether it has a board out. */
  rival: ["none", "open", "promo"],
  /** Window light. Driven by the week rather than by anything you decide. */
  season: ["spring", "summer", "autumn", "night"],
} as const;

export type WorldKey = keyof typeof WORLD_KEYS;
export type WorldValue<K extends WorldKey> = (typeof WORLD_KEYS)[K][number];
export type World = { [K in WorldKey]: WorldValue<K> };

/** A write a decision asks for. Partial, because most beats move one thing. */
export type WorldPatch = Partial<World>;

/** Week one, before anything has been decided. */
export const OPENING_WORLD: World = {
  chalkboard: "base",
  regulars: "full",
  till: "tight",
  staff: "easy",
  truck: "absent",
  machine: "old",
  board: "clean",
  beans: "good",
  rival: "none",
  season: "spring",
};

/**
 * Week one on the track you are on. Level B opens with the rival's awning
 * already up across the road (PRD §14): the pressure is visible through the
 * glass from the first minute rather than arriving in week 18, which is the
 * difference between a season that builds to a threat and one that is run under
 * one from the start.
 */
export function openingWorldFor(track: Track): World {
  return track === "SCB" ? { ...OPENING_WORLD, rival: "open" } : { ...OPENING_WORLD };
}

const KEYS = Object.keys(WORLD_KEYS) as WorldKey[];

export function isWorldKey(key: string): key is WorldKey {
  return (KEYS as string[]).includes(key);
}

export function isLegal<K extends WorldKey>(key: K, value: string): value is WorldValue<K> {
  return (WORLD_KEYS[key] as readonly string[]).includes(value);
}

/**
 * Apply a patch, dropping anything unrecognised. Returns the same object when
 * nothing changed, so a caller can cheaply tell whether the room needs redressing
 * — and so a store write does not wake every subscriber for a no-op.
 */
export function applyPatch(world: World, patch: WorldPatch): World {
  let next: World | null = null;
  for (const [key, value] of Object.entries(patch)) {
    if (!isWorldKey(key) || typeof value !== "string") continue;
    if (!isLegal(key, value)) continue;
    if (world[key] === value) continue;
    next = next ?? { ...world };
    (next as Record<string, string>)[key] = value;
  }
  return next ?? world;
}

/** Which keys a patch would actually move. Drives what gets announced. */
export function changedKeys(world: World, patch: WorldPatch): WorldKey[] {
  return (Object.entries(patch) as [string, string][])
    .filter(([k, v]) => isWorldKey(k) && isLegal(k, v) && world[k] !== v)
    .map(([k]) => k as WorldKey);
}

// ── What a change sounds like ────────────────────────────────────────────────

/**
 * Said out loud when a key moves. A sighted player watches the board get
 * rewritten and the table fill up; everyone else gets this, and it has to carry
 * the same information and the same absence of opinion (PRD §15).
 *
 * Only the keys with a visible consequence in the room are here. `season` is
 * announced by the week transition instead, since the light changes with it.
 */
const ANNOUNCEMENTS: Partial<{ [K in WorldKey]: Partial<Record<string, string>> }> = {
  chalkboard: {
    oat_asked: "Priya has chalked a card and propped it by the till.",
    oat: "Priya has rewritten the board. Oat is on it.",
    oat_plus: "Priya has rewritten the board. Oat and almond are on it.",
    plant_full: "Priya has rewritten the board. The whole plant-milk range is on it.",
    iced: "Priya has rewritten the board. The iced drink is on it.",
    iced_renamed: "Priya has rewritten the board. The iced drink has a new name.",
    combo: "Priya has rewritten the board. There is a combo on it now.",
    app: "Priya has rewritten the board. There is a delivery logo in the corner.",
    direct: "Priya has rewritten the board. The logo is gone and there is a phone number.",
    beans_story: "Priya has rewritten the board. The roaster's name is on it now.",
  },
  regulars: {
    full: "The four-top by the window is full.",
    steady: "There are people at the four-top by the window.",
    thin: "The four-top by the window is empty.",
    returning: "Marcus is back in his chair.",
  },
  truck: {
    parked: "There is a food truck at the kerb outside.",
    gone_rival: "The food truck has moved across the road.",
    absent: "The kerb outside is clear.",
  },
  board: {
    app_card: "There is a delivery card pinned to the noticeboard.",
    direct_card: "There is a card with your own number on the noticeboard.",
    clean: "The noticeboard is clear.",
  },
  machine: { upgraded: "There is a new machine on the counter." },
  beans: {
    cheap: "There is a different sack behind the counter.",
    good: "The usual sack is back behind the counter.",
  },
  rival: {
    open: "There is a new awning across the road.",
    promo: "The place across the road has put a board out.",
  },
};

/** What to say about a change, or null when the key has no visible consequence. */
export function announcementFor<K extends WorldKey>(key: K, value: WorldValue<K>): string | null {
  return ANNOUNCEMENTS[key]?.[value as string] ?? null;
}

// ── What the room looks like ─────────────────────────────────────────────────

/**
 * The chalkboard's text, as a function of what you sell. This is §3.3's
 * "unforgettable thing": nine weeks in, the board is a physical diff of the
 * season, and it only works if it is derived rather than written down once.
 */
export function chalkboardBody(world: World): string {
  const menu: Record<WorldValue<"chalkboard">, string> = {
    base: "House blend, a flat white nobody orders, and a cortado somebody has already tried to correct the spelling of. The menu you inherited, in the last owner's shorthand.",
    oat_asked:
      "The menu you inherited, and a card propped against the till in fresh chalk: OAT MILK? SHOULD WE? Eleven ticks under it and three names in Priya's handwriting.",
    oat: "The menu you inherited, with OAT added at the bottom in a different hand. It has been there long enough now to stop looking new.",
    oat_plus:
      "The menu you inherited, with OAT and ALMOND added at the bottom. The almond has a small dot beside it that Priya has not explained.",
    plant_full:
      "Oat, almond, soy, all of it, listed down the right-hand side in the same neat capitals. Nobody walking in here has to ask.",
    iced: "The menu, and ICED at the top in a box, because it is the only thing on this board you put there on purpose.",
    iced_renamed:
      "The menu, and the iced drink at the top under its new name. The old name is still faintly there underneath if you know to look.",
    combo:
      "The menu, and a line at the bottom: COFFEE + FRIES, and a time, and an arrow pointing at the door.",
    app: "The menu, and a delivery app's logo chalked carefully into the bottom corner. Priya has drawn it very accurately, which somehow makes it worse.",
    direct:
      "The menu, and where the logo used to be there is a phone number and the words ORDER FROM US.",
    beans_story:
      "The menu, and above it now, in bigger letters than anything else, the name of the roaster and the farm.",
  };
  return menu[world.chalkboard];
}

/** The four-top, as a function of who still comes in. */
export function fourTopBody(world: World): string {
  const table: Record<WorldValue<"regulars">, string> = {
    full: "Four chairs, all of them pulled out, all of them warm. Marcus is in the one facing the window with the paper folded to the size of his hands.",
    steady:
      "Four chairs and two of them in use. Marcus has the one facing the window. The other two are pushed back in, neat, the way Priya leaves them.",
    thin: "Four chairs, all pushed in. Marcus's coat is not on the back of any of them. The varnish is worn pale where forearms have gone for years.",
    returning:
      "Four chairs, and Marcus is in his again with the paper. He has not said anything about having been away, and neither has anyone else.",
  };
  return table[world.regulars];
}

/** The street through the glass. The threat is always visible from inside. */
export function windowBody(world: World): string {
  const parts = [
    "Market Street goes on without you: the kerb, the railing, somebody's bike against it, the light coming off the shopfronts opposite.",
  ];
  if (world.truck === "parked") {
    parts.push("There is a food truck at your kerb with its hatch up and a queue of four.");
  } else if (world.truck === "gone_rival") {
    parts.push("The food truck is across the road now, outside somebody else's door.");
  }
  if (world.rival === "open") {
    parts.push("The awning opposite is new. It was a shuttered unit a fortnight ago.");
  } else if (world.rival === "promo") {
    parts.push(
      "The new place opposite has a sandwich board out on the pavement. You cannot read it from here.",
    );
  }
  return parts.join(" ");
}

/** The community board by the door. Four layers of other people's lives. */
export function noticeboardBody(world: World): string {
  const cork =
    "Cork, and four layers of other people's lives. A lost cat from a fortnight ago, a bassist wanted, two flyers for the same open mic.";
  const card: Record<WorldValue<"board">, string> = {
    clean: "Nothing on it that you did not expect to be on it.",
    app_card: "And a delivery app's promo card, pinned neatly, that you did not put there.",
    direct_card: "And a card with your own number on it, in Priya's handwriting.",
  };
  return `${cork} ${card[world.board]}`;
}

/** The pass-through. The only corner of this room the floor cannot hear. */
export function passThroughBody(world: World, track: Track = trackOrDefault()): string {
  const base =
    "Two metres out of earshot of the floor, which is the whole reason it matters. Through the hatch, the kitchen, and nobody in it.";
  // Level B pins two more things here: the supplier's price-increase letter, and
  // a second rota that somebody has already been through in pencil (PRD §14).
  const paper =
    track === "SCB"
      ? " Pinned beside it: a letter from the supplier about next quarter's prices, and a second rota with two shifts crossed out and rewritten."
      : "";
  const rota: Record<WorldValue<"staff">, string> = {
    easy: "The rota is pinned here and nobody has touched it since you put it up.",
    strained:
      "The rota is pinned here with three corrections in pencil, none of them yours, and one of them gone over twice.",
    trusting:
      "The rota is pinned here with a swap written in at the bottom and both names beside it.",
  };
  return `${base} ${rota[world.staff]}${paper}`;
}

/** The supplier's sample, and the invoice underneath it. */
export function sampleBagBody(world: World): string {
  const base =
    "A kilo of the cheaper beans in a plain bag, and the invoice folded under it with a number on it that would fix this month. They smell fine. They smell like coffee.";
  return world.beans === "cheap"
    ? `${base} There is already a sack of them behind you, half used.`
    : base;
}

/**
 * What you read when you stop at something. Kept here rather than in room.ts
 * because all four of these are now views onto state — the board is what you
 * sell, the table is who still comes, the window is what is happening to you
 * from outside, and the rota is how the team is doing.
 */
export function hotspotBody(id: string, world: World): string {
  switch (id) {
    case "ht_chalkboard":
      return chalkboardBody(world);
    case "ht_board":
      return noticeboardBody(world);
    case "ht_window":
      return windowBody(world);
    case "ht_pass":
      return passThroughBody(world);
    case "ht_sample":
      return sampleBagBody(world);
    default:
      return "";
  }
}

/** Whether Marcus is in the room at all. */
export function marcusIsIn(world: World): boolean {
  return world.regulars !== "thin";
}

/** Where the four-top is, for the announcement and for anything that walks there. */
export const FOUR_TOP: Cell = { x: 9, y: 6 };

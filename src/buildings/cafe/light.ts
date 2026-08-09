// The season's light (PRD §3.4). Nine decisions, one year, and the room ages
// through it — so the light is a function of the week, not of anything you
// decide.
//
// Pure. It answers "what colour is this week" and "what do we say about it";
// the canvas owns the fade and the Graphics.
//
// **Why a grade and not a lamp.** The room is already a lit island on a dark
// surround (scene.ts's warm pool). Adding a second light source per week would
// mean re-baking props; multiplying one screen-space quad over the finished
// frame costs one draw call and changes every pixel at once, which is what a
// time of day actually does. The night beat is the same mechanism turned up.
//
// **The floor matters.** §15 requires that the room never becomes unreadable for
// a low-vision player, so `grade` is clamped below 1 and the night beat is a
// deep blue at 0.62 rather than black at 0.95. You can still see the chairs.
import { MISSIONS } from "./missions";
import { trackOrDefault } from "./track";

export interface Light {
  /** Multiplied over the whole frame. */
  tint: number;
  /** How much of the tint lands. 0 leaves the room exactly as baked. */
  grade: number;
  /** An additive warm wash, for the hot day and the low autumn gold. */
  glow: number;
  /** Said to the live region when the week turns. A blind player gets the cut. */
  says: string;
}

/**
 * The hard ceiling on `grade`. Above this the room stops being legible, and a
 * dramatic week-8 that a low-vision player cannot navigate is not a beat, it is
 * a wall (PRD §15).
 */
export const MAX_GRADE = 0.66;

/** How long the cut between weeks takes. §3.4: "about 1.2 seconds". */
export const FADE_S = 1.2;

/**
 * Week one before anything has happened, and the fallback for any week not in
 * the table. Neutral: the room as it was baked.
 */
export const OPEN_LIGHT: Light = {
  tint: 0xfff4e2,
  grade: 0.1,
  glow: 0.04,
  says: "Late-spring morning. The light through the window is high and clean.",
};

/** PRD §3.4's table, one row per mission week. */
const BY_WEEK: Readonly<Record<number, Light>> = {
  1: OPEN_LIGHT,
  3: {
    tint: 0xffeed4,
    grade: 0.14,
    glow: 0.06,
    says: "A shade warmer than a fortnight ago. The room is busy.",
  },
  5: {
    // The first properly hot day. Glare on the window, and the street is loud
    // enough that it comes through the glass.
    tint: 0xfff0cf,
    grade: 0.16,
    glow: 0.16,
    says: "The first properly hot day. There is glare on the window and the street is loud.",
  },
  8: {
    // The structural centrepiece: closed, one pendant, nobody to perform for.
    tint: 0x3d4a72,
    grade: MAX_GRADE,
    glow: 0.03,
    says: "Half past ten at night. Chairs up, one pendant on over the counter, and the room to yourself.",
  },
  10: {
    tint: 0xfff8ee,
    grade: 0.08,
    glow: 0.05,
    says: "High summer. The light overhead is flat and even and gives you nothing.",
  },
  12: {
    tint: 0xffe6bc,
    grade: 0.2,
    glow: 0.13,
    says: "Late summer. The light comes the long way through the glass. Quiet mid-morning.",
  },
  14: {
    // First grey day. Cool, low contrast, and the room feels thin in it.
    tint: 0xc7cdd6,
    grade: 0.3,
    glow: 0.0,
    says: "The first grey day. The room has gone flat and a little cold.",
  },
  16: {
    tint: 0xffd9a0,
    grade: 0.26,
    glow: 0.12,
    says: "Autumn. The light is low and gold and comes in almost level with the counter.",
  },
  18: {
    // Late autumn, blue and short. Deliberately close to the night beat without
    // being it — week 18 is the last thing you see of the year.
    tint: 0x9fb2d0,
    grade: 0.36,
    glow: 0.02,
    says: "Late autumn. Blue, and going dark early.",
  },
};

/** After the ninth week closes. The year is over and the room is warm about it. */
export const AFTER_LIGHT: Light = {
  tint: 0xffe3b8,
  grade: 0.24,
  glow: 0.1,
  says: "Late autumn, and the place is still here.",
};

export function lightForWeek(week: number): Light {
  return BY_WEEK[week] ?? OPEN_LIGHT;
}

/**
 * The light for a point in the season. `missionOrder` is the runner's, so 1..9
 * during the year and 10 once it is done.
 */
export function lightForMission(missionOrder: number): Light {
  const mission = MISSIONS.find((m) => m.order === missionOrder);
  const light = mission ? lightForWeek(mission.week) : AFTER_LIGHT;
  // Both seasons run the same nine weeks, so the week comes off the Level A
  // table on either track. Only the grade differs.
  return trackOrDefault() === "SCB" ? cooled(light) : light;
}

/**
 * Level B is "one stop cooler; the night beat is darker and longer" (PRD §14).
 * Applied as a transform of the Level A light rather than a second table, so the
 * two tracks can never drift into being different rooms — the fiction is that
 * this is the same café and you are a different person walking into it.
 */
export function cooled(light: Light): Light {
  return {
    tint: shiftCool(light.tint),
    grade: Math.min(MAX_GRADE, light.grade + 0.08),
    glow: light.glow * 0.7,
    says: light.says,
  };
}

/** Pull a colour a stop toward blue without changing how bright it reads. */
function shiftCool(color: number): number {
  const r = Math.max(0, Math.round(((color >> 16) & 0xff) * 0.94));
  const g = (color >> 8) & 0xff;
  const b = Math.min(255, Math.round((color & 0xff) * 1.08));
  return (r << 16) | (g << 8) | b;
}

/**
 * Cross-fade between two lights. `t` runs 0 (from) to 1 (to). Channels are
 * mixed independently so a warm morning becoming a grey afternoon passes
 * through a plausible middle rather than through purple.
 */
export function mixLight(from: Light, to: Light, t: number): Light {
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return {
    tint: mixColor(from.tint, to.tint, k),
    grade: from.grade + (to.grade - from.grade) * k,
    glow: from.glow + (to.glow - from.glow) * k,
    says: k >= 1 ? to.says : from.says,
  };
}

function mixColor(a: number, b: number, t: number): number {
  const ch = (shiftBits: number) => {
    const x = (a >> shiftBits) & 0xff;
    const y = (b >> shiftBits) & 0xff;
    return Math.round(x + (y - x) * t) & 0xff;
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

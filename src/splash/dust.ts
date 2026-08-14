/**
 * Soot knocked off the glyphs by the projectile.
 *
 * This is deliberately not the fire. Fire is hot, buoyant and short lived: it
 * rises and burns out. Dust is cold and heavy: it is splattered downrange by the
 * impact, loses its throw to drag, arcs down under gravity and sticks where it
 * lands. Settled dust is permanent — it is debris on the page, not a puff.
 *
 * Grain size drives weight: a big chip carries its throw much further and drops
 * faster than fine grit, which is what makes a burst read as real debris rather
 * than uniform powder.
 *
 * Units: everything here is in emitter seconds and pixels, the same clock the
 * fire runs on. That clock ticks at {@link FLAME_TIME_SCALE}, so one emitter
 * second is four real ones — a duration of 0.5 below plays over two seconds on
 * screen. Nothing in this module may read a wall clock.
 */

import { type FlameBounds, flameScale } from "./flame";

/** Where a burst of dust comes from, and where it settles. */
export interface DustBurst {
  /** Horizontal extent of the source band across the struck letter. */
  readonly left: number;
  readonly right: number;
  /** Top of the source band; the baseline is its bottom. */
  readonly capTop: number;
  /** The word's baseline, which the resting band hangs below. */
  readonly baseline: number;
  /** Which way the projectile was travelling, which is where the fan leans. */
  readonly direction: -1 | 1;
  /** Size and force multiplier from the type size. */
  readonly scale: number;
}

/* -------------------------------------------------------------------------- */
/* Tuning constants. These are the hand-adjustable knobs.                      */
/* -------------------------------------------------------------------------- */

/**
 * Motes thrown by one impact, and the ceilings on each pool. Settled dust never
 * expires, so its cap has to cover every burst the splash can ever fire.
 */
export const DUST_BURST_COUNT = 90;
export const DUST_MAX_MOTES = 200;
export const DUST_MAX_SETTLED = 240;
/** Which passes shed dust. The user asked for the C; the R matches it. */
export const DUST_ON_MARC = true;
export const DUST_ON_HERMANN = true;

/** Source band width as a multiple of the struck letter, centred on it. */
export const DUST_SOURCE_WIDEN = 1.6;
/** How much of the cap height the source band covers. */
export const DUST_SOURCE_HEIGHT = 0.9;
/**
 * How far the source band is shifted downrange, as a fraction of its half width.
 * The strike sweeps across the letter and throws material off its leading side,
 * so the debris is shed ahead of the letter's centre rather than evenly about it.
 */
export const DUST_SOURCE_LEAD = 0.4;

/** Outward lean at the edge of the source band, in radians. */
export const DUST_FAN_TILT = 0.5;
/**
 * How hard the throw leans the way the projectile went, in radians. This is what
 * makes the burst a splatter thrown ahead of the impact rather than an even fan.
 */
export const DUST_DOWNRANGE_BIAS = 0.95;
/** Share of the burst that kicks back against the pass instead. */
export const DUST_BACKSPLASH_SHARE = 0.12;
/** How hard that minority kicks back, in radians. */
export const DUST_BACKSPLASH_BIAS = 0.75;
/** Backsplash is a ricochet, not part of the throw, so it carries less. */
export const DUST_BACKSPLASH_SPEED = 0.5;
/** And it is the light material that bounces: chips carry on through. */
export const DUST_BACKSPLASH_GRAIN = 0.55;
/** Random scatter either side of a mote's nominal angle, in radians. */
export const DUST_FAN_SPREAD = 0.55;

/** Throw speed, px per emitter second at scale 1. */
export const DUST_MIN_SPEED = 420;
export const DUST_MAX_SPEED = 950;
/** Higher throws more of the burst gently and only a few of it far. */
export const DUST_SPEED_SKEW = 1.7;

/** Air resistance on a reference grain, per emitter second. */
export const DUST_DRAG = 5.5;
/** Fall, px per emitter second squared. Terminal drift is this over the drag. */
export const DUST_GRAVITY = 2200;
/** Grain size that carries exactly {@link DUST_DRAG}, in px at scale 1. */
export const DUST_SIZE_REFERENCE = 2;
/** How strongly grain size buys momentum. 0 would make every mote weightless. */
export const DUST_MASS_DRAG = 0.8;
/** Bounds on that mass factor, so no grain is a feather or a cannonball. */
export const DUST_MIN_MASS = 0.55;
export const DUST_MAX_MASS = 2.2;

/** How far below the baseline grit comes to rest, px at scale 1. */
export const DUST_REST_BAND = 52;
/** Higher settles more of the burst close under the type. */
export const DUST_REST_SKEW = 1.8;

/**
 * Safety net only, in emitter seconds. Every mote lands long before this; a mote
 * that somehow has not is faded off rather than left hanging in the air.
 */
export const DUST_FLIGHT_TIMEOUT = 3;
/** Fraction of the timeout spent fading, for that same safety net. */
export const DUST_FLIGHT_FADE = 0.25;
/** Emitter seconds a mote spends fading in, so nothing pops into existence. */
export const DUST_FADE_IN = 0.02;

/** Peak opacity. Dust must stay well under the fire and the projectile. */
export const DUST_ALPHA = 0.42;
/** How far a mote dims once it has bedded into the page, and how long that takes. */
export const DUST_REST_DIM = 0.62;
export const DUST_SETTLE_EASE = 0.25;
/** Faintest a settled speck gets, relative to a settled chip. */
export const DUST_REST_ALPHA_FLOOR = 0.72;
/** Landed grit is drawn flatter, as if lying on the page. */
export const DUST_REST_FLATTEN = 0.6;

/** Grain range. Wide on purpose: fine dust up to chips knocked off the glyph. */
export const DUST_MIN_SIZE = 0.8;
export const DUST_MAX_SIZE = 7;
/** Higher makes fine grit dominate and chips rare. */
export const DUST_SIZE_SKEW = 2.4;

/** Soot and ash, keyed off the type's own texture. Never a fire colour. */
export const DUST_PALETTE = ["#8b8c86", "#747570", "#6b6259", "#60625e", "#514f4a"] as const;

/* -------------------------------------------------------------------------- */

function clamp01(value: number): number {
  if (!(value > 0)) return 0;
  return value < 1 ? value : 1;
}

/**
 * The impact sheds dust off the whole struck letter and a little of what sits
 * either side of it, so it reads as knocked off the type rather than fired out
 * of a nozzle. Vertical extent comes from the word's block box, which carries
 * the baseline and cap height; the letter's inline box hangs below the baseline
 * and would drop the resting band under the page.
 */
export function createDustBurst(
  word: FlameBounds,
  letter: FlameBounds,
  direction: -1 | 1,
): DustBurst {
  const cap = Math.max(word.bottom - word.top, 1);
  const half = ((letter.right - letter.left) * DUST_SOURCE_WIDEN) / 2;
  const centre =
    letter.left + (letter.right - letter.left) / 2 + direction * half * DUST_SOURCE_LEAD;

  return {
    left: centre - half,
    right: centre + half,
    capTop: word.bottom - cap * DUST_SOURCE_HEIGHT,
    baseline: word.bottom,
    direction,
    scale: flameScale(cap),
  };
}

export function dustSourceX(burst: DustBurst, roll: number): number {
  return burst.left + (burst.right - burst.left) * clamp01(roll);
}

export function dustSourceY(burst: DustBurst, roll: number): number {
  return burst.capTop + (burst.baseline - burst.capTop) * clamp01(roll);
}

/**
 * Launch angle for a mote leaving the band at `x`. Radians, with 0 pointing
 * right and negative pointing up.
 *
 * Debris off a struck surface goes with the strike, so the throw leans hard
 * downrange and the burst reads as splatter thrown ahead of the impact. A
 * {@link DUST_BACKSPLASH_SHARE} minority, selected by `kickRoll`, kicks back the
 * other way instead, which is what keeps it from looking like a jet.
 */
export function dustFanAngle(
  burst: DustBurst,
  x: number,
  spreadRoll: number,
  kickRoll: number,
): number {
  const half = (burst.right - burst.left) / 2 || 1;
  const centre = (burst.left + burst.right) / 2;
  const offset = Math.max(-1, Math.min(1, (x - centre) / half));
  // A ricochet comes straight back off the strike; it does not fan with where on
  // the band it was shed, which is what the downrange throw does.
  const tilt = dustKicksBack(kickRoll)
    ? burst.direction * -DUST_BACKSPLASH_BIAS
    : offset * DUST_FAN_TILT + burst.direction * DUST_DOWNRANGE_BIAS;
  return -Math.PI / 2 + tilt + (clamp01(spreadRoll) - 0.5) * 2 * DUST_FAN_SPREAD;
}

/** Whether this mote is part of the minority that ricochets back off the strike. */
export function dustKicksBack(kickRoll: number): boolean {
  return clamp01(kickRoll) < DUST_BACKSPLASH_SHARE;
}

/**
 * Throw speed in px per emitter second, skewed so most of the burst is gentle.
 * A mote that kicked back is a ricochet and never carries as far as the throw.
 */
export function dustLaunchSpeed(roll: number, scale: number, kicksBack = false): number {
  const skewed = clamp01(roll) ** DUST_SPEED_SKEW;
  const speed = (DUST_MIN_SPEED + (DUST_MAX_SPEED - DUST_MIN_SPEED) * skewed) * scale;
  return kicksBack ? speed * DUST_BACKSPLASH_SPEED : speed;
}

/**
 * Grain of one mote, skewed hard so fine dust dominates and chips are rare.
 * A mote that kicked back is drawn from the fine end only: heavy chips carry
 * through the impact rather than bouncing off it.
 */
export function dustSize(roll: number, scale: number, kicksBack = false): number {
  const grain = kicksBack ? clamp01(roll) * DUST_BACKSPLASH_GRAIN : clamp01(roll);
  return (DUST_MIN_SIZE + (DUST_MAX_SIZE - DUST_MIN_SIZE) * grain ** DUST_SIZE_SKEW) * scale;
}

/**
 * Air resistance for one grain. Bigger means heavier: a chip keeps its throw and
 * carries downrange, while fine grit is stopped almost at once and drops short.
 * Terminal fall speed is {@link DUST_GRAVITY} over this, so chips also land first.
 */
export function dustDragFor(size: number, scale: number): number {
  const relative = size / (scale * DUST_SIZE_REFERENCE);
  const mass = Math.max(
    DUST_MIN_MASS,
    Math.min(DUST_MAX_MASS, Math.max(relative, 0) ** DUST_MASS_DRAG),
  );
  return DUST_DRAG / mass;
}

export function dustShade(roll: number): string {
  const index = Math.min(DUST_PALETTE.length - 1, Math.floor(clamp01(roll) * DUST_PALETTE.length));
  return DUST_PALETTE[index] ?? DUST_PALETTE[0];
}

/** Where one mote comes to rest: a scattered band hanging under the baseline. */
export function dustRestY(burst: DustBurst, roll: number): number {
  return burst.baseline + clamp01(roll) ** DUST_REST_SKEW * DUST_REST_BAND * burst.scale;
}

/**
 * One flight step: drag takes the throw away, gravity takes over. Exponential
 * damping keeps the result independent of the frame rate.
 */
export function advanceDustFlight(
  vx: number,
  vy: number,
  delta: number,
  drag: number,
): { readonly vx: number; readonly vy: number } {
  const damping = Math.exp(-drag * delta);
  const terminal = DUST_GRAVITY / drag;
  return {
    vx: vx * damping,
    // Exact solution of v' = g - k v, so a long frame cannot overshoot terminal.
    vy: terminal + (vy - terminal) * damping,
  };
}

/** True once a mote has arrived at its resting height on the way down. */
export function hasLanded(y: number, restY: number, vy: number): boolean {
  return y >= restY && vy >= 0;
}

/**
 * Opacity of a mote still in the air. It catches quickly and then holds: the
 * fade at the end only exists to retire a mote that never found its resting
 * height, which the tuning makes impossible.
 */
export function dustFlightAlpha(flightTime: number): number {
  const elapsed = Math.max(flightTime, 0);
  const fadeIn = Math.min(1, elapsed / DUST_FADE_IN);
  const left = (DUST_FLIGHT_TIMEOUT - elapsed) / (DUST_FLIGHT_TIMEOUT * DUST_FLIGHT_FADE);
  return DUST_ALPHA * fadeIn * clamp01(left);
}

/**
 * Opacity of a mote that has settled. There is no time term: dust that has come
 * to rest is debris on the page and stays exactly as it is for the life of the
 * splash. Chips read a little stronger than fine grit.
 */
export function dustRestAlpha(size: number, scale: number): number {
  const grain = clamp01((size / scale - DUST_MIN_SIZE) / (DUST_MAX_SIZE - DUST_MIN_SIZE));
  const weight = DUST_REST_ALPHA_FLOOR + (1 - DUST_REST_ALPHA_FLOOR) * grain;
  return DUST_ALPHA * DUST_REST_DIM * weight;
}

/** Eases a mote from its flight opacity onto its resting one: 0 landing, 1 bedded. */
export function dustBedIn(sinceSettled: number): number {
  return clamp01(sinceSettled / DUST_SETTLE_EASE);
}

/**
 * Anchored fire model for the signature splash.
 *
 * The dashes leave accelerant on two letters, and what burns afterwards should
 * read as oil clinging to the glyph: fuel pooled along a short stretch of the
 * stroke, plumes that lick along that stroke before buoyancy takes them, lateral
 * vortex shedding, and a white hot core grading out to a cool tapered tip.
 *
 * Everything here is pure and frame-rate independent. Time always arrives as an
 * accumulated `elapsed` or a `delta` measured from the emitter's own clock, so a
 * scaled clock (the `?slow=` debug knob) slows the fire exactly like everything
 * else. Nothing in this module may read a wall clock.
 */

/** A DOMRect-compatible box. */
export interface FlameBounds {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** One point of the letter that holds fuel. */
export interface FlameSite {
  readonly x: number;
  readonly y: number;
  /** Unit vector along the stroke; new fire licks along it before it rises. */
  readonly leanX: number;
  readonly leanY: number;
  /** Share of the seat's fuel, relative to the other sites. */
  readonly weight: number;
  /** This site's own breathing phase, so no two spots flare together. */
  readonly phase: number;
}

/** Everything an emitter needs to keep one letter alight. */
export interface FlameSeat {
  readonly sites: readonly FlameSite[];
  /** Size multiplier taken from the cap height of the word. */
  readonly scale: number;
  /** Stable flicker phase so two seats never breathe in lockstep. */
  readonly phase: number;
}

/* -------------------------------------------------------------------------- */
/* Tuning constants. These are the hand-adjustable knobs.                      */
/* -------------------------------------------------------------------------- */

/**
 * How fast the fire burns relative to the projectile passes. The passes are a
 * fast snap; the fire reads better at a quarter of that, so it gets its own
 * clock rather than having every duration below retuned. Live parcel count is
 * unaffected: spawn rate and parcel life scale together.
 */
export const FLAME_TIME_SCALE = 0.25;

/** Cap height (px) the raw pixel numbers below were tuned against. */
export const FLAME_REFERENCE_CAP = 120;
export const FLAME_MIN_SCALE = 0.55;
export const FLAME_MAX_SCALE = 2.4;

/** MARC's C: a short arc up the lower right flank of the bowl, to the terminal. */
export const ARC_CENTER_X = 0.5;
export const ARC_CENTER_Y = 0.5;
/**
 * Past half the letter box, so the sites ride the outer edge of the bowl and
 * spill just beyond it — the fire licks off the outside of the stroke rather
 * than burning inside it. On the lower right quadrant, pushing the radius out
 * moves every site both down and right at once, which the arc angle alone
 * cannot do: there the two trade off against each other.
 */
export const ARC_RADIUS_X = 0.62;
export const ARC_RADIUS_Y = 0.55;
/**
 * Angles are degrees on the bowl: 0 is 3 o'clock, negative runs below it. The
 * span sits on the right flank rather than under the letter, so the fire climbs
 * the curve instead of pooling beneath it.
 */
export const ARC_START_DEGREES = -54;
export const ARC_END_DEGREES = -26;
export const ARC_SITE_COUNT = 7;
/** Fuel at the bottom of the arc relative to the terminal, which holds 1. */
export const ARC_ROOT_WEIGHT = 0.34;
export const ARC_WEIGHT_BIAS = 1.2;
/** How far the lick is pushed off the outside of the stroke. */
export const ARC_LEAN_OUTWARD = 0.35;
/** How far a site may slide along the arc, as a fraction of one even step. */
export const ARC_SITE_JITTER = 0.34;
/** How much a site's fuel may differ from the smooth curve, as a fraction. */
export const ARC_WEIGHT_JITTER = 0.22;

/** HERMANN's R|M gap: two strands up the facing strokes plus a pool in the seam. */
/** Shifts the whole seat off the R's right edge, as a fraction of cap height. */
export const SEAM_NUDGE = 0.05;
export const SEAM_SPLIT = 0.055;
export const SEAM_BASE_SPLIT = 0.4;
export const SEAM_SPLAY = 1.1;
export const SEAM_HEIGHT = 0.6;
export const SEAM_SITE_COUNT = 4;
export const SEAM_LEAN_OUTWARD = 0.55;
export const SEAM_POOL_WEIGHT = 1.25;
export const SEAM_TAPER = 0.68;
/** How far a strand site may slide sideways, as a fraction of its own offset. */
export const SEAM_SITE_JITTER = 0.3;
/** How far a strand site may slide up or down, as a fraction of one even step. */
export const SEAM_CLIMB_JITTER = 0.3;
export const SEAM_WEIGHT_JITTER = 0.22;
/** How much the outward lean of a strand site may vary. */
export const SEAM_LEAN_JITTER = 0.3;

/** Upward acceleration of fully hot gas, px/s^2 at scale 1. */
export const FLAME_BUOYANCY = 620;
/** Vertical damping; buoyancy over this is roughly the terminal rise speed. */
export const FLAME_RISE_DRAG = 2.4;
export const FLAME_LATERAL_DRAG = 3.2;
/** Peak sideways acceleration of the vortex street, px/s^2 at scale 1. */
export const FLAME_CURL_ACCELERATION = 300;
/** Shedding rate in radians per second. */
export const FLAME_CURL_FREQUENCY = 6.5;
export const FLAME_CURL_BASE_SWELL = 0.2;
export const FLAME_CURL_SWELL_GAIN = 1.15;
/** Weight of the second harmonic in the sway, which keeps it off a clean sine. */
export const FLAME_CURL_HARMONIC = 0.28;
export const FLAME_CURL_HARMONIC_RATIO = 2.3;
/** Spread of per-particle curl phases; small keeps neighbouring licks coherent. */
export const FLAME_SEED_SPREAD = 2.2;
/** How far a parcel's own shedding rate may drift from the seat's, either way. */
export const FLAME_WOBBLE_SPREAD = 0.3;

/** How fast a single site breathes, and how deep that breath goes. */
export const SITE_PULSE_RATE = 2.7;
export const SITE_PULSE_DEPTH = 0.45;

/**
 * Ignition flare. Accelerant goes up all at once and then has to make do with
 * what soaked into the letter, so a seat opens far above its steady burn and
 * relaxes onto it. Time is measured from the seat's own ignition, on the
 * emitter's clock.
 */
export const IGNITION_FLARE = 4;
/**
 * Seconds of EMITTER time until the seat is burning calmly again. The emitter
 * runs at {@link FLAME_TIME_SCALE}, so this is four times longer in real time.
 */
export const IGNITION_SETTLE = 0.5;
/** Higher spends the fury sooner. */
export const IGNITION_CURVE = 3;
/** How much of the flare each property takes: 0 ignores it, 1 takes all of it. */
export const IGNITION_SPAWN_GAIN = 0.34;
export const IGNITION_RISE_GAIN = 0.38;
export const IGNITION_SIZE_GAIN = 0.24;
export const IGNITION_LIFE_GAIN = 0.08;
export const IGNITION_GLOW_GAIN = 0.55;
/**
 * Parcels in the opening flash, per unit of site fuel. The flash is what makes
 * the fury land on the ignition frame itself; the envelope alone only ramps up
 * as parcels accumulate.
 */
export const IGNITION_FLASH_COUNT = 14;

/** Hard ceiling on live parcels across every seat, so a flare cannot run away. */
export const FLAME_MAX_PARCELS = 460;

/** Most parcels are small; this skews the draw toward the small end. */
export const FLAME_SIZE_SKEW = 1.8;
/** Odds that a parcel is a gout of barely burnt fuel, and how far it overshoots. */
export const FLAME_GOUT_CHANCE = 0.09;
export const FLAME_GOUT_GAIN = 1.9;

/** Opening upward speed of a fresh parcel, px/s at scale 1. */
export const FLAME_LAUNCH_RISE = 55;
export const FLAME_LAUNCH_RISE_SPAN = 70;
/** Ceiling on parcels spawned by one seat in one frame, whatever the frame took. */
export const FLAME_MAX_SPAWNS_PER_FRAME = 12;

export const FLAME_HEAT_FALLOFF = 1.35;
/** Cool tip first, white hot core last. */
export const FLAME_RAMP = ["#ff3d00", "#ff8a00", "#ffd400", "#fff7c2"] as const;
export const FLAME_RAMP_BIAS = 1.25;

export const FLAME_WICK_PINCH = 0.2;
export const FLAME_STRETCH_MIN = 0.95;
export const FLAME_STRETCH_GAIN = 1.7;
export const FLAME_PEAK_ALPHA = 0.55;
export const FLAME_FADE_IN = 6;
export const FLAME_FADE_OUT = 1.6;

/* -------------------------------------------------------------------------- */

const TAU = Math.PI * 2;

function clamp01(value: number): number {
  if (!(value > 0)) return 0;
  return value < 1 ? value : 1;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Stable hash in [0, 1). Geometry-derived irregularity has to be deterministic:
 * a site that is lumpier than its neighbour must stay lumpier every frame, or
 * the fire shimmers instead of burning.
 */
export function flameNoise(seed: number): number {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/** Signed jitter in [-amount, amount] for a seed. */
function wander(seed: number, amount: number): number {
  return (flameNoise(seed) - 0.5) * 2 * amount;
}

/** Deterministic 0..TAU phase from a point, so seats differ without randomness. */
function seatPhase(x: number, y: number): number {
  const raw = x * 0.017 + y * 0.011;
  return ((raw % TAU) + TAU) % TAU;
}

function lean(x: number, y: number): { leanX: number; leanY: number } {
  const upward = Math.min(y, 0);
  const length = Math.hypot(x, upward);
  if (length === 0) return { leanX: 0, leanY: -1 };
  return { leanX: x / length, leanY: upward / length };
}

/** Cap height of the block word box, which sits on the baseline the fire uses. */
function capHeightOf(word: FlameBounds): number {
  return Math.max(word.bottom - word.top, 1);
}

export function flameScale(capHeight: number): number {
  const raw = capHeight / FLAME_REFERENCE_CAP;
  if (!(raw > FLAME_MIN_SCALE)) return FLAME_MIN_SCALE;
  return raw < FLAME_MAX_SCALE ? raw : FLAME_MAX_SCALE;
}

/**
 * MARC's C. Only the letter's box is measurable at runtime, so the bowl is
 * approximated as an ellipse inscribed in it and the seat is the arc sweeping
 * from the bottom of the bowl up to the lower right terminal, where the stroke
 * turns back toward the letter's opening.
 */
export function createArcFlameSeat(word: FlameBounds, letter: FlameBounds): FlameSeat {
  const cap = capHeightOf(word);
  const width = letter.right - letter.left;
  const centerX = letter.left + width * ARC_CENTER_X;
  const centerY = word.bottom - cap * ARC_CENTER_Y;
  const radiusX = width * ARC_RADIUS_X;
  const radiusY = cap * ARC_RADIUS_Y;
  const start = toRadians(ARC_START_DEGREES);
  const end = toRadians(ARC_END_DEGREES);
  const steps = Math.max(ARC_SITE_COUNT - 1, 1);

  const span = end - start;
  const seedBase = centerX + centerY;

  const sites: FlameSite[] = [];
  for (let index = 0; index < ARC_SITE_COUNT; index += 1) {
    const progress = index / steps;
    // Slide each site along the arc by less than half a step, so the spacing is
    // lumpy but the order along the curve never changes.
    const slide = wander(seedBase + index * 1.7, ARC_SITE_JITTER) / steps;
    const angle = start + span * (progress + slide);
    const x = centerX + radiusX * Math.cos(angle);
    const y = centerY - radiusY * Math.sin(angle);

    // Tangent of the bowl in the direction of travel, then nudged outward so the
    // fire licks off the outside of the stroke instead of through it.
    const tangentX = -radiusX * Math.sin(angle);
    const tangentY = -radiusY * Math.cos(angle);
    const tangentLength = Math.hypot(tangentX, tangentY) || 1;
    const outwardX = x - centerX;
    const outwardY = y - centerY;
    const outwardLength = Math.hypot(outwardX, outwardY) || 1;

    const smooth = ARC_ROOT_WEIGHT + (1 - ARC_ROOT_WEIGHT) * progress ** ARC_WEIGHT_BIAS;
    sites.push({
      x,
      y,
      ...lean(
        tangentX / tangentLength + (outwardX / outwardLength) * ARC_LEAN_OUTWARD,
        tangentY / tangentLength,
      ),
      weight: smooth * (1 + wander(seedBase + index * 5.3, ARC_WEIGHT_JITTER)),
      phase: flameNoise(seedBase + index * 9.1) * TAU,
    });
  }

  return { sites, scale: flameScale(cap), phase: seatPhase(centerX, centerY) };
}

/**
 * HERMANN's R. The fire belongs in the gap between the R and the M, not on the
 * R itself, so the seat is the seam at the right edge of the R's box: a pool of
 * fuel on the baseline plus two strands that climb and part as they lick up the
 * right flank of the R and the left flank of the M.
 */
export function createSeamFlameSeat(word: FlameBounds, letter: FlameBounds): FlameSeat {
  const cap = capHeightOf(word);
  const seamX = letter.right + cap * SEAM_NUDGE;
  const baseline = word.bottom;
  const steps = Math.max(SEAM_SITE_COUNT - 1, 1);

  const seedBase = seamX + baseline;
  const sites: FlameSite[] = [
    {
      x: seamX,
      y: baseline,
      leanX: 0,
      leanY: -1,
      weight: SEAM_POOL_WEIGHT,
      phase: flameNoise(seedBase) * TAU,
    },
  ];

  for (const strand of [-1, 1] as const) {
    // Seeding off the strand as well as the index keeps the two flanks from
    // coming out as mirror images of each other.
    const strandSeed = seedBase + (strand > 0 ? 43.7 : 11.3);
    for (let index = 0; index < SEAM_SITE_COUNT; index += 1) {
      const progress = index / steps;
      const climb = clamp01(progress + wander(strandSeed + index * 2.9, SEAM_CLIMB_JITTER) / steps);
      const offset =
        cap *
        SEAM_SPLIT *
        (SEAM_BASE_SPLIT + progress * SEAM_SPLAY) *
        (1 + wander(strandSeed + index * 6.1, SEAM_SITE_JITTER));
      sites.push({
        x: seamX + strand * offset,
        y: baseline - cap * SEAM_HEIGHT * climb,
        ...lean(
          strand * SEAM_LEAN_OUTWARD * (1 + wander(strandSeed + index * 3.3, SEAM_LEAN_JITTER)),
          -1,
        ),
        weight:
          (1 - SEAM_TAPER * progress) * (1 + wander(strandSeed + index * 7.7, SEAM_WEIGHT_JITTER)),
        phase: flameNoise(strandSeed + index * 9.1) * TAU,
      });
    }
  }

  return { sites, scale: flameScale(cap), phase: seatPhase(seamX, baseline) };
}

/**
 * How hard one site is burning right now. Two out-of-step sines per site mean
 * the fire wanders along the seat instead of feeding every spot evenly.
 */
export function sitePulse(elapsed: number, phase: number): number {
  const swing =
    Math.sin(elapsed * SITE_PULSE_RATE + phase) * 0.62 +
    Math.sin(elapsed * SITE_PULSE_RATE * 1.87 + phase * 2.3) * 0.38;
  return 1 + swing * SITE_PULSE_DEPTH;
}

/**
 * Picks a site in proportion to the fuel it is giving up at this instant.
 * `roll` is a 0..1 random draw; `elapsed` is emitter time.
 */
export function pickFlameSite(
  sites: readonly FlameSite[],
  roll: number,
  elapsed: number,
): FlameSite {
  const last = sites[sites.length - 1];
  if (!last) throw new Error("A flame seat needs at least one site");

  let total = 0;
  for (const site of sites) total += site.weight * sitePulse(elapsed, site.phase);

  let target = clamp01(roll) * total;
  for (const site of sites) {
    target -= site.weight * sitePulse(elapsed, site.phase);
    if (target <= 0) return site;
  }
  return last;
}

/**
 * Strength of a seat's ignition flare, from a fury at t=0 down to exactly the
 * steady burn at {@link IGNITION_SETTLE}. A pure function of the seat's own
 * accumulated emitter time, so it is frame-rate independent and slows correctly
 * under a scaled clock.
 */
export function ignitionEnvelope(sinceIgnition: number): number {
  if (!(sinceIgnition > 0)) return IGNITION_FLARE;
  if (sinceIgnition >= IGNITION_SETTLE) return 1;
  const remaining = 1 - sinceIgnition / IGNITION_SETTLE;
  return 1 + (IGNITION_FLARE - 1) * remaining ** IGNITION_CURVE;
}

/** Takes `gain` of the flare's excess: 0 leaves a property alone, 1 gives it everything. */
export function ignitionGain(envelope: number, gain: number): number {
  return 1 + (envelope - 1) * gain;
}

/**
 * Size of one parcel relative to the profile's range. Most are small, and about
 * {@link FLAME_GOUT_CHANCE} of them are gouts of barely burnt fuel that overshoot
 * the range entirely, which is what stops the plume looking granulated.
 */
export function parcelSpread(roll: number, gout: number): number {
  const skewed = clamp01(roll) ** FLAME_SIZE_SKEW;
  if (clamp01(gout) < FLAME_GOUT_CHANCE) return 1 + skewed * (FLAME_GOUT_GAIN - 1);
  return skewed;
}

/**
 * Meters how many parcels a seat releases this frame. The fractional remainder
 * carries over, so emission tracks the emitter's own clock rather than the frame
 * rate, and a long frame cannot dump a whole plume at once.
 */
export function drainSpawnBudget(
  carry: number,
  spawnRate: number,
  surge: number,
  delta: number,
): { readonly spawns: number; readonly carry: number } {
  const budget = carry + spawnRate * Math.max(surge, 0) * Math.max(delta, 0);
  const spawns = Math.min(Math.floor(budget), FLAME_MAX_SPAWNS_PER_FRAME);
  return { spawns, carry: budget - spawns };
}

/** 1 at the wick, 0 at the tip: how much heat a parcel of gas has left. */
export function flameHeat(ageFraction: number): number {
  return clamp01(1 - ageFraction) ** FLAME_HEAT_FALLOFF;
}

/** Index into {@link FLAME_RAMP} for a given heat. */
export function flameRampIndex(heat: number): number {
  const index = Math.floor(clamp01(heat) ** FLAME_RAMP_BIAS * FLAME_RAMP.length);
  return index < FLAME_RAMP.length ? index : FLAME_RAMP.length - 1;
}

/** Negative is upward: hot gas is light, and cooling gas stops climbing. */
export function buoyantAcceleration(ageFraction: number, scale: number): number {
  return -FLAME_BUOYANCY * flameHeat(ageFraction) * scale;
}

/**
 * Vortex shedding. Neighbouring parcels share a seat phase and differ only by a
 * small seed, so the column wavers as one body instead of dissolving into noise,
 * and the amplitude swells with height as the plume loses its grip on the wick.
 * A second harmonic and a per-parcel `wobble` on the shedding rate keep the sway
 * off a clean sine, which is what a single frequency reads as.
 */
export function curlAcceleration(
  elapsed: number,
  seed: number,
  ageFraction: number,
  scale: number,
  wobble = 1,
): number {
  const swell = FLAME_CURL_BASE_SWELL + clamp01(ageFraction) * FLAME_CURL_SWELL_GAIN;
  const rate = elapsed * FLAME_CURL_FREQUENCY * wobble;
  const sway =
    Math.sin(rate + seed) * (1 - FLAME_CURL_HARMONIC) +
    Math.sin(rate * FLAME_CURL_HARMONIC_RATIO + seed * 1.7) * FLAME_CURL_HARMONIC;
  return sway * FLAME_CURL_ACCELERATION * swell * scale;
}

/** Exponential damping, so the result does not depend on the frame rate. */
export function applyDrag(velocity: number, drag: number, delta: number): number {
  return velocity * Math.exp(-drag * delta);
}

/** One vertical integration step. Fire rises or stalls; it never falls back. */
export function advanceFlameVelocity(
  velocity: number,
  ageFraction: number,
  scale: number,
  delta: number,
): number {
  const lifted = velocity + buoyantAcceleration(ageFraction, scale) * delta;
  return Math.min(0, applyDrag(lifted, FLAME_RISE_DRAG, delta));
}

/** One lateral integration step: curl in, drag out. */
export function advanceFlameLateral(
  velocity: number,
  elapsed: number,
  seed: number,
  ageFraction: number,
  scale: number,
  delta: number,
  wobble = 1,
): number {
  const curled = velocity + curlAcceleration(elapsed, seed, ageFraction, scale, wobble) * delta;
  return applyDrag(curled, FLAME_LATERAL_DRAG, delta);
}

/**
 * Liquid accelerant does not burn evenly: it surges and settles. Three
 * incommensurate sines keep the seat breathing without ever repeating audibly
 * or guttering out.
 */
export function fuelSurge(elapsed: number, phase: number): number {
  return (
    1 +
    Math.sin(elapsed * 3.1 + phase) * 0.22 +
    Math.sin(elapsed * 7.7 + phase * 1.7) * 0.12 +
    Math.sin(elapsed * 1.3 + phase * 0.6) * 0.06
  );
}

/** Plume silhouette: pinched at the wick, swollen mid-plume, tapered to a point. */
export function flameRadii(
  ageFraction: number,
  size: number,
  scale: number,
): { readonly rx: number; readonly ry: number } {
  const age = clamp01(ageFraction);
  const bulge = Math.sin(Math.PI * (FLAME_WICK_PINCH + age * (1 - FLAME_WICK_PINCH)));
  return {
    rx: Math.abs(size * scale * bulge),
    ry: size * scale * (FLAME_STRETCH_MIN + age * FLAME_STRETCH_GAIN),
  };
}

/** Additive draw alpha: catches quickly at the wick, dies out at the tip. */
export function flameAlpha(ageFraction: number): number {
  const age = clamp01(ageFraction);
  const catching = Math.min(1, 0.35 + age * FLAME_FADE_IN);
  return catching * (1 - age) ** FLAME_FADE_OUT * FLAME_PEAK_ALPHA;
}

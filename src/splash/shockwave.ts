/**
 * Sonic boom for the signature splash projectiles.
 *
 * What a person actually sees when something goes supersonic past them is a
 * condensation cone and nothing else. The expanding wavefronts are real, but
 * they are invisible to the eye; drawing them is instrumentation, not
 * observation. So the whole effect is one wide vapour cone hanging off the nose.
 *
 * The cone's EDGE is the feature. A condensation cone is a shock surface — a
 * shell — so it is brightest where you look along it and shades away inward,
 * fading to nothing outside. That is built here without drawing a single round
 * or stroked mark:
 *
 *  - Each flank is walked from apex to tail as a chain of straight-sided
 *    quadrilateral bands straddling the flank line.
 *  - Each band is filled with a linear gradient running PERPENDICULAR to the
 *    flank: transparent outside, peaking exactly on the flank line, decaying
 *    smoothly inward toward the axis. That one choice is what produces a
 *    defined edge with shading that decays away from it.
 *  - Consecutive bands overlap by half their length, so every point on the
 *    flank is covered exactly twice and there are no seams between segments.
 *  - One very faint interior fill under the whole cone gives the volume body.
 *
 * Nothing circular is drawn, so nothing can read as a circle: no `arc`, no
 * `ellipse`, no `createRadialGradient`, no `stroke`.
 *
 * The drawn width is deliberately NOT the strict Mach angle. A Mach 4 cone is
 * geometrically a thin dart; the photographs everyone recognises are broad and
 * enveloping. `CONE_WIDTH_SCALE` opens the drawn cone well past the formula and
 * `MIN_CONE_ASPECT`/`MAX_CONE_ASPECT` bound it, so the physics shapes the cone
 * without being allowed to veto the art direction.
 *
 * Irregularity lives in the edge: the flank line wavers on two octaves phased
 * by distance travelled, and each band's width and brightness come from a
 * seeded hash, so the boundary is organic rather than ruler-straight and never
 * shimmers or repeats. There is no `Math.random` in this module.
 *
 * All motion is driven by the `delta` handed to `advance`; nothing reads a wall
 * clock, so the dev slow-motion knob can feed a scaled clock straight in. The
 * geometry is pure and exported separately so it can be unit tested without a
 * DOM or a canvas.
 */

/** Hypersonic limit of the Billig bow shock stand-off correlation. */
const STANDOFF_LIMIT = 0.386;
/** Exponent of the Billig correlation, `0.386 * exp(4.67 / M^2)`. */
const STANDOFF_FALLOFF = 4.67;
/** Anything fainter than this is not worth a draw call. */
const MIN_ALPHA = 0.0012;

/**
 * How much wider the drawn shroud is than the strict Mach cone. This is the
 * art-direction dial: raise it for a broader, blunter, more enveloping cone,
 * lower it toward 1 for the geometrically faithful dart.
 */
export const CONE_WIDTH_SCALE = 2;
/** Floor on the drawn half width as a fraction of the shroud's length. */
export const MIN_CONE_ASPECT = 0.2;
/** Ceiling on the same, so a transonic pass flares wide but never into a disc. */
export const MAX_CONE_ASPECT = 0.58;

/**
 * Where the flank line sits across the band, as a fraction of the band's width
 * measured from its outer edge. This is the edge-sharpness dial: lower values
 * put the bright line closer to the outside, giving a crisper boundary with a
 * longer inward shade.
 */
export const EDGE_OUTER_RATIO = 0.26;
/**
 * How abruptly the band climbs to the flank line from outside. Toward 1 the
 * outer approach is a hard shoulder; toward 0 it is a long soft ramp.
 */
export const EDGE_RISE = 0.55;
/**
 * How far the shading carries inward from the edge, as a fraction of the
 * band's inner half. Lower hugs the edge; higher washes toward the axis.
 */
export const EDGE_FALLOFF = 0.55;
/** Band thickness at the nose, as a fraction of the cone's half width. */
export const EDGE_BAND_RATIO = 0.55;
/**
 * How fast the band thins as it runs back from the nose. The shock is strongest
 * where it is normal to the flow — right at the nose — and weakens along the
 * flank, so the line is thickest at the front and tapers off. Scaling thickness
 * by the cone's LOCAL half width instead gets this backwards: it fattens the
 * band toward the tail, which is what made the edge swell in the middle.
 */
export const EDGE_TAPER = 1.6;
/** Floor on band thickness in px, so the tail thins out without vanishing. */
export const EDGE_MIN_BAND = 5;

/**
 * Bluntness of the nose: the cone's half width at its apex, as a fraction of
 * its half width at the tail. A detached shock is rounded over at the front, so
 * this is non-zero — at 0 the cone comes to a point and reads as a triangle.
 */
export const NOSE_BLUNTNESS = 0.06;
/**
 * How far back the rounding carries before the flank runs straight. This is the
 * exponent of the norm blending nose into flank: higher keeps the rounding
 * tight to the tip, lower carries it further down the cone.
 */
export const NOSE_BLEND = 2.4;
/**
 * How far ahead of the projectile the shock detaches, as a multiple of the
 * Billig stand-off. The cone floats clear of the nose rather than being pinned
 * to it; raise for a longer gap.
 */
export const NOSE_STANDOFF_SCALE = 2.2;
/**
 * Ceiling on the stand-off as a fraction of the cone's own length. Billig runs
 * away toward Mach 1, and a short transonic cone must not float far out ahead
 * of the projectile it belongs to.
 */
export const NOSE_STANDOFF_LIMIT = 0.12;
/**
 * Floor on density across the rounded cap, so the nose reads as solid. Compression
 * is strongest on the axis, which the collar profile alone would not show.
 */
export const NOSE_DENSITY = 0.55;

export type Rgb = readonly [number, number, number];

export interface EdgeStop {
  readonly offset: number;
  readonly alpha: number;
}

export interface ShockwaveOptions {
  /** Speed of sound in px/s. Travel speed divided by this is the Mach number. */
  readonly waveSpeed?: number;
  /** Mach number where the effect starts to appear; transonic, so below 1. */
  readonly machOnset?: number;
  /** Mach number at which the effect reaches full strength. */
  readonly machFull?: number;
  /** Exponent on the onset ramp; below 1 so a barely supersonic pass still reads. */
  readonly intensityCurve?: number;
  /** Seconds of travel represented by the length of the shroud. */
  readonly coneTime?: number;
  readonly minConeLength?: number;
  readonly maxConeLength?: number;
  /** Peak opacity on the flank line itself. */
  readonly edgeAlpha?: number;
  /** Opacity of the single interior fill. Far fainter than the edge. */
  readonly bodyAlpha?: number;
  /** Bands per flank. They overlap by half, so coverage is seamless. */
  readonly edgeSegments?: number;
  /** Extra bands per flank spent rounding the boundary around the nose. */
  readonly noseSegments?: number;
  /** Exponent of the shroud's half-width profile; below 1 for a convex swell. */
  readonly coneProfile?: number;
  /** Relative amplitude of the waver on the flank line. */
  readonly coneWaverAmount?: number;
  /** Bias of the shroud off the flight line, breaking the flank symmetry. */
  readonly coneAsymmetry?: number;
  /** Radians of waver phase per pixel travelled, so the edge breathes. */
  readonly conePhaseRate?: number;
  /** Effective nose radius of the dash, in px. Drives the bow shock stand-off. */
  readonly noseRadius?: number;
  /** Ceiling on stand-off in nose radii, keeping the subsonic blow-up in frame. */
  readonly maxStandoffFactor?: number;
  /** Time constant in seconds for smoothing the inferred speed. */
  readonly speedResponse?: number;
  /** Above this px/s a tracked step is a teleport, not motion. */
  readonly maxSpeed?: number;
  /** Above this px of cross-track movement a tracked step is a re-layout. */
  readonly maxLateralStep?: number;
  /** Seconds of missing tracking before the shroud lets go. */
  readonly noseHold?: number;
  /** Cool shock colour for the body of the cone. */
  readonly coolColor?: Rgb;
  /** Hotter, whiter colour for the collar just behind the nose. */
  readonly hotColor?: Rgb;
}

export type ResolvedShockwaveOptions = Required<ShockwaveOptions>;

/**
 * Tuned for the choreography as shipped: MARC crosses at roughly 6900px/s and
 * HERMANN at roughly 5100px/s, which against a 1500px/s wave speed puts them at
 * Mach 4.6 and Mach 3.4. Speed is still inferred per frame, so none of this
 * assumes a particular pass duration.
 */
export const SHOCKWAVE_DEFAULTS: ResolvedShockwaveOptions = {
  waveSpeed: 1500,
  machOnset: 0.85,
  machFull: 2.6,
  intensityCurve: 0.6,
  coneTime: 0.05,
  minConeLength: 150,
  maxConeLength: 520,
  edgeAlpha: 0.1,
  bodyAlpha: 0.02,
  // More segments, so the flank polyline reads as a curve rather than as a
  // chain of visible facets.
  edgeSegments: 18,
  noseSegments: 4,
  /**
   * A sideways parabola: half width grows as the square root of the distance
   * back from the apex, so the boundary is `x = y²` lying on its side. This is
   * also what a real detached bow shock looks like — blunt at the nose, opening
   * fast, then straightening as it runs back.
   */
  coneProfile: 0.5,
  // Enough waver and asymmetry to keep the silhouette from looking machined,
  // little enough that it still reads as a clean cone.
  // The fast octave of the waver aliases into visible zigzag when sampled at
  // this few nodes, so keep the amplitude low enough that the boundary stays a
  // clean curve.
  coneWaverAmount: 0.02,
  coneAsymmetry: 0.04,
  conePhaseRate: 0.0012,
  noseRadius: 16,
  maxStandoffFactor: 2,
  speedResponse: 0.035,
  maxSpeed: 45000,
  maxLateralStep: 140,
  noseHold: 0.05,
  coolColor: [206, 226, 255],
  hotColor: [255, 250, 232],
};

export function resolveShockwaveOptions(options: ShockwaveOptions = {}): ResolvedShockwaveOptions {
  const fallback = SHOCKWAVE_DEFAULTS;
  return {
    waveSpeed: options.waveSpeed ?? fallback.waveSpeed,
    machOnset: options.machOnset ?? fallback.machOnset,
    machFull: options.machFull ?? fallback.machFull,
    intensityCurve: options.intensityCurve ?? fallback.intensityCurve,
    coneTime: options.coneTime ?? fallback.coneTime,
    minConeLength: options.minConeLength ?? fallback.minConeLength,
    maxConeLength: options.maxConeLength ?? fallback.maxConeLength,
    edgeAlpha: options.edgeAlpha ?? fallback.edgeAlpha,
    bodyAlpha: options.bodyAlpha ?? fallback.bodyAlpha,
    edgeSegments: Math.max(3, Math.round(options.edgeSegments ?? fallback.edgeSegments)),
    noseSegments: Math.max(2, Math.round(options.noseSegments ?? fallback.noseSegments)),
    coneProfile: options.coneProfile ?? fallback.coneProfile,
    coneWaverAmount: options.coneWaverAmount ?? fallback.coneWaverAmount,
    coneAsymmetry: options.coneAsymmetry ?? fallback.coneAsymmetry,
    conePhaseRate: options.conePhaseRate ?? fallback.conePhaseRate,
    noseRadius: options.noseRadius ?? fallback.noseRadius,
    maxStandoffFactor: options.maxStandoffFactor ?? fallback.maxStandoffFactor,
    speedResponse: options.speedResponse ?? fallback.speedResponse,
    maxSpeed: options.maxSpeed ?? fallback.maxSpeed,
    maxLateralStep: options.maxLateralStep ?? fallback.maxLateralStep,
    noseHold: options.noseHold ?? fallback.noseHold,
    coolColor: options.coolColor ?? fallback.coolColor,
    hotColor: options.hotColor ?? fallback.hotColor,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Builds a canvas colour string with a clamped, trimmed alpha. */
export function rgba(color: Rgb, alpha: number): string {
  const safe = Number.isFinite(alpha) ? clamp(alpha, 0, 1) : 0;
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${Math.round(safe * 1000) / 1000})`;
}

/**
 * The cross-band alpha profile that gives the cone its edge: nothing on the
 * outside, a peak exactly on the flank line at `outerRatio`, then a smooth
 * decay inward to nothing. Linear in `peak`, so the renderer can evaluate it
 * once and scale it per band.
 */
export function edgeProfile(
  peak: number,
  outerRatio: number = EDGE_OUTER_RATIO,
  falloff: number = EDGE_FALLOFF,
  rise: number = EDGE_RISE,
): readonly EdgeStop[] {
  const edge = clamp(Number.isFinite(outerRatio) ? outerRatio : EDGE_OUTER_RATIO, 0.02, 0.9);
  const inner = 1 - edge;
  const decay = clamp(Number.isFinite(falloff) ? falloff : EDGE_FALLOFF, 0.05, 1);
  const climb = clamp(Number.isFinite(rise) ? rise : EDGE_RISE, 0.05, 0.95);
  const level = Number.isFinite(peak) ? Math.max(peak, 0) : 0;

  return [
    { offset: 0, alpha: 0 },
    { offset: edge * (1 - climb), alpha: level * 0.14 },
    { offset: edge, alpha: level },
    { offset: edge + inner * decay * 0.34, alpha: level * 0.4 },
    { offset: edge + inner * decay * 0.85, alpha: level * 0.11 },
    { offset: 1, alpha: 0 },
  ];
}

/** Unit profile, evaluated once; per-band alpha just scales it. */
const EDGE_STOPS = edgeProfile(1);

/**
 * Stable hash of an integer seed into `[0, 1)`. Irregularity has to be
 * deterministic per band, or the edge shimmers every frame and cannot be
 * tested; this stands in for `Math.random` everywhere in the module.
 */
export function hashNoise(seed: number): number {
  const base = Number.isFinite(seed) ? Math.trunc(seed) : 0;
  let hash = Math.imul(base ^ 0x9e3779b9, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

export interface EdgeJitter {
  /** Scale on the band's thickness. */
  readonly width: number;
  /** Scale on its opacity. */
  readonly alpha: number;
}

/** Per-band character, derived from a seed so it is stable across frames. */
export function edgeJitter(seed: number): EdgeJitter {
  const base = seed * 733;
  return {
    width: 0.78 + hashNoise(base + 1) * 0.48,
    alpha: 0.66 + hashNoise(base + 2) * 0.68,
  };
}

/** Travel speed as a multiple of the wave speed. Zero when either is unusable. */
export function machNumber(speed: number, waveSpeed: number): number {
  if (!Number.isFinite(speed) || !Number.isFinite(waveSpeed) || waveSpeed <= 0) return 0;
  return Math.max(speed, 0) / waveSpeed;
}

/**
 * Half angle of the Mach cone, `asin(1 / M)`. Below Mach 1 the wave front is
 * normal to the flight path, so the cone opens all the way out to a right
 * angle and the drawn shroud falls back on its aspect ceiling.
 */
export function machConeHalfAngle(mach: number): number {
  if (!(mach > 1)) return Math.PI / 2;
  return Math.asin(1 / mach);
}

/**
 * Strict half width of the Mach cone at a given distance behind the nose.
 * Equal to `length * tan(halfAngle)`, written as `length / sqrt(M^2 - 1)` so it
 * stays exact instead of running through a tangent near the asymptote.
 */
export function machConeHalfWidth(length: number, mach: number): number {
  if (!(mach > 1)) return Number.POSITIVE_INFINITY;
  return length / Math.sqrt(mach * mach - 1);
}

/**
 * Half width of the shroud as actually drawn: the strict Mach cone opened up by
 * `CONE_WIDTH_SCALE` and then bounded against its own length. The Mach angle
 * still modulates the shape — a slower pass gives a blunter cone — but it
 * cannot pull the cone back into a thin dart.
 */
export function shroudHalfWidth(
  length: number,
  mach: number,
  widthScale: number = CONE_WIDTH_SCALE,
): number {
  const strict = machConeHalfWidth(length, mach);
  const widened = Number.isFinite(strict) ? strict * widthScale : Number.POSITIVE_INFINITY;
  return clamp(widened, length * MIN_CONE_ASPECT, length * MAX_CONE_ASPECT);
}

/**
 * Ramps the effect in from the transonic onset. The curve exponent is below 1
 * so the first sliver of supersonic reads as weak rather than as nothing: the
 * cone thins out gracefully if the pass is ever slowed.
 */
export function shockIntensity(
  mach: number,
  machFull: number,
  machOnset: number = SHOCKWAVE_DEFAULTS.machOnset,
  curve: number = SHOCKWAVE_DEFAULTS.intensityCurve,
): number {
  if (!Number.isFinite(mach)) return 0;
  const onset = Math.min(machOnset, machFull);
  if (mach <= onset) return 0;
  if (!(machFull > onset)) return 1;
  return clamp((mach - onset) / (machFull - onset), 0, 1) ** Math.max(curve, 0.05);
}

/**
 * Billig's bow shock stand-off correlation, `delta = 0.386 R exp(4.67 / M^2)`:
 * the faster the nose, the tighter the shock wraps onto it. The cone's apex
 * rides on that shock, so this is where the vapour cone attaches.
 */
export function bowShockStandoff(
  mach: number,
  noseRadius: number,
  maxFactor: number = SHOCKWAVE_DEFAULTS.maxStandoffFactor,
): number {
  if (!Number.isFinite(noseRadius) || noseRadius <= 0) return 0;
  const bounded = Math.max(Number.isFinite(mach) ? mach : 1, 1);
  const ratio = STANDOFF_LIMIT * Math.exp(STANDOFF_FALLOFF / (bounded * bounded));
  return noseRadius * Math.min(ratio, maxFactor);
}

/**
 * Half width of the shroud a fraction `t` of the way down its length.
 *
 * The straight-sided cone is blended with a blunt nose through a p-norm, which
 * gives a non-zero half width at the apex, a smooth turn-over with no corner,
 * and a flank that converges onto the straight cone within the first fifth of
 * the length. The rounding is a local treatment at the front: by mid-cone the
 * sides are straight to within a couple of percent.
 */
/**
 * Thickness of the edge band at `depth` along the cone, thickest at the nose
 * and tapering monotonically to the tail.
 *
 * The shock is strongest where it stands normal to the flow, at the nose, and
 * weakens as it lies over along the flank. Scaling thickness by the cone's
 * local half width does the reverse — it fattens the band toward the tail — and
 * that is what made the edge swell through its middle. Deliberately carries no
 * jitter: band-to-band thickness variation reads as a jagged, lumpy edge.
 */
export function edgeBandWidth(depth: number, halfWidth: number): number {
  const taper = (1 - clamp(depth, 0, 1)) ** EDGE_TAPER;
  return Math.max(halfWidth * EDGE_BAND_RATIO * taper, EDGE_MIN_BAND);
}

export function coneProfileHalfWidth(
  t: number,
  halfWidth: number,
  exponent: number,
  bluntness: number = NOSE_BLUNTNESS,
  blend: number = NOSE_BLEND,
): number {
  const straight = halfWidth * clamp(t, 0, 1) ** exponent;
  const nose = halfWidth * Math.max(Number.isFinite(bluntness) ? bluntness : NOSE_BLUNTNESS, 0);
  if (!(nose > 0)) return straight;
  const power = clamp(Number.isFinite(blend) ? blend : NOSE_BLEND, 1.05, 16);
  return (Math.abs(straight) ** power + nose ** power) ** (1 / power);
}

/**
 * Density along the shroud. Vapour condenses abruptly at the collar just behind
 * the nose, where the expansion drops the air below its dew point, then thins
 * out over a long tail as the flow recovers — a fast rise and a slow dissolve,
 * peaking near a fifth of the way down and normalised to exactly 1 there.
 */
export function coneDensity(t: number): number {
  if (!(t > 0) || t >= 1) return 0;
  return Math.sin(Math.PI * t ** 0.45) ** 1.35;
}

/**
 * Two-octave waver on the flank line, bounded by `amplitude`. The phase is fed
 * from distance travelled rather than a clock, and the two flanks are offset so
 * the upper and lower sides of the cone never mirror each other.
 */
export function coneWaver(t: number, phase: number, flank: 0 | 1, amplitude: number): number {
  if (!(amplitude > 0)) return 0;
  const offset = flank * 2.4;
  const slow = Math.sin(t * 5.3 + phase + offset);
  const fast = Math.sin(t * 12.1 - phase * 1.35 + offset * 1.9);
  return amplitude * (slow * 0.62 + fast * 0.38);
}

/** Speed implied by a tracked step and the frame delta, in px/s. */
export function estimateSpeed(dx: number, dy: number, delta: number): number {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !(delta > 0)) return 0;
  return Math.hypot(dx, dy) / delta;
}

/**
 * Exponential smoothing with a time constant rather than a per-frame factor, so
 * the response is the same at 60fps, 120fps, and under slow motion.
 */
export function smoothSpeed(
  current: number,
  sample: number,
  response: number,
  delta: number,
): number {
  if (!(response > 0) || !(delta > 0)) return sample;
  return sample + (current - sample) * Math.exp(-delta / response);
}

export interface TrackLimits {
  readonly maxSpeed: number;
  readonly maxLateralStep: number;
}

/**
 * True when a tracked step cannot be motion: the animation aborting and
 * restarting on resize teleports the projectile, and a teleport must not be
 * mistaken for speed.
 */
export function isTrackDiscontinuity(
  dx: number,
  dy: number,
  direction: -1 | 1,
  delta: number,
  limits: TrackLimits,
): boolean {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !(delta > 0)) return true;
  if (dx * direction < 0) return true;
  if (Math.abs(dy) > limits.maxLateralStep) return true;
  return Math.hypot(dx, dy) / delta > limits.maxSpeed;
}

export interface ShockwaveRenderer {
  /** Called each frame with the projectile's leading-edge position and travel direction. */
  readonly track: (x: number, y: number, direction: -1 | 1) => void;
  /** Advance simulation by delta SECONDS. */
  readonly advance: (delta: number) => void;
  /** Draw into the given 2D context. */
  readonly draw: (context: CanvasRenderingContext2D) => void;
  readonly clear: () => void;
}

export function createShockwaveRenderer(options: ShockwaveOptions = {}): ShockwaveRenderer {
  const config = resolveShockwaveOptions(options);
  const segments = config.edgeSegments;
  const capSegments = config.noseSegments;
  // Bands span two nodes and advance by one, so they overlap by half and every
  // point on the boundary is covered exactly twice: no seams between segments.
  const step = 1 / (segments + 1);
  const flankNodes = segments + 2;
  // The chain runs from the tip, around the rounded cap, then down the flank.
  const chainNodes = capSegments + flankNodes;
  // Each node is (x, y, axial fraction). Rebuilt in place; nothing allocates.
  const upper = new Float64Array(chainNodes * 3);
  const lower = new Float64Array(chainNodes * 3);

  let tracked = false;
  let pending = false;
  let pendingX = 0;
  let pendingY = 0;
  let pendingDirection: -1 | 1 = 1;
  let noseX = 0;
  let noseY = 0;
  let direction: -1 | 1 = 1;
  let speed = 0;
  let measured = false;
  let travelled = 0;
  let idle = 0;

  const track = (x: number, y: number, value: -1 | 1): void => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    pendingX = x;
    pendingY = y;
    pendingDirection = value;
    pending = true;
  };

  const advance = (delta: number): void => {
    if (!Number.isFinite(delta) || delta <= 0) return;

    if (!pending) {
      if (tracked) {
        idle += delta;
        speed = smoothSpeed(speed, 0, config.speedResponse, delta);
      }
      return;
    }
    pending = false;
    idle = 0;

    if (!tracked) {
      tracked = true;
      noseX = pendingX;
      noseY = pendingY;
      direction = pendingDirection;
      speed = 0;
      measured = false;
      return;
    }

    const dx = pendingX - noseX;
    const dy = pendingY - noseY;
    const jumped =
      pendingDirection !== direction ||
      isTrackDiscontinuity(dx, dy, pendingDirection, delta, config);

    noseX = pendingX;
    noseY = pendingY;
    direction = pendingDirection;

    if (jumped) {
      speed = 0;
      measured = false;
      return;
    }

    const sample = estimateSpeed(dx, dy, delta);
    speed = measured ? smoothSpeed(speed, sample, config.speedResponse, delta) : sample;
    measured = true;
    travelled += Math.hypot(dx, dy);
  };

  const nodeX = (nodes: Float64Array, index: number): number => nodes[index * 3] ?? 0;
  const nodeY = (nodes: Float64Array, index: number): number => nodes[index * 3 + 1] ?? 0;
  const nodeDepth = (nodes: Float64Array, index: number): number => nodes[index * 3 + 2] ?? 0;

  /**
   * Walks one side of the boundary: a quarter-turn around the rounded nose,
   * then straight down the flank. The cap leaves the tip on the axis and
   * arrives at the flank tangentially, so the two chains close across the front
   * with no gap and no corner where they meet.
   */
  const layBoundary = (
    nodes: Float64Array,
    side: -1 | 1,
    flank: 0 | 1,
    bias: number,
    frontX: number,
    length: number,
    half: number,
    noseHalf: number,
    phase: number,
  ): void => {
    const total = length + noseHalf;
    const lift = config.coneAsymmetry * 0.2;
    const scale = bias * (1 + coneWaver(0, phase, flank, config.coneWaverAmount));

    for (let index = 0; index < capSegments; index += 1) {
      const angle = ((index / capSegments) * Math.PI) / 2;
      const depth = noseHalf * (1 - Math.cos(angle));
      nodes[index * 3] = frontX - direction * depth;
      nodes[index * 3 + 1] = noseY + (side * scale + lift) * noseHalf * Math.sin(angle);
      nodes[index * 3 + 2] = depth / total;
    }

    for (let index = 0; index < flankNodes; index += 1) {
      const t = index * step;
      const local = coneProfileHalfWidth(t, half, config.coneProfile);
      const waver = coneWaver(t, phase, flank, config.coneWaverAmount);
      const depth = noseHalf + length * t;
      const at = capSegments + index;
      nodes[at * 3] = frontX - direction * depth;
      nodes[at * 3 + 1] = noseY + side * local * bias * (1 + waver) + local * lift;
      nodes[at * 3 + 2] = depth / total;
    }
  };

  /**
   * One side's worth of bands. Each is a quad straddling the boundary, filled
   * with a gradient running across it — outside, through the bright line, and
   * away into the interior.
   */
  const paintBoundary = (
    context: CanvasRenderingContext2D,
    nodes: Float64Array,
    seedBase: number,
    half: number,
    capFraction: number,
    insideX: number,
    intensity: number,
  ): void => {
    const maxWidth = Math.max(half * 0.8, EDGE_MIN_BAND);

    for (let index = 0; index + 2 < chainNodes; index += 1) {
      const depth = nodeDepth(nodes, index + 1);
      // Compression is strongest on the axis, so the cap keeps a density floor
      // that fades out exactly where the collar profile takes over.
      const floor = NOSE_DENSITY * Math.max(0, 1 - depth / Math.max(capFraction, 1e-6));
      const jitter = edgeJitter(seedBase + index);
      const alpha =
        config.edgeAlpha * intensity * Math.max(coneDensity(depth), floor) * jitter.alpha;
      if (alpha <= MIN_ALPHA) continue;

      const ax = nodeX(nodes, index);
      const ay = nodeY(nodes, index);
      const bx = nodeX(nodes, index + 2);
      const by = nodeY(nodes, index + 2);
      const runX = bx - ax;
      const runY = by - ay;
      const span = Math.hypot(runX, runY);
      if (!(span > 0)) continue;

      const midX = (ax + bx) / 2;
      const midY = (ay + by) / 2;
      // Unit normal to the band, turned to face away from the cone's interior.
      // Referencing an interior point rather than the axis keeps this correct
      // around the nose, where the boundary runs across the flight line.
      let normalX = -runY / span;
      let normalY = runX / span;
      if (normalX * (midX - insideX) + normalY * (midY - noseY) < 0) {
        normalX = -normalX;
        normalY = -normalY;
      }

      const width = Math.min(edgeBandWidth(depth, half), maxWidth);
      const outer = width * EDGE_OUTER_RATIO;
      const inner = width - outer;

      const gradient = context.createLinearGradient(
        midX + normalX * outer,
        midY + normalY * outer,
        midX - normalX * inner,
        midY - normalY * inner,
      );
      const tone = depth < 0.3 ? config.hotColor : config.coolColor;
      for (const stop of EDGE_STOPS) {
        gradient.addColorStop(stop.offset, rgba(tone, alpha * stop.alpha));
      }

      context.fillStyle = gradient;
      context.beginPath();
      context.moveTo(ax + normalX * outer, ay + normalY * outer);
      context.lineTo(bx + normalX * outer, by + normalY * outer);
      context.lineTo(bx - normalX * inner, by - normalY * inner);
      context.lineTo(ax - normalX * inner, ay - normalY * inner);
      context.closePath();
      context.fill();
    }
  };

  /** A single faint wash inside the cone, so the shell has some volume behind it. */
  const paintBody = (
    context: CanvasRenderingContext2D,
    frontX: number,
    reach: number,
    intensity: number,
  ): void => {
    const alpha = config.bodyAlpha * intensity;
    if (alpha <= MIN_ALPHA) return;

    const gradient = context.createLinearGradient(frontX, noseY, frontX - direction * reach, noseY);
    gradient.addColorStop(0, rgba(config.hotColor, alpha * 0.75));
    gradient.addColorStop(0.22, rgba(config.hotColor, alpha));
    gradient.addColorStop(0.55, rgba(config.coolColor, alpha * 0.6));
    gradient.addColorStop(1, rgba(config.coolColor, 0));

    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(nodeX(upper, 0), nodeY(upper, 0));
    for (let index = 1; index < chainNodes; index += 1) {
      context.lineTo(nodeX(upper, index), nodeY(upper, index));
    }
    for (let index = chainNodes - 1; index >= 0; index -= 1) {
      context.lineTo(nodeX(lower, index), nodeY(lower, index));
    }
    context.closePath();
    context.fill();
  };

  const draw = (context: CanvasRenderingContext2D): void => {
    if (!tracked || idle > config.noseHold) return;
    const mach = machNumber(speed, config.waveSpeed);
    const intensity = shockIntensity(
      mach,
      config.machFull,
      config.machOnset,
      config.intensityCurve,
    );
    if (intensity <= 0) return;

    const length = clamp(speed * config.coneTime, config.minConeLength, config.maxConeLength);
    const half = shroudHalfWidth(length, mach);
    const noseHalf = coneProfileHalfWidth(0, half, config.coneProfile);
    const phase = travelled * config.conePhaseRate;
    // The shock detaches and stands off ahead of the projectile, along travel.
    const standoff = Math.min(
      bowShockStandoff(mach, config.noseRadius, config.maxStandoffFactor) * NOSE_STANDOFF_SCALE,
      length * NOSE_STANDOFF_LIMIT,
    );
    const frontX = noseX + direction * standoff;
    const reach = length + noseHalf;

    layBoundary(upper, -1, 0, 1 + config.coneAsymmetry, frontX, length, half, noseHalf, phase);
    layBoundary(lower, 1, 1, 1 - config.coneAsymmetry * 0.7, frontX, length, half, noseHalf, phase);

    const capFraction = noseHalf / reach;
    const insideX = frontX - direction * reach * 0.45;

    context.save();
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    paintBody(context, frontX, reach, intensity);
    paintBoundary(context, upper, 0, half, capFraction, insideX, intensity);
    paintBoundary(context, lower, 601, half, capFraction, insideX, intensity);
    context.restore();
  };

  const clear = (): void => {
    tracked = false;
    pending = false;
    measured = false;
    speed = 0;
    travelled = 0;
    idle = 0;
    direction = 1;
  };

  return { track, advance, draw, clear };
}

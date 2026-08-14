import { describe, expect, it } from "vitest";
import {
  bowShockStandoff,
  CONE_WIDTH_SCALE,
  coneDensity,
  coneProfileHalfWidth,
  coneWaver,
  createShockwaveRenderer,
  EDGE_BAND_RATIO,
  EDGE_FALLOFF,
  EDGE_MIN_BAND,
  EDGE_OUTER_RATIO,
  EDGE_RISE,
  edgeBandWidth,
  edgeJitter,
  edgeProfile,
  estimateSpeed,
  hashNoise,
  isTrackDiscontinuity,
  MAX_CONE_ASPECT,
  MIN_CONE_ASPECT,
  machConeHalfAngle,
  machConeHalfWidth,
  machNumber,
  NOSE_BLEND,
  NOSE_BLUNTNESS,
  NOSE_STANDOFF_SCALE,
  resolveShockwaveOptions,
  rgba,
  SHOCKWAVE_DEFAULTS,
  type ShockwaveRenderer,
  shockIntensity,
  shroudHalfWidth,
  smoothSpeed,
} from "./shockwave";

/** Travel speeds the restored choreography produces across a ~1500px viewport. */
const MARC_SPEED = 6900;
const HERMANN_SPEED = 5100;
const LINE = 400;

interface Point {
  readonly x: number;
  readonly y: number;
}

interface FakeStop {
  readonly offset: number;
  readonly color: string;
  readonly alpha: number;
}

interface FakeGradient {
  readonly from: Point;
  readonly to: Point;
  readonly stops: FakeStop[];
  readonly addColorStop: (offset: number, color: string) => void;
}

interface Mark {
  readonly points: Point[];
  readonly gradient: FakeGradient | null;
  readonly composite: string;
  readonly peak: number;
}

interface FakeContext {
  readonly context: CanvasRenderingContext2D;
  readonly marks: Mark[];
  readonly radialGradients: number;
  readonly arcs: number;
  readonly ellipses: number;
  readonly strokes: number;
  readonly saves: () => number;
  readonly restores: () => number;
}

function alphaOf(color: string): number {
  const match = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)$/.exec(color);
  return match?.[1] === undefined ? Number.NaN : Number(match[1]);
}

function createFakeContext(): FakeContext {
  const marks: Mark[] = [];
  const gradients: FakeGradient[] = [];
  const counts = { radial: 0, arcs: 0, ellipses: 0, strokes: 0, saves: 0, restores: 0 };
  let points: Point[] = [];

  const surface = {
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillStyle: "" as unknown,
    strokeStyle: "" as unknown,
    lineWidth: 1,
    save() {
      counts.saves += 1;
    },
    restore() {
      counts.restores += 1;
    },
    beginPath() {
      points = [];
    },
    closePath() {
      // the recorded vertices already describe the polygon
    },
    moveTo(x: number, y: number) {
      points.push({ x, y });
    },
    lineTo(x: number, y: number) {
      points.push({ x, y });
    },
    arc() {
      counts.arcs += 1;
    },
    ellipse() {
      counts.ellipses += 1;
    },
    createRadialGradient() {
      counts.radial += 1;
      return { addColorStop() {} };
    },
    createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
      const stops: FakeStop[] = [];
      const gradient: FakeGradient = {
        from: { x: x0, y: y0 },
        to: { x: x1, y: y1 },
        stops,
        addColorStop(offset: number, color: string) {
          stops.push({ offset, color, alpha: alphaOf(color) });
        },
      };
      gradients.push(gradient);
      return gradient;
    },
    fill() {
      const gradient = gradients.includes(surface.fillStyle as FakeGradient)
        ? (surface.fillStyle as FakeGradient)
        : null;
      marks.push({
        points: [...points],
        gradient,
        composite: String(surface.globalCompositeOperation),
        peak: (gradient?.stops ?? []).reduce(
          (best, stop) => (Number.isNaN(stop.alpha) ? best : Math.max(best, stop.alpha)),
          0,
        ),
      });
    },
    stroke() {
      counts.strokes += 1;
    },
  };

  return {
    context: surface as unknown as CanvasRenderingContext2D,
    marks,
    get radialGradients() {
      return counts.radial;
    },
    get arcs() {
      return counts.arcs;
    },
    get ellipses() {
      return counts.ellipses;
    },
    get strokes() {
      return counts.strokes;
    },
    saves: () => counts.saves,
    restores: () => counts.restores,
  } as FakeContext;
}

const bands = (fake: FakeContext): Mark[] => fake.marks.filter((mark) => mark.points.length === 4);
const body = (fake: FakeContext): Mark[] => fake.marks.filter((mark) => mark.points.length > 4);

function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}
function length(v: Point): number {
  return Math.hypot(v.x, v.y);
}
function unit(v: Point): Point {
  const size = length(v) || 1;
  return { x: v.x / size, y: v.y / size };
}
function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}
/** The point a gradient's peak stop lands on, in canvas space. */
function peakPoint(mark: Mark): Point {
  const gradient = mark.gradient;
  if (!gradient) return { x: Number.NaN, y: Number.NaN };
  const best = gradient.stops.reduce((top, stop) => (stop.alpha > top.alpha ? stop : top));
  const axis = subtract(gradient.to, gradient.from);
  return { x: gradient.from.x + axis.x * best.offset, y: gradient.from.y + axis.y * best.offset };
}

/** Flies a pass at a fixed speed and returns the flight line. */
function fly(
  renderer: ShockwaveRenderer,
  speed: number,
  seconds: number,
  frame = 1 / 60,
  direction: -1 | 1 = -1,
): { readonly startX: number; readonly endX: number } {
  const startX = direction > 0 ? -100 : 1600;
  let x = startX;

  renderer.track(x, LINE, direction);
  renderer.advance(frame);
  const steps = Math.round(seconds / frame);
  for (let step = 0; step < steps; step += 1) {
    x += direction * speed * frame;
    renderer.track(x, LINE, direction);
    renderer.advance(frame);
  }

  return { startX, endX: x };
}

function drawPass(speed: number, seconds = 0.16, direction: -1 | 1 = -1): FakeContext {
  const renderer = createShockwaveRenderer();
  const fake = createFakeContext();
  fly(renderer, speed, seconds, 1 / 60, direction);
  renderer.draw(fake.context);
  return fake;
}

describe("mach geometry", () => {
  it("derives the Mach number from travel speed and the wave speed", () => {
    expect(machNumber(4500, 1500)).toBe(3);
    expect(machNumber(0, 1500)).toBe(0);
    expect(machNumber(4500, 0)).toBe(0);
    expect(machNumber(4500, Number.NaN)).toBe(0);
  });

  it("narrows the Mach cone as the projectile outruns its own pressure wave", () => {
    const slow = machConeHalfAngle(1.5);
    const fast = machConeHalfAngle(6);

    expect(slow).toBeCloseTo(Math.asin(1 / 1.5), 10);
    expect(fast).toBeLessThan(slow);
    expect(fast).toBeGreaterThan(0);
  });

  it("opens out to a normal wave front at or below Mach 1", () => {
    expect(machConeHalfAngle(1)).toBeCloseTo(Math.PI / 2, 10);
    expect(machConeHalfWidth(200, 0.8)).toBe(Number.POSITIVE_INFINITY);
  });

  it("keeps the strict cone half width consistent with the cone half angle", () => {
    expect(machConeHalfWidth(240, 3.2)).toBeCloseTo(240 * Math.tan(machConeHalfAngle(3.2)), 6);
  });
});

describe("drawn shroud width", () => {
  const marcMach = machNumber(MARC_SPEED, SHOCKWAVE_DEFAULTS.waveSpeed);
  const hermannMach = machNumber(HERMANN_SPEED, SHOCKWAVE_DEFAULTS.waveSpeed);

  it("opens the drawn cone well past the strict Mach angle", () => {
    expect(CONE_WIDTH_SCALE).toBeGreaterThan(1.5);
    for (const mach of [hermannMach, marcMach]) {
      expect(shroudHalfWidth(400, mach)).toBeGreaterThan(machConeHalfWidth(400, mach) * 1.4);
    }
  });

  it("reads wide at both restored pass speeds", () => {
    for (const [speed, mach] of [
      [HERMANN_SPEED, hermannMach],
      [MARC_SPEED, marcMach],
    ] as const) {
      const len = speed * SHOCKWAVE_DEFAULTS.coneTime;
      const halfAngle = Math.atan(shroudHalfWidth(len, mach) / len);
      expect(halfAngle).toBeGreaterThan((22 * Math.PI) / 180);
      expect(halfAngle).toBeLessThan((45 * Math.PI) / 180);
    }
  });

  it("holds the drawn width inside its own aspect band whatever the physics says", () => {
    expect(MIN_CONE_ASPECT).toBeLessThan(MAX_CONE_ASPECT);
    for (const mach of [0.2, 0.9, 1, 1.05, 2, 4, 20, 400]) {
      const half = shroudHalfWidth(400, mach);
      expect(Number.isFinite(half)).toBe(true);
      expect(half).toBeGreaterThanOrEqual(400 * MIN_CONE_ASPECT - 1e-9);
      expect(half).toBeLessThanOrEqual(400 * MAX_CONE_ASPECT + 1e-9);
    }
  });

  it("still blunts as the pass slows toward the sound barrier", () => {
    expect(shroudHalfWidth(400, 1.6)).toBeGreaterThan(shroudHalfWidth(400, 6));
  });
});

describe("edge gradient profile", () => {
  it("peaks exactly on the flank line with falloff on both sides", () => {
    const stops = edgeProfile(0.1);
    const peak = stops.reduce((top, stop) => (stop.alpha > top.alpha ? stop : top));

    expect(peak.alpha).toBe(0.1);
    expect(peak.offset).toBeCloseTo(EDGE_OUTER_RATIO, 10);
    expect(stops.at(0)?.alpha).toBe(0);
    expect(stops.at(-1)?.alpha).toBe(0);
    expect(stops.filter((stop) => stop.alpha === peak.alpha)).toHaveLength(1);
  });

  it("rises to the edge and decays away from it, monotonically", () => {
    const stops = edgeProfile(1);
    const peakIndex = stops.findIndex((stop) => stop.alpha === 1);

    expect(peakIndex).toBeGreaterThan(0);
    expect(peakIndex).toBeLessThan(stops.length - 1);
    for (let index = 1; index < stops.length; index += 1) {
      const previous = stops[index - 1];
      const current = stops[index];
      if (!previous || !current) continue;
      expect(current.offset).toBeGreaterThan(previous.offset);
      if (index <= peakIndex) expect(current.alpha).toBeGreaterThan(previous.alpha);
      else expect(current.alpha).toBeLessThan(previous.alpha);
    }
  });

  it("keeps the bright core narrow so the eye reads a boundary", () => {
    const stops = edgeProfile(1);
    const shoulder = stops.at(1);
    const inner = stops.at(3);

    // Half strength is reached well inside a quarter of the band on each side.
    expect((shoulder?.offset ?? 1) - 0).toBeLessThan(0.2);
    expect((inner?.offset ?? 1) - EDGE_OUTER_RATIO).toBeLessThan(0.25);
  });

  it("exposes its tuning knobs and honours them", () => {
    expect(EDGE_OUTER_RATIO).toBeGreaterThan(0);
    expect(EDGE_OUTER_RATIO).toBeLessThan(0.5);
    expect(EDGE_RISE).toBeGreaterThan(0);
    expect(EDGE_FALLOFF).toBeGreaterThan(0);
    expect(EDGE_BAND_RATIO).toBeGreaterThan(0);
    expect(EDGE_MIN_BAND).toBeGreaterThan(0);

    const crisp = edgeProfile(1, 0.1, 0.3);
    const soft = edgeProfile(1, 0.4, 1);
    const peakOf = (stops: readonly { offset: number; alpha: number }[]): number =>
      stops.reduce((top, stop) => (stop.alpha > top.alpha ? stop : top)).offset;

    expect(peakOf(crisp)).toBeCloseTo(0.1, 10);
    expect(peakOf(soft)).toBeCloseTo(0.4, 10);
    expect(crisp.at(-2)?.offset ?? 1).toBeLessThan(soft.at(-2)?.offset ?? 0);
  });

  it("survives nonsense knobs", () => {
    for (const stops of [edgeProfile(1, 0, 0), edgeProfile(1, 5, 5), edgeProfile(0, 0.26, 0.5)]) {
      let previous = -1;
      for (const stop of stops) {
        expect(Number.isFinite(stop.offset)).toBe(true);
        expect(stop.offset).toBeGreaterThanOrEqual(previous);
        expect(stop.offset).toBeGreaterThanOrEqual(0);
        expect(stop.offset).toBeLessThanOrEqual(1);
        expect(stop.alpha).toBeGreaterThanOrEqual(0);
        previous = stop.offset;
      }
    }
  });
});

describe("shock intensity", () => {
  const { machFull, machOnset, intensityCurve } = SHOCKWAVE_DEFAULTS;
  const at = (mach: number): number => shockIntensity(mach, machFull, machOnset, intensityCurve);

  it("fades in from the transonic onset rather than switching on at Mach 1", () => {
    expect(at(machOnset)).toBe(0);
    expect(at(1)).toBeGreaterThan(0.1);
  });

  it("reaches and holds full strength at the design Mach number", () => {
    expect(at(machFull)).toBe(1);
    expect(at(machFull * 4)).toBe(1);
  });

  it("rises monotonically and stays weak-but-present when barely supersonic", () => {
    let previous = 0;
    for (let mach = machOnset; mach <= machFull; mach += 0.05) {
      const current = at(mach);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
    expect(at(1.1)).toBeGreaterThan(0.2);
    expect(at(1.1)).toBeLessThan(0.75);
  });
});

describe("bow shock stand-off", () => {
  it("presses the leading edge closer to the nose as speed rises", () => {
    expect(bowShockStandoff(4, 16)).toBeLessThan(bowShockStandoff(1.6, 16));
    expect(bowShockStandoff(8, 16)).toBeLessThan(bowShockStandoff(4, 16));
    expect(bowShockStandoff(8, 16)).toBeGreaterThan(0);
  });

  it("approaches the hypersonic limit of 0.386 nose radii", () => {
    expect(bowShockStandoff(60, 10)).toBeGreaterThan(3.86);
    expect(bowShockStandoff(60, 10)).toBeLessThan(3.9);
  });

  it("caps the subsonic blow-up and rejects a degenerate nose", () => {
    expect(bowShockStandoff(1, 16, 2)).toBe(32);
    expect(bowShockStandoff(4, 0)).toBe(0);
  });
});

describe("vapour cone shape", () => {
  it("starts blunt: a non-zero half width at the apex, not a point", () => {
    const apex = coneProfileHalfWidth(0, 100, 1);

    expect(apex).toBeGreaterThan(0);
    expect(apex).toBeCloseTo(100 * NOSE_BLUNTNESS, 6);
    expect(NOSE_BLUNTNESS).toBeGreaterThan(0);
    expect(NOSE_BLUNTNESS).toBeLessThan(0.4);
    expect(NOSE_BLEND).toBeGreaterThan(1);
  });

  it("blends the rounding into the flank without a corner, then runs straight", () => {
    const half = 100;
    const at = (t: number): number => coneProfileHalfWidth(t, half, 1);

    // Strictly rising, and never below the straight cone it converges onto.
    let previous = -1;
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const value = at(t);
      expect(value).toBeGreaterThan(previous);
      expect(value).toBeGreaterThanOrEqual(half * t - 1e-9);
      previous = value;
    }

    // Through the body the sides are straight: equal steps give equal growth.
    const bodySteps = [0.5, 0.625, 0.75, 0.875, 1].map(at);
    const growth: number[] = [];
    for (let index = 1; index < bodySteps.length; index += 1) {
      growth.push((bodySteps[index] ?? 0) - (bodySteps[index - 1] ?? 0));
    }
    // Straight to within a few percent: the blend converges onto the cone.
    for (const step of growth) {
      expect(step).toBeGreaterThan(half * 0.125 * 0.96);
      expect(step).toBeLessThan(half * 0.125 * 1.01);
    }
    expect(at(1)).toBeGreaterThan(half);
    expect(at(1)).toBeLessThan(half * 1.02);

    // The rounding is a front-only treatment: it has faded out by mid-cone.
    // The lift near the tip is modest now that the default profile is a
    // parabola, which is already blunt at the vertex on its own.
    expect(at(0.5) / (half * 0.5)).toBeLessThan(1.04);
    expect(at(0.08) / (half * 0.08)).toBeGreaterThan(1.15);
  });

  it("draws the edge thickest at the nose and thinning all the way back", () => {
    const half = 150;
    const widths = Array.from({ length: 21 }, (_, index) => edgeBandWidth(index / 20, half));

    // Strictly thinning: any swelling in the middle is the artefact we removed.
    for (let index = 1; index < widths.length; index += 1) {
      const previous = widths[index - 1] ?? 0;
      const current = widths[index] ?? 0;
      expect(current).toBeLessThanOrEqual(previous);
    }

    expect(widths[0]).toBeCloseTo(half * EDGE_BAND_RATIO, 6);
    expect(widths[0] ?? 0).toBeGreaterThan((widths[20] ?? 0) * 4);
    // Never vanishes, never runs away.
    for (const width of widths) {
      expect(width).toBeGreaterThanOrEqual(EDGE_MIN_BAND);
    }
    expect(edgeBandWidth(2, half)).toBe(EDGE_MIN_BAND);
    expect(edgeBandWidth(-1, half)).toBeCloseTo(half * EDGE_BAND_RATIO, 6);
  });

  it("defaults to a parabola lying on its side", () => {
    const half = 150;
    const at = (t: number): number => coneProfileHalfWidth(t, half, SHOCKWAVE_DEFAULTS.coneProfile);

    // x = y^2 on its side: half width goes as the square root of the distance
    // back from the apex, so it is already half its final width a quarter along.
    for (const t of [0.1, 0.25, 0.5, 0.75, 1]) {
      expect(at(t) / (half * Math.sqrt(t))).toBeCloseTo(1, 1);
    }

    // Opens fast at the front and keeps flattening: strictly decreasing growth.
    const steps = [0, 0.25, 0.5, 0.75, 1].map(at);
    const growth: number[] = [];
    for (let index = 1; index < steps.length; index += 1) {
      growth.push((steps[index] ?? 0) - (steps[index - 1] ?? 0));
    }
    for (let index = 1; index < growth.length; index += 1) {
      expect(growth[index] ?? 0).toBeLessThan(growth[index - 1] ?? 0);
    }
  });

  it("takes its bluntness and blend from its own knobs", () => {
    expect(coneProfileHalfWidth(0, 100, 1, 0.3)).toBeCloseTo(30, 6);
    expect(coneProfileHalfWidth(0, 100, 1, 0)).toBe(0);

    // A higher blend power keeps the rounding tighter to the tip.
    const tight = coneProfileHalfWidth(0.2, 100, 1, 0.14, 6);
    const loose = coneProfileHalfWidth(0.2, 100, 1, 0.14, 1.4);
    expect(tight).toBeLessThan(loose);
  });

  it("clamps its parameter and survives nonsense knobs", () => {
    expect(coneProfileHalfWidth(2, 100, 1)).toBe(coneProfileHalfWidth(1, 100, 1));
    expect(coneProfileHalfWidth(-1, 100, 1)).toBe(coneProfileHalfWidth(0, 100, 1));
    expect(Number.isFinite(coneProfileHalfWidth(0.5, 100, 1, Number.NaN, Number.NaN))).toBe(true);
    expect(Number.isFinite(coneProfileHalfWidth(0.5, 100, 1, -3, 0))).toBe(true);
  });

  it("condenses into a dense collar near the nose and dissolves down the tail", () => {
    expect(coneDensity(0)).toBe(0);
    expect(coneDensity(1)).toBe(0);
    expect(coneDensity(-1)).toBe(0);

    const samples = Array.from({ length: 201 }, (_, index) => coneDensity(index / 200));
    const peak = samples.indexOf(Math.max(...samples)) / 200;
    expect(peak).toBeGreaterThan(0.1);
    expect(peak).toBeLessThan(0.35);
    expect(Math.max(...samples)).toBeCloseTo(1, 4);

    expect(coneDensity(peak / 2)).toBeGreaterThan(0.5);
    expect(coneDensity(0.75)).toBeLessThan(0.45);
    for (let t = peak + 0.05; t < 1; t += 0.05) {
      expect(coneDensity(t)).toBeLessThan(coneDensity(t - 0.05));
    }
  });

  it("wavers the flank smoothly, differently on each side, within its amplitude", () => {
    for (let t = 0; t <= 1; t += 0.05) {
      expect(Math.abs(coneWaver(t, 1.3, 0, 0.18))).toBeLessThanOrEqual(0.18 + 1e-9);
      expect(Math.abs(coneWaver(t, 1.3, 1, 0.18))).toBeLessThanOrEqual(0.18 + 1e-9);
    }
    expect(coneWaver(0.4, 1.3, 0, 0.18)).not.toBeCloseTo(coneWaver(0.4, 1.3, 1, 0.18), 3);
    expect(coneWaver(0.4, 1.3, 0, 0.18)).toBeCloseTo(coneWaver(0.4, 1.3001, 0, 0.18), 3);
    expect(coneWaver(0.4, 1.3, 0, 0)).toBe(0);
  });
});

describe("deterministic irregularity", () => {
  it("hashes a seed to a stable value in the unit interval", () => {
    expect(hashNoise(7)).toBe(hashNoise(7));
    expect(hashNoise(7)).not.toBe(hashNoise(8));

    const samples = Array.from({ length: 512 }, (_, index) => hashNoise(index));
    for (const sample of samples) {
      expect(sample).toBeGreaterThanOrEqual(0);
      expect(sample).toBeLessThan(1);
    }
    const mean = samples.reduce((total, sample) => total + sample, 0) / samples.length;
    expect(mean).toBeGreaterThan(0.4);
    expect(mean).toBeLessThan(0.6);
    expect(new Set(samples).size).toBeGreaterThan(500);
  });

  it("survives a nonsense seed", () => {
    expect(Number.isFinite(hashNoise(Number.NaN))).toBe(true);
    expect(Number.isFinite(hashNoise(Number.POSITIVE_INFINITY))).toBe(true);
  });

  it("gives every band its own width and brightness, stably", () => {
    expect(edgeJitter(4)).toEqual(edgeJitter(4));
    expect(edgeJitter(4).alpha).not.toBe(edgeJitter(5).alpha);

    for (const seed of [0, 1, 2, 3, 5, 8, 13, 21, 34, 55]) {
      const jitter = edgeJitter(seed);
      expect(jitter.width).toBeGreaterThanOrEqual(0.78);
      expect(jitter.width).toBeLessThanOrEqual(1.26);
      expect(jitter.alpha).toBeGreaterThanOrEqual(0.66);
      expect(jitter.alpha).toBeLessThanOrEqual(1.34);
    }
  });
});

describe("colour helper", () => {
  it("renders an rgba string with a clamped alpha", () => {
    expect(rgba([206, 226, 255], 0.5)).toBe("rgba(206, 226, 255, 0.5)");
    expect(alphaOf(rgba([206, 226, 255], 0))).toBe(0);
    expect(alphaOf(rgba([206, 226, 255], 4))).toBe(1);
    expect(alphaOf(rgba([206, 226, 255], Number.NaN))).toBe(0);
  });
});

describe("speed estimation", () => {
  it("infers speed from a step and the frame delta", () => {
    expect(estimateSpeed(-80, 0, 0.016)).toBeCloseTo(5000, 6);
    expect(estimateSpeed(3, 4, 0.01)).toBeCloseTo(500, 6);
  });

  it("returns zero rather than infinity for a non-advancing clock", () => {
    expect(estimateSpeed(-80, 0, 0)).toBe(0);
    expect(estimateSpeed(Number.NaN, 0, 0.016)).toBe(0);
  });

  it("smooths toward the sample independently of the frame rate", () => {
    const response = 0.04;
    const oneBigStep = smoothSpeed(0, 5000, response, 0.032);
    const twoSmallSteps = smoothSpeed(smoothSpeed(0, 5000, response, 0.016), 5000, response, 0.016);

    expect(twoSmallSteps).toBeCloseTo(oneBigStep, 6);
    expect(oneBigStep).toBeGreaterThan(0);
    expect(oneBigStep).toBeLessThan(5000);
  });

  it("snaps to the sample when smoothing is disabled", () => {
    expect(smoothSpeed(0, 5000, 0, 0.016)).toBe(5000);
  });
});

describe("track discontinuity", () => {
  const limits = { maxSpeed: 45000, maxLateralStep: 140 };

  it("accepts an ordinary frame step at the restored pass speed", () => {
    expect(isTrackDiscontinuity(-HERMANN_SPEED / 60, 0, -1, 1 / 60, limits)).toBe(false);
    expect(isTrackDiscontinuity(MARC_SPEED / 60, 0, 1, 1 / 60, limits)).toBe(false);
  });

  it("rejects a reversed step, a teleport, a re-layout and an untimeable step", () => {
    expect(isTrackDiscontinuity(85, 0, -1, 0.016, limits)).toBe(true);
    expect(isTrackDiscontinuity(-1500, 0, -1, 0.016, limits)).toBe(true);
    expect(isTrackDiscontinuity(-25, 220, -1, 0.016, limits)).toBe(true);
    expect(isTrackDiscontinuity(-25, 0, -1, 0, limits)).toBe(true);
  });
});

describe("shockwave options", () => {
  it("is tuned so the restored pass speeds land solidly supersonic", () => {
    const config = resolveShockwaveOptions();
    const marc = machNumber(MARC_SPEED, config.waveSpeed);
    const hermann = machNumber(HERMANN_SPEED, config.waveSpeed);

    expect(hermann).toBeGreaterThan(3);
    expect(marc).toBeGreaterThan(hermann);
    expect(marc).toBeLessThan(6);
    expect(shockIntensity(hermann, config.machFull, config.machOnset, config.intensityCurve)).toBe(
      1,
    );
  });

  it("sizes the shroud to a real fraction of the viewport at pass speed", () => {
    const config = resolveShockwaveOptions();
    const len = HERMANN_SPEED * config.coneTime;

    expect(len).toBeGreaterThan(config.minConeLength);
    expect(len).toBeLessThan(config.maxConeLength);
  });

  it("keeps the edge readable and the interior far fainter", () => {
    const config = resolveShockwaveOptions();

    expect(config.edgeAlpha).toBeGreaterThan(0.03);
    expect(config.edgeAlpha).toBeLessThan(0.25);
    expect(config.bodyAlpha).toBeLessThan(config.edgeAlpha / 2);
    expect(config.edgeSegments).toBeGreaterThanOrEqual(8);
  });

  it("keeps defaults for options left undefined", () => {
    const defaults = resolveShockwaveOptions();
    const config = resolveShockwaveOptions({ coneTime: undefined, waveSpeed: 900 });

    expect(config.coneTime).toBe(defaults.coneTime);
    expect(config.waveSpeed).toBe(900);
  });
});

describe("shockwave renderer lifecycle", () => {
  it("is a no-op before the projectile has ever been tracked", () => {
    const renderer = createShockwaveRenderer();
    const fake = createFakeContext();

    expect(() => renderer.advance(0.016)).not.toThrow();
    renderer.draw(fake.context);

    expect(fake.marks).toHaveLength(0);
    expect(fake.saves()).toBe(0);
  });

  it("ignores a non-advancing or invalid delta", () => {
    const renderer = createShockwaveRenderer();
    const fake = createFakeContext();

    renderer.track(1000, LINE, -1);
    expect(() => renderer.advance(0)).not.toThrow();
    expect(() => renderer.advance(-1)).not.toThrow();
    expect(() => renderer.advance(Number.NaN)).not.toThrow();
    renderer.draw(fake.context);

    expect(fake.marks).toHaveLength(0);
  });

  it("ignores a non-finite tracked position", () => {
    const renderer = createShockwaveRenderer();
    const fake = createFakeContext();

    renderer.track(Number.NaN, LINE, -1);
    renderer.advance(1 / 60);
    renderer.track(1000, Number.POSITIVE_INFINITY, -1);
    renderer.advance(1 / 60);
    renderer.draw(fake.context);

    expect(fake.marks).toHaveLength(0);
  });

  it("lets the shroud go the moment the projectile stops being tracked", () => {
    const renderer = createShockwaveRenderer();
    fly(renderer, HERMANN_SPEED, 0.16);

    renderer.advance(0.2);
    const fake = createFakeContext();
    renderer.draw(fake.context);

    expect(fake.marks).toHaveLength(0);
  });

  it("clears back to a blank, reusable state", () => {
    const renderer = createShockwaveRenderer();
    fly(renderer, HERMANN_SPEED, 0.16);

    renderer.clear();
    const cleared = createFakeContext();
    renderer.draw(cleared.context);
    expect(cleared.marks).toHaveLength(0);

    fly(renderer, HERMANN_SPEED, 0.16);
    const restarted = createFakeContext();
    renderer.draw(restarted.context);
    expect(restarted.marks.length).toBeGreaterThan(8);
  });

  it("balances its context save and restore", () => {
    const fake = drawPass(HERMANN_SPEED);

    expect(fake.saves()).toBe(1);
    expect(fake.restores()).toBe(1);
  });

  it("restarts rather than drawing garbage when tracking jumps or reverses", () => {
    const renderer = createShockwaveRenderer();
    const frame = 1 / 60;
    let x = 1500;

    renderer.track(x, LINE, -1);
    renderer.advance(frame);
    for (let step = 0; step < 8; step += 1) {
      x -= HERMANN_SPEED * frame;
      renderer.track(x, LINE, -1);
      renderer.advance(frame);
    }
    renderer.track(x - 1400, LINE, -1);
    renderer.advance(frame);
    const jumped = createFakeContext();
    renderer.draw(jumped.context);
    expect(jumped.marks).toHaveLength(0);

    renderer.track(200, LINE, 1);
    renderer.advance(frame);
    const reversed = createFakeContext();
    renderer.draw(reversed.context);
    expect(reversed.marks).toHaveLength(0);
  });
});

describe("shockwave renderer look", () => {
  it("draws nothing round: no arcs, no ellipses, no radial gradients, no strokes", () => {
    const fake = drawPass(HERMANN_SPEED);

    expect(fake.marks.length).toBeGreaterThan(8);
    expect(fake.arcs).toBe(0);
    expect(fake.ellipses).toBe(0);
    expect(fake.radialGradients).toBe(0);
    expect(fake.strokes).toBe(0);
    for (const mark of fake.marks) {
      expect(mark.gradient).not.toBeNull();
      expect(mark.points.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("builds the edges from straight-sided bands and the interior from one faint fill", () => {
    const fake = drawPass(HERMANN_SPEED);

    expect(body(fake)).toHaveLength(1);
    expect(bands(fake).length).toBeGreaterThanOrEqual(16);
    const interior = body(fake)[0];
    expect(interior?.peak ?? 1).toBeLessThan(Math.max(...bands(fake).map((band) => band.peak)) / 2);
  });

  it("runs every edge gradient perpendicular to its own band", () => {
    for (const band of bands(drawPass(HERMANN_SPEED))) {
      const gradient = band.gradient;
      const [p0, p1] = band.points;
      if (!gradient || !p0 || !p1) throw new Error("malformed band");

      const along = subtract(p1, p0);
      const across = subtract(gradient.to, gradient.from);
      expect(length(along)).toBeGreaterThan(0);
      expect(Math.abs(dot(unit(along), unit(across)))).toBeLessThan(1e-9);
    }
  });

  it("spans the gradient across exactly the band's thickness", () => {
    for (const band of bands(drawPass(HERMANN_SPEED))) {
      const gradient = band.gradient;
      const [p0, , , p3] = band.points;
      if (!gradient || !p0 || !p3) throw new Error("malformed band");

      expect(length(subtract(gradient.to, gradient.from))).toBeCloseTo(length(subtract(p0, p3)), 6);
    }
  });

  it("places the bright peak on the flank line, dimmer to either side of it", () => {
    for (const band of bands(drawPass(HERMANN_SPEED))) {
      const stops = band.gradient?.stops ?? [];
      const peakIndex = stops.findIndex((stop) => stop.alpha === band.peak);

      expect(peakIndex).toBeGreaterThan(0);
      expect(peakIndex).toBeLessThan(stops.length - 1);
      expect(stops.at(0)?.alpha).toBe(0);
      expect(stops.at(-1)?.alpha).toBe(0);
      expect(stops[peakIndex]?.offset).toBeCloseTo(EDGE_OUTER_RATIO, 10);
      expect(stops[peakIndex - 1]?.alpha ?? 1).toBeLessThan(band.peak);
      expect(stops[peakIndex + 1]?.alpha ?? 1).toBeLessThan(band.peak);
    }
  });

  it("traces two flanks that diverge from the nose down the cone", () => {
    const fake = drawPass(HERMANN_SPEED);
    const peaks = bands(fake).map(peakPoint);
    const above = peaks.filter((point) => point.y < LINE);
    const below = peaks.filter((point) => point.y > LINE);

    expect(above.length).toBeGreaterThan(4);
    expect(below.length).toBeGreaterThan(4);

    const nose = Math.min(...peaks.map((point) => point.x));
    for (const flank of [above, below]) {
      const sorted = [...flank].sort((left, right) => left.x - right.x);
      const first = sorted.at(0);
      const last = sorted.at(-1);
      if (!first || !last) throw new Error("missing flank");
      expect(Math.abs(first.y - LINE)).toBeLessThan(Math.abs(last.y - LINE));
      expect(first.x - nose).toBeLessThan(last.x - nose);
    }
  });

  it("tapers the edge along the length: a bright collar and a dissolving tail", () => {
    const fake = drawPass(HERMANN_SPEED);
    const marks = bands(fake);
    const peaks = marks.map(peakPoint);
    const nose = Math.min(...peaks.map((point) => point.x));
    const tail = Math.max(...peaks.map((point) => point.x)) - nose;

    const depth = (index: number): number => (peaks[index]?.x ?? nose) - nose;
    const collar = marks.filter((_, index) => depth(index) < tail * 0.4);
    const trailing = marks.filter((_, index) => depth(index) > tail * 0.7);
    const mean = (list: Mark[]): number =>
      list.reduce((total, mark) => total + mark.peak, 0) / list.length;

    expect(collar.length).toBeGreaterThan(2);
    expect(trailing.length).toBeGreaterThan(2);
    expect(mean(collar)).toBeGreaterThan(mean(trailing) * 1.8);
  });

  it("is a wide cone, not a dart", () => {
    const fake = drawPass(HERMANN_SPEED);
    const points = fake.marks.flatMap((mark) => mark.points);
    const axial =
      Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x));
    const lateral = Math.max(...points.map((point) => Math.abs(point.y - LINE)));

    expect(axial).toBeGreaterThan(200);
    expect(lateral / axial).toBeGreaterThan(0.4);
  });

  it("hangs off the flight line asymmetrically instead of mirroring its flanks", () => {
    const peaks = bands(drawPass(HERMANN_SPEED)).map(peakPoint);
    const reach = (list: Point[]): number =>
      Math.max(...list.map((point) => Math.abs(point.y - LINE)));

    expect(reach(peaks.filter((point) => point.y < LINE))).not.toBeCloseTo(
      reach(peaks.filter((point) => point.y > LINE)),
      1,
    );
  });

  it("keeps the cone behind the nose whichever way the projectile flies", () => {
    for (const direction of [-1, 1] as const) {
      const fake = drawPass(direction < 0 ? HERMANN_SPEED : MARC_SPEED, 0.16, direction);
      const xs = fake.marks.flatMap((mark) => mark.points).map((point) => point.x);
      const nose = direction < 0 ? Math.min(...xs) : Math.max(...xs);
      const behind = xs.filter((x) => (direction < 0 ? x > nose + 100 : x < nose - 100));

      expect(behind.length).toBeGreaterThan(10);
    }
  });

  it("keeps every drawn number finite and every alpha restrained", () => {
    for (const speed of [MARC_SPEED, HERMANN_SPEED, 2500, 1600]) {
      const fake = drawPass(speed);
      for (const mark of fake.marks) {
        for (const point of mark.points) {
          expect(Number.isFinite(point.x)).toBe(true);
          expect(Number.isFinite(point.y)).toBe(true);
        }
        for (const stop of mark.gradient?.stops ?? []) {
          expect(Number.isNaN(stop.alpha)).toBe(false);
          expect(stop.alpha).toBeLessThanOrEqual(0.3);
        }
      }
    }
  });

  it("keeps the per-frame cost bounded", () => {
    const config = resolveShockwaveOptions();
    const fake = drawPass(MARC_SPEED);

    expect(fake.marks.length).toBeLessThanOrEqual(
      (config.edgeSegments + config.noseSegments) * 2 + 1,
    );
  });

  it("closes the boundary around a rounded nose instead of a point", () => {
    const fake = drawPass(HERMANN_SPEED);
    const peaks = bands(fake).map(peakPoint);
    // Front-most first: the cone runs right-to-left, so ahead is smaller x.
    const front = [...peaks].sort((left, right) => left.x - right.x);
    const first = front.at(0);
    const second = front.at(1);
    if (!first || !second) throw new Error("missing nose bands");

    // The two flanks come together across the front rather than leaving a gap.
    expect(Math.abs(first.y - second.y)).toBeLessThan(40);
    expect(Math.abs(first.y - LINE)).toBeLessThan(30);
    expect(Math.abs(second.y - LINE)).toBeLessThan(30);
    expect(Math.sign(first.y - LINE)).not.toBe(Math.sign(second.y - LINE));

    // And the boundary steps around the nose in small increments: no corner.
    const nose = front.filter((point) => point.x < (front.at(0)?.x ?? 0) + 60);
    expect(nose.length).toBeGreaterThanOrEqual(4);
    const spread = nose.map((point) => Math.abs(point.y - LINE)).sort((a, b) => a - b);
    for (let index = 1; index < spread.length; index += 1) {
      expect((spread[index] ?? 0) - (spread[index - 1] ?? 0)).toBeLessThan(50);
    }
  });

  it("stands the cone a short distance ahead of the projectile, whichever way it flies", () => {
    for (const direction of [-1, 1] as const) {
      const renderer = createShockwaveRenderer();
      const fake = createFakeContext();
      const pass = fly(
        renderer,
        direction < 0 ? HERMANN_SPEED : MARC_SPEED,
        0.16,
        1 / 60,
        direction,
      );
      renderer.draw(fake.context);

      const xs = fake.marks.flatMap((mark) => mark.points).map((point) => point.x);
      // Ahead is whichever way the projectile is travelling.
      const tip = direction < 0 ? Math.min(...xs) : Math.max(...xs);
      const gap = (tip - pass.endX) * direction;

      expect(gap).toBeGreaterThan(0);
      expect(gap).toBeLessThan(120);
    }
  });

  it("scales the stand-off with the bow shock rather than pinning it to the nose", () => {
    expect(NOSE_STANDOFF_SCALE).toBeGreaterThan(0);
    expect(bowShockStandoff(3.4, 16, 2) * NOSE_STANDOFF_SCALE).toBeGreaterThan(8);
    expect(bowShockStandoff(3.4, 16, 2) * NOSE_STANDOFF_SCALE).toBeLessThan(60);
  });

  it("keeps the gap proportionate when the transonic stand-off blows up", () => {
    // Billig runs away toward Mach 1, so the gap is also capped against the
    // cone's own length: a short cone must not float far out in front.
    for (const speed of [HERMANN_SPEED, 2500, 1600]) {
      const renderer = createShockwaveRenderer();
      const fake = createFakeContext();
      const pass = fly(renderer, speed, 0.16);
      renderer.draw(fake.context);

      const xs = fake.marks.flatMap((mark) => mark.points).map((point) => point.x);
      const gap = pass.endX - Math.min(...xs);
      const span = Math.max(...xs) - Math.min(...xs);

      expect(gap).toBeGreaterThan(0);
      expect(gap / span).toBeLessThan(0.22);
    }
  });
});

describe("shockwave renderer simulation", () => {
  it("draws the same shroud at any frame rate", () => {
    const shape = (frame: number): number[] => {
      const renderer = createShockwaveRenderer();
      const fake = createFakeContext();
      fly(renderer, HERMANN_SPEED, 0.18, frame);
      renderer.draw(fake.context);
      return fake.marks.flatMap((mark) => mark.points.flatMap((point) => [point.x, point.y]));
    };

    const sixty = shape(1 / 60);
    const oneTwenty = shape(1 / 120);

    expect(sixty.length).toBeGreaterThan(60);
    expect(oneTwenty).toHaveLength(sixty.length);
    for (const [index, value] of sixty.entries()) {
      expect(oneTwenty[index] ?? Number.NaN).toBeCloseTo(value, 6);
    }
  });

  it("lets the edge breathe as the projectile travels", () => {
    const renderer = createShockwaveRenderer();
    const frame = 1 / 60;
    let x = 1600;
    const shapes: number[][] = [];

    renderer.track(x, LINE, -1);
    renderer.advance(frame);
    for (let step = 0; step < 14; step += 1) {
      x -= HERMANN_SPEED * frame;
      renderer.track(x, LINE, -1);
      renderer.advance(frame);
      const fake = createFakeContext();
      renderer.draw(fake.context);
      shapes.push(bands(fake).map((band) => peakPoint(band).y - LINE));
    }

    const first = shapes.at(4) ?? [];
    const last = shapes.at(-1) ?? [];
    expect(first.length).toBeGreaterThan(0);
    expect(last).toHaveLength(first.length);
    expect(last.some((value, index) => Math.abs(value - (first[index] ?? 0)) > 1)).toBe(true);
  });
});

describe("shockwave renderer across the speed range", () => {
  const strength = (speed: number): number =>
    drawPass(speed, 0.16).marks.reduce((peak, mark) => Math.max(peak, mark.peak), 0);

  it("reads at full strength at both restored pass speeds", () => {
    expect(strength(MARC_SPEED)).toBeGreaterThan(0.05);
    expect(strength(HERMANN_SPEED)).toBeGreaterThan(0.05);
  });

  it("weakens rather than vanishes as the pass slows", () => {
    const full = strength(HERMANN_SPEED);
    const slow = strength(2500);
    const slower = strength(1600);

    expect(slow).toBeLessThan(full);
    expect(slow).toBeGreaterThan(0);
    expect(slower).toBeLessThan(slow);
    expect(slower).toBeGreaterThan(0);
  });

  it("falls silent only for a genuinely subsonic drift", () => {
    expect(strength(1000)).toBe(0);
    expect(strength(400)).toBe(0);
  });
});

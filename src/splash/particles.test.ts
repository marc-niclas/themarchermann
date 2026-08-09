import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDustBurst, DUST_BURST_COUNT, DUST_MAX_MOTES, DUST_MAX_SETTLED } from "./dust";
import {
  createArcFlameSeat,
  FLAME_GOUT_GAIN,
  FLAME_LAUNCH_RISE,
  FLAME_MAX_PARCELS,
  FLAME_RAMP,
  IGNITION_FLARE,
  IGNITION_FLASH_COUNT,
  IGNITION_LIFE_GAIN,
  IGNITION_SPAWN_GAIN,
  ignitionGain,
} from "./flame";
import { emberTrailPoint, FLAME_PROFILE, ParticleEmitter } from "./particles";

/** Records the draw calls the emitter makes, in order, with their arguments. */
interface DrawOp {
  readonly op: string;
  readonly args: readonly number[];
}

function createSurface(): { readonly ops: DrawOp[]; readonly canvas: HTMLCanvasElement } {
  const ops: DrawOp[] = [];
  const record =
    (op: string) =>
    (...args: number[]) => {
      ops.push({ op, args });
    };

  const context = {
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillStyle: "",
    shadowBlur: 0,
    shadowColor: "",
    save: record("save"),
    restore: record("restore"),
    translate: record("translate"),
    setTransform: record("setTransform"),
    clearRect: record("clearRect"),
    fillRect: record("fillRect"),
    beginPath: record("beginPath"),
    ellipse: record("ellipse"),
    fill: record("fill"),
  };

  const canvas = { getContext: () => context, style: {}, width: 0, height: 0 };
  return { ops, canvas: canvas as unknown as HTMLCanvasElement };
}

const VIEWPORT = { devicePixelRatio: 1, innerWidth: 1200, innerHeight: 800 };

describe("emitter scroll window", () => {
  const globals = globalThis as { window?: unknown };
  let saved: unknown;

  beforeAll(() => {
    saved = globals.window;
    globals.window = VIEWPORT;
  });
  afterAll(() => {
    globals.window = saved;
  });

  /** The MARC word and its C, already lifted into document space. */
  const word = { left: 50, right: 525, top: 248, bottom: 368 };
  const letter = { left: 414, right: 525, top: 313, bottom: 423 };

  /** Runs enough emitter time for every mote of a burst to be on the page. */
  const settleDust = (emitter: ParticleEmitter, from = 0) => {
    let time = from;
    // Well past the longest possible flight, so nothing is still in the air.
    for (let frame = 0; frame < 240; frame += 1) {
      time += 25;
      emitter.render(time, 0, 0);
    }
    return time;
  };

  it("draws its world through the page's scroll offset", () => {
    const { ops, canvas } = createSurface();
    const emitter = new ParticleEmitter(canvas);
    emitter.burstDust(createDustBurst(word, letter, 1));

    ops.length = 0;
    emitter.render(16, 0, 800);

    const translate = ops.find((entry) => entry.op === "translate");
    expect(translate).toBeDefined();
    expect(translate?.args[1]).toBe(-800);
    expect(Math.abs(translate?.args[0] ?? 1)).toBe(0);
  });

  it("clears the fixed canvas in viewport space, before the scroll translation", () => {
    const { ops, canvas } = createSurface();
    const emitter = new ParticleEmitter(canvas);

    ops.length = 0;
    emitter.render(16, 0, 800);

    const clear = ops.findIndex((entry) => entry.op === "clearRect");
    const translate = ops.findIndex((entry) => entry.op === "translate");
    expect(clear).toBeGreaterThanOrEqual(0);
    expect(clear).toBeLessThan(translate);
    expect(ops[clear]?.args).toEqual([0, 0, VIEWPORT.innerWidth, VIEWPORT.innerHeight]);
  });

  it("balances its save and restore so the shockwave after it is untouched", () => {
    const { ops, canvas } = createSurface();
    const emitter = new ParticleEmitter(canvas);
    emitter.anchorFlame("marc-c", createArcFlameSeat(word, letter));
    emitter.burstDust(createDustBurst(word, letter, 1));

    ops.length = 0;
    emitter.render(16, 0, 800);

    expect(ops.filter((entry) => entry.op === "save")).toHaveLength(1);
    expect(ops.filter((entry) => entry.op === "restore")).toHaveLength(1);
    // Nothing is drawn after the transform is put back, so whatever the
    // controller draws next sits in viewport space.
    expect(ops[ops.length - 1]?.op).toBe("restore");
    // The transform is only ever set up front, by resize.
    expect(ops.some((entry) => entry.op === "setTransform")).toBe(false);
  });

  it("keeps settled dust on the same document position when the page scrolls", () => {
    const { ops, canvas } = createSurface();
    const emitter = new ParticleEmitter(canvas);
    emitter.burstDust(createDustBurst(word, letter, 1));
    const time = settleDust(emitter);

    ops.length = 0;
    emitter.render(time + 25, 0, 0);
    const atTop = ops.filter((entry) => entry.op === "fillRect").map((entry) => entry.args);

    ops.length = 0;
    emitter.render(time + 50, 0, 800);
    const scrolled = ops.filter((entry) => entry.op === "fillRect").map((entry) => entry.args);

    expect(atTop.length).toBe(DUST_BURST_COUNT);
    expect(scrolled.length).toBe(atTop.length);
    // Identical document coordinates: only the translation moved, which is what
    // carries the dust up the screen along with the type.
    const positions = (rects: readonly (readonly number[])[]) =>
      rects.map((rect) => `${rect[0]?.toFixed(6)},${rect[1]?.toFixed(6)}`).sort();
    expect(positions(scrolled)).toEqual(positions(atTop));
    // And it is genuinely settled: parked in the band under the word baseline.
    for (const rect of scrolled) expect(rect[1]).toBeGreaterThanOrEqual(word.bottom);
  });
});

describe("ember drip path", () => {
  const source = { x: 72, y: 500 };
  const target = { x: 82, y: 590 };

  it("falls from the H to the About outline with a slight sideways curl", () => {
    expect(emberTrailPoint(source, target, 0)).toEqual(source);
    expect(emberTrailPoint(source, target, 1)).toEqual(target);

    const quarter = emberTrailPoint(source, target, 0.25);
    const half = emberTrailPoint(source, target, 0.5);
    const threeQuarter = emberTrailPoint(source, target, 0.75);
    expect(quarter.y).toBeLessThan(half.y);
    expect(half.y).toBeLessThan(threeQuarter.y);
    expect(half.x).not.toBeCloseTo(source.x + (target.x - source.x) * 0.5, 3);
  });
});

describe("signature splash particle profiles", () => {
  it("sustains the anchored fire without flooding the frame", () => {
    const profile = FLAME_PROFILE;

    expect(profile.minLife).toBeGreaterThanOrEqual(0.35);
    expect(profile.maxLife).toBeGreaterThan(profile.minLife);
    expect(profile.spawnRate).toBeGreaterThanOrEqual(60);
    expect(profile.spawnRate).toBeLessThanOrEqual(140);

    // Live parcels per seat, which is what actually costs us per frame.
    const averageLife = (profile.minLife + profile.maxLife) / 2;
    expect(profile.spawnRate * averageLife).toBeLessThan(90);
  });

  it("draws its colour from the flame ramp rather than a private palette", () => {
    const profile = FLAME_PROFILE;

    expect(profile.colors).toEqual([...FLAME_RAMP]);
    expect(profile.colors).toContain("#ff3d00");
    expect(profile.colors).toContain("#fff7c2");
  });

  it("keeps both seats inside the parcel budget at the height of their flare", () => {
    const averageLife = (FLAME_PROFILE.minLife + FLAME_PROFILE.maxLife) / 2;
    const peakRate = FLAME_PROFILE.spawnRate * ignitionGain(IGNITION_FLARE, IGNITION_SPAWN_GAIN);
    const peakLife = averageLife * ignitionGain(IGNITION_FLARE, IGNITION_LIFE_GAIN);
    const seats = 2;

    expect(peakRate * peakLife * seats).toBeLessThan(FLAME_MAX_PARCELS);
    expect(peakRate).toBeGreaterThan(FLAME_PROFILE.spawnRate);

    // The opening flash is one frame; it must not swamp the budget on its own.
    const flashPerSeat = IGNITION_FLASH_COUNT * 12;
    expect(flashPerSeat * seats).toBeLessThan(FLAME_MAX_PARCELS);
  });

  it("budgets dust separately from fire so neither can starve the other", () => {
    // Two different pools with two different ceilings: a heavy burst of soot
    // must never eat into the parcels keeping the letters alight.
    expect(DUST_MAX_MOTES).toBeLessThan(FLAME_MAX_PARCELS);
    expect(DUST_BURST_COUNT * 2).toBeLessThanOrEqual(DUST_MAX_SETTLED);

    // Settled dust never expires, so the steady state is every mote ever thrown
    // sitting on the page. Fire pays up to two ellipse paths per parcel; dust
    // pays one flat fill, which is the cheaper draw by far.
    expect(FLAME_MAX_PARCELS * 2).toBeLessThan(1000);
    expect(DUST_MAX_MOTES + DUST_MAX_SETTLED).toBeLessThanOrEqual(460);
  });

  it("sizes a gout above the profile range without unbounding it", () => {
    const gout = FLAME_PROFILE.maxSize * FLAME_GOUT_GAIN;
    expect(gout).toBeGreaterThan(FLAME_PROFILE.maxSize);
    expect(gout).toBeLessThan(FLAME_PROFILE.maxSize * 3);
  });

  it("licks sideways along the letter but still reads as a rising plume", () => {
    const profile = FLAME_PROFILE;

    expect(profile.maxHorizontalSpeed).toBeGreaterThan(0);
    expect(profile.maxHorizontalSpeed).toBeLessThan(FLAME_LAUNCH_RISE);
    expect(profile.horizontalSpread).toBeLessThanOrEqual(6);
  });
});

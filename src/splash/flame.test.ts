import { describe, expect, it } from "vitest";
import {
  ARC_CENTER_X,
  ARC_CENTER_Y,
  ARC_END_DEGREES,
  ARC_RADIUS_X,
  ARC_RADIUS_Y,
  ARC_SITE_COUNT,
  ARC_START_DEGREES,
  advanceFlameLateral,
  advanceFlameVelocity,
  applyDrag,
  buoyantAcceleration,
  createArcFlameSeat,
  createSeamFlameSeat,
  curlAcceleration,
  drainSpawnBudget,
  FLAME_CURL_ACCELERATION,
  FLAME_GOUT_CHANCE,
  FLAME_GOUT_GAIN,
  FLAME_MAX_SPAWNS_PER_FRAME,
  FLAME_MIN_SCALE,
  FLAME_RAMP,
  FLAME_REFERENCE_CAP,
  type FlameSite,
  flameAlpha,
  flameHeat,
  flameNoise,
  flameRadii,
  flameRampIndex,
  flameScale,
  fuelSurge,
  IGNITION_CURVE,
  IGNITION_FLARE,
  IGNITION_SETTLE,
  ignitionEnvelope,
  ignitionGain,
  parcelSpread,
  pickFlameSite,
  SEAM_HEIGHT,
  SEAM_SITE_COUNT,
  SITE_PULSE_DEPTH,
  sitePulse,
} from "./flame";

/** MARC, roughly as the live layout measures it: block word box plus inline letter box. */
const marcWord = { left: 50, right: 525, top: 248, bottom: 368 };
const marcLetter = { left: 414, right: 525, top: 313, bottom: 423 };

/** HERMANN, where the R span ends exactly where the M begins. */
const hermannWord = { left: 50, right: 940, top: 400, bottom: 500 };
const hermannLetter = { left: 300, right: 400, top: 380, bottom: 540 };

const capHeight = (bounds: { top: number; bottom: number }) => bounds.bottom - bounds.top;
const site = (overrides: Partial<FlameSite> = {}): FlameSite => ({
  x: 0,
  y: 0,
  leanX: 0,
  leanY: -1,
  weight: 1,
  phase: 0,
  ...overrides,
});

describe("flame seat scale", () => {
  it("grows the fire with the type size and stays inside sane bounds", () => {
    expect(flameScale(FLAME_REFERENCE_CAP)).toBeCloseTo(1, 10);
    expect(flameScale(FLAME_REFERENCE_CAP * 1.5)).toBeCloseTo(1.5, 10);
    expect(flameScale(1)).toBe(FLAME_MIN_SCALE);
    expect(flameScale(0)).toBe(FLAME_MIN_SCALE);
  });
});

describe("MARC arc flame seat", () => {
  const seat = createArcFlameSeat(marcWord, marcLetter);
  const cap = capHeight(marcWord);
  const letterWidth = marcLetter.right - marcLetter.left;

  it("seats the fire on the word baseline, never the nested letter line box", () => {
    for (const item of seat.sites) {
      expect(item.y).toBeLessThanOrEqual(marcWord.bottom);
      expect(item.y).toBeLessThan(marcLetter.bottom);
      expect(item.y).toBeGreaterThanOrEqual(marcWord.bottom - cap);
    }
  });

  it("traces a short arc that climbs up and to the right along the C", () => {
    expect(seat.sites).toHaveLength(ARC_SITE_COUNT);
    expect(ARC_START_DEGREES).toBeLessThan(ARC_END_DEGREES);

    for (let index = 1; index < seat.sites.length; index += 1) {
      const previous = seat.sites[index - 1] as FlameSite;
      const current = seat.sites[index] as FlameSite;
      expect(current.x).toBeGreaterThan(previous.x);
      expect(current.y).toBeLessThan(previous.y);
    }
  });

  it("sits out on the upward curving right flank, not under the letter", () => {
    // Every site past the halfway mark of the letter, and the body of the seat
    // out beyond three quarters: this is the flank, not the underside.
    for (const item of seat.sites) {
      expect(item.x).toBeGreaterThan(marcLetter.left + letterWidth * 0.5);
    }

    const meanX = seat.sites.reduce((total, item) => total + item.x, 0) / seat.sites.length;
    expect(meanX).toBeGreaterThan(marcLetter.left + letterWidth * 0.75);
    // The terminal spills just past the box: the fire burns off the outside of
    // the stroke, not inside it. It must not drift into the next letter though.
    expect(Math.max(...seat.sites.map((item) => item.x))).toBeLessThanOrEqual(
      marcLetter.right + letterWidth * 0.09,
    );

    // The seat rides the outer boundary of the bowl: on the lower right quadrant
    // that keeps it low and far right, clear of the underside but well below the
    // waist of the letter.
    const fuel = seat.sites.reduce((total, item) => total + item.weight, 0);
    const centroidY = seat.sites.reduce((total, item) => total + item.y * item.weight, 0) / fuel;
    const centroidHeight = marcWord.bottom - centroidY;
    expect(centroidHeight).toBeGreaterThan(cap * 0.12);
    expect(centroidHeight).toBeLessThan(cap * 0.35);

    const highest = Math.max(...seat.sites.map((item) => marcWord.bottom - item.y));
    expect(highest).toBeLessThan(cap * 0.45);
  });

  it("seats every site on the outer curve of the bowl, not inside the stroke", () => {
    const centerX = marcLetter.left + letterWidth * ARC_CENTER_X;
    const centerY = marcWord.bottom - cap * ARC_CENTER_Y;

    for (const item of seat.sites) {
      const radial = Math.hypot(
        (item.x - centerX) / (letterWidth * ARC_RADIUS_X),
        (centerY - item.y) / (cap * ARC_RADIUS_Y),
      );
      expect(radial).toBeCloseTo(1, 6);
    }
  });

  it("licks along the stroke: every lean rises, and the terminal leans right", () => {
    for (const item of seat.sites) {
      expect(item.leanY).toBeLessThanOrEqual(0);
      expect(Math.hypot(item.leanX, item.leanY)).toBeCloseTo(1, 10);
    }

    const first = seat.sites[0] as FlameSite;
    const last = seat.sites[seat.sites.length - 1] as FlameSite;
    expect(first.leanX).toBeGreaterThan(0);
    expect(last.leanX).toBeGreaterThan(0);
    expect(last.leanY).toBeLessThan(first.leanY);
  });

  it("pools most of the fuel at the terminal end of the arc", () => {
    const first = seat.sites[0] as FlameSite;
    const last = seat.sites[seat.sites.length - 1] as FlameSite;
    expect(last.weight).toBeGreaterThan(first.weight);
    for (const item of seat.sites) expect(item.weight).toBeGreaterThan(0);
  });

  it("spaces its sites and fuel irregularly, the way spilled accelerant lies", () => {
    const gaps: number[] = [];
    for (let index = 1; index < seat.sites.length; index += 1) {
      const previous = seat.sites[index - 1] as FlameSite;
      const current = seat.sites[index] as FlameSite;
      gaps.push(Math.hypot(current.x - previous.x, current.y - previous.y));
    }
    const meanGap = gaps.reduce((total, gap) => total + gap, 0) / gaps.length;
    const spread = Math.max(...gaps) - Math.min(...gaps);
    expect(spread).toBeGreaterThan(meanGap * 0.1);

    // Fuel does not fall on a smooth curve either.
    const deltas: number[] = [];
    for (let index = 1; index < seat.sites.length; index += 1) {
      deltas.push(
        (seat.sites[index] as FlameSite).weight - (seat.sites[index - 1] as FlameSite).weight,
      );
    }
    expect(new Set(deltas.map((delta) => delta.toFixed(4))).size).toBe(deltas.length);

    // Every site breathes on its own schedule.
    const phases = seat.sites.map((item) => item.phase);
    expect(new Set(phases).size).toBe(phases.length);
  });

  it("stays deterministic so the same layout always burns the same way", () => {
    expect(createArcFlameSeat(marcWord, marcLetter)).toEqual(seat);
    expect(seat.phase).toBeGreaterThanOrEqual(0);
    expect(seat.phase).toBeLessThan(Math.PI * 2);
    expect(seat.scale).toBeCloseTo(flameScale(cap), 10);
  });
});

describe("HERMANN seam flame seat", () => {
  const seat = createSeamFlameSeat(hermannWord, hermannLetter);
  const cap = capHeight(hermannWord);

  it("straddles the gap between the R and the M instead of centring on the R", () => {
    const centreX = hermannLetter.left + (hermannLetter.right - hermannLetter.left) / 2;
    const meanX = seat.sites.reduce((total, item) => total + item.x, 0) / seat.sites.length;

    expect(meanX).toBeGreaterThan(centreX);
    expect(Math.abs(meanX - hermannLetter.right)).toBeLessThan(cap * 0.05);
    expect(seat.sites.some((item) => item.x < hermannLetter.right)).toBe(true);
    expect(seat.sites.some((item) => item.x > hermannLetter.right)).toBe(true);
    for (const item of seat.sites) expect(item.x).toBeGreaterThan(centreX);
  });

  it("runs two strands that part as they climb the adjacent strokes", () => {
    expect(seat.sites).toHaveLength(SEAM_SITE_COUNT * 2 + 1);

    const left = seat.sites.filter((item) => item.leanX < 0);
    const right = seat.sites.filter((item) => item.leanX > 0);
    expect(left).toHaveLength(SEAM_SITE_COUNT);
    expect(right).toHaveLength(SEAM_SITE_COUNT);

    const spread = (sites: readonly FlameSite[]) =>
      Math.abs((sites[sites.length - 1] as FlameSite).x - hermannLetter.right) -
      Math.abs((sites[0] as FlameSite).x - hermannLetter.right);
    expect(spread(left)).toBeGreaterThan(0);
    expect(spread(right)).toBeGreaterThan(0);
  });

  it("keeps the strands between the baseline and the seam height", () => {
    for (const item of seat.sites) {
      expect(item.y).toBeLessThanOrEqual(hermannWord.bottom);
      expect(item.y).toBeGreaterThanOrEqual(hermannWord.bottom - cap * SEAM_HEIGHT - 0.001);
      expect(item.leanY).toBeLessThan(0);
      expect(Math.hypot(item.leanX, item.leanY)).toBeCloseTo(1, 10);
    }
  });

  it("pools the heaviest fuel in the gap at the baseline", () => {
    const pool = seat.sites.reduce((lowest, item) => (item.y > lowest.y ? item : lowest));
    expect(pool.x).toBeCloseTo(seat.sites[0]?.x ?? 0, 10);
    for (const item of seat.sites) expect(item.weight).toBeLessThanOrEqual(pool.weight);
  });

  it("burns lopsided: the two strands are never mirror images", () => {
    const left = seat.sites.filter((item) => item.leanX < 0);
    const right = seat.sites.filter((item) => item.leanX > 0);

    const mirrored = left.every((item, index) => {
      const twin = right[index] as FlameSite;
      return (
        Math.abs(Math.abs(item.x - hermannLetter.right) - Math.abs(twin.x - hermannLetter.right)) <
          1e-9 &&
        Math.abs(item.y - twin.y) < 1e-9 &&
        Math.abs(item.weight - twin.weight) < 1e-9
      );
    });
    expect(mirrored).toBe(false);
  });

  it("flickers out of step with the MARC seat", () => {
    expect(seat.phase).not.toBeCloseTo(createArcFlameSeat(marcWord, marcLetter).phase, 3);
  });
});

describe("deterministic noise", () => {
  it("returns a stable unit value for a seed", () => {
    for (let seed = -20; seed < 20; seed += 0.37) {
      const value = flameNoise(seed);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      expect(flameNoise(seed)).toBe(value);
    }
    expect(flameNoise(1)).not.toBeCloseTo(flameNoise(2), 3);
  });

  it("spreads roughly evenly so jitter does not lean one way", () => {
    let total = 0;
    let samples = 0;
    for (let seed = 0; seed < 400; seed += 1) {
      total += flameNoise(seed * 0.73);
      samples += 1;
    }
    expect(total / samples).toBeCloseTo(0.5, 1);
  });
});

describe("per site pulse", () => {
  it("lets each site breathe on its own without ever going dark", () => {
    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;
    for (let elapsed = 0; elapsed < 60; elapsed += 0.01) {
      const pulse = sitePulse(elapsed, 2.1);
      lowest = Math.min(lowest, pulse);
      highest = Math.max(highest, pulse);
    }
    expect(lowest).toBeGreaterThanOrEqual(1 - SITE_PULSE_DEPTH);
    expect(highest).toBeLessThanOrEqual(1 + SITE_PULSE_DEPTH);
    expect(highest - lowest).toBeGreaterThan(SITE_PULSE_DEPTH);
  });

  it("is neutral at the origin so weighting stays predictable, and differs by phase", () => {
    expect(sitePulse(0, 0)).toBeCloseTo(1, 10);
    expect(sitePulse(1.3, 0.4)).not.toBeCloseTo(sitePulse(1.3, 2.7), 3);
  });
});

describe("weighted site selection", () => {
  const sites: readonly FlameSite[] = [site({ weight: 1 }), site({ x: 1, weight: 3 })];

  it("spreads spawns across sites in proportion to their fuel weight", () => {
    expect(pickFlameSite(sites, 0, 0)).toBe(sites[0]);
    expect(pickFlameSite(sites, 0.2, 0)).toBe(sites[0]);
    expect(pickFlameSite(sites, 0.3, 0)).toBe(sites[1]);
    expect(pickFlameSite(sites, 0.999, 0)).toBe(sites[1]);
    expect(pickFlameSite(sites, 1, 0)).toBe(sites[1]);
    expect(pickFlameSite(sites, -1, 0)).toBe(sites[0]);
  });

  it("lets the live pulse shift which site is feeding the fire", () => {
    const pulsed: readonly FlameSite[] = [
      site({ weight: 1, phase: 0 }),
      site({ x: 1, weight: 1, phase: Math.PI }),
    ];
    const boundary = (elapsed: number) => {
      let roll = 0;
      while (roll < 1 && pickFlameSite(pulsed, roll, elapsed) === pulsed[0]) roll += 0.001;
      return roll;
    };

    expect(boundary(0)).toBeCloseTo(0.5, 1);
    expect(boundary(0.4)).not.toBeCloseTo(boundary(0), 1);
  });
});

describe("ignition envelope", () => {
  it("opens with a fury", () => {
    expect(ignitionEnvelope(0)).toBe(IGNITION_FLARE);
    expect(ignitionEnvelope(-1)).toBe(IGNITION_FLARE);
    expect(IGNITION_FLARE).toBeGreaterThan(2);
    expect(IGNITION_CURVE).toBeGreaterThan(1);
  });

  it("decays monotonically and settles to the calm burn", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let elapsed = 0; elapsed < IGNITION_SETTLE; elapsed += IGNITION_SETTLE / 200) {
      const value = ignitionEnvelope(elapsed);
      expect(value).toBeLessThan(previous);
      expect(value).toBeGreaterThanOrEqual(1);
      previous = value;
    }

    expect(ignitionEnvelope(IGNITION_SETTLE)).toBe(1);
    expect(ignitionEnvelope(IGNITION_SETTLE * 3)).toBe(1);
    expect(ignitionEnvelope(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it("spends most of its fury early", () => {
    const half = ignitionEnvelope(IGNITION_SETTLE / 2) - 1;
    expect(half).toBeLessThan((IGNITION_FLARE - 1) * 0.35);
  });

  it("reads the same however the frames fall", () => {
    const totalFor = (step: number) => {
      let carry = 0;
      let spawns = 0;
      for (let elapsed = 0; elapsed < IGNITION_SETTLE - 1e-9; elapsed += step) {
        const drained = drainSpawnBudget(carry, 96 * ignitionEnvelope(elapsed), 1, step);
        carry = drained.carry;
        spawns += drained.spawns;
      }
      return spawns;
    };

    const fine = totalFor(1 / 240);
    expect(totalFor(1 / 120)).toBeGreaterThan(fine * 0.95);
    expect(totalFor(1 / 120)).toBeLessThan(fine * 1.05);
    expect(totalFor(1 / 30)).toBeGreaterThan(fine * 0.9);
    expect(totalFor(1 / 30)).toBeLessThan(fine * 1.1);
  });

  it("dials the envelope into each property by its own gain", () => {
    expect(ignitionGain(IGNITION_FLARE, 0)).toBe(1);
    expect(ignitionGain(IGNITION_FLARE, 1)).toBe(IGNITION_FLARE);
    expect(ignitionGain(IGNITION_FLARE, 0.5)).toBeCloseTo((1 + IGNITION_FLARE) / 2, 10);
    expect(ignitionGain(1, 0.8)).toBe(1);
    expect(ignitionGain(IGNITION_FLARE, 0.5)).toBeGreaterThan(1);
  });
});

describe("parcel spread", () => {
  it("makes most parcels small and a few of them gouts of raw fuel", () => {
    let gouts = 0;
    let total = 0;
    const samples = 4000;
    for (let index = 0; index < samples; index += 1) {
      const roll = (index + 0.5) / samples;
      const gout = ((index * 7919) % samples) / samples;
      const spread = parcelSpread(roll, gout);
      expect(spread).toBeGreaterThanOrEqual(0);
      expect(spread).toBeLessThanOrEqual(FLAME_GOUT_GAIN);
      if (spread > 1) gouts += 1;
      total += spread;
    }

    expect(gouts / samples).toBeCloseTo(FLAME_GOUT_CHANCE, 1);
    expect(total / samples).toBeLessThan(0.5);
    expect(FLAME_GOUT_GAIN).toBeGreaterThan(1);
  });

  it("is deterministic in both draws", () => {
    expect(parcelSpread(0.4, 0.5)).toBe(parcelSpread(0.4, 0.5));
    expect(parcelSpread(0.4, 0.01)).toBeGreaterThan(parcelSpread(0.4, 0.5));
  });
});

describe("spawn metering", () => {
  it("releases fuel on the emitter's clock, not on the frame rate", () => {
    const rate = 96;
    const totalFor = (step: number) => {
      let carry = 0;
      let spawns = 0;
      for (let elapsed = 0; elapsed < 1 - 1e-9; elapsed += step) {
        const drained = drainSpawnBudget(carry, rate, 1, step);
        carry = drained.carry;
        spawns += drained.spawns;
      }
      return spawns;
    };

    expect(totalFor(1 / 120)).toBe(rate);
    expect(totalFor(1 / 60)).toBe(rate);
    expect(totalFor(1 / 24)).toBe(rate);
  });

  it("carries the fractional remainder instead of rounding it away", () => {
    const first = drainSpawnBudget(0, 96, 1, 1 / 60);
    expect(first.spawns).toBe(1);
    expect(first.carry).toBeCloseTo(0.6, 6);
  });

  it("never dumps a whole plume after a stalled frame", () => {
    const drained = drainSpawnBudget(0, 96 * IGNITION_FLARE, 1.4, 10);
    expect(drained.spawns).toBe(FLAME_MAX_SPAWNS_PER_FRAME);
    expect(drained.carry).toBeGreaterThan(0);
  });

  it("ignores nonsense clocks", () => {
    expect(drainSpawnBudget(0, 96, 1, -1).spawns).toBe(0);
    expect(drainSpawnBudget(0, 96, -3, 0.5).spawns).toBe(0);
  });
});

describe("flame heat", () => {
  it("burns hottest at the source and cools to nothing at the tip", () => {
    expect(flameHeat(0)).toBe(1);
    expect(flameHeat(1)).toBe(0);
    expect(flameHeat(-1)).toBe(1);
    expect(flameHeat(2)).toBe(0);

    let previous = Number.POSITIVE_INFINITY;
    for (let age = 0; age <= 1; age += 0.05) {
      const heat = flameHeat(age);
      expect(heat).toBeLessThan(previous);
      expect(heat).toBeGreaterThanOrEqual(0);
      previous = heat;
    }
  });

  it("grades the palette from a cool tip up to a white hot core", () => {
    expect(FLAME_RAMP[0]).toBe("#ff3d00");
    expect(FLAME_RAMP[FLAME_RAMP.length - 1]).toBe("#fff7c2");
    expect(flameRampIndex(1)).toBe(FLAME_RAMP.length - 1);
    expect(flameRampIndex(0)).toBe(0);
    expect(flameRampIndex(-5)).toBe(0);
    expect(flameRampIndex(5)).toBe(FLAME_RAMP.length - 1);

    let previous = -1;
    for (let heat = 0; heat <= 1; heat += 0.02) {
      const index = flameRampIndex(heat);
      expect(index).toBeGreaterThanOrEqual(previous);
      previous = index;
    }
  });
});

describe("buoyancy", () => {
  it("always pushes upward and fades as the gas cools", () => {
    expect(buoyantAcceleration(0, 1)).toBeLessThan(0);
    expect(buoyantAcceleration(0.5, 1)).toBeGreaterThan(buoyantAcceleration(0, 1));
    expect(buoyantAcceleration(1, 1)).toBe(-0);
    expect(buoyantAcceleration(0, 2)).toBeCloseTo(buoyantAcceleration(0, 1) * 2, 10);
  });

  it("never lets anchored fire fall back down over a full lifetime", () => {
    let velocity = -20;
    for (let age = 0; age <= 1; age += 0.02) {
      velocity = advanceFlameVelocity(velocity, age, 1, 0.016);
      expect(velocity).toBeLessThanOrEqual(0);
    }
  });

  it("lifts a plume roughly a cap height above its seat", () => {
    const life = 0.7;
    const step = 1 / 120;
    let velocity = -60;
    let rise = 0;
    for (let elapsed = 0; elapsed < life; elapsed += step) {
      velocity = advanceFlameVelocity(velocity, elapsed / life, 1, step);
      rise -= velocity * step;
    }

    expect(rise).toBeGreaterThan(70);
    expect(rise).toBeLessThan(220);
  });
});

describe("curl and drag", () => {
  it("sheds vortices to both sides with an amplitude that swells as the plume rises", () => {
    const samples: number[] = [];
    for (let elapsed = 0; elapsed < 4; elapsed += 0.01) {
      samples.push(curlAcceleration(elapsed, 0, 0.5, 1));
    }

    expect(Math.max(...samples)).toBeGreaterThan(0);
    expect(Math.min(...samples)).toBeLessThan(0);
    for (const sample of samples) {
      expect(Math.abs(sample)).toBeLessThanOrEqual(FLAME_CURL_ACCELERATION * 2);
    }

    const low = Math.abs(curlAcceleration(0.4, 0, 0.1, 1));
    const high = Math.abs(curlAcceleration(0.4, 0, 0.9, 1));
    expect(high).toBeGreaterThan(low);
  });

  it("never settles into a clean sine: the sway carries a second harmonic", () => {
    const period = (Math.PI * 2) / 6.5;
    const first = curlAcceleration(0.31, 0.4, 0.5, 1);
    const later = curlAcceleration(0.31 + period, 0.4, 0.5, 1);
    expect(later).not.toBeCloseTo(first, 3);
  });

  it("separates neighbouring plumes by seed, wobble and type size", () => {
    expect(curlAcceleration(0.5, 0, 0.5, 1)).not.toBeCloseTo(curlAcceleration(0.5, 1.7, 0.5, 1), 3);
    expect(curlAcceleration(0.5, 0, 0.5, 2)).toBeCloseTo(curlAcceleration(0.5, 0, 0.5, 1) * 2, 10);
    expect(curlAcceleration(0.5, 0, 0.5, 1, 1.3)).not.toBeCloseTo(
      curlAcceleration(0.5, 0, 0.5, 1, 1),
      3,
    );
  });

  it("damps at the same rate regardless of frame rate", () => {
    const single = applyDrag(100, 2.5, 0.1);
    let stepped = 100;
    for (let index = 0; index < 10; index += 1) stepped = applyDrag(stepped, 2.5, 0.01);

    expect(stepped).toBeCloseTo(single, 9);
    expect(single).toBeLessThan(100);
    expect(single).toBeGreaterThan(0);
    expect(applyDrag(-100, 2.5, 0.1)).toBeLessThan(0);
  });

  it("keeps lateral drift bounded while curling", () => {
    let velocity = 0;
    for (let elapsed = 0; elapsed < 1; elapsed += 0.016) {
      velocity = advanceFlameLateral(velocity, elapsed, 0.3, elapsed, 1, 0.016, 1.2);
      expect(Math.abs(velocity)).toBeLessThan(FLAME_CURL_ACCELERATION);
    }
  });
});

describe("accelerant surge", () => {
  it("breathes around full strength without ever guttering out or exploding", () => {
    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;
    let total = 0;
    let samples = 0;

    for (let elapsed = 0; elapsed < 200; elapsed += 0.01) {
      const surge = fuelSurge(elapsed, 1.2);
      lowest = Math.min(lowest, surge);
      highest = Math.max(highest, surge);
      total += surge;
      samples += 1;
    }

    expect(lowest).toBeGreaterThan(0.5);
    expect(highest).toBeLessThan(1.6);
    expect(highest - lowest).toBeGreaterThan(0.3);
    expect(total / samples).toBeCloseTo(1, 1);
  });

  it("is deterministic and decorrelated between seats", () => {
    expect(fuelSurge(3.5, 1.2)).toBe(fuelSurge(3.5, 1.2));
    expect(fuelSurge(3.5, 1.2)).not.toBeCloseTo(fuelSurge(3.5, 2.9), 3);
  });
});

describe("plume shape", () => {
  it("pinches at the wick, swells, then tapers to a point", () => {
    const widths: number[] = [];
    for (let age = 0; age <= 1.0001; age += 0.05) widths.push(flameRadii(age, 4, 1).rx);

    const peak = Math.max(...widths);
    const peakIndex = widths.indexOf(peak);
    expect(peakIndex).toBeGreaterThan(0);
    expect(peakIndex).toBeLessThan(widths.length - 1);
    expect(widths[0] as number).toBeLessThan(peak);
    expect(widths[widths.length - 1] as number).toBeCloseTo(0, 6);
    for (const width of widths) expect(width).toBeGreaterThanOrEqual(0);
  });

  it("stretches lengthwise as the gas accelerates upward", () => {
    let previous = -1;
    for (let age = 0; age <= 1; age += 0.05) {
      const { ry } = flameRadii(age, 4, 1);
      expect(ry).toBeGreaterThan(previous);
      previous = ry;
    }
    expect(flameRadii(0.5, 4, 2).ry).toBeCloseTo(flameRadii(0.5, 4, 1).ry * 2, 10);
  });

  it("fades in at the wick and out at the tip", () => {
    expect(flameAlpha(0)).toBeGreaterThan(0);
    expect(flameAlpha(1)).toBe(0);
    for (let age = 0; age <= 1; age += 0.05) {
      const alpha = flameAlpha(age);
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThanOrEqual(0.6);
    }
    expect(flameAlpha(0.15)).toBeGreaterThan(flameAlpha(0));
    expect(flameAlpha(0.9)).toBeLessThan(flameAlpha(0.5));
  });
});

import { describe, expect, it } from "vitest";
import {
  advanceDustFlight,
  createDustBurst,
  DUST_ALPHA,
  DUST_BACKSPLASH_SHARE,
  DUST_BURST_COUNT,
  DUST_FAN_SPREAD,
  DUST_FLIGHT_TIMEOUT,
  DUST_GRAVITY,
  DUST_MAX_MOTES,
  DUST_MAX_SETTLED,
  DUST_MAX_SIZE,
  DUST_MAX_SPEED,
  DUST_MIN_SIZE,
  DUST_MIN_SPEED,
  DUST_PALETTE,
  DUST_REST_BAND,
  DUST_REST_DIM,
  DUST_SETTLE_EASE,
  DUST_SOURCE_LEAD,
  DUST_SOURCE_WIDEN,
  type DustBurst,
  dustBedIn,
  dustDragFor,
  dustFanAngle,
  dustFlightAlpha,
  dustKicksBack,
  dustLaunchSpeed,
  dustRestAlpha,
  dustRestY,
  dustShade,
  dustSize,
  dustSourceX,
  dustSourceY,
  hasLanded,
} from "./dust";
import { FLAME_RAMP } from "./flame";

/** MARC, as the live layout measures it: block word box plus inline letter box. */
const word = { left: 50, right: 525, top: 248, bottom: 368 };
const letter = { left: 414, right: 525, top: 313, bottom: 423 };
const letterCentre = letter.left + (letter.right - letter.left) / 2;
const cap = word.bottom - word.top;
const burst = createDustBurst(word, letter, 1);
const upwind = createDustBurst(word, letter, -1);

/** Deterministic draws, so a whole simulated burst is reproducible. */
function rolls(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Flies one mote from a launch until it lands or its flight times out. */
function fly(
  x: number,
  y: number,
  angle: number,
  speed: number,
  drag: number,
  restY: number,
): { x: number; y: number; elapsed: number; peak: number; landed: boolean } {
  const step = 1 / 240;
  let vx = Math.cos(angle) * speed;
  let vy = Math.sin(angle) * speed;
  let elapsed = 0;
  let peak = y;
  let moteX = x;
  let moteY = y;

  while (elapsed < DUST_FLIGHT_TIMEOUT) {
    moteX += vx * step;
    moteY += vy * step;
    peak = Math.min(peak, moteY);
    const next = advanceDustFlight(vx, vy, step, drag);
    vx = next.vx;
    vy = next.vy;
    elapsed += step;
    if (hasLanded(moteY, restY, vy)) {
      return { x: moteX, y: restY, elapsed, peak, landed: true };
    }
  }
  return { x: moteX, y: moteY, elapsed, peak, landed: false };
}

/** Throws a whole burst the way the emitter does and reports where it lands. */
function throwBurst(source: DustBurst, seed: number) {
  const next = rolls(seed);
  const landings: { x: number; y: number; size: number; elapsed: number; landed: boolean }[] = [];

  for (let index = 0; index < DUST_BURST_COUNT; index += 1) {
    const x = dustSourceX(source, next());
    const y = dustSourceY(source, next());
    const kickRoll = next();
    const angle = dustFanAngle(source, x, next(), kickRoll);
    const speed = dustLaunchSpeed(next(), source.scale, dustKicksBack(kickRoll));
    const size = dustSize(next(), source.scale, dustKicksBack(kickRoll));
    const restY = dustRestY(source, next());
    const flight = fly(x, y, angle, speed, dustDragFor(size, source.scale), restY);
    landings.push({
      x: flight.x,
      y: flight.y,
      size,
      elapsed: flight.elapsed,
      landed: flight.landed,
    });
  }
  return landings;
}

describe("dust burst geometry", () => {
  it("sheds off the struck letter's extent, not from a single point", () => {
    const letterWidth = letter.right - letter.left;
    const half = (letterWidth * DUST_SOURCE_WIDEN) / 2;
    expect(burst.right - burst.left).toBeCloseTo(half * 2, 6);

    // The band is shed off the leading side of the strike, so it sits downrange
    // of the letter's centre rather than evenly about it, and mirrors per pass.
    const shed = (burst.left + burst.right) / 2 - letterCentre;
    expect(shed).toBeCloseTo(half * DUST_SOURCE_LEAD, 6);
    expect(shed).toBeGreaterThan(0);
    expect((upwind.left + upwind.right) / 2 - letterCentre).toBeCloseTo(-shed, 6);

    // It still overlaps the letter it came off.
    expect(burst.left).toBeLessThan(letter.right);
    expect(burst.right).toBeGreaterThan(letter.right);
  });

  it("takes its baseline and height from the word box, not the letter line box", () => {
    expect(burst.baseline).toBe(word.bottom);
    expect(burst.baseline).toBeLessThan(letter.bottom);
    expect(burst.capTop).toBeGreaterThanOrEqual(word.bottom - cap);
    expect(burst.capTop).toBeLessThan(burst.baseline);
    expect(burst.scale).toBeGreaterThan(0);
    expect(burst.direction).toBe(1);
    expect(upwind.direction).toBe(-1);
  });

  it("scatters its source across that whole band", () => {
    for (let roll = 0; roll <= 1; roll += 0.05) {
      expect(dustSourceX(burst, roll)).toBeGreaterThanOrEqual(burst.left);
      expect(dustSourceX(burst, roll)).toBeLessThanOrEqual(burst.right);
      expect(dustSourceY(burst, roll)).toBeGreaterThanOrEqual(burst.capTop);
      expect(dustSourceY(burst, roll)).toBeLessThanOrEqual(burst.baseline);
    }
    expect(dustSourceX(burst, 0)).toBe(burst.left);
    expect(dustSourceX(burst, 1)).toBe(burst.right);
    expect(dustSourceX(burst, -3)).toBe(burst.left);
    expect(dustSourceX(burst, 4)).toBe(burst.right);
  });
});

describe("dust splatter direction", () => {
  const carry = (angle: number) => Math.cos(angle);
  const downrange = 0.9;
  const kicked = 0;

  it("throws the bulk of the burst downrange, ahead of the impact", () => {
    let thrownAhead = 0;
    let samples = 0;
    for (let spread = 0; spread <= 1; spread += 0.05) {
      for (let step = 0; step <= 1; step += 0.05) {
        const x = burst.left + (burst.right - burst.left) * step;
        if (carry(dustFanAngle(burst, x, spread, downrange)) > 0) thrownAhead += 1;
        samples += 1;
      }
    }
    expect(thrownAhead / samples).toBeGreaterThan(0.9);
    expect(carry(dustFanAngle(burst, letterCentre, 0.5, downrange))).toBeGreaterThan(0.5);
  });

  it("keeps a little material kicking back so it is not a jet", () => {
    expect(DUST_BACKSPLASH_SHARE).toBeGreaterThan(0.05);
    expect(DUST_BACKSPLASH_SHARE).toBeLessThan(0.25);

    for (let spread = 0; spread <= 1; spread += 0.1) {
      const back = dustFanAngle(burst, letterCentre, spread, kicked);
      expect(carry(back)).toBeLessThan(0);
    }
  });

  it("mirrors for a pass travelling the other way", () => {
    for (let spread = 0; spread <= 1; spread += 0.1) {
      const ahead = dustFanAngle(burst, letterCentre, spread, downrange);
      // The mirror image of a throw is the mirrored scatter of the other pass.
      const back = dustFanAngle(upwind, letterCentre, 1 - spread, downrange);
      expect(carry(ahead)).toBeGreaterThan(0);
      expect(carry(back)).toBeLessThan(0);
      expect(carry(back)).toBeCloseTo(-carry(ahead), 6);
      expect(Math.sin(back)).toBeCloseTo(Math.sin(ahead), 6);
    }
  });

  it("throws up off the glyph and never fires at the floor", () => {
    for (let spread = 0; spread <= 1; spread += 0.1) {
      for (let step = 0; step <= 1; step += 0.1) {
        const x = burst.left + (burst.right - burst.left) * step;
        for (const kick of [kicked, downrange]) {
          // Screen coordinates: negative is up.
          expect(Math.sin(dustFanAngle(burst, x, spread, kick))).toBeLessThan(0.7);
        }
      }
    }
  });

  it("scatters within its cone and never outside it", () => {
    const mid = dustFanAngle(burst, letterCentre, 0.5, downrange);
    expect(dustFanAngle(burst, letterCentre, 0, downrange)).toBeCloseTo(mid - DUST_FAN_SPREAD, 6);
    expect(dustFanAngle(burst, letterCentre, 1, downrange)).toBeCloseTo(mid + DUST_FAN_SPREAD, 6);
  });
});

describe("dust grain", () => {
  it("runs from fine specks to genuinely chunky bits", () => {
    expect(DUST_MAX_SIZE / DUST_MIN_SIZE).toBeGreaterThan(4);

    let total = 0;
    let chunky = 0;
    const samples = 500;
    for (let index = 0; index < samples; index += 1) {
      const size = dustSize((index + 0.5) / samples, 1);
      expect(size).toBeGreaterThanOrEqual(DUST_MIN_SIZE);
      expect(size).toBeLessThanOrEqual(DUST_MAX_SIZE);
      total += size;
      if (size > (DUST_MIN_SIZE + DUST_MAX_SIZE) / 2) chunky += 1;
    }

    // Skewed hard to the fine end: most of it is grit, a few are lumps.
    expect(total / samples).toBeLessThan(DUST_MIN_SIZE + (DUST_MAX_SIZE - DUST_MIN_SIZE) * 0.4);
    expect(chunky / samples).toBeLessThan(0.3);
    expect(chunky / samples).toBeGreaterThan(0.02);
    expect(dustSize(0.5, 2)).toBeCloseTo(dustSize(0.5, 1) * 2, 6);
  });

  it("makes big bits heavy: less drag, so they carry further and drop faster", () => {
    const fine = dustDragFor(DUST_MIN_SIZE, 1);
    const lump = dustDragFor(DUST_MAX_SIZE, 1);
    expect(lump).toBeLessThan(fine);
    expect(fine / lump).toBeGreaterThan(2);

    let previous = Number.POSITIVE_INFINITY;
    for (let roll = 0; roll <= 1; roll += 0.05) {
      const drag = dustDragFor(dustSize(roll, 1), 1);
      expect(drag).toBeLessThanOrEqual(previous);
      expect(drag).toBeGreaterThan(0);
      previous = drag;
    }

    // Drag is about grain, not type size, so a bigger headline behaves the same.
    expect(dustDragFor(dustSize(0.5, 2), 2)).toBeCloseTo(dustDragFor(dustSize(0.5, 1), 1), 6);
  });

  it("carries a lump measurably further than a speck off the same throw", () => {
    const restY = dustRestY(burst, 0.5);
    const launch = dustFanAngle(burst, letterCentre, 0.5, 0.9);
    const speed = dustLaunchSpeed(0.8, 1);
    const speck = fly(0, burst.capTop, launch, speed, dustDragFor(DUST_MIN_SIZE, 1), restY);
    const lump = fly(0, burst.capTop, launch, speed, dustDragFor(DUST_MAX_SIZE, 1), restY);

    expect(lump.x).toBeGreaterThan(speck.x * 2);
    expect(lump.elapsed).toBeLessThan(speck.elapsed);
    expect(speck.landed).toBe(true);
    expect(lump.landed).toBe(true);
  });

  it("throws most motes gently and a few of them far", () => {
    let total = 0;
    const samples = 500;
    for (let index = 0; index < samples; index += 1) {
      const speed = dustLaunchSpeed((index + 0.5) / samples, 1);
      expect(speed).toBeGreaterThanOrEqual(DUST_MIN_SPEED);
      expect(speed).toBeLessThanOrEqual(DUST_MAX_SPEED);
      total += speed;
    }
    expect(total / samples).toBeLessThan((DUST_MIN_SPEED + DUST_MAX_SPEED) / 2);
    expect(dustLaunchSpeed(0.5, 2)).toBeCloseTo(dustLaunchSpeed(0.5, 1) * 2, 6);
  });
});

describe("dust flight", () => {
  const drag = dustDragFor(2, 1);

  it("bleeds off its throw and falls under gravity", () => {
    const flat = advanceDustFlight(500, 0, 0.01, drag);
    expect(flat.vx).toBeLessThan(500);
    expect(flat.vx).toBeGreaterThan(0);
    expect(flat.vy).toBeGreaterThan(0);
    expect(advanceDustFlight(0, -500, 0.01, drag).vy).toBeGreaterThan(-500);
  });

  it("integrates the same however the frames fall", () => {
    const single = advanceDustFlight(600, -400, 0.1, drag);
    let vx = 600;
    let vy = -400;
    for (let index = 0; index < 10; index += 1) {
      const next = advanceDustFlight(vx, vy, 0.01, drag);
      vx = next.vx;
      vy = next.vy;
    }
    expect(vx).toBeCloseTo(single.vx, 4);
    expect(vy).toBeCloseTo(single.vy, 4);
  });

  it("never falls faster than the terminal drift for its own weight", () => {
    for (const size of [DUST_MIN_SIZE, 2, DUST_MAX_SIZE]) {
      const own = dustDragFor(size, 1);
      const terminal = DUST_GRAVITY / own;
      let vy = 0;
      for (let elapsed = 0; elapsed < 6; elapsed += 1 / 240) {
        vy = advanceDustFlight(0, vy, 1 / 240, own).vy;
        expect(vy).toBeLessThanOrEqual(terminal + 1e-6);
      }
      expect(vy).toBeCloseTo(terminal, 0);
    }
  });

  it("comes to rest once it reaches its resting height", () => {
    expect(hasLanded(100, 100, 50)).toBe(true);
    expect(hasLanded(101, 100, 50)).toBe(true);
    expect(hasLanded(99, 100, 50)).toBe(false);
    // Still on the way up through the band: it has not landed yet.
    expect(hasLanded(101, 100, -50)).toBe(false);
  });
});

describe("dust settling", () => {
  it("scatters resting heights into a band below the baseline", () => {
    let deepest = 0;
    for (let roll = 0; roll <= 1; roll += 0.02) {
      const restY = dustRestY(burst, roll);
      expect(restY).toBeGreaterThanOrEqual(burst.baseline);
      expect(restY).toBeLessThanOrEqual(burst.baseline + DUST_REST_BAND * burst.scale + 1e-9);
      deepest = Math.max(deepest, restY);
    }
    expect(deepest).toBeGreaterThan(burst.baseline + DUST_REST_BAND * burst.scale * 0.9);

    let total = 0;
    const samples = 200;
    for (let index = 0; index < samples; index += 1) {
      total += dustRestY(burst, (index + 0.5) / samples) - burst.baseline;
    }
    expect(total / samples).toBeLessThan((DUST_REST_BAND * burst.scale) / 2);
  });

  it("splatters to the right of the letter and stays there", () => {
    // Pooled over several bursts so the ratio is a property of the model, not of
    // one lucky sequence of draws.
    const landings = [20260809, 7, 99, 4242].flatMap((seed) => throwBurst(burst, seed));
    const right = landings.filter((mote) => mote.x > letterCentre).length;
    const left = landings.length - right;

    expect(landings.every((mote) => mote.landed)).toBe(true);
    // Clearly a rightward splatter, but not a jet.
    expect(right / landings.length).toBeGreaterThan(0.78);
    expect(left / landings.length).toBeGreaterThan(0.02);

    const reach = Math.max(...landings.map((mote) => mote.x)) - letterCentre;
    expect(reach).toBeGreaterThan(120);
    expect(reach).toBeLessThan(700);
    // The ricochet is a light one and never outruns the throw.
    const backwash = letterCentre - Math.min(...landings.map((mote) => mote.x));
    expect(backwash).toBeLessThan(reach * 0.6);
  });

  it("splatters the other way for a pass travelling the other way", () => {
    const landings = [20260809, 7, 99, 4242].flatMap((seed) => throwBurst(upwind, seed));
    const left = landings.filter((mote) => mote.x < letterCentre).length;

    expect(left / landings.length).toBeGreaterThan(0.78);
    expect(landings.every((mote) => mote.landed)).toBe(true);
  });

  it("lands the heavy bits furthest downrange", () => {
    const landings = throwBurst(burst, 7).filter((mote) => mote.x > letterCentre);
    const sorted = [...landings].sort((a, b) => a.x - b.x);
    const nearHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const farHalf = sorted.slice(Math.floor(sorted.length / 2));

    const meanSize = (motes: typeof sorted) =>
      motes.reduce((total, mote) => total + mote.size, 0) / motes.length;
    expect(meanSize(farHalf)).toBeGreaterThan(meanSize(nearHalf));
  });

  it("is always on the page well before its flight times out", () => {
    const slowest = Math.max(...throwBurst(burst, 99).map((mote) => mote.elapsed));
    expect(slowest).toBeLessThan(DUST_FLIGHT_TIMEOUT * 0.6);
  });
});

describe("dust permanence", () => {
  it("never fades once it has settled", () => {
    // Structural: resting opacity is a function of the mote alone. There is no
    // time term, so there is no path by which settled dust can fade out.
    expect(dustRestAlpha(DUST_MIN_SIZE, 1)).toBeGreaterThan(0.05);
    expect(dustRestAlpha(DUST_MAX_SIZE, 1)).toBeGreaterThan(dustRestAlpha(DUST_MIN_SIZE, 1));
    for (const size of [DUST_MIN_SIZE, 1.5, 3, DUST_MAX_SIZE]) {
      expect(dustRestAlpha(size, 1)).toBeLessThanOrEqual(DUST_ALPHA);
      expect(dustRestAlpha(size, 1)).toBeGreaterThan(0);
    }
  });

  it("beds in rather than popping when it lands", () => {
    expect(dustBedIn(0)).toBe(0);
    expect(dustBedIn(-1)).toBe(0);
    expect(dustBedIn(DUST_SETTLE_EASE)).toBe(1);
    expect(dustBedIn(DUST_SETTLE_EASE * 10)).toBe(1);

    let previous = -1;
    for (let settled = 0; settled <= DUST_SETTLE_EASE; settled += DUST_SETTLE_EASE / 20) {
      const bedded = dustBedIn(settled);
      expect(bedded).toBeGreaterThanOrEqual(previous);
      previous = bedded;
    }
    expect(DUST_REST_DIM).toBeLessThan(1);
  });

  it("catches quickly in flight and holds until it lands", () => {
    expect(dustFlightAlpha(0)).toBe(0);
    expect(dustFlightAlpha(0.05)).toBeCloseTo(DUST_ALPHA, 10);
    expect(dustFlightAlpha(DUST_FLIGHT_TIMEOUT * 0.5)).toBeCloseTo(DUST_ALPHA, 10);
    // Only the safety net at the very end of an impossible flight fades out.
    expect(dustFlightAlpha(DUST_FLIGHT_TIMEOUT)).toBe(0);
    for (let elapsed = 0; elapsed <= DUST_FLIGHT_TIMEOUT; elapsed += DUST_FLIGHT_TIMEOUT / 40) {
      expect(dustFlightAlpha(elapsed)).toBeLessThanOrEqual(DUST_ALPHA);
      expect(dustFlightAlpha(elapsed)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("dust look", () => {
  it("reads as soot and ash, never as fire", () => {
    for (const shade of DUST_PALETTE) {
      expect(shade).toMatch(/^#[0-9a-f]{6}$/);
      expect(FLAME_RAMP).not.toContain(shade);

      const red = Number.parseInt(shade.slice(1, 3), 16);
      const green = Number.parseInt(shade.slice(3, 5), 16);
      const blue = Number.parseInt(shade.slice(5, 7), 16);
      const brightest = Math.max(red, green, blue);
      const darkest = Math.min(red, green, blue);
      expect(brightest).toBeLessThan(0xa0);
      expect(brightest).toBeGreaterThan(0x30);
      expect(brightest - darkest).toBeLessThan(0x28);
    }
    expect(DUST_ALPHA).toBeLessThanOrEqual(0.55);
  });

  it("picks a shade for every draw and covers the whole palette", () => {
    const seen = new Set<string>();
    for (let roll = 0; roll <= 1; roll += 0.01) {
      const shade = dustShade(roll);
      expect(DUST_PALETTE).toContain(shade);
      seen.add(shade);
    }
    expect(seen.size).toBe(DUST_PALETTE.length);
    expect(dustShade(0.42)).toBe(dustShade(0.42));
    expect(dustShade(-1)).toBe(DUST_PALETTE[0]);
    expect(dustShade(2)).toBe(DUST_PALETTE[DUST_PALETTE.length - 1]);
  });
});

describe("dust budget", () => {
  it("caps what accumulates, now that settled dust never leaves", () => {
    // Every mote thrown ends up on the settled list and stays there, so the
    // settled cap has to cover every burst the splash can fire.
    expect(DUST_BURST_COUNT * 2).toBeLessThanOrEqual(DUST_MAX_SETTLED);
    expect(DUST_BURST_COUNT).toBeGreaterThan(30);
    expect(DUST_MAX_SETTLED).toBeLessThanOrEqual(260);
    expect(DUST_MAX_MOTES).toBeLessThanOrEqual(DUST_MAX_SETTLED);
  });
});

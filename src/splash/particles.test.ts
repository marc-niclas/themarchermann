import { describe, expect, it } from "vitest";
import { DUST_BURST_COUNT, DUST_MAX_MOTES, DUST_MAX_SETTLED } from "./dust";
import {
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
import { FLAME_PROFILE } from "./particles";

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

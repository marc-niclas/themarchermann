import { describe, expect, it } from "vitest";
import { createSplashSpec, getOffscreenTravel, type SplashPass } from "./choreography";

function requirePass(passes: readonly SplashPass[], word: SplashPass["word"]): SplashPass {
  const pass = passes.find((candidate) => candidate.word === word);
  if (!pass) {
    throw new Error(`Expected a ${word} pass`);
  }
  return pass;
}

describe("signature splash choreography", () => {
  it("models two independent passes without an on-screen reversal", () => {
    const spec = createSplashSpec(false);

    expect(spec.passes).toHaveLength(2);
    const marc = requirePass(spec.passes, "MARC");
    const hermann = requirePass(spec.passes, "HERMANN");

    expect(marc).toMatchObject({
      direction: "left-to-right",
      revealFrom: "left",
      duration: 0.22,
      impactLetter: "C",
    });
    expect(hermann).toMatchObject({
      direction: "right-to-left",
      revealFrom: "right",
      duration: 0.3,
      impactLetter: "R",
    });
    expect(marc.projectileId).not.toBe(hermann.projectileId);
  });

  it("keeps both projectile passes fully off-screen at their start and end", () => {
    const geometry = { viewportWidth: 390, projectileWidth: 168, overscan: 24 };

    expect(getOffscreenTravel("left-to-right", geometry)).toEqual({
      fromX: -192,
      toX: 414,
    });
    expect(getOffscreenTravel("right-to-left", geometry)).toEqual({
      fromX: 414,
      toX: -192,
    });
  });

  it("honors the hold, off-screen gap, and active timing contract", () => {
    const spec = createSplashSpec(false);
    const marc = requirePass(spec.passes, "MARC");
    const hermann = requirePass(spec.passes, "HERMANN");

    expect(spec.hold).toBeGreaterThanOrEqual(0.14);
    expect(spec.hold).toBeLessThanOrEqual(0.18);
    expect(hermann.startsAt - (marc.startsAt + marc.duration)).toBeCloseTo(0.05);
    expect(spec.readableAt).toBeLessThan(1);
    expect(spec.readableAt).toBeCloseTo(hermann.startsAt + hermann.duration);
    expect(spec.persistentIgnition).toBe(true);
    expect(spec.effectsEndAt).toBeNull();
  });

  it("makes every word immediately readable and disables effects for reduced motion", () => {
    const spec = createSplashSpec(true);

    expect(spec.reducedMotion).toBe(true);
    expect(spec.passes).toEqual([]);
    expect(spec.initialVisibility).toEqual({ THE: 1, MARC: 1, HERMANN: 1 });
    expect(spec.particlesEnabled).toBe(false);
    expect(spec.persistentIgnition).toBe(false);
    expect(spec.readableAt).toBe(0);
  });
});

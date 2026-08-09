import { describe, expect, it } from "vitest";
import { advanceVerticalVelocity, getParticleProfile } from "./particles";

describe("anchored flame motion", () => {
  it("never lets the weakest upward flame reverse downward during its maximum lifetime", () => {
    const profile = getParticleProfile("kindle");
    let velocity = -24;

    for (let elapsed = 0; elapsed < profile.maxLife; elapsed += 0.016) {
      velocity = advanceVerticalVelocity(velocity, profile.gravity, 0.016, true);
      expect(velocity).toBeLessThanOrEqual(0);
    }
  });
});

describe("signature splash particle profiles", () => {
  it("uses a compact rooted profile for continuously regenerated impact fire", () => {
    const profile = getParticleProfile("kindle");

    expect(profile.count).toBeLessThanOrEqual(8);
    expect(profile.minLife).toBeGreaterThanOrEqual(0.2);
    expect(profile.maxLife).toBeGreaterThan(profile.minLife);
    expect(profile.gravity).toBeGreaterThan(0);
    expect(profile.colors).toContain("#ff3d00");
    expect(profile.shape).toBe("flame");
    expect(profile.anchored).toBe(true);
    expect(profile.spawnRate).toBeGreaterThanOrEqual(30);
    expect(profile.horizontalSpread).toBeLessThanOrEqual(5);
    expect(profile.maxHorizontalSpeed).toBeLessThanOrEqual(10);
  });

  it("keeps the moving trail lighter than the impact ignition", () => {
    const trail = getParticleProfile("flame");
    const ignition = getParticleProfile("kindle");

    expect(trail.count).toBeLessThan(ignition.count);
    expect(trail.maxLife).toBeLessThan(ignition.maxLife);
    expect(trail.shape).toBe("streak");
    expect(trail.anchored).toBe(false);
  });
});

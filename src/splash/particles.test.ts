import { describe, expect, it } from "vitest";
import { getParticleProfile } from "./particles";

describe("signature splash particle profiles", () => {
  it("uses a dense, longer-lived ignition profile for impact kindling", () => {
    const profile = getParticleProfile("kindle");

    expect(profile.count).toBeGreaterThanOrEqual(20);
    expect(profile.minLife).toBeGreaterThanOrEqual(0.45);
    expect(profile.maxLife).toBeGreaterThan(profile.minLife);
    expect(profile.gravity).toBeGreaterThan(0);
    expect(profile.colors).toContain("#ff3d00");
    expect(profile.shape).toBe("flame");
  });

  it("keeps the moving trail lighter than the impact ignition", () => {
    const trail = getParticleProfile("flame");
    const ignition = getParticleProfile("kindle");

    expect(trail.count).toBeLessThan(ignition.count);
    expect(trail.maxLife).toBeLessThan(ignition.maxLife);
    expect(trail.shape).toBe("streak");
  });
});

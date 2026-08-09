import { describe, expect, it, vi } from "vitest";
import { createResizeAbortHandler } from "./controller";

describe("signature splash resize handling", () => {
  it("aborts motion into a readable particle-free state on the first viewport change", () => {
    const resizeParticles = vi.fn();
    const stopTimeline = vi.fn();
    const revealWords = vi.fn();
    const hideProjectiles = vi.fn();
    const clearParticles = vi.fn();
    const onResize = createResizeAbortHandler({
      resizeParticles,
      stopTimeline,
      revealWords,
      hideProjectiles,
      clearParticles,
    });

    onResize();
    onResize();

    expect(resizeParticles).toHaveBeenCalledOnce();
    expect(stopTimeline).toHaveBeenCalledOnce();
    expect(revealWords).toHaveBeenCalledOnce();
    expect(hideProjectiles).toHaveBeenCalledOnce();
    expect(clearParticles).toHaveBeenCalledOnce();
  });
});

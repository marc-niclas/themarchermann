import { describe, expect, it, vi } from "vitest";
import { createResizeAbortHandler, getImpactPoint } from "./controller";

describe("signature splash impact geometry", () => {
  it("anchors fire to the word baseline instead of the nested letter line box", () => {
    const point = getImpactPoint(
      { left: 50, right: 525, bottom: 368 },
      { left: 414, right: 525, bottom: 423 },
    );

    expect(point).toEqual({ x: 469.5, y: 368 });
  });
});

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

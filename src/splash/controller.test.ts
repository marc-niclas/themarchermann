import { describe, expect, it, vi } from "vitest";
import { createPersistentRenderer, createResizeAbortHandler } from "./controller";

describe("signature splash persistent fire renderer", () => {
  it("keeps rendering anchored fire until explicitly stopped", () => {
    const render = vi.fn();
    const queued: FrameRequestCallback[] = [];
    const cancelFrame = vi.fn();
    const renderer = createPersistentRenderer(
      render,
      (callback: FrameRequestCallback) => {
        queued.push(callback);
        return queued.length;
      },
      cancelFrame,
    );

    renderer.start();
    expect(queued).toHaveLength(1);
    queued[0]?.(16);
    expect(render).toHaveBeenCalledOnce();
    expect(queued).toHaveLength(2);

    renderer.stop();
    expect(cancelFrame).toHaveBeenCalledWith(2);
  });
});

// Impact geometry now lives with the flame model: see `flame.test.ts`, which
// covers the arc seat on MARC's C and the seam seat in HERMANN's R/M gap.

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

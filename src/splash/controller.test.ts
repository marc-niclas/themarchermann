import { describe, expect, it, vi } from "vitest";
import { createPersistentRenderer, createResizeAbortHandler, toDocumentBounds } from "./controller";
import { createDustBurst } from "./dust";
import { createArcFlameSeat, createSeamFlameSeat } from "./flame";

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

describe("scroll aware capture", () => {
  const NO_SCROLL = { x: 0, y: 0 };
  const SCROLLED = { x: 0, y: 800 };

  /** The MARC word and its C, as measured with the page at the top. */
  const word = { left: 50, right: 525, top: 248, bottom: 368 };
  const letter = { left: 414, right: 525, top: 313, bottom: 423 };
  /** The very same elements, measured after scrolling down 800px. */
  const scroll = (bounds: typeof word, by: number) => ({
    ...bounds,
    top: bounds.top - by,
    bottom: bounds.bottom - by,
  });

  it("lifts a viewport rect into document space", () => {
    expect(toDocumentBounds(word, NO_SCROLL)).toEqual(word);
    expect(toDocumentBounds(scroll(word, 800), SCROLLED)).toEqual(word);
    expect(toDocumentBounds(word, { x: 40, y: 800 })).toEqual({
      left: 90,
      right: 565,
      top: 1048,
      bottom: 1168,
    });
  });

  it("seats the same fire on the letter however far the page has scrolled", () => {
    const atTop = createArcFlameSeat(
      toDocumentBounds(word, NO_SCROLL),
      toDocumentBounds(letter, NO_SCROLL),
    );
    const scrolled = createArcFlameSeat(
      toDocumentBounds(scroll(word, 800), SCROLLED),
      toDocumentBounds(scroll(letter, 800), SCROLLED),
    );

    expect(scrolled).toEqual(atTop);
  });

  it("would have welded that fire to the screen without the lift", () => {
    // The bug: capturing raw viewport rects seats the fire a whole scroll offset
    // away from the letter it belongs to.
    const raw = createArcFlameSeat(scroll(word, 800), scroll(letter, 800));
    const lifted = createArcFlameSeat(word, letter);
    const centroid = (seat: typeof raw) => ({
      x: seat.sites.reduce((total, site) => total + site.x, 0) / seat.sites.length,
      y: seat.sites.reduce((total, site) => total + site.y, 0) / seat.sites.length,
    });

    // Off by the scroll offset vertically, and in the right place horizontally.
    // Not exact, because the seat's irregularity is seeded from its own geometry.
    expect(centroid(lifted).y - centroid(raw).y).toBeGreaterThan(795);
    expect(centroid(lifted).y - centroid(raw).y).toBeLessThan(805);
    expect(Math.abs(centroid(lifted).x - centroid(raw).x)).toBeLessThan(5);
  });

  it("seats the seam and the dust burst in document space too", () => {
    const seam = createSeamFlameSeat(
      toDocumentBounds(scroll(word, 800), SCROLLED),
      toDocumentBounds(scroll(letter, 800), SCROLLED),
    );
    expect(seam).toEqual(createSeamFlameSeat(word, letter));

    const burst = createDustBurst(
      toDocumentBounds(scroll(word, 800), SCROLLED),
      toDocumentBounds(scroll(letter, 800), SCROLLED),
      1,
    );
    expect(burst).toEqual(createDustBurst(word, letter, 1));
    expect(burst.baseline).toBe(word.bottom);
  });
});

describe("signature splash resize handling", () => {
  it("aborts motion into a readable particle-free state on the first viewport change", () => {
    const resizeParticles = vi.fn();
    const stopTimeline = vi.fn();
    const revealWords = vi.fn();
    const hideProjectiles = vi.fn();
    const clearParticles = vi.fn();
    const revealAbout = vi.fn();
    const onResize = createResizeAbortHandler({
      resizeParticles,
      stopTimeline,
      revealWords,
      hideProjectiles,
      clearParticles,
      revealAbout,
    });

    onResize();
    onResize();

    expect(resizeParticles).toHaveBeenCalledOnce();
    expect(stopTimeline).toHaveBeenCalledOnce();
    expect(revealWords).toHaveBeenCalledOnce();
    expect(hideProjectiles).toHaveBeenCalledOnce();
    expect(clearParticles).toHaveBeenCalledOnce();
    expect(revealAbout).toHaveBeenCalledOnce();
  });
});

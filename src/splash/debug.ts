/**
 * Development-only slow motion for inspecting the signature splash.
 *
 * The splash runs in well under a second, so `?slow=<factor>` scales both clocks
 * that drive it: the GSAP timeline and the particle emitter's own rAF clock.
 * These helpers are pure so the scaling stays testable without a browser.
 */

export const SLOW_PARAM = "slow";
export const DEFAULT_SLOW_FACTOR = 8;
export const MIN_SLOW_FACTOR = 1;
export const MAX_SLOW_FACTOR = 100;

/** Returns a GSAP-style time scale (1 = full speed, 0.125 = eight times slower). */
export function resolveTimeScale(search: string): number {
  const raw = new URLSearchParams(search).get(SLOW_PARAM);
  if (raw === null) return 1;
  if (raw === "") return 1 / DEFAULT_SLOW_FACTOR;

  const factor = Number(raw);
  if (!Number.isFinite(factor) || factor <= 0) return 1;

  return 1 / Math.min(Math.max(factor, MIN_SLOW_FACTOR), MAX_SLOW_FACTOR);
}

/**
 * Converts real frame timestamps into a slowed virtual clock. The first
 * timestamp passes through unchanged so the emitter's opening delta stays in the
 * same time base it was constructed with.
 */
export function createScaledClock(timeScale: number): (time: number) => number {
  let previous: number | null = null;
  let virtual = 0;

  return (time) => {
    if (previous === null) {
      previous = time;
      virtual = time;
      return virtual;
    }
    virtual += (time - previous) * timeScale;
    previous = time;
    return virtual;
  };
}

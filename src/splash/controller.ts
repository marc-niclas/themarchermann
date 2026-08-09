import { gsap } from "gsap";
import { createSplashSpec, getOffscreenTravel } from "./choreography";
import { createScaledClock } from "./debug";
import { createDustBurst, DUST_ON_HERMANN, DUST_ON_MARC } from "./dust";
import { createArcFlameSeat, createSeamFlameSeat, FLAME_TIME_SCALE, type FlameSeat } from "./flame";
import { ParticleEmitter } from "./particles";
import { createShockwaveRenderer } from "./shockwave";

const OVERSCAN = 32;

export interface SplashOptions {
  /** 1 is full speed; smaller values slow the pass down for inspection. */
  readonly timeScale?: number;
}

export interface PersistentRenderer {
  readonly start: () => void;
  readonly stop: () => void;
}

export function createPersistentRenderer(
  render: (time: number) => void,
  requestFrame: (callback: FrameRequestCallback) => number = window.requestAnimationFrame.bind(
    window,
  ),
  cancelFrame: (handle: number) => void = window.cancelAnimationFrame.bind(window),
): PersistentRenderer {
  let active = false;
  let frame = 0;
  const tick: FrameRequestCallback = (time) => {
    if (!active) return;
    render(time);
    frame = requestFrame(tick);
  };

  return {
    start: () => {
      if (active) return;
      active = true;
      frame = requestFrame(tick);
    },
    stop: () => {
      if (!active) return;
      active = false;
      cancelFrame(frame);
    },
  };
}

export interface ResizeAbortActions {
  readonly resizeParticles: () => void;
  readonly stopTimeline: () => void;
  readonly revealWords: () => void;
  readonly hideProjectiles: () => void;
  readonly clearParticles: () => void;
}

export function createResizeAbortHandler(actions: ResizeAbortActions): () => void {
  let aborted = false;

  return () => {
    if (aborted) return;
    aborted = true;
    actions.resizeParticles();
    actions.stopTimeline();
    actions.revealWords();
    actions.hideProjectiles();
    actions.clearParticles();
  };
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing splash element: ${selector}`);
  return element;
}

export function startSignatureSplash(root: HTMLElement, options: SplashOptions = {}): () => void {
  const timeScale = options.timeScale ?? 1;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const spec = createSplashSpec(reducedMotion);
  root.dataset.motion = reducedMotion ? "reduced" : "active";
  if (reducedMotion) return () => undefined;

  const canvas = requireElement<HTMLCanvasElement>(root, "[data-particles]");
  const marc = requireElement<HTMLElement>(root, '[data-word="MARC"]');
  const hermann = requireElement<HTMLElement>(root, '[data-word="HERMANN"]');
  const marcImpact = requireElement<HTMLElement>(marc, '[data-impact="C"]');
  const hermannImpact = requireElement<HTMLElement>(hermann, '[data-impact="R"]');
  const marcDash = requireElement<HTMLElement>(root, '[data-projectile="marc-dash"]');
  const hermannDash = requireElement<HTMLElement>(root, '[data-projectile="hermann-dash"]');
  const emitter = new ParticleEmitter(canvas);
  /** Drives the shockwave, which has to stay in step with the projectile. */
  const passClock = createScaledClock(timeScale);
  /** The fire burns on its own slower clock; see FLAME_TIME_SCALE. */
  const flameClock = createScaledClock(timeScale * FLAME_TIME_SCALE);
  /**
   * Each pass gets its own shockwave so the two projectiles never look like one
   * object teleporting across the viewport between passes.
   */
  const marcShock = createShockwaveRenderer();
  const hermannShock = createShockwaveRenderer();
  /** The emitter already holds this context, transform and all; 2D contexts are per-canvas singletons. */
  const shockContext = canvas.getContext("2d");

  let lastScaled = 0;
  let clockStarted = false;
  const fireRenderer = createPersistentRenderer((time) => {
    const scaled = passClock(time);
    const delta = clockStarted ? Math.min((scaled - lastScaled) / 1000, 0.05) : 0;
    clockStarted = true;
    lastScaled = scaled;
    // The emitter clears the canvas, so the shockwave has to draw after it.
    emitter.render(flameClock(time));
    marcShock.advance(delta);
    hermannShock.advance(delta);
    if (shockContext) {
      marcShock.draw(shockContext);
      hermannShock.draw(shockContext);
    }
  });
  const timeline = gsap.timeline({ defaults: { ease: "none" } });
  timeline.timeScale(timeScale);

  const travel = (projectile: HTMLElement, direction: "left-to-right" | "right-to-left") =>
    getOffscreenTravel(direction, {
      viewportWidth: window.innerWidth,
      projectileWidth: projectile.offsetWidth,
      overscan: OVERSCAN,
    });

  const marcTravel = travel(marcDash, "left-to-right");
  const hermannTravel = travel(hermannDash, "right-to-left");
  gsap.set(marc, { clipPath: "inset(0 100% 0 0)" });
  gsap.set(hermann, { clipPath: "inset(0 0 0 100%)" });
  const baselineTop = (word: HTMLElement, dash: HTMLElement) => {
    const wordBounds = word.getBoundingClientRect();
    return wordBounds.bottom - dash.offsetHeight * 0.45;
  };
  gsap.set(marcDash, { x: marcTravel.fromX, top: baselineTop(marc, marcDash), autoAlpha: 1 });
  gsap.set(hermannDash, {
    x: hermannTravel.fromX,
    top: baselineTop(hermann, hermannDash),
    autoAlpha: 1,
  });

  const dashCenterY = (dash: HTMLElement) => {
    const bounds = dash.getBoundingClientRect();
    return bounds.top + bounds.height / 2;
  };

  const revealMarc = () => {
    const dashBounds = marcDash.getBoundingClientRect();
    const wordBounds = marc.getBoundingClientRect();
    const revealed = Math.min(
      Math.max((dashBounds.left - wordBounds.left) / wordBounds.width, 0),
      1,
    );
    gsap.set(marc, { clipPath: `inset(0 ${100 - revealed * 100}% 0 0)` });
  };
  const revealHermann = () => {
    const dashBounds = hermannDash.getBoundingClientRect();
    const wordBounds = hermann.getBoundingClientRect();
    const revealed = Math.min(
      Math.max((wordBounds.right - dashBounds.right) / wordBounds.width, 0),
      1,
    );
    gsap.set(hermann, { clipPath: `inset(0 0 0 ${100 - revealed * 100}%)` });
  };

  /**
   * The word's block box carries the baseline and cap height; the letter's inline
   * box carries the horizontal extent. Seat builders combine the two so the fire
   * never drops to the nested letter line box, which hangs below the baseline.
   */
  const ignite = (
    id: string,
    word: HTMLElement,
    target: HTMLElement,
    seatOf: (word: DOMRect, target: DOMRect) => FlameSeat,
    dust: { readonly enabled: boolean; readonly direction: -1 | 1 },
  ) => {
    const wordBounds = word.getBoundingClientRect();
    const targetBounds = target.getBoundingClientRect();
    emitter.anchorFlame(id, seatOf(wordBounds, targetBounds));
    // The same impact that lights the letter knocks soot off it.
    if (dust.enabled) emitter.burstDust(createDustBurst(wordBounds, targetBounds, dust.direction));
    fireRenderer.start();
  };

  let marcIgnited = false;
  let hermannIgnited = false;

  timeline
    .to(
      marcDash,
      {
        x: marcTravel.toX,
        duration: spec.passes[0]?.duration ?? 0,
        onUpdate: () => {
          revealMarc();
          const bounds = marcDash.getBoundingClientRect();
          // Travelling left-to-right, so the right edge is the leading edge.
          marcShock.track(bounds.right, bounds.top + bounds.height / 2, 1);
          if (!marcIgnited) {
            const impactBounds = marcImpact.getBoundingClientRect();
            if (bounds.left >= impactBounds.left) {
              marcIgnited = true;
              ignite("marc-c", marc, marcImpact, createArcFlameSeat, {
                enabled: DUST_ON_MARC,
                direction: 1,
              });
            }
          }
        },
      },
      spec.passes[0]?.startsAt ?? 0,
    )
    .to(
      hermannDash,
      {
        x: hermannTravel.toX,
        duration: spec.passes[1]?.duration ?? 0,
        onUpdate: () => {
          revealHermann();
          const bounds = hermannDash.getBoundingClientRect();
          // Travelling right-to-left, so the left edge is the leading edge.
          hermannShock.track(bounds.left, dashCenterY(hermannDash), -1);
          if (!hermannIgnited) {
            const impactBounds = hermannImpact.getBoundingClientRect();
            if (bounds.right <= impactBounds.right) {
              hermannIgnited = true;
              ignite("hermann-r", hermann, hermannImpact, createSeamFlameSeat, {
                enabled: DUST_ON_HERMANN,
                direction: -1,
              });
            }
          }
        },
        onComplete: () => {
          gsap.set([marc, hermann], { clipPath: "inset(0 0 0 0)" });
        },
      },
      spec.passes[1]?.startsAt ?? 0,
    );

  // The shockwave leads the first ignition, so the loop runs for the whole timeline.
  fireRenderer.start();

  const onResize = createResizeAbortHandler({
    resizeParticles: () => emitter.resize(),
    stopTimeline: () => {
      timeline.kill();
      fireRenderer.stop();
    },
    revealWords: () => gsap.set([marc, hermann], { clipPath: "inset(0 0 0 0)" }),
    hideProjectiles: () => gsap.set([marcDash, hermannDash], { autoAlpha: 0 }),
    clearParticles: () => {
      emitter.clear();
      marcShock.clear();
      hermannShock.clear();
    },
  });
  window.addEventListener("resize", onResize, { passive: true });

  return () => {
    timeline.kill();
    fireRenderer.stop();
    emitter.clear();
    marcShock.clear();
    hermannShock.clear();
    window.removeEventListener("resize", onResize);
  };
}

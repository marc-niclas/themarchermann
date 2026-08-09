import { gsap } from "gsap";
import { createSplashSpec, getOffscreenTravel } from "./choreography";
import { ParticleEmitter } from "./particles";

const OVERSCAN = 32;

export interface ImpactBounds {
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
}

export function getImpactPoint(
  wordBounds: ImpactBounds,
  targetBounds: ImpactBounds,
): { readonly x: number; readonly y: number } {
  return {
    x: targetBounds.left + (targetBounds.right - targetBounds.left) / 2,
    y: wordBounds.bottom,
  };
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

export function startSignatureSplash(root: HTMLElement): () => void {
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
  const fireRenderer = createPersistentRenderer((time) => emitter.render(time));
  const timeline = gsap.timeline({ defaults: { ease: "none" } });

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

  const ignite = (id: string, word: HTMLElement, target: HTMLElement) => {
    const point = getImpactPoint(word.getBoundingClientRect(), target.getBoundingClientRect());
    emitter.anchorFlame(id, point.x, point.y);
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
          if (!marcIgnited) {
            const dashBounds = marcDash.getBoundingClientRect();
            const impactBounds = marcImpact.getBoundingClientRect();
            if (dashBounds.left >= impactBounds.left) {
              marcIgnited = true;
              ignite("marc-c", marc, marcImpact);
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
          emitter.emit(bounds.right, dashCenterY(hermannDash), "flame", 1);
          if (!hermannIgnited) {
            const impactBounds = hermannImpact.getBoundingClientRect();
            if (bounds.right <= impactBounds.right) {
              hermannIgnited = true;
              ignite("hermann-r", hermann, hermannImpact);
            }
          }
        },
        onComplete: () => {
          gsap.set([marc, hermann], { clipPath: "inset(0 0 0 0)" });
        },
      },
      spec.passes[1]?.startsAt ?? 0,
    );

  const onResize = createResizeAbortHandler({
    resizeParticles: () => emitter.resize(),
    stopTimeline: () => {
      timeline.kill();
      fireRenderer.stop();
    },
    revealWords: () => gsap.set([marc, hermann], { clipPath: "inset(0 0 0 0)" }),
    hideProjectiles: () => gsap.set([marcDash, hermannDash], { autoAlpha: 0 }),
    clearParticles: () => emitter.clear(),
  });
  window.addEventListener("resize", onResize, { passive: true });

  return () => {
    timeline.kill();
    fireRenderer.stop();
    emitter.clear();
    window.removeEventListener("resize", onResize);
  };
}

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

  const ignite = (word: HTMLElement, target: HTMLElement, direction: -1 | 1) => {
    const point = getImpactPoint(word.getBoundingClientRect(), target.getBoundingClientRect());
    emitter.emit(point.x, point.y, "kindle", direction);
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
          emitter.render();
          revealMarc();
          if (!marcIgnited) {
            const dashBounds = marcDash.getBoundingClientRect();
            const impactBounds = marcImpact.getBoundingClientRect();
            if (dashBounds.left >= impactBounds.left) {
              marcIgnited = true;
              ignite(marc, marcImpact, 1);
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
          emitter.render();
          revealHermann();
          const bounds = hermannDash.getBoundingClientRect();
          emitter.emit(bounds.right, dashCenterY(hermannDash), "flame", 1);
          if (!hermannIgnited) {
            const impactBounds = hermannImpact.getBoundingClientRect();
            if (bounds.right <= impactBounds.right) {
              hermannIgnited = true;
              ignite(hermann, hermannImpact, -1);
            }
          }
        },
        onComplete: () => {
          gsap.set([marc, hermann], { clipPath: "inset(0 0 0 0)" });
        },
      },
      spec.passes[1]?.startsAt ?? 0,
    )
    .to(
      {},
      {
        duration: spec.effectsEndAt - spec.readableAt,
        onUpdate: () => emitter.render(),
        onComplete: () => emitter.clear(),
      },
      spec.readableAt,
    );

  const onResize = createResizeAbortHandler({
    resizeParticles: () => emitter.resize(),
    stopTimeline: () => timeline.kill(),
    revealWords: () => gsap.set([marc, hermann], { clipPath: "inset(0 0 0 0)" }),
    hideProjectiles: () => gsap.set([marcDash, hermannDash], { autoAlpha: 0 }),
    clearParticles: () => emitter.clear(),
  });
  window.addEventListener("resize", onResize, { passive: true });

  return () => {
    timeline.kill();
    emitter.clear();
    window.removeEventListener("resize", onResize);
  };
}

export type PassDirection = "left-to-right" | "right-to-left";
export type SplashWord = "MARC" | "HERMANN";

export interface SplashPass {
  readonly word: SplashWord;
  readonly projectileId: "marc-dash" | "hermann-dash";
  readonly direction: PassDirection;
  readonly revealFrom: "left" | "right";
  readonly impactLetter: "C" | "R";
  readonly startsAt: number;
  readonly duration: number;
}

export interface SplashSpec {
  readonly reducedMotion: boolean;
  readonly hold: number;
  readonly gap: number;
  readonly passes: readonly SplashPass[];
  readonly initialVisibility: Readonly<Record<"THE" | SplashWord, number>>;
  readonly particlesEnabled: boolean;
  readonly readableAt: number;
  readonly effectsEndAt: number;
}

export interface TravelGeometry {
  readonly viewportWidth: number;
  readonly projectileWidth: number;
  readonly overscan: number;
}

const HOLD = 0.16;
const GAP = 0.05;
const MARC_DURATION = 0.22;
const HERMANN_DURATION = 0.3;
const PARTICLE_DECAY = 0.5;

export function getOffscreenTravel(
  direction: PassDirection,
  geometry: TravelGeometry,
): { readonly fromX: number; readonly toX: number } {
  const left = -(geometry.projectileWidth + geometry.overscan);
  const right = geometry.viewportWidth + geometry.overscan;

  return direction === "left-to-right" ? { fromX: left, toX: right } : { fromX: right, toX: left };
}

export function createSplashSpec(reducedMotion: boolean): SplashSpec {
  if (reducedMotion) {
    return {
      reducedMotion: true,
      hold: 0,
      gap: 0,
      passes: [],
      initialVisibility: { THE: 1, MARC: 1, HERMANN: 1 },
      particlesEnabled: false,
      readableAt: 0,
      effectsEndAt: 0,
    };
  }

  const marc: SplashPass = {
    word: "MARC",
    projectileId: "marc-dash",
    direction: "left-to-right",
    revealFrom: "left",
    impactLetter: "C",
    startsAt: HOLD,
    duration: MARC_DURATION,
  };
  const hermann: SplashPass = {
    word: "HERMANN",
    projectileId: "hermann-dash",
    direction: "right-to-left",
    revealFrom: "right",
    impactLetter: "R",
    startsAt: HOLD + MARC_DURATION + GAP,
    duration: HERMANN_DURATION,
  };

  const readableAt = hermann.startsAt + hermann.duration;

  return {
    reducedMotion: false,
    hold: HOLD,
    gap: GAP,
    passes: [marc, hermann],
    initialVisibility: { THE: 1, MARC: 0, HERMANN: 0 },
    particlesEnabled: true,
    readableAt,
    effectsEndAt: readableAt + PARTICLE_DECAY,
  };
}

export type ParticleKind = "ember" | "flame" | "kindle";

export interface ParticleProfile {
  readonly count: number;
  readonly minLife: number;
  readonly maxLife: number;
  readonly minSize: number;
  readonly maxSize: number;
  readonly gravity: number;
  readonly colors: readonly string[];
  readonly shape: "spark" | "streak" | "flame";
  readonly anchored: boolean;
  readonly spawnRate: number;
  readonly horizontalSpread: number;
  readonly maxHorizontalSpeed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  kind: ParticleKind;
  shape: ParticleProfile["shape"];
}

interface FlameAnchor {
  x: number;
  y: number;
  carry: number;
}

const PROFILES: Readonly<Record<ParticleKind, ParticleProfile>> = {
  ember: {
    count: 1,
    minLife: 0.24,
    maxLife: 0.38,
    minSize: 1.25,
    maxSize: 2.25,
    gravity: 70,
    colors: ["#fff7c2", "#ffd400", "#ff8a00"],
    shape: "spark",
    anchored: false,
    spawnRate: 0,
    horizontalSpread: 2,
    maxHorizontalSpeed: 205,
  },
  flame: {
    count: 3,
    minLife: 0.12,
    maxLife: 0.24,
    minSize: 1.5,
    maxSize: 3.5,
    gravity: 35,
    colors: ["#fff7c2", "#ffd400", "#ff8a00"],
    shape: "streak",
    anchored: false,
    spawnRate: 0,
    horizontalSpread: 2,
    maxHorizontalSpeed: 205,
  },
  kindle: {
    count: 6,
    minLife: 0.24,
    maxLife: 0.52,
    minSize: 2,
    maxSize: 5,
    gravity: 55,
    colors: ["#fff7c2", "#ffd400", "#ff8a00", "#ff3d00"],
    shape: "flame",
    anchored: true,
    spawnRate: 36,
    horizontalSpread: 4,
    maxHorizontalSpeed: 8,
  },
};

export function getParticleProfile(kind: ParticleKind): ParticleProfile {
  return PROFILES[kind];
}

export function advanceVerticalVelocity(
  velocity: number,
  gravity: number,
  delta: number,
  anchored: boolean,
): number {
  const nextVelocity = velocity + gravity * delta;
  return anchored ? Math.min(0, nextVelocity) : nextVelocity;
}

export class ParticleEmitter {
  readonly #canvas: HTMLCanvasElement;
  readonly #context: CanvasRenderingContext2D;
  readonly #particles: Particle[] = [];
  readonly #anchors = new Map<string, FlameAnchor>();
  #width = 0;
  #height = 0;
  #lastTime = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D is unavailable");
    }
    this.#canvas = canvas;
    this.#context = context;
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.#width = window.innerWidth;
    this.#height = window.innerHeight;
    this.#canvas.width = Math.round(this.#width * dpr);
    this.#canvas.height = Math.round(this.#height * dpr);
    this.#canvas.style.width = `${this.#width}px`;
    this.#canvas.style.height = `${this.#height}px`;
    this.#context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  emit(x: number, y: number, kind: ParticleKind, direction: -1 | 1): void {
    const profile = getParticleProfile(kind);
    for (let index = 0; index < profile.count; index += 1) {
      this.#spawn(x, y, kind, direction);
    }
  }

  anchorFlame(id: string, x: number, y: number): void {
    this.#anchors.set(id, { x, y, carry: 0 });
    this.emit(x, y, "kindle", 1);
  }

  #spawn(x: number, y: number, kind: ParticleKind, direction: -1 | 1): void {
    const profile = getParticleProfile(kind);
    const maxLife = profile.minLife + Math.random() * (profile.maxLife - profile.minLife);
    const kindle = profile.anchored;
    this.#particles.push({
      x: x + (Math.random() - 0.5) * profile.horizontalSpread * 2,
      y: kindle ? y - Math.random() * 2 : y + (Math.random() - 0.5) * 7,
      vx: kindle
        ? (Math.random() - 0.5) * profile.maxHorizontalSpeed * 2
        : direction * (55 + Math.random() * 150),
      vy: kindle ? -(24 + Math.random() * 68) : (Math.random() - 0.5) * 55,
      life: maxLife,
      maxLife,
      size: profile.minSize + Math.random() * (profile.maxSize - profile.minSize),
      color:
        profile.colors[Math.floor(Math.random() * profile.colors.length)] ??
        profile.colors[0] ??
        "#ffd400",
      gravity: profile.gravity,
      kind,
      shape: profile.shape,
    });
  }

  render(time = performance.now()): void {
    const delta = Math.min((time - this.#lastTime) / 1000, 0.05);
    this.#lastTime = time;
    this.#context.clearRect(0, 0, this.#width, this.#height);

    const kindleProfile = getParticleProfile("kindle");
    for (const anchor of this.#anchors.values()) {
      anchor.carry += delta * kindleProfile.spawnRate;
      while (anchor.carry >= 1) {
        this.#spawn(anchor.x, anchor.y, "kindle", 1);
        anchor.carry -= 1;
      }

      this.#context.globalAlpha = 0.78;
      this.#context.fillStyle = "#ff8a00";
      this.#context.shadowBlur = 12;
      this.#context.shadowColor = "#ff5a00";
      this.#context.beginPath();
      this.#context.ellipse(anchor.x, anchor.y - 1, 4.5, 2.5, 0, 0, Math.PI * 2);
      this.#context.fill();
    }

    for (let index = this.#particles.length - 1; index >= 0; index -= 1) {
      const particle = this.#particles[index];
      if (!particle) continue;
      particle.life -= delta;
      if (particle.life <= 0) {
        this.#particles.splice(index, 1);
        continue;
      }
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vy = advanceVerticalVelocity(
        particle.vy,
        particle.gravity,
        delta,
        particle.kind === "kindle",
      );
      particle.vx *= 0.93;
      const alpha = particle.life / particle.maxLife;
      this.#context.globalAlpha = alpha;
      this.#context.fillStyle = particle.color;
      this.#context.shadowBlur = particle.kind === "kindle" ? 9 : 4;
      this.#context.shadowColor = particle.color;
      if (particle.shape === "flame") {
        this.#context.beginPath();
        this.#context.ellipse(
          particle.x,
          particle.y,
          particle.size * (0.7 + alpha * 0.25),
          particle.size * (1.1 + alpha * 0.65),
          0,
          0,
          Math.PI * 2,
        );
        this.#context.fill();
      } else {
        const length = particle.shape === "streak" ? 2.4 + alpha * 2.2 : 1 + alpha;
        this.#context.fillRect(particle.x, particle.y, particle.size * length, particle.size * 0.7);
      }
    }
    this.#context.globalAlpha = 1;
    this.#context.shadowBlur = 0;
  }

  clear(): void {
    this.#particles.length = 0;
    this.#anchors.clear();
    this.#context.clearRect(0, 0, this.#width, this.#height);
  }
}

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
  },
  kindle: {
    count: 24,
    minLife: 0.5,
    maxLife: 0.85,
    minSize: 1.5,
    maxSize: 4.5,
    gravity: 120,
    colors: ["#fff7c2", "#ffd400", "#ff8a00", "#ff3d00"],
    shape: "flame",
  },
};

export function getParticleProfile(kind: ParticleKind): ParticleProfile {
  return PROFILES[kind];
}

export class ParticleEmitter {
  readonly #canvas: HTMLCanvasElement;
  readonly #context: CanvasRenderingContext2D;
  readonly #particles: Particle[] = [];
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
      const maxLife = profile.minLife + Math.random() * (profile.maxLife - profile.minLife);
      const kindle = kind === "kindle";
      this.#particles.push({
        x: x + (Math.random() - 0.5) * (kindle ? 12 : 2),
        y: y + (Math.random() - 0.5) * (kindle ? 10 : 7),
        vx: kindle
          ? direction * (20 + Math.random() * 55) + (Math.random() - 0.5) * 150
          : direction * (55 + Math.random() * 150),
        vy: kindle ? -(35 + Math.random() * 165) : (Math.random() - 0.5) * 55,
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
  }

  render(time = performance.now()): void {
    const delta = Math.min((time - this.#lastTime) / 1000, 0.05);
    this.#lastTime = time;
    this.#context.clearRect(0, 0, this.#width, this.#height);

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
      particle.vy += particle.gravity * delta;
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
    this.#context.clearRect(0, 0, this.#width, this.#height);
  }
}

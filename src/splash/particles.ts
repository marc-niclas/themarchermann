export type ParticleKind = "ember" | "flame";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const COLORS = ["#fff7c2", "#ffd400", "#ff8a00"] as const;

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
    const count = kind === "flame" ? 3 : 1;
    for (let index = 0; index < count; index += 1) {
      const maxLife = kind === "flame" ? 0.22 + Math.random() * 0.18 : 0.3;
      this.#particles.push({
        x,
        y: y + (Math.random() - 0.5) * 7,
        vx: direction * (55 + Math.random() * 150),
        vy: (Math.random() - 0.5) * 55,
        life: maxLife,
        maxLife,
        size: kind === "flame" ? 1.5 + Math.random() * 2.5 : 1.5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? COLORS[1],
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
      particle.vx *= 0.93;
      const alpha = particle.life / particle.maxLife;
      this.#context.globalAlpha = alpha;
      this.#context.fillStyle = particle.color;
      this.#context.fillRect(particle.x, particle.y, particle.size * (1 + alpha), particle.size);
    }
    this.#context.globalAlpha = 1;
  }

  clear(): void {
    this.#particles.length = 0;
    this.#context.clearRect(0, 0, this.#width, this.#height);
  }
}

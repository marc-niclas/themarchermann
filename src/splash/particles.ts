import {
  advanceDustFlight,
  DUST_ALPHA,
  DUST_BURST_COUNT,
  DUST_FLIGHT_TIMEOUT,
  DUST_MAX_MOTES,
  DUST_MAX_SETTLED,
  DUST_REST_FLATTEN,
  type DustBurst,
  dustBedIn,
  dustDragFor,
  dustFanAngle,
  dustFlightAlpha,
  dustKicksBack,
  dustLaunchSpeed,
  dustRestAlpha,
  dustRestY,
  dustShade,
  dustSize,
  dustSourceX,
  dustSourceY,
  hasLanded,
} from "./dust";
import {
  advanceFlameLateral,
  advanceFlameVelocity,
  drainSpawnBudget,
  FLAME_LAUNCH_RISE,
  FLAME_LAUNCH_RISE_SPAN,
  FLAME_MAX_PARCELS,
  FLAME_RAMP,
  FLAME_SEED_SPREAD,
  FLAME_WOBBLE_SPREAD,
  type FlameSeat,
  type FlameSite,
  flameAlpha,
  flameHeat,
  flameNoise,
  flameRadii,
  flameRampIndex,
  fuelSurge,
  IGNITION_FLASH_COUNT,
  IGNITION_GLOW_GAIN,
  IGNITION_LIFE_GAIN,
  IGNITION_RISE_GAIN,
  IGNITION_SIZE_GAIN,
  IGNITION_SPAWN_GAIN,
  ignitionEnvelope,
  ignitionGain,
  parcelSpread,
  pickFlameSite,
  sitePulse,
} from "./flame";

export interface ParticleProfile {
  readonly minLife: number;
  readonly maxLife: number;
  readonly minSize: number;
  readonly maxSize: number;
  readonly colors: readonly string[];
  readonly spawnRate: number;
  readonly horizontalSpread: number;
  readonly maxHorizontalSpeed: number;
}

interface Particle {
  readonly anchorId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  /** Curl phase. Neighbours share a seat phase so the column wavers as one body. */
  seed: number;
  /** This parcel's own shedding rate, so the column slowly decoheres. */
  wobble: number;
  /** Size and force multiplier inherited from the seat's type size. */
  scale: number;
  /** Vertical-force multiplier inherited from low or full flame seats. */
  rise: number;
}

interface FlameAnchor {
  seat: FlameSeat;
  carry: number;
  /** Emitter time at which this seat caught, for its ignition envelope. */
  ignitedAt: number;
}

export interface FlamePoint {
  readonly x: number;
  readonly y: number;
}

interface EmberTrail {
  readonly source: FlamePoint;
  readonly target: FlamePoint;
  age: number;
  carry: number;
}

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  readonly maxLife: number;
  readonly size: number;
}

/**
 * A speck of soot in the air, thrown off a glyph by the impact. Kept in its own
 * pool with its own budget: it shares nothing with the fire but the clock, and
 * the two must not compete for the same ceiling.
 */
interface DustMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Emitter seconds in the air, for the fade-in and the timeout safety net. */
  flightTime: number;
  /** Air resistance for this grain: big chips carry, fine grit stops dead. */
  drag: number;
  size: number;
  color: string;
  /** Height this mote comes to rest at. */
  restY: number;
  /** Opacity it will hold at, forever, once it has bedded in. */
  restAlpha: number;
}

/**
 * Dust that has landed. It is retired out of the simulation entirely — no
 * velocity, no life, no physics — and simply redrawn, because the emitter clears
 * the canvas every frame. This is debris on the page: it never expires.
 */
interface SettledMote {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  alpha: number;
  /** Emitter time it landed at, for the short bed-in ease. */
  settledAt: number;
}

const TAU = Math.PI * 2;
/** Below this speed a parcel has stalled and there is no direction left to align to. */
const ALIGNMENT_FLOOR = 4;
/** Anything fainter than this costs a fill and shows nothing, so it is skipped. */
const INVISIBLE_ALPHA = 0.015;
/** The soft outer body of a lick, drawn under its core. */
const HALO_ALPHA = 0.42;
const HALO_WIDTH = 1.9;
const HALO_LENGTH = 1.3;
const EMBER_TRAIL_DURATION = 0.18;
const EMBER_TRAIL_RATE = 110;

function clamp01(value: number): number {
  if (!(value > 0)) return 0;
  return value < 1 ? value : 1;
}

/** Deterministic lead position for the ember drip, including a small curl. */
export function emberTrailPoint(
  source: FlamePoint,
  target: FlamePoint,
  progress: number,
): FlamePoint {
  const amount = clamp01(progress);
  const curl = Math.sin(amount * Math.PI) * Math.min(12, Math.abs(target.y - source.y) * 0.12);
  return {
    x: source.x + (target.x - source.x) * amount + curl,
    y: source.y + (target.y - source.y) * amount,
  };
}

/** The only particle in the splash: a parcel of burning gas seated on a glyph. */
export const FLAME_PROFILE: ParticleProfile = {
  minLife: 0.42,
  maxLife: 0.95,
  minSize: 2.4,
  maxSize: 5.6,
  colors: FLAME_RAMP,
  spawnRate: 96,
  horizontalSpread: 5,
  maxHorizontalSpeed: 42,
};

export class ParticleEmitter {
  readonly #canvas: HTMLCanvasElement;
  readonly #context: CanvasRenderingContext2D;
  readonly #particles: Particle[] = [];
  readonly #dust: DustMote[] = [];
  readonly #settled: SettledMote[] = [];
  readonly #anchors = new Map<string, FlameAnchor>();
  readonly #emberTrails: EmberTrail[] = [];
  readonly #embers: Ember[] = [];
  #width = 0;
  #height = 0;
  #lastTime = performance.now();
  /** Seconds of emitter time, accumulated from render deltas only. */
  #elapsed = 0;

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

  /**
   * Lights a letter and keeps it lit. The seat carries the geometry of the fuel
   * left on the glyph, so the fire hugs the stroke instead of sitting on a point.
   */
  anchorFlame(id: string, seat: FlameSeat): void {
    this.#anchors.set(id, { seat, carry: 0, ignitedAt: this.#elapsed });

    // The accelerant going up: every site lights at once and hard, then the
    // envelope walks the seat down to its steady burn over the next seconds.
    const flare = ignitionEnvelope(0);
    for (const site of seat.sites) {
      const flash = Math.round(IGNITION_FLASH_COUNT * site.weight);
      for (let index = 0; index < flash; index += 1) {
        if (this.#particles.length >= FLAME_MAX_PARCELS) return;
        this.#spawnFlame(id, seat, site, flare);
      }
    }
  }

  removeFlame(id: string): void {
    this.#anchors.delete(id);
    for (let index = this.#particles.length - 1; index >= 0; index -= 1) {
      if (this.#particles[index]?.anchorId === id) this.#particles.splice(index, 1);
    }
  }

  startEmberTrail(source: FlamePoint, target: FlamePoint): void {
    this.#emberTrails.push({ source, target, age: 0, carry: 0 });
  }

  /**
   * Throws one burst of soot off a struck letter. One shot: unlike the fire
   * there is no anchor to keep feeding, the impact knocks the dust loose and
   * that is all the dust there is.
   */
  burstDust(burst: DustBurst): void {
    for (let index = 0; index < DUST_BURST_COUNT; index += 1) {
      if (this.#dust.length >= DUST_MAX_MOTES) return;

      const x = dustSourceX(burst, Math.random());
      const kickRoll = Math.random();
      const kicksBack = dustKicksBack(kickRoll);
      const angle = dustFanAngle(burst, x, Math.random(), kickRoll);
      const speed = dustLaunchSpeed(Math.random(), burst.scale, kicksBack);
      const size = dustSize(Math.random(), burst.scale, kicksBack);

      this.#dust.push({
        x,
        y: dustSourceY(burst, Math.random()),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        flightTime: 0,
        drag: dustDragFor(size, burst.scale),
        size,
        color: dustShade(Math.random()),
        restY: dustRestY(burst, Math.random()),
        restAlpha: dustRestAlpha(size, burst.scale),
      });
    }
  }

  /** `flare` is the seat's ignition envelope right now; 1 is the calm burn. */
  #spawnFlame(anchorId: string, seat: FlameSeat, site: FlameSite, flare: number): void {
    const profile = FLAME_PROFILE;
    const scale = seat.scale;
    // One draw decides how big a parcel this is; a gout is both fatter and
    // longer lived, the way a lump of unburnt fuel actually behaves.
    const spread = parcelSpread(Math.random(), Math.random());
    const lifeMix = 0.45 * spread + 0.55 * Math.random();
    const maxLife =
      (profile.minLife + (profile.maxLife - profile.minLife) * lifeMix) *
      ignitionGain(flare, IGNITION_LIFE_GAIN) *
      (seat.life ?? 1);
    const jitter = profile.horizontalSpread * scale;
    // A parcel leaves along the stroke first; buoyancy only wins once drag has
    // eaten that initial lick, which is what makes the fire look attached.
    const lick = profile.maxHorizontalSpeed * (0.55 + Math.random() * 0.9) * scale;
    const rise =
      (FLAME_LAUNCH_RISE + Math.random() * FLAME_LAUNCH_RISE_SPAN) *
      scale *
      ignitionGain(flare, IGNITION_RISE_GAIN) *
      (seat.rise ?? 1);

    this.#particles.push({
      anchorId,
      x: site.x + (Math.random() - 0.5) * jitter,
      y: site.y + (Math.random() - 0.5) * jitter * 0.6,
      vx: site.leanX * lick + (Math.random() - 0.5) * lick * 0.5,
      vy: site.leanY * lick - rise,
      life: maxLife,
      maxLife,
      size:
        (profile.minSize + (profile.maxSize - profile.minSize) * spread) *
        ignitionGain(flare, IGNITION_SIZE_GAIN) *
        (seat.size ?? 1) *
        (site.flare ?? 1),
      color: FLAME_RAMP[FLAME_RAMP.length - 1] ?? "#fff7c2",
      seed: seat.phase + Math.random() * FLAME_SEED_SPREAD,
      wobble: 1 + (Math.random() - 0.5) * 2 * FLAME_WOBBLE_SPREAD,
      scale,
      rise: seat.rise ?? 1,
    });
  }

  /**
   * Everything the emitter owns is stored in document space, because the fire
   * and the dust belong to the letters and the page scrolls. The canvas is fixed
   * to the viewport, so the draw is a scrolled window onto that world: clear in
   * viewport space, then translate by the scroll offset for the drawing itself.
   *
   * The translation is strictly balanced by save/restore. The controller draws
   * the shockwave into this same context immediately afterwards, and that one is
   * fed live viewport positions from a fixed projectile, so nothing may leak.
   */
  render(time = performance.now(), scrollX = 0, scrollY = 0): void {
    const delta = Math.min((time - this.#lastTime) / 1000, 0.05);
    this.#lastTime = time;
    this.#elapsed += delta;
    this.#context.clearRect(0, 0, this.#width, this.#height);

    this.#refuel(delta);
    this.#update(delta);
    this.#updateEmberTrails(delta);
    this.#updateEmbers(delta);
    this.#updateDust(delta);

    this.#context.save();
    this.#context.translate(-scrollX, -scrollY);
    // Dust lies on the page under the fire, and is never additive.
    this.#drawDust();
    this.#drawFire();
    this.#context.restore();
  }

  #refuel(delta: number): void {
    for (const [anchorId, anchor] of this.#anchors) {
      const flare = ignitionEnvelope(this.#elapsed - anchor.ignitedAt);
      const rate =
        FLAME_PROFILE.spawnRate *
        (anchor.seat.fuel ?? 1) *
        ignitionGain(flare, IGNITION_SPAWN_GAIN);
      const surge = fuelSurge(this.#elapsed, anchor.seat.phase);
      const drained = drainSpawnBudget(anchor.carry, rate, surge, delta);
      anchor.carry = drained.carry;
      for (let index = 0; index < drained.spawns; index += 1) {
        if (this.#particles.length >= FLAME_MAX_PARCELS) break;
        this.#spawnFlame(
          anchorId,
          anchor.seat,
          pickFlameSite(anchor.seat.sites, Math.random(), this.#elapsed),
          flare,
        );
      }
    }
  }

  #update(delta: number): void {
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

      const age = 1 - particle.life / particle.maxLife;
      particle.vy = advanceFlameVelocity(particle.vy, age, particle.scale * particle.rise, delta);
      particle.vx = advanceFlameLateral(
        particle.vx,
        this.#elapsed,
        particle.seed,
        age,
        particle.scale,
        delta,
        particle.wobble,
      );
    }
  }

  #updateEmberTrails(delta: number): void {
    for (let index = this.#emberTrails.length - 1; index >= 0; index -= 1) {
      const trail = this.#emberTrails[index];
      if (!trail) continue;
      trail.age += delta;
      trail.carry += EMBER_TRAIL_RATE * delta;
      const spawns = Math.floor(trail.carry);
      trail.carry -= spawns;
      const point = emberTrailPoint(trail.source, trail.target, trail.age / EMBER_TRAIL_DURATION);

      for (let spawn = 0; spawn < spawns; spawn += 1) {
        const life = 0.18 + Math.random() * 0.22;
        this.#embers.push({
          x: point.x + (Math.random() - 0.5) * 5,
          y: point.y + (Math.random() - 0.5) * 3,
          vx: (Math.random() - 0.5) * 24,
          vy: 18 + Math.random() * 30,
          life,
          maxLife: life,
          size: 1.2 + Math.random() * 2.1,
        });
      }

      if (trail.age >= EMBER_TRAIL_DURATION) this.#emberTrails.splice(index, 1);
    }
  }

  #updateEmbers(delta: number): void {
    for (let index = this.#embers.length - 1; index >= 0; index -= 1) {
      const ember = this.#embers[index];
      if (!ember) continue;
      ember.life -= delta;
      if (ember.life <= 0) {
        this.#embers.splice(index, 1);
        continue;
      }
      ember.x += ember.vx * delta;
      ember.y += ember.vy * delta;
      ember.vx *= Math.exp(-2.2 * delta);
      ember.vy += 80 * delta;
    }
  }

  /**
   * Only dust still in the air is simulated. A mote that reaches its resting
   * height is moved to the settled list and never touched again.
   */
  #updateDust(delta: number): void {
    for (let index = this.#dust.length - 1; index >= 0; index -= 1) {
      const mote = this.#dust[index];
      if (!mote) continue;

      mote.flightTime += delta;
      mote.x += mote.vx * delta;
      mote.y += mote.vy * delta;
      const next = advanceDustFlight(mote.vx, mote.vy, delta, mote.drag);
      mote.vx = next.vx;
      mote.vy = next.vy;

      if (hasLanded(mote.y, mote.restY, mote.vy)) {
        this.#dust.splice(index, 1);
        if (this.#settled.length >= DUST_MAX_SETTLED) continue;
        this.#settled.push({
          x: mote.x,
          y: mote.restY,
          width: mote.size,
          height: mote.size * DUST_REST_FLATTEN,
          color: mote.color,
          alpha: mote.restAlpha,
          settledAt: this.#elapsed,
        });
        continue;
      }

      // Safety net: nothing should ever still be flying by now.
      if (mote.flightTime >= DUST_FLIGHT_TIMEOUT) this.#dust.splice(index, 1);
    }
  }

  /**
   * Flat, dim specks. No glow, no blur: this is grit on the page. Settled dust
   * has to be repainted every frame because the emitter clears the canvas, but
   * each speck is a single flat fill with no path behind it.
   */
  #drawDust(): void {
    const context = this.#context;

    for (const mote of this.#settled) {
      // Eases from the flight opacity onto its resting one, then holds there for
      // good: there is no term here that can take it to zero.
      const alpha =
        DUST_ALPHA + (mote.alpha - DUST_ALPHA) * dustBedIn(this.#elapsed - mote.settledAt);
      context.globalAlpha = alpha;
      context.fillStyle = mote.color;
      context.fillRect(mote.x, mote.y, mote.width, mote.height);
    }

    for (const mote of this.#dust) {
      const alpha = dustFlightAlpha(mote.flightTime);
      if (alpha < INVISIBLE_ALPHA) continue;
      context.globalAlpha = alpha;
      context.fillStyle = mote.color;
      context.fillRect(mote.x, mote.y, mote.size, mote.size);
    }

    context.globalAlpha = 1;
  }

  /**
   * The fire is drawn additively: overlapping parcels bloom to white where the
   * plume is dense and stay a thin cool lick where it is not, which is the grade
   * we want without paying for a shadow blur on every parcel.
   */
  #drawFire(): void {
    const context = this.#context;
    context.globalCompositeOperation = "lighter";
    context.shadowBlur = 0;

    for (const anchor of this.#anchors.values()) {
      const surge = fuelSurge(this.#elapsed, anchor.seat.phase);
      const scale = anchor.seat.scale;
      const flare = ignitionGain(
        ignitionEnvelope(this.#elapsed - anchor.ignitedAt),
        IGNITION_GLOW_GAIN,
      );
      for (const site of anchor.seat.sites) {
        const glow = site.weight * surge * sitePulse(this.#elapsed, site.phase) * flare;
        // A stable per-site lump: one puddle is always wider than its neighbour.
        const lump = flameNoise(site.phase * 3.1);
        const x = site.x + (lump - 0.5) * 2 * scale;
        const y = site.y - scale;

        context.fillStyle = "#ff8a00";
        context.globalAlpha = Math.min(0.26, 0.07 + glow * 0.1);
        context.beginPath();
        context.ellipse(
          x,
          y,
          (3 + glow * 3.4) * (0.75 + lump * 0.55) * scale,
          (2.2 + glow * 2.2) * (0.8 + lump * 0.4) * scale,
          0,
          0,
          TAU,
        );
        context.fill();

        context.fillStyle = "#fff7c2";
        context.globalAlpha = Math.min(0.2, 0.04 + glow * 0.07);
        context.beginPath();
        context.ellipse(x, y, (1.5 + lump * 0.8) * scale, 1.5 * scale, 0, 0, TAU);
        context.fill();
      }
    }

    for (const ember of this.#embers) {
      const life = ember.life / ember.maxLife;
      context.fillStyle = life > 0.55 ? "#fff7c2" : life > 0.25 ? "#ffd400" : "#ff8a00";
      context.globalAlpha = Math.min(0.9, life * 1.35);
      context.beginPath();
      context.ellipse(ember.x, ember.y, ember.size * 0.7, ember.size * 1.4, 0, 0, TAU);
      context.fill();
    }

    for (const particle of this.#particles) {
      const age = 1 - particle.life / particle.maxLife;
      const alpha = flameAlpha(age);
      if (alpha < INVISIBLE_ALPHA) continue;
      const { rx, ry } = flameRadii(age, particle.size, particle.scale);
      const speed = Math.hypot(particle.vx, particle.vy);
      // Stretch along travel so a lick that curls sideways lies down with it.
      const rotation =
        speed > ALIGNMENT_FLOOR ? Math.atan2(particle.vy, particle.vx) + Math.PI / 2 : 0;

      context.fillStyle = FLAME_RAMP[flameRampIndex(flameHeat(age))] ?? "#ff8a00";
      const halo = alpha * HALO_ALPHA;
      if (halo >= INVISIBLE_ALPHA) {
        context.globalAlpha = halo;
        context.beginPath();
        context.ellipse(
          particle.x,
          particle.y,
          rx * HALO_WIDTH,
          ry * HALO_LENGTH,
          rotation,
          0,
          TAU,
        );
        context.fill();
      }

      context.globalAlpha = alpha;
      context.beginPath();
      context.ellipse(particle.x, particle.y, rx, ry, rotation, 0, TAU);
      context.fill();
    }

    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
  }

  clear(): void {
    this.#particles.length = 0;
    this.#dust.length = 0;
    this.#settled.length = 0;
    this.#anchors.clear();
    this.#emberTrails.length = 0;
    this.#embers.length = 0;
    this.#context.clearRect(0, 0, this.#width, this.#height);
  }
}

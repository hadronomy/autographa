import type { Point } from "./machine";

export interface PointStabilizer {
  reset(): void;
  addPoint(point: Readonly<Point>): Point;
}

export type PressureConfig =
  | Readonly<{
      mode: "none";
    }>
  | Readonly<{
      mode: "ema";
      alpha?: number; // 0..1
    }>
  | Readonly<{
      mode: "kalman";
      qPerMs?: number;
      r?: number;
    }>;

type CommonConfig = Readonly<{
  level?: number; // 0..100
  minPressure?: number;
  minDtMs?: number;
  maxDtMs?: number;
  minInputDeltaPx?: number;
  pressure?: PressureConfig;
}>;

export type KalmanConfig = CommonConfig &
  Readonly<{
    algorithm: "kalman";
    kalman?: Readonly<{
      qPerMs?: number;
      r?: number;
    }>;
    holt?: never;
  }>;

export type HoltConfig = CommonConfig &
  Readonly<{
    algorithm: "holt";
    holt?: Readonly<{
      /**
       * Alpha/Beta are tuned at a reference sample rate (default 60Hz),
       * then rescaled per dt to keep the feel consistent across event rates.
       */
      alpha?: number; // 0..1
      beta?: number; // 0..1
      referenceDtMs?: number; // default 16.6667

      /**
       * Damped-trend Holt (recommended):
       * Controls how quickly the velocity estimate decays toward 0 when residuals
       * get small (e.g. during deceleration).
       *
       * - 0 disables damping (classic Holt)
       * - Typical values: 40..140
       */
      trendDampingHalfLifeMs?: number;
    }>;
    kalman?: never;
  }>;

export type PenStabilizerConfig = KalmanConfig | HoltConfig;

const clamp = (min: number, max: number, v: number) => Math.max(min, Math.min(max, v));
const clamp01 = (v: number) => clamp(0, 1, v);

const DEFAULTS = {
  level: 35,
  minPressure: 0.1,
  minDtMs: 1,
  maxDtMs: 40,
  minInputDeltaPx: 0,
  pressure: { mode: "none" } as const,
} as const;

function kalmanParamsFromLevel(levelRaw: number): { qPerMs: number; r: number } {
  const level = clamp01(levelRaw / 100);
  const qPerMs = 0.0005 - level * 0.00047; // 0.0005 -> 0.00003
  const r = 0.02 + level * 0.33; // 0.02 -> 0.35
  return { qPerMs, r };
}

function holtParamsFromLevel(levelRaw: number): {
  alpha: number;
  beta: number;
  trendDampingHalfLifeMs: number;
} {
  const level = clamp01(levelRaw / 100);

  const alpha = 0.45 - level * 0.33; // 0.45 -> 0.12
  const beta = 0.18 - level * 0.14; // 0.18 -> 0.04

  // Higher stabilization => more damping (less coasting).
  const trendDampingHalfLifeMs = 50 + level * 120; // 50..170

  return {
    alpha: clamp01(alpha),
    beta: clamp01(beta),
    trendDampingHalfLifeMs,
  };
}

/**
 * Convert a reference EMA alpha (for referenceDtMs) into a dt-adjusted alpha.
 * alpha(dt) = 1 - exp(-dt / tau)
 */
function alphaForDt(alphaRef: number, referenceDtMs: number, dtMs: number): number {
  const aRef = clamp01(alphaRef);
  if (aRef <= 0) return 0;
  if (aRef >= 1) return 1;

  const refDt = Math.max(1e-3, referenceDtMs);
  const dt = Math.max(1e-3, dtMs);

  const tau = -refDt / Math.log(1 - aRef);
  const aDt = 1 - Math.exp(-dt / tau);
  return clamp01(aDt);
}

/**
 * Exponential decay factor from a half-life.
 * halfLifeMs=0 => no decay (factor 1)
 */
function decayFactorFromHalfLife(halfLifeMs: number, dtMs: number): number {
  const hl = Math.max(0, halfLifeMs);
  if (hl === 0) return 1;
  const dt = Math.max(0, dtMs);
  // factor = 0.5^(dt/hl)
  return Math.pow(0.5, dt / hl);
}

class Kalman1D {
  private x = 0;
  private p = 1;
  private initialized = false;

  constructor(
    private readonly qPerMs: number,
    private readonly r: number,
  ) {}

  reset(): void {
    this.x = 0;
    this.p = 1;
    this.initialized = false;
  }

  update(z: number, dtMs: number): number {
    if (!this.initialized) {
      this.initialized = true;
      this.x = z;
      return z;
    }

    const dt = Math.max(1e-3, dtMs);
    this.p = this.p + this.qPerMs * dt;

    const k = this.p / (this.p + this.r);
    this.x = this.x + k * (z - this.x);
    this.p = (1 - k) * this.p;

    return this.x;
  }
}

/**
 * Damped, dt-aware Holt where trend is velocity (px/ms), not “px per sample”.
 *
 * Predict: x̂ = level + trend * dtMs
 * Update level: blend measurement with prediction using alpha(dt)
 * Update trend: blend instantaneous velocity with previous using beta(dt)
 * Apply damping to trend each step to prevent “coasting” on deceleration.
 */
class HoltVelocity1D {
  private initialized = false;
  private level = 0;
  private trendV = 0; // px/ms

  constructor(
    private readonly alphaRef: number,
    private readonly betaRef: number,
    private readonly referenceDtMs: number,
    private readonly trendDampingHalfLifeMs: number,
  ) {}

  reset(): void {
    this.initialized = false;
    this.level = 0;
    this.trendV = 0;
  }

  update(z: number, dtMs: number): number {
    const dt = Math.max(1e-3, dtMs);

    if (!this.initialized) {
      this.initialized = true;
      this.level = z;
      this.trendV = 0;
      return z;
    }

    const alpha = alphaForDt(this.alphaRef, this.referenceDtMs, dt);
    const beta = alphaForDt(this.betaRef, this.referenceDtMs, dt);

    // Dampen existing velocity (prevents momentum carryover).
    const damp = decayFactorFromHalfLife(this.trendDampingHalfLifeMs, dt);
    this.trendV *= damp;

    const pred = this.level + this.trendV * dt;
    const prevLevel = this.level;

    // Update level toward measurement
    const nextLevel = alpha * z + (1 - alpha) * pred;

    // Instantaneous velocity implied by level change
    const instV = (nextLevel - prevLevel) / dt;

    // Update velocity estimate
    const nextTrendV = beta * instV + (1 - beta) * this.trendV;

    this.level = nextLevel;
    this.trendV = nextTrendV;

    return this.level;
  }
}

class PressureSmoother {
  private readonly mode: PressureConfig["mode"];
  private readonly minPressure: number;

  private readonly emaAlpha: number;
  private readonly kalman: Kalman1D | null;

  private ema = 0.5;
  private emaInitialized = false;

  constructor(args: { pressure: PressureConfig; level: number; minPressure: number }) {
    this.mode = args.pressure.mode;
    this.minPressure = args.minPressure;

    if (args.pressure.mode === "ema") {
      this.emaAlpha = clamp01(args.pressure.alpha ?? 0.25);
      this.kalman = null;
    } else if (args.pressure.mode === "kalman") {
      const derived = kalmanParamsFromLevel(args.level);
      const qPerMs = args.pressure.qPerMs ?? derived.qPerMs * 0.5;
      const r = args.pressure.r ?? derived.r * 0.4;
      this.kalman = new Kalman1D(qPerMs, r);
      this.emaAlpha = 0;
    } else {
      this.emaAlpha = 0;
      this.kalman = null;
    }
  }

  reset(): void {
    this.ema = 0.5;
    this.emaInitialized = false;
    this.kalman?.reset();
  }

  update(pressure: number, dtMs: number): number {
    const pIn = clamp(this.minPressure, 1, pressure);

    if (this.mode === "none") return pIn;

    if (this.mode === "ema") {
      if (!this.emaInitialized) {
        this.emaInitialized = true;
        this.ema = pIn;
      } else {
        this.ema = this.ema + this.emaAlpha * (pIn - this.ema);
      }
      return clamp(this.minPressure, 1, this.ema);
    }

    return clamp(this.minPressure, 1, this.kalman!.update(pIn, dtMs));
  }
}

export class PenStabilizer implements PointStabilizer {
  private readonly algorithm: PenStabilizerConfig["algorithm"];

  private readonly minPressure: number;
  private readonly minDtMs: number;
  private readonly maxDtMs: number;
  private readonly minInputDeltaSq: number;

  private lastT: number | null = null;
  private lastRaw: { x: number; y: number; t: number } | null = null;

  private readonly pressure: PressureSmoother;

  private readonly xKalman: Kalman1D | null;
  private readonly yKalman: Kalman1D | null;

  private readonly xHolt: HoltVelocity1D | null;
  private readonly yHolt: HoltVelocity1D | null;

  constructor(levelOrConfig: number | PenStabilizerConfig = 35) {
    const config: PenStabilizerConfig =
      typeof levelOrConfig === "number"
        ? { algorithm: "kalman", level: levelOrConfig }
        : levelOrConfig;

    const level = config.level ?? DEFAULTS.level;

    this.algorithm = config.algorithm;

    this.minPressure = clamp(0, 1, config.minPressure ?? DEFAULTS.minPressure);
    this.minDtMs = Math.max(0, config.minDtMs ?? DEFAULTS.minDtMs);
    this.maxDtMs = Math.max(this.minDtMs, config.maxDtMs ?? DEFAULTS.maxDtMs);

    const minInputDeltaPx = Math.max(0, config.minInputDeltaPx ?? DEFAULTS.minInputDeltaPx);
    this.minInputDeltaSq = minInputDeltaPx * minInputDeltaPx;

    this.pressure = new PressureSmoother({
      pressure: config.pressure ?? DEFAULTS.pressure,
      level,
      minPressure: this.minPressure,
    });

    if (config.algorithm === "kalman") {
      const derived = kalmanParamsFromLevel(level);
      const qPerMs = config.kalman?.qPerMs ?? derived.qPerMs;
      const r = config.kalman?.r ?? derived.r;

      this.xKalman = new Kalman1D(qPerMs, r);
      this.yKalman = new Kalman1D(qPerMs, r);

      this.xHolt = null;
      this.yHolt = null;
    } else {
      const derived = holtParamsFromLevel(level);

      const alphaRef = config.holt?.alpha ?? derived.alpha;
      const betaRef = config.holt?.beta ?? derived.beta;
      const referenceDtMs = Math.max(1e-3, config.holt?.referenceDtMs ?? 1000 / 60);

      const trendDampingHalfLifeMs = Math.max(
        0,
        config.holt?.trendDampingHalfLifeMs ?? derived.trendDampingHalfLifeMs,
      );

      this.xHolt = new HoltVelocity1D(alphaRef, betaRef, referenceDtMs, trendDampingHalfLifeMs);
      this.yHolt = new HoltVelocity1D(alphaRef, betaRef, referenceDtMs, trendDampingHalfLifeMs);

      this.xKalman = null;
      this.yKalman = null;
    }
  }

  reset(): void {
    this.lastT = null;
    this.lastRaw = null;

    this.xKalman?.reset();
    this.yKalman?.reset();

    this.xHolt?.reset();
    this.yHolt?.reset();

    this.pressure.reset();
  }

  addPoint(point: Readonly<Point>): Point {
    const t = point.timestamp;

    // Optional raw jitter gate (BEFORE filtering).
    if (this.lastRaw && this.minInputDeltaSq > 0) {
      const dx = point.x - this.lastRaw.x;
      const dy = point.y - this.lastRaw.y;
      if (dx * dx + dy * dy < this.minInputDeltaSq) {
        this.lastT = t;
        this.lastRaw = { x: point.x, y: point.y, t };
        return {
          x: point.x,
          y: point.y,
          pressure: clamp(this.minPressure, 1, point.pressure),
          timestamp: t,
        };
      }
    }

    const dtRaw = this.lastT === null ? this.minDtMs : t - this.lastT;
    const dtMs = clamp(this.minDtMs, this.maxDtMs, dtRaw);

    this.lastT = t;
    this.lastRaw = { x: point.x, y: point.y, t };

    let x = point.x;
    let y = point.y;

    if (this.algorithm === "kalman") {
      x = this.xKalman!.update(point.x, dtMs);
      y = this.yKalman!.update(point.y, dtMs);
    } else {
      x = this.xHolt!.update(point.x, dtMs);
      y = this.yHolt!.update(point.y, dtMs);
    }

    const p = this.pressure.update(point.pressure, dtMs);

    return { x, y, pressure: p, timestamp: t };
  }
}

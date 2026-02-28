import type { Stroke } from "../machine";

export type BrushCanvasContext = Readonly<{
  dpr: number;
}>;

export type DashoffsetCurve = Readonly<{
  /**
   * Normalized times in [0..1], strictly increasing, including 0 and 1.
   */
  keyTimes: ReadonlyArray<number>;

  /**
   * stroke-dashoffset values in [1..0] (1=hidden, 0=fully drawn),
   * same length as keyTimes.
   */
  values: ReadonlyArray<number>;
}>;

export type BrushSvgContext = Readonly<{
  size: { width: number; height: number };
  precision: number;
  inkColor: string;
  animation: Readonly<{
    enabled: boolean;
    delayMs: number;
    durationMs: number;

    /**
     * Optional per-stroke CSS animation-name override.
     * If not provided, renderers will use the default keyframes name.
     */
    name?: string;

    /**
     * Optional per-stroke CSS timing function override.
     * (For curve-driven keyframes you typically want "linear".)
     */
    timingFunction?: string;

    /**
     * Optional curve samples for non-linear reveal.
     * - Centerline brushes can use it by emitting per-stroke CSS keyframes.
     * - Fill/outline brushes can use it in SMIL inside reveal masks.
     */
    dashoffsetCurve?: DashoffsetCurve;
  }>;
}>;

export type BrushSvgRenderResult = Readonly<{
  defs?: string;
  body: string;
}>;

export interface Brush<S extends Record<string, unknown>> {
  id: string;
  label: string;
  version: 1;

  defaults: S;

  /**
   * Takes untyped stroke.brush.settings and returns strongly-shaped settings.
   * Must be pure and deterministic.
   */
  coerceSettings: (raw: Record<string, unknown>) => S;

  preprocess?: (stroke: Stroke, settings: S) => Stroke;

  renderCanvas(args: {
    ctx: CanvasRenderingContext2D;
    stroke: Stroke;
    settings: S;
    context: BrushCanvasContext;
  }): void;

  renderSvg(args: { stroke: Stroke; settings: S; context: BrushSvgContext }): BrushSvgRenderResult;
}

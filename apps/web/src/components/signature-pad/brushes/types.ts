import type { Stroke } from "../machine";

export type BrushCanvasContext = Readonly<{
  dpr: number;
}>;

export type BrushSvgContext = Readonly<{
  size: { width: number; height: number };
  precision: number;
  inkColor: string;
  animation: Readonly<{
    enabled: boolean;
    delayMs: number;
    durationMs: number;
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

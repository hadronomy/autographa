import { optimize } from "svgo";

import type { MonolineSettings } from "./brushes/brushes/monoline";
import type { SharpieBrushSettings } from "./brushes/brushes/sharpie-brush";
import type { TombowFudenosukeSettings } from "./brushes/brushes/tombow-fudenosuke";
import {
  buildOutlinePolygon,
  densifyQuadraticCenterline,
  estimateStrokeLength,
  toFixed,
} from "./brushes/geometry";
import { getBrush } from "./brushes/registry";
import type { Brush } from "./brushes/types";
import type { BrushId, Stroke } from "./machine";

export type SignatureSvgSize = Readonly<{
  width: number;
  height: number;
}>;

export type SignatureSvgAnimationOptions = Readonly<{
  pxPerSecond: number;
  minStrokeMs: number;
  maxStrokeMs: number;
  gapBetweenStrokesMs: number;
}>;

export type BuildSignatureSvgOptions = Readonly<{
  precision?: number;
  animated?: boolean;

  /**
   * If true, the exported SVG's width/height/viewBox are computed from the
   * rendered content bounds (strokes), independent of where the user drew on
   * the canvas.
   *
   * Defaults to true.
   */
  fitToContent?: boolean;

  /**
   * Padding (px) added around the fitted content bounds.
   * Defaults to 2.
   */
  contentPaddingPx?: number;

  animation?: Partial<SignatureSvgAnimationOptions>;
  stroke?: string;
}>;

export type BuildSignatureSvgParams = Readonly<{
  strokes: ReadonlyArray<Stroke>;
  /**
   * The "canvas size" (historical). Used when fitToContent=false, and as a
   * fallback for empty exports.
   */
  size: SignatureSvgSize;
  options?: BuildSignatureSvgOptions;
}>;

const DEFAULT_ANIMATION: SignatureSvgAnimationOptions = {
  pxPerSecond: 900,
  minStrokeMs: 120,
  maxStrokeMs: 2200,
  gapBetweenStrokesMs: 60,
};

type Bounds = Readonly<{
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}>;

function emptyBounds(): Bounds {
  return {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
}

function isFiniteBounds(b: Bounds): boolean {
  return (
    Number.isFinite(b.minX) &&
    Number.isFinite(b.minY) &&
    Number.isFinite(b.maxX) &&
    Number.isFinite(b.maxY)
  );
}

function unionBounds(a: Bounds, b: Bounds): Bounds {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

function expandBounds(b: Bounds, padPx: number): Bounds {
  const p = Math.max(0, padPx);
  return {
    minX: b.minX - p,
    minY: b.minY - p,
    maxX: b.maxX + p,
    maxY: b.maxY + p,
  };
}

function boundsFromPoints(points: ReadonlyArray<{ x: number; y: number }>): Bounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  return { minX, minY, maxX, maxY };
}

function translateStroke(stroke: Stroke, dx: number, dy: number): Stroke {
  if (dx === 0 && dy === 0) return stroke;

  return {
    ...stroke,
    points: stroke.points.map((p) => ({
      ...p,
      x: p.x + dx,
      y: p.y + dy,
    })),
  };
}

type PreparedStroke =
  | Readonly<{
      brushId: "monoline";
      brush: Brush<MonolineSettings>;
      settings: MonolineSettings;
      stroke: Stroke;
    }>
  | Readonly<{
      brushId: "uni-jetstream";
      brush: Brush<MonolineSettings>;
      settings: MonolineSettings;
      stroke: Stroke;
    }>
  | Readonly<{
      brushId: "sharpie-fine";
      brush: Brush<MonolineSettings>;
      settings: MonolineSettings;
      stroke: Stroke;
    }>
  | Readonly<{
      brushId: "tombow-fudenosuke";
      brush: Brush<TombowFudenosukeSettings>;
      settings: TombowFudenosukeSettings;
      stroke: Stroke;
    }>
  | Readonly<{
      brushId: "sharpie-brush";
      brush: Brush<SharpieBrushSettings>;
      settings: SharpieBrushSettings;
      stroke: Stroke;
    }>;

function prepareStroke(stroke: Stroke): PreparedStroke {
  const id: BrushId = stroke.brush.id;

  switch (id) {
    case "monoline": {
      const brush = getBrush("monoline");
      const settings = brush.coerceSettings(stroke.brush.settings);
      const pre = brush.preprocess ? brush.preprocess(stroke, settings) : stroke;
      return { brushId: "monoline", brush, settings, stroke: pre };
    }

    case "uni-jetstream": {
      const brush = getBrush("uni-jetstream");
      const settings = brush.coerceSettings(stroke.brush.settings);
      const pre = brush.preprocess ? brush.preprocess(stroke, settings) : stroke;
      return { brushId: "uni-jetstream", brush, settings, stroke: pre };
    }

    case "sharpie-fine": {
      const brush = getBrush("sharpie-fine");
      const settings = brush.coerceSettings(stroke.brush.settings);
      const pre = brush.preprocess ? brush.preprocess(stroke, settings) : stroke;
      return { brushId: "sharpie-fine", brush, settings, stroke: pre };
    }

    case "tombow-fudenosuke": {
      const brush = getBrush("tombow-fudenosuke");
      const settings = brush.coerceSettings(stroke.brush.settings);
      const pre = brush.preprocess ? brush.preprocess(stroke, settings) : stroke;
      return { brushId: "tombow-fudenosuke", brush, settings, stroke: pre };
    }

    case "sharpie-brush": {
      const brush = getBrush("sharpie-brush");
      const settings = brush.coerceSettings(stroke.brush.settings);
      const pre = brush.preprocess ? brush.preprocess(stroke, settings) : stroke;
      return { brushId: "sharpie-brush", brush, settings, stroke: pre };
    }
  }
}

/**
 * Some brushes use SVG filters (blur/glow/displacement) which can paint outside
 * the geometric stroke outline. This returns extra pad to avoid clipping when
 * fitting tightly.
 */
function extraVisualPadPx(p: PreparedStroke): number {
  if (p.brushId !== "sharpie-brush") return 0;

  const softness = Math.max(0, Math.min(1, p.settings.edgeSoftness));
  const roughness = Math.max(0, p.settings.roughnessPx);

  // Matches brush renderSvg mapping (approx).
  const blur = 0.08 + softness * 0.38;
  const dropShadowStd = blur + 0.35;

  // Conservative: ~3 sigma, plus displacement, plus small safety.
  return roughness + dropShadowStd * 6 + 2;
}

function strokeBounds(p: PreparedStroke): Bounds {
  const stroke = p.stroke;

  if (stroke.points.length === 0) return emptyBounds();

  switch (p.brushId) {
    case "monoline":
    case "sharpie-fine":
    case "uni-jetstream": {
      // Centerline stroke with round caps: expand point bounds by max radius.
      const half = Math.max(0, stroke.width) / 2;
      const b = boundsFromPoints(stroke.points);
      return expandBounds(b, half);
    }

    case "tombow-fudenosuke": {
      const poly = buildOutlinePolygon(stroke.points, {
        ...p.settings,
        base: stroke.width,
      });

      const vertices: Array<{ x: number; y: number }> = [];
      vertices.push(...poly.startCap);
      vertices.push(...poly.left.slice(1, -1));
      vertices.push(...poly.endCap);
      vertices.push(...poly.right.slice(1, -1).reverse());

      return boundsFromPoints(vertices);
    }

    case "sharpie-brush": {
      // Mirror the brush's densify behavior for stable geometry bounds.
      const autoSpacing = Math.max(0.35, stroke.width * 0.075);
      const spacing = p.settings.densifySpacingPx > 0 ? p.settings.densifySpacingPx : autoSpacing;

      const densified = densifyQuadraticCenterline(stroke.points, spacing);

      const poly = buildOutlinePolygon(densified, {
        ...p.settings,
        base: stroke.width,
      });

      const vertices: Array<{ x: number; y: number }> = [];
      vertices.push(...poly.startCap);
      vertices.push(...poly.left.slice(1, -1));
      vertices.push(...poly.endCap);
      vertices.push(...poly.right.slice(1, -1).reverse());

      // Outline smoothing stays within the polygon, so this is a safe bound.
      return boundsFromPoints(vertices);
    }
  }
}

function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function svgStyle(animated: boolean): string {
  if (!animated) return "";

  /**
   * IMPORTANT:
   * - Do NOT set stroke-dashoffset: 1 in the base class.
   *   That makes paths invisible in viewers that don't run CSS animations
   *   (and is especially problematic when the path lives inside a <mask>).
   *
   * - Instead, set dashoffset in keyframes.
   * - Use fill-mode: both so the 0% keyframe applies during delay.
   */
  return `
    .sig-anim-path {
      stroke-dasharray: 1;
      animation-name: sig-draw;
      animation-timing-function: linear;
      animation-fill-mode: both;
    }

    @keyframes sig-draw {
      from {
        stroke-dashoffset: 1;
      }
      to {
        stroke-dashoffset: 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .sig-anim-path {
        animation: none !important;
        stroke-dashoffset: 0;
      }
    }
  `;
}

function renderPreparedSvg(args: {
  prepared: PreparedStroke;
  translatedStroke: Stroke;
  exportSize: SignatureSvgSize;
  precision: number;
  inkColor: string;
  animation: { enabled: boolean; delayMs: number; durationMs: number };
}) {
  const { prepared: p, translatedStroke, exportSize, precision, inkColor, animation } = args;

  switch (p.brushId) {
    case "monoline":
    case "sharpie-fine":
    case "uni-jetstream":
      return p.brush.renderSvg({
        stroke: translatedStroke,
        settings: p.settings,
        context: {
          size: exportSize,
          precision,
          inkColor,
          animation,
        },
      });

    case "tombow-fudenosuke":
      return p.brush.renderSvg({
        stroke: translatedStroke,
        settings: p.settings,
        context: {
          size: exportSize,
          precision,
          inkColor,
          animation,
        },
      });

    case "sharpie-brush":
      return p.brush.renderSvg({
        stroke: translatedStroke,
        settings: p.settings,
        context: {
          size: exportSize,
          precision,
          inkColor,
          animation,
        },
      });
  }
}

/**
 * Pure + deterministic SVG export.
 * All brushes animate:
 * - centerline: dash anim on the stroke path
 * - fill brushes: dash anim on a reveal-mask centerline
 */
export function buildSignatureSvg(params: BuildSignatureSvgParams): string {
  const { strokes, size, options } = params;

  const precision = options?.precision ?? 1;
  const animated = options?.animated ?? true;
  const inkColor = options?.stroke ?? "currentColor";

  const animationCfg: SignatureSvgAnimationOptions = {
    ...DEFAULT_ANIMATION,
    ...options?.animation,
  };

  const fitToContent = options?.fitToContent ?? true;
  const contentPaddingPx = Math.max(0, options?.contentPaddingPx ?? 2);

  const prepared = strokes.map(prepareStroke);

  let exportSize: SignatureSvgSize = {
    width: Number.isFinite(size.width) ? Math.max(0, size.width) : 0,
    height: Number.isFinite(size.height) ? Math.max(0, size.height) : 0,
  };

  let dx = 0;
  let dy = 0;

  if (fitToContent && prepared.length > 0) {
    let content = emptyBounds();

    for (const p of prepared) {
      const geom = strokeBounds(p);
      const pad = contentPaddingPx + extraVisualPadPx(p);
      content = unionBounds(content, expandBounds(geom, pad));
    }

    if (isFiniteBounds(content)) {
      dx = -content.minX;
      dy = -content.minY;

      exportSize = {
        width: Math.ceil(Math.max(1, content.maxX - content.minX)),
        height: Math.ceil(Math.max(1, content.maxY - content.minY)),
      };
    }
  }

  let cumulativeDelayMs = 0;

  const defs: string[] = [];
  const bodies: string[] = [];

  for (const p of prepared) {
    const translated = dx === 0 && dy === 0 ? p.stroke : translateStroke(p.stroke, dx, dy);

    const approxLenPx = estimateStrokeLength(translated.points);

    const durationMs = Math.min(
      animationCfg.maxStrokeMs,
      Math.max(animationCfg.minStrokeMs, (approxLenPx / animationCfg.pxPerSecond) * 1000),
    );

    const delayMs = cumulativeDelayMs;
    cumulativeDelayMs += durationMs + animationCfg.gapBetweenStrokesMs;

    const out = renderPreparedSvg({
      prepared: p,
      translatedStroke: translated,
      exportSize,
      precision,
      inkColor,
      animation: {
        enabled: animated,
        delayMs,
        durationMs,
      },
    });

    if (out.defs) defs.push(out.defs);
    bodies.push(out.body);
  }

  const styleTag = svgStyle(animated).trim();
  const defsBlock =
    defs.length > 0 || styleTag.length > 0
      ? `<defs>${styleTag ? `<style>${styleTag}</style>` : ""}${defs.join("")}</defs>`
      : "";

  const widthAttr = toFixed(exportSize.width, 0);
  const heightAttr = toFixed(exportSize.height, 0);

  return optimize(
    `<svg` +
      ` width="${widthAttr}"` +
      ` height="${heightAttr}"` +
      ` viewBox="0 0 ${widthAttr} ${heightAttr}"` +
      ` xmlns="http://www.w3.org/2000/svg"` +
      `>` +
      defsBlock +
      bodies.join("") +
      `</svg>`,
    {
      js2svg: {
        pretty: true,
        indent: 2,
      },
      multipass: true,
    },
  ).data;
}

export function buildAnimatedPathStyle(args: {
  enabled: boolean;
  delayMs: number;
  durationMs: number;
}): string {
  if (!args.enabled) return "";
  return `animation-delay: ${toFixed(args.delayMs, 0)}ms; animation-duration: ${toFixed(
    args.durationMs,
    0,
  )}ms;`;
}

export function svgStrokeAttrs(args: {
  stroke: string;
  strokeWidth: number;
  linecap?: "round" | "butt" | "square";
  linejoin?: "round" | "bevel" | "miter";
}): string {
  return (
    ` stroke="${escapeAttr(args.stroke)}"` +
    ` stroke-width="${escapeAttr(String(args.strokeWidth))}"` +
    ` stroke-linecap="${escapeAttr(args.linecap ?? "round")}"` +
    ` stroke-linejoin="${escapeAttr(args.linejoin ?? "round")}"` +
    ` fill="none"`
  );
}

export function escapeSvgAttr(value: string): string {
  return escapeAttr(value);
}

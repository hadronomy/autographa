import { estimateStrokeLength, toFixed } from "./brushes/geometry";
import { getBrush } from "./brushes/registry";
import type { Stroke } from "./machine";

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
  animation?: Partial<SignatureSvgAnimationOptions>;
  stroke?: string;
}>;

export type BuildSignatureSvgParams = Readonly<{
  strokes: ReadonlyArray<Stroke>;
  size: SignatureSvgSize;
  options?: BuildSignatureSvgOptions;
}>;

const DEFAULT_ANIMATION: SignatureSvgAnimationOptions = {
  pxPerSecond: 900,
  minStrokeMs: 120,
  maxStrokeMs: 2200,
  gapBetweenStrokesMs: 60,
};

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

/**
 * Pure + deterministic SVG export.
 * All brushes animate:
 * - centerline: dash anim on the stroke path
 * - fill brushes: dash anim on a reveal-mask centerline
 */
export function buildSignatureSvg(params: BuildSignatureSvgParams): string {
  const { strokes, size, options } = params;

  const width = Number.isFinite(size.width) ? Math.max(0, size.width) : 0;
  const height = Number.isFinite(size.height) ? Math.max(0, size.height) : 0;

  const precision = options?.precision ?? 1;
  const animated = options?.animated ?? true;
  const inkColor = options?.stroke ?? "currentColor";

  const animation: SignatureSvgAnimationOptions = {
    ...DEFAULT_ANIMATION,
    ...options?.animation,
  };

  let cumulativeDelayMs = 0;

  const defs: string[] = [];
  const bodies: string[] = [];

  for (const stroke of strokes) {
    const brush = getBrush(stroke.brush.id);
    const settings = brush.coerceSettings(stroke.brush.settings);
    const prepared = brush.preprocess ? brush.preprocess(stroke, settings) : stroke;

    const approxLenPx = estimateStrokeLength(prepared.points);

    const durationMs = Math.min(
      animation.maxStrokeMs,
      Math.max(animation.minStrokeMs, (approxLenPx / animation.pxPerSecond) * 1000),
    );

    const delayMs = cumulativeDelayMs;
    cumulativeDelayMs += durationMs + animation.gapBetweenStrokesMs;

    const out = brush.renderSvg({
      stroke: prepared,
      settings,
      context: {
        size: { width, height },
        precision,
        inkColor,
        animation: {
          enabled: animated,
          delayMs,
          durationMs,
        },
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

  return (
    `<svg` +
    ` width="${toFixed(width, 0)}"` +
    ` height="${toFixed(height, 0)}"` +
    ` viewBox="0 0 ${toFixed(width, 0)} ${toFixed(height, 0)}"` +
    ` xmlns="http://www.w3.org/2000/svg"` +
    `>` +
    defsBlock +
    bodies.join("") +
    `</svg>`
  );
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

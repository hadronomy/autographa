import { toHtml } from "hast-util-to-html";
import { h } from "hastscript";

import type { Stroke } from "./machine";

export type SignatureSvgSize = Readonly<{
  width: number;
  height: number;
}>;

export type SignatureSvgAnimationOptions = Readonly<{
  /**
   * Approximate drawing speed used to derive per-stroke animation durations.
   * Higher => faster animation (shorter duration).
   */
  pxPerSecond: number;

  /** Clamp for very small strokes. */
  minStrokeMs: number;

  /** Clamp for very long strokes. */
  maxStrokeMs: number;

  /** Gap inserted between stroke animations. */
  gapBetweenStrokesMs: number;
}>;

export type BuildSignatureSvgOptions = Readonly<{
  /**
   * Decimal places for path coordinates. Default: 1 (matches prior behavior).
   * Note: Lower precision reduces SVG size but may reduce fidelity.
   */
  precision?: number;

  /**
   * Include stroke-dash "draw" animation and a prefers-reduced-motion fallback.
   * Default: true (matches prior behavior).
   */
  animated?: boolean;

  /**
   * Animation tuning. Any omitted values fall back to the component defaults.
   */
  animation?: Partial<SignatureSvgAnimationOptions>;

  /**
   * SVG stroke color used for all paths.
   * Default: "currentColor" (matches the previous in-component export).
   *
   * If you want the exported SVG to preserve canvas stroke color, pass
   * `stroke: strokeColor` (but that would change behavior from the existing export).
   */
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

function estimateStrokeLength(points: ReadonlyArray<{ x: number; y: number }>): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    len += Math.hypot(dx, dy);
  }
  return len;
}

function toFixed(n: number, precision: number): string {
  // Guard against invalid precision.
  const p = Number.isFinite(precision) ? Math.max(0, Math.min(6, precision)) : 1;
  return n.toFixed(p);
}

/**
 * Build an SVG string representing the provided signature strokes.
 *
 * - Pure function: no DOM access, no side effects.
 * - Output is stable for the same inputs.
 * - Default output matches the component's previous "exportSVG" behavior:
 *   quadratic smoothing, `currentColor`, and stroke-dash animation.
 */
export function buildSignatureSvg(params: BuildSignatureSvgParams): string {
  const { strokes, size, options } = params;

  const width = Number.isFinite(size.width) ? Math.max(0, size.width) : 0;
  const height = Number.isFinite(size.height) ? Math.max(0, size.height) : 0;

  const precision = options?.precision ?? 1;
  const animated = options?.animated ?? true;
  const strokeColor = options?.stroke ?? "currentColor";

  const animation: SignatureSvgAnimationOptions = {
    ...DEFAULT_ANIMATION,
    ...options?.animation,
  };

  let cumulativeDelayMs = 0;

  const pathElements = strokes
    .map((stroke, index) => {
      if (stroke.points.length < 2) return null;

      let pathData = `M ${toFixed(stroke.points[0].x, precision)} ${toFixed(
        stroke.points[0].y,
        precision,
      )}`;

      for (let i = 1; i < stroke.points.length - 1; i++) {
        const curr = stroke.points[i];
        const next = stroke.points[i + 1];
        const midX = (curr.x + next.x) / 2;
        const midY = (curr.y + next.y) / 2;

        pathData += ` Q ${toFixed(curr.x, precision)} ${toFixed(
          curr.y,
          precision,
        )}, ${toFixed(midX, precision)} ${toFixed(midY, precision)}`;
      }

      const last = stroke.points[stroke.points.length - 1];
      pathData += ` L ${toFixed(last.x, precision)} ${toFixed(last.y, precision)}`;

      if (!animated) {
        return h("path", {
          d: pathData,
          id: `stroke-${index}`,
          stroke: strokeColor,
          strokeWidth: stroke.width,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          fill: "none",
        });
      }

      const approxLenPx = estimateStrokeLength(stroke.points);
      const durationMs = Math.min(
        animation.maxStrokeMs,
        Math.max(animation.minStrokeMs, (approxLenPx / animation.pxPerSecond) * 1000),
      );

      const delayMs = cumulativeDelayMs;
      cumulativeDelayMs += durationMs + animation.gapBetweenStrokesMs;

      return h("path", {
        d: pathData,
        id: `stroke-${index}`,
        class: "sig-path",
        stroke: strokeColor,
        strokeWidth: stroke.width,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        fill: "none",

        // Normalized stroke-dash animation units
        pathLength: 1,
        style: `
          animation-delay: ${delayMs}ms;
          animation-duration: ${durationMs}ms;
        `,
      });
    })
    .filter(Boolean);

  const children = [];

  if (animated) {
    children.push(
      h(
        "style",
        {},
        `
      .sig-path {
        stroke-dasharray: 1;
        stroke-dashoffset: 1;
        animation-name: sig-draw;
        animation-timing-function: linear;
        animation-fill-mode: forwards;
      }

      @keyframes sig-draw {
        to {
          stroke-dashoffset: 0;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .sig-path {
          animation: none;
          stroke-dashoffset: 0;
        }
      }
    `,
      ),
    );
  }

  children.push(...pathElements);

  const svgTree = h(
    "svg",
    {
      width,
      height,
      viewBox: `0 0 ${width} ${height}`,
      xmlns: "http://www.w3.org/2000/svg",
    },
    children,
  );

  return toHtml(svgTree);
}

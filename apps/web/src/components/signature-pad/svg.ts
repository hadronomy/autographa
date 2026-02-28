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
import type { DashoffsetCurve } from "./brushes/types";
import type { BrushId, Point, Stroke } from "./machine";

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

export type VelocityCurvePoint = Readonly<{
  x: number; // time 0..1
  y: number; // progress 0..1
}>;

export type VelocityCurve = Readonly<{
  /**
   * Points should be:
   * - x ascending in [0..1]
   * - y in [0..1]
   * - y monotone non-decreasing
   *
   * Use coerceVelocityCurve() to normalize user input.
   */
  points: ReadonlyArray<VelocityCurvePoint>;
}>;

export type SignatureVelocitySpec =
  | Readonly<{ mode: "off" }>
  | Readonly<{
      mode: "editor";
      curve: VelocityCurve;
      samples?: number;
    }>
  | Readonly<{
      mode: "derived";
      samples?: number;
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

  /**
   * Controls non-linear reveal behavior.
   * - mode:"editor": use an editor-authored curve
   * - mode:"derived": derive reveal curve from stroke timestamps + distance
   */
  velocity?: SignatureVelocitySpec;

  animation?: Partial<SignatureSvgAnimationOptions>;
  stroke?: string;
}>;

export type BuildSignatureSvgParams = Readonly<{
  strokes: ReadonlyArray<Stroke>;
  /**
   * Historical "canvas size".
   * Used when fitToContent=false and as a fallback for empty exports.
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

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

const clamp = (min: number, max: number, v: number) => Math.max(min, Math.min(max, v));
const clamp01 = (v: number) => clamp(0, 1, v);

function clampInt(min: number, max: number, v: number): number {
  return Math.floor(clamp(min, max, v));
}

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
  if (points.length === 0) return emptyBounds();

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

function sanitizeSize(size: SignatureSvgSize): SignatureSvgSize {
  return {
    width: Number.isFinite(size.width) ? Math.max(0, size.width) : 0,
    height: Number.isFinite(size.height) ? Math.max(0, size.height) : 0,
  };
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
      settings: MonolineSettings;
      stroke: Stroke;
    }>
  | Readonly<{
      brushId: "uni-jetstream";
      settings: MonolineSettings;
      stroke: Stroke;
    }>
  | Readonly<{
      brushId: "sharpie-fine";
      settings: MonolineSettings;
      stroke: Stroke;
    }>
  | Readonly<{
      brushId: "tombow-fudenosuke";
      settings: TombowFudenosukeSettings;
      stroke: Stroke;
    }>
  | Readonly<{
      brushId: "sharpie-brush";
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
      return { brushId: "monoline", settings, stroke: pre };
    }

    case "uni-jetstream": {
      const brush = getBrush("uni-jetstream");
      const settings = brush.coerceSettings(stroke.brush.settings);
      const pre = brush.preprocess ? brush.preprocess(stroke, settings) : stroke;
      return { brushId: "uni-jetstream", settings, stroke: pre };
    }

    case "sharpie-fine": {
      const brush = getBrush("sharpie-fine");
      const settings = brush.coerceSettings(stroke.brush.settings);
      const pre = brush.preprocess ? brush.preprocess(stroke, settings) : stroke;
      return { brushId: "sharpie-fine", settings, stroke: pre };
    }

    case "tombow-fudenosuke": {
      const brush = getBrush("tombow-fudenosuke");
      const settings = brush.coerceSettings(stroke.brush.settings);
      const pre = brush.preprocess ? brush.preprocess(stroke, settings) : stroke;
      return { brushId: "tombow-fudenosuke", settings, stroke: pre };
    }

    case "sharpie-brush": {
      const brush = getBrush("sharpie-brush");
      const settings = brush.coerceSettings(stroke.brush.settings);
      const pre = brush.preprocess ? brush.preprocess(stroke, settings) : stroke;
      return { brushId: "sharpie-brush", settings, stroke: pre };
    }
  }

  return assertNever(id);
}

/**
 * Some brushes use SVG filters (blur/glow/displacement) which can paint outside
 * the geometric stroke outline. This returns extra padding to avoid clipping.
 */
function extraVisualPadPx(p: PreparedStroke): number {
  if (p.brushId !== "sharpie-brush") return 0;

  const softness = clamp01(p.settings.edgeSoftness);
  const roughness = Math.max(0, p.settings.roughnessPx);

  const blur = 0.08 + softness * 0.38;
  const dropShadowStd = blur + 0.35;

  // Conservative: ~3 sigma, plus displacement, plus small safety margin.
  return roughness + dropShadowStd * 6 + 2;
}

function strokeBounds(p: PreparedStroke): Bounds {
  const stroke = p.stroke;
  if (stroke.points.length === 0) return emptyBounds();

  const id = p.brushId;

  switch (id) {
    case "monoline":
    case "sharpie-fine":
    case "uni-jetstream": {
      const half = Math.max(0, stroke.width) / 2;
      return expandBounds(boundsFromPoints(stroke.points), half);
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
      // Mirror densification for stable geometry bounds.
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

      return boundsFromPoints(vertices);
    }
  }

  return assertNever(id);
}

function computeFitTransform(args: {
  prepared: ReadonlyArray<PreparedStroke>;
  baseSize: SignatureSvgSize;
  fitToContent: boolean;
  contentPaddingPx: number;
}): { exportSize: SignatureSvgSize; translate: { x: number; y: number } } {
  const baseSize = sanitizeSize(args.baseSize);

  if (!args.fitToContent || args.prepared.length === 0) {
    return { exportSize: baseSize, translate: { x: 0, y: 0 } };
  }

  const padBase = Math.max(0, args.contentPaddingPx);

  let content = emptyBounds();

  for (const p of args.prepared) {
    const geom = strokeBounds(p);
    const pad = padBase + extraVisualPadPx(p);
    content = unionBounds(content, expandBounds(geom, pad));
  }

  if (!isFiniteBounds(content)) {
    return { exportSize: baseSize, translate: { x: 0, y: 0 } };
  }

  const exportSize: SignatureSvgSize = {
    width: Math.ceil(Math.max(1, content.maxX - content.minX)),
    height: Math.ceil(Math.max(1, content.maxY - content.minY)),
  };

  return {
    exportSize,
    translate: { x: -content.minX, y: -content.minY },
  };
}

/**
 * Normalizes arbitrary user-edited curve input into a safe monotone curve.
 * - clamps to [0..1]
 * - sorts by x
 * - ensures endpoints (0,0) and (1,1)
 * - enforces non-decreasing y
 */
export function coerceVelocityCurve(curve: VelocityCurve): VelocityCurve {
  const pts = curve.points
    .map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) }))
    .sort((a, b) => a.x - b.x);

  const withEnds: Array<VelocityCurvePoint> = [];

  if (pts.length === 0 || pts[0].x > 0) withEnds.push({ x: 0, y: 0 });
  for (const p of pts) withEnds.push(p);
  if (withEnds[withEnds.length - 1].x < 1) withEnds.push({ x: 1, y: 1 });

  let lastY = 0;
  const mono = withEnds.map((p) => {
    const y = Math.max(lastY, p.y);
    lastY = y;
    return { x: p.x, y };
  });

  mono[mono.length - 1] = { x: 1, y: 1 };

  return { points: mono };
}

function progressAtTimeFromCurve(curve: VelocityCurve, t: number): number {
  const tt = clamp01(t);
  const pts = curve.points;

  if (pts.length === 0) return tt;
  if (tt <= pts[0].x) return pts[0].y;
  if (tt >= pts[pts.length - 1].x) return pts[pts.length - 1].y;

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (tt <= b.x) {
      const span = Math.max(1e-6, b.x - a.x);
      const u = (tt - a.x) / span;
      return a.y + (b.y - a.y) * u;
    }
  }

  return 1;
}

/**
 * Builds a monotone mapping time->progress from the user's input timestamps,
 * using arc-length progress along the polyline as "progress".
 *
 * Returns u[]=timeNormalized, p[]=progressNormalized.
 */
function deriveProgressByTime(points: ReadonlyArray<Point>): {
  u: number[];
  p: number[];
} | null {
  if (points.length < 2) return null;

  const t0 = points[0].timestamp;
  const t1 = points[points.length - 1].timestamp;
  const timeSpan = t1 - t0;

  const totalDist = estimateStrokeLength(points);
  if (!(timeSpan > 0) || !(totalDist > 1e-6)) return null;

  const u: number[] = [0];
  const p: number[] = [0];

  let dist = 0;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];

    dist += Math.hypot(b.x - a.x, b.y - a.y);

    const ui = clamp01((b.timestamp - t0) / timeSpan);
    const pi = clamp01(dist / totalDist);

    // Skip non-increasing time (duplicate / out-of-order)
    if (ui <= u[u.length - 1]) continue;

    u.push(ui);
    p.push(pi);
  }

  if (u[u.length - 1] < 1) {
    u.push(1);
    p.push(1);
  } else {
    u[u.length - 1] = 1;
    p[p.length - 1] = 1;
  }

  return { u, p };
}

function sampleDashoffsetCurve(args: {
  progressAtTime: (t: number) => number;
  samples: number;
}): DashoffsetCurve {
  const n = clampInt(8, 240, args.samples);

  const keyTimes: number[] = [];
  const values: number[] = [];

  let lastV = Number.POSITIVE_INFINITY;

  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 1 : i / (n - 1);
    const progress = clamp01(args.progressAtTime(t));
    const dashoffset = clamp01(1 - progress);

    // Keep endpoints and drop near-duplicates to control SVG size.
    if (i === 0 || i === n - 1 || Math.abs(dashoffset - lastV) > 1e-4) {
      keyTimes.push(t);
      values.push(dashoffset);
      lastV = dashoffset;
    }
  }

  keyTimes[0] = 0;
  values[0] = 1;
  keyTimes[keyTimes.length - 1] = 1;
  values[values.length - 1] = 0;

  // Ensure strict increase even after de-duplication.
  for (let i = 1; i < keyTimes.length; i++) {
    if (!(keyTimes[i] > keyTimes[i - 1])) {
      keyTimes[i] = Math.min(1, keyTimes[i - 1] + 1e-4);
    }
  }

  return { keyTimes, values };
}

function curveFromEditor(
  spec: Extract<SignatureVelocitySpec, { mode: "editor" }>,
): DashoffsetCurve {
  const curve = coerceVelocityCurve(spec.curve);
  const samples = spec.samples ?? 64;

  return sampleDashoffsetCurve({
    samples,
    progressAtTime: (t) => progressAtTimeFromCurve(curve, t),
  });
}

function curveFromDerived(
  spec: Extract<SignatureVelocitySpec, { mode: "derived" }>,
  stroke: Stroke,
): DashoffsetCurve | null {
  const derived = deriveProgressByTime(stroke.points);
  if (!derived) return null;

  const samples = spec.samples ?? 64;
  const { u, p } = derived;

  return sampleDashoffsetCurve({
    samples,
    progressAtTime: (t) => {
      const tt = clamp01(t);

      for (let i = 1; i < u.length; i++) {
        if (tt <= u[i]) {
          const u0 = u[i - 1];
          const u1 = u[i];
          const span = Math.max(1e-6, u1 - u0);
          const a = (tt - u0) / span;
          return p[i - 1] + (p[i] - p[i - 1]) * a;
        }
      }

      return 1;
    },
  });
}

function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function keyframesNameForStroke(strokeId: string): string {
  // Stable + CSS-safe.
  return `sig-draw-${fnv1a32(strokeId).toString(36)}`;
}

function dashoffsetKeyframesCss(name: string, curve: DashoffsetCurve): string {
  const stops = curve.keyTimes.map((t, i) => {
    const pct = (clamp01(t) * 100).toFixed(4).replace(/\.?0+$/, "");
    const v = clamp01(curve.values[i])
      .toFixed(4)
      .replace(/\.?0+$/, "");
    return `  ${pct}% { stroke-dashoffset: ${v}; }`;
  });

  return `@keyframes ${name} {\n${stops.join("\n")}\n}\n`;
}

function svgStyle(args: { animated: boolean; extraKeyframesCss: string }): string {
  if (!args.animated) return "";

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

    ${args.extraKeyframesCss}

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
 * - fill brushes: dash anim on a reveal-mask centerline (SMIL)
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

  const velocity: SignatureVelocitySpec = options?.velocity ?? { mode: "derived" };

  const prepared = strokes.map(prepareStroke);

  const { exportSize, translate } = computeFitTransform({
    prepared,
    baseSize: size,
    fitToContent,
    contentPaddingPx,
  });

  let cumulativeDelayMs = 0;

  const defs: string[] = [];
  const bodies: string[] = [];
  const extraKeyframes: string[] = [];

  for (const p of prepared) {
    const translatedStroke =
      translate.x === 0 && translate.y === 0
        ? p.stroke
        : translateStroke(p.stroke, translate.x, translate.y);

    const approxLenPx = estimateStrokeLength(translatedStroke.points);

    const durationMs = Math.min(
      animationCfg.maxStrokeMs,
      Math.max(animationCfg.minStrokeMs, (approxLenPx / animationCfg.pxPerSecond) * 1000),
    );

    const delayMs = cumulativeDelayMs;
    cumulativeDelayMs += durationMs + animationCfg.gapBetweenStrokesMs;

    let dashoffsetCurve: DashoffsetCurve | undefined;
    let animationName: string | undefined;

    if (animated && velocity.mode !== "off") {
      if (velocity.mode === "editor") {
        dashoffsetCurve = curveFromEditor(velocity);
      } else if (velocity.mode === "derived") {
        dashoffsetCurve = curveFromDerived(velocity, translatedStroke) ?? undefined;
      } else {
        assertNever(velocity);
      }

      if (dashoffsetCurve) {
        animationName = keyframesNameForStroke(translatedStroke.id);
        extraKeyframes.push(dashoffsetKeyframesCss(animationName, dashoffsetCurve));
      }
    }

    const context = {
      size: exportSize,
      precision,
      inkColor,
      animation: {
        enabled: animated,
        delayMs,
        durationMs,
        name: animationName,
        timingFunction: dashoffsetCurve ? "linear" : undefined,
        dashoffsetCurve,
      },
    } as const;

    const id = p.brushId;

    const out = (() => {
      switch (id) {
        case "monoline": {
          const brush = getBrush("monoline");
          return brush.renderSvg({
            stroke: translatedStroke,
            settings: p.settings,
            context,
          });
        }

        case "uni-jetstream": {
          const brush = getBrush("uni-jetstream");
          return brush.renderSvg({
            stroke: translatedStroke,
            settings: p.settings,
            context,
          });
        }

        case "sharpie-fine": {
          const brush = getBrush("sharpie-fine");
          return brush.renderSvg({
            stroke: translatedStroke,
            settings: p.settings,
            context,
          });
        }

        case "tombow-fudenosuke": {
          const brush = getBrush("tombow-fudenosuke");
          return brush.renderSvg({
            stroke: translatedStroke,
            settings: p.settings,
            context,
          });
        }

        case "sharpie-brush": {
          const brush = getBrush("sharpie-brush");
          return brush.renderSvg({
            stroke: translatedStroke,
            settings: p.settings,
            context,
          });
        }
      }

      return assertNever(id);
    })();

    if (out.defs) defs.push(out.defs);
    bodies.push(out.body);
  }

  const styleTag = svgStyle({
    animated,
    extraKeyframesCss: extraKeyframes.join("\n"),
  }).trim();

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
  name?: string;
  timingFunction?: string;
}): string {
  if (!args.enabled) return "";

  const parts: string[] = [];

  if (args.name) parts.push(`animation-name: ${args.name};`);
  if (args.timingFunction) {
    parts.push(`animation-timing-function: ${args.timingFunction};`);
  }

  parts.push(`animation-delay: ${toFixed(args.delayMs, 0)}ms;`);
  parts.push(`animation-duration: ${toFixed(args.durationMs, 0)}ms;`);

  return parts.join(" ");
}

function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
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

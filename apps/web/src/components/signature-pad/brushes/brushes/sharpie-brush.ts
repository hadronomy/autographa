import type { Stroke } from "../../machine";
import { buildAnimatedPathStyle, escapeSvgAttr } from "../../svg";
import {
  buildCenterlinePathD,
  buildClosedPathDFromVertices,
  buildOutlinePolygon,
  chaikinSmoothClosed,
  densifyQuadraticCenterline,
  type OutlineSettings,
} from "../geometry";
import {
  buildRevealMaskSvg,
  buildSharpieFilterDef,
  buildSharpieTextureMaskDef,
  hashToSeed,
} from "../svg-helpers";
import type { Brush } from "../types";

export type SharpieBrushSettings = Readonly<
  OutlineSettings & {
    opacity: number;

    /**
     * 0..1. Higher = softer wet edge.
     */
    edgeSoftness: number;

    /**
     * SVG edge wobble (px). Keep small.
     */
    roughnessPx: number;

    /**
     * 0..1. Higher = more internal streak texture (SVG only).
     */
    textureStrength: number;

    /**
     * 0..3. Chaikin iterations for the outline ring.
     */
    outlineSmoothing: number;

    /**
     * Centerline densify spacing in px (0 => auto).
     * Lower => smoother curves, more points.
     */
    densifySpacingPx: number;
  }
>;

function coerce(raw: Record<string, unknown>): SharpieBrushSettings {
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;

  const edgeSoftness = Math.max(0, Math.min(1, num(raw.edgeSoftness, 0.75)));
  const roughnessPx = Math.max(0, num(raw.roughnessPx, 0.9));
  const textureStrength = Math.max(0, Math.min(1, num(raw.textureStrength, 0.45)));

  return {
    /**
     * Thickness tuning (less chunky than your reverted version):
     * - lower bleed (was 0.22/0.24)
     * - slightly lower minWidthFactor (thinner light pressure)
     * - slightly higher exponent (more contrast without overall fatness)
     */
    minWidthFactor: num(raw.minWidthFactor, 0.18),
    pressureExponent: num(raw.pressureExponent, 1.25),
    taperStart: num(raw.taperStart, 0.18),
    taperEnd: num(raw.taperEnd, 0.22),
    bleed: num(raw.bleed, 0.14),

    // high cap steps reduces faceting on tight turns/loops
    capSteps: num(raw.capSteps, 30),

    opacity: num(raw.opacity, 0.98),
    edgeSoftness,
    roughnessPx,
    textureStrength,

    outlineSmoothing: Math.max(0, Math.min(3, Math.floor(num(raw.outlineSmoothing, 2)))),

    densifySpacingPx: Math.max(0, num(raw.densifySpacingPx, 0)),
  };
}

function resolveInkColor(args: { stroke: Stroke; contextInk: string }): string {
  // Avoid currentColor in filter primitives (drop-shadow flood-color etc).
  if (args.contextInk === "currentColor") return args.stroke.color || "#111111";
  return args.contextInk;
}

function buildSmoothOutline(args: {
  stroke: Stroke;
  settings: SharpieBrushSettings;
  precision: number;
}): {
  d: string;
  maxRadius: number;
  densifiedPoints: Stroke["points"];
} {
  const { stroke, settings, precision } = args;

  // Auto spacing scales with brush size; smaller => smoother curves.
  const autoSpacing = Math.max(0.35, stroke.width * 0.075);
  const spacing = settings.densifySpacingPx > 0 ? settings.densifySpacingPx : autoSpacing;

  const densified = densifyQuadraticCenterline(stroke.points, spacing);

  const poly = buildOutlinePolygon(densified, { ...settings, base: stroke.width });

  const vertices: Array<{ x: number; y: number }> = [];
  vertices.push(...poly.startCap);
  vertices.push(...poly.left.slice(1, -1));
  vertices.push(...poly.endCap);
  vertices.push(...poly.right.slice(1, -1).reverse());

  const smoothed =
    settings.outlineSmoothing > 0
      ? chaikinSmoothClosed(vertices, settings.outlineSmoothing)
      : vertices;

  const d = buildClosedPathDFromVertices(smoothed, precision);

  return { d, maxRadius: poly.maxRadius, densifiedPoints: densified };
}

export const sharpieBrushBrush: Brush<SharpieBrushSettings> = {
  id: "sharpie-brush",
  label: "Sharpie Brush",
  version: 1,
  defaults: coerce({}),
  coerceSettings: coerce,

  preprocess(stroke: Stroke) {
    return stroke;
  },

  renderCanvas({ ctx, stroke, settings }) {
    if (stroke.points.length === 0) return;

    const outline = buildSmoothOutline({ stroke, settings, precision: 2 });
    const path = new Path2D(outline.d);

    ctx.save();

    // Main ink body
    ctx.globalAlpha = settings.opacity;
    ctx.fillStyle = stroke.color;
    ctx.fill(path);

    // Wet bloom (reduced so it doesn't get chunky)
    const bloomAlpha = 0.12 + settings.edgeSoftness * 0.1; // ~0.12..0.22
    const bloomBlur = 0.18 + settings.edgeSoftness * 0.75; // ~0.18..0.93

    ctx.globalAlpha = settings.opacity * bloomAlpha;
    ctx.filter = `blur(${bloomBlur.toFixed(2)}px)`;
    ctx.fill(path);

    // Subtle richness for overlaps
    ctx.filter = "none";
    ctx.globalAlpha = settings.opacity * 0.06;
    ctx.fill(path);

    // Optional crisp edge (very light)
    ctx.globalAlpha = settings.opacity * 0.08;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = Math.max(0.5, stroke.width * 0.06);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke(path);

    ctx.restore();
  },

  renderSvg({ stroke, settings, context }) {
    if (stroke.points.length === 0) return { body: "" };

    const ink = resolveInkColor({ stroke, contextInk: context.inkColor });

    const outline = buildSmoothOutline({
      stroke,
      settings,
      precision: context.precision,
    });

    // Reveal mask driven by densified centerline
    const centerD = buildCenterlinePathD(outline.densifiedPoints, context.precision);
    const revealMaskId = `mask-reveal-${stroke.id}`;

    const softness = settings.edgeSoftness;
    const revealWidth = Math.max(2, outline.maxRadius * (3.0 + softness * 0.8));

    const reveal = buildRevealMaskSvg({
      maskId: revealMaskId,
      size: context.size,
      centerlineD: centerD,
      revealWidth,
      animation: context.animation,
    });

    // Deterministic Sharpie filter (wobble + blur + glow)
    const seed = hashToSeed(stroke.id);
    const filterId = `sharpie-filter-${stroke.id}`;

    // Softer mapping (less fat)
    const blur = 0.08 + softness * 0.38; // 0.08..0.46
    const glow = 0.1 + softness * 0.12; // 0.10..0.22

    const filterDef = buildSharpieFilterDef({
      filterId,
      seed,
      inkColor: "currentColor",
      roughness: Math.max(0, settings.roughnessPx),
      blur,
      glow,
    });

    // Inner texture mask (optional but enabled by default)
    const texMaskId = `mask-tex-${stroke.id}`;
    const texFilterId = `tex-filter-${stroke.id}`;

    const textureDef = buildSharpieTextureMaskDef({
      maskId: texMaskId,
      filterId: texFilterId,
      seed: seed + 17,
      size: context.size,
      strength: settings.textureStrength,
    });

    const defs = `${reveal.defs}${filterDef}${textureDef}`;

    const style = buildAnimatedPathStyle(context.animation);

    const body =
      `<g${reveal.maskAttr}>` +
      `<g mask="url(#${escapeSvgAttr(texMaskId)})">` +
      `<path d="${escapeSvgAttr(outline.d)}"` +
      ` fill="${escapeSvgAttr("currentColor")}"` +
      ` filter="url(#${escapeSvgAttr(filterId)})"` +
      ` style="${escapeSvgAttr(style)}"` +
      ` />` +
      `</g>` +
      `</g>`;

    return { defs, body };
  },
};

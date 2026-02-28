import type { Stroke } from "../../machine";
import { buildAnimatedPathStyle, escapeSvgAttr } from "../../svg";
import {
  buildCenterlinePathD,
  buildOutlinePath2D,
  buildOutlinePathD,
  type OutlineSettings,
} from "../geometry";
import { buildRevealMaskSvg } from "../svg-helpers";
import type { Brush } from "../types";

export type TombowFudenosukeSettings = Readonly<
  OutlineSettings & {
    opacity: number;
  }
>;

function coerce(raw: Record<string, unknown>): TombowFudenosukeSettings {
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;

  return {
    // Sharper hairlines + more contrast:
    minWidthFactor: num(raw.minWidthFactor, 0.035),
    pressureExponent: num(raw.pressureExponent, 2.25),
    taperStart: num(raw.taperStart, 0.45),
    taperEnd: num(raw.taperEnd, 0.7),
    bleed: num(raw.bleed, 0.02),
    capSteps: num(raw.capSteps, 16),
    opacity: num(raw.opacity, 1),
  };
}

export const tombowFudenosukeBrush: Brush<TombowFudenosukeSettings> = {
  id: "tombow-fudenosuke",
  label: "Tombow Fudenosuke",
  version: 1,
  defaults: coerce({}),
  coerceSettings: coerce,

  preprocess(stroke: Stroke) {
    return stroke;
  },

  renderCanvas({ ctx, stroke, settings }) {
    const pts = stroke.points;
    if (pts.length === 0) return;

    const { path } = buildOutlinePath2D(pts, { ...settings, base: stroke.width });

    ctx.save();
    ctx.globalAlpha = settings.opacity;
    ctx.fillStyle = stroke.color;
    ctx.fill(path);
    ctx.restore();
  },

  renderSvg({ stroke, settings, context }) {
    const pts = stroke.points;
    if (pts.length === 0) return { body: "" };

    const outline = buildOutlinePathD(pts, { ...settings, base: stroke.width }, context.precision);

    const fillStyle = buildAnimatedPathStyle(context.animation);

    const centerD = buildCenterlinePathD(pts, context.precision);
    const maskId = `mask-${stroke.id}`;
    const revealWidth = Math.max(2, outline.maxRadius * 3.2);

    const reveal = buildRevealMaskSvg({
      maskId,
      size: context.size,
      centerlineD: centerD,
      revealWidth,
      animation: context.animation,
    });

    const body =
      `<path d="${escapeSvgAttr(outline.d)}"` +
      ` fill="${escapeSvgAttr(context.inkColor)}"` +
      ` style="${escapeSvgAttr(fillStyle)}"` +
      `${reveal.maskAttr}` +
      ` />`;

    return { defs: reveal.defs, body };
  },
};

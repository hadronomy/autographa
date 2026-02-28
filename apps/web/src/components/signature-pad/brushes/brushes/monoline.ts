import { buildAnimatedPathStyle, escapeSvgAttr, svgStrokeAttrs } from "../../svg";
import { buildCenterlinePathD } from "../geometry";
import type { Brush } from "../types";

export type MonolineSettings = Readonly<{
  pressureWidth: boolean;
  minPressureWidthFactor: number;
  opacity: number;
}>;

function coerce(raw: Record<string, unknown>): MonolineSettings {
  return {
    pressureWidth: raw.pressureWidth !== false,
    minPressureWidthFactor:
      typeof raw.minPressureWidthFactor === "number" ? raw.minPressureWidthFactor : 0.5,
    opacity: typeof raw.opacity === "number" ? raw.opacity : 1,
  };
}

export const monolineBrush: Brush<MonolineSettings> = {
  id: "monoline",
  label: "Monoline",
  version: 1,
  defaults: {
    pressureWidth: true,
    minPressureWidthFactor: 0.5,
    opacity: 1,
  },
  coerceSettings: coerce,

  renderCanvas({ ctx, stroke, settings }) {
    const pts = stroke.points;
    if (pts.length === 0) return;

    ctx.save();
    ctx.globalAlpha = settings.opacity;
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (pts.length === 1) {
      const p = pts[0];
      const pressure = p.pressure;
      const w = settings.pressureWidth
        ? stroke.width *
          (settings.minPressureWidthFactor + pressure * (1 - settings.minPressureWidthFactor))
        : stroke.width;

      ctx.beginPath();
      ctx.arc(p.x, p.y, w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    for (let i = 1; i < pts.length - 1; i++) {
      const curr = pts[i];
      const next = pts[i + 1];

      const midX = (curr.x + next.x) / 2;
      const midY = (curr.y + next.y) / 2;

      const pressure = curr.pressure;
      const w = settings.pressureWidth
        ? stroke.width *
          (settings.minPressureWidthFactor + pressure * (1 - settings.minPressureWidthFactor))
        : stroke.width;

      ctx.lineWidth = w;

      ctx.beginPath();
      if (i === 1) {
        ctx.moveTo(pts[0].x, pts[0].y);
      } else {
        const prev = pts[i - 1];
        const prevMidX = (prev.x + curr.x) / 2;
        const prevMidY = (prev.y + curr.y) / 2;
        ctx.moveTo(prevMidX, prevMidY);
      }
      ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
      ctx.stroke();
    }

    const last = pts[pts.length - 1];
    const lastPressure = last.pressure;
    const lastW = settings.pressureWidth
      ? stroke.width *
        (settings.minPressureWidthFactor + lastPressure * (1 - settings.minPressureWidthFactor))
      : stroke.width;

    ctx.lineWidth = lastW;
    ctx.beginPath();
    ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
    ctx.lineTo(last.x, last.y);
    ctx.stroke();

    ctx.restore();
  },

  renderSvg({ stroke, context }) {
    const pts = stroke.points;
    if (pts.length === 0) return { body: "" };

    const style = buildAnimatedPathStyle(context.animation);

    // Single-point stroke: export as a tiny segment so dash animation works.
    if (pts.length === 1) {
      const p = pts[0];
      const eps = 0.01;

      const d = `M ${p.x} ${p.y} L ${p.x + eps} ${p.y}`;

      const body =
        `<path d="${escapeSvgAttr(d)}"` +
        ` class="${context.animation.enabled ? "sig-anim-path" : ""}"` +
        ` pathLength="1"` +
        ` style="${escapeSvgAttr(style)}"` +
        svgStrokeAttrs({
          stroke: context.inkColor,
          strokeWidth: stroke.width,
        }) +
        ` />`;

      return { body };
    }

    const d = buildCenterlinePathD(pts, context.precision);

    const body =
      `<path d="${escapeSvgAttr(d)}"` +
      ` class="${context.animation.enabled ? "sig-anim-path" : ""}"` +
      ` pathLength="1"` +
      ` style="${escapeSvgAttr(style)}"` +
      svgStrokeAttrs({
        stroke: context.inkColor,
        strokeWidth: stroke.width,
      }) +
      ` />`;

    return { body };
  },
};

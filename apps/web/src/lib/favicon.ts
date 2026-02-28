import { getBrush } from "../components/signature-pad/brushes/registry";
import type { BrushId, Point, Stroke } from "../components/signature-pad/machine";

export type RenderFaviconOptions = Readonly<{
  brushId: BrushId;
  size: number;
  background: string;
  ink: string;
}>;

function pointsForSize(size: number): Point[] {
  // Designed to read well at 16–48px when downscaled from 64px.
  // “timestamp” just needs to be increasing.
  const s = size / 64;

  return [
    { x: 6 * s, y: 40 * s, pressure: 0.2, timestamp: 0 },
    { x: 12 * s, y: 26 * s, pressure: 0.35, timestamp: 1 },
    { x: 20 * s, y: 34 * s, pressure: 0.8, timestamp: 2 },
    { x: 30 * s, y: 24 * s, pressure: 0.95, timestamp: 3 },
    { x: 40 * s, y: 34 * s, pressure: 0.75, timestamp: 4 },
    { x: 50 * s, y: 28 * s, pressure: 0.55, timestamp: 5 },
    { x: 58 * s, y: 34 * s, pressure: 0.35, timestamp: 6 },
  ];
}

function widthForBrush(brushId: BrushId): number {
  // Slightly thicker than your swatches because favicons get downscaled.
  switch (brushId) {
    case "uni-jetstream":
      return 3.2;
    case "sharpie-fine":
      return 4.6;
    case "sharpie-brush":
      return 8.5;
    case "tombow-fudenosuke":
      return 7.2;
    case "monoline":
    default:
      return 3.6;
  }
}

export function renderFaviconSvg({ brushId, size, background, ink }: RenderFaviconOptions): string {
  const brush = getBrush(brushId);

  const stroke: Stroke = {
    id: `favicon-${brushId}`,
    points: pointsForSize(size),
    color: ink,
    width: widthForBrush(brushId),
    brush: { id: brushId, version: 1, settings: {} },
  };

  const settings = brush.coerceSettings({});
  const { defs, body } = brush.renderSvg({
    stroke,
    settings,
    context: {
      size: { width: size, height: size },
      precision: 1,
      inkColor: ink,
      animation: { enabled: false, delayMs: 0, durationMs: 0 },
    },
  });

  // defs/body are raw SVG strings, same as in BrushSwatch.
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}" fill="${background}" />`,
    defs ? `<defs>${defs}</defs>` : "",
    `<g>${body}</g>`,
    `</svg>`,
  ]
    .filter(Boolean)
    .join("");
}

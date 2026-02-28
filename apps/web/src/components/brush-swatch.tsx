import * as React from "react";

import { getBrush } from "@/components/signature-pad/brushes/registry";
import type { BrushId, Point, Stroke } from "@/components/signature-pad/machine";

function samplePoints(): Point[] {
  return [
    { x: 4, y: 14, pressure: 0.15, timestamp: 0 },
    { x: 10, y: 6, pressure: 0.25, timestamp: 1 },
    { x: 18, y: 12, pressure: 0.6, timestamp: 2 },
    { x: 26, y: 8, pressure: 0.95, timestamp: 3 },
    { x: 34, y: 14, pressure: 0.55, timestamp: 4 },
  ];
}

function sampleWidth(brushId: BrushId): number {
  switch (brushId) {
    case "uni-jetstream":
      return 2.2;
    case "sharpie-fine":
      return 3.4;
    case "sharpie-brush":
      return 6.5;
    case "tombow-fudenosuke":
      return 5.5;
    case "monoline":
    default:
      return 2.5;
  }
}

export function BrushSwatch({
  brushId,
  className,
}: Readonly<{ brushId: BrushId; className?: string }>) {
  const brush = getBrush(brushId);

  const stroke: Stroke = React.useMemo(
    () => ({
      id: `swatch-${brushId}`,
      points: samplePoints(),
      color: "currentColor",
      width: sampleWidth(brushId),
      brush: { id: brushId, version: 1, settings: {} },
    }),
    [brushId],
  );

  const { defs, body } = React.useMemo(() => {
    const settings = brush.coerceSettings({});
    return brush.renderSvg({
      stroke,
      settings,
      context: {
        size: { width: 38, height: 18 },
        precision: 1,
        inkColor: "currentColor",
        animation: { enabled: false, delayMs: 0, durationMs: 0 },
      },
    });
  }, [brush, stroke]);

  return (
    <svg
      viewBox="0 0 38 18"
      width="38"
      height="18"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {defs ? <defs dangerouslySetInnerHTML={{ __html: defs }} /> : null}
      <g dangerouslySetInnerHTML={{ __html: body }} />
    </svg>
  );
}

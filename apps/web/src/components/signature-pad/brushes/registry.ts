import { monolineBrush } from "./brushes/monoline";
import { sharpieBrushBrush } from "./brushes/sharpie-brush";
import { sharpieFineBrush } from "./brushes/sharpie-fine";
import { tombowFudenosukeBrush } from "./brushes/tombow-fudenosuke";
import { uniJetstreamBrush } from "./brushes/uni-jetstream";
import type { Brush } from "./types";

export const brushRegistry: Record<string, Brush<any>> = {
  monoline: monolineBrush,
  "uni-jetstream": uniJetstreamBrush,
  "sharpie-fine": sharpieFineBrush,
  "sharpie-brush": sharpieBrushBrush,
  "tombow-fudenosuke": tombowFudenosukeBrush,
};

export function getBrush(id: string): Brush<any> {
  return brushRegistry[id] ?? monolineBrush;
}

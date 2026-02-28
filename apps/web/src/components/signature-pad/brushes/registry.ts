import type { BrushId } from "../machine";

import { monolineBrush, type MonolineSettings } from "./brushes/monoline";
import { sharpieBrushBrush, type SharpieBrushSettings } from "./brushes/sharpie-brush";
import { sharpieFineBrush, type SharpieFineSettings } from "./brushes/sharpie-fine";
import { tombowFudenosukeBrush, type TombowFudenosukeSettings } from "./brushes/tombow-fudenosuke";
import { uniJetstreamBrush, type UniJetstreamSettings } from "./brushes/uni-jetstream";
import type { Brush } from "./types";

export type BrushSettingsById = Readonly<{
  monoline: MonolineSettings;
  "uni-jetstream": UniJetstreamSettings;
  "sharpie-fine": SharpieFineSettings;
  "sharpie-brush": SharpieBrushSettings;
  "tombow-fudenosuke": TombowFudenosukeSettings;
}>;

export type BrushById = {
  [K in BrushId]: Brush<BrushSettingsById[K]>;
};

export const brushRegistry: BrushById = {
  monoline: monolineBrush,
  "uni-jetstream": uniJetstreamBrush,
  "sharpie-fine": sharpieFineBrush,
  "sharpie-brush": sharpieBrushBrush,
  "tombow-fudenosuke": tombowFudenosukeBrush,
};

/**
 * Typed brush getter for known BrushId values.
 */
export function getBrush<T extends BrushId>(id: T): Brush<BrushSettingsById[T]>;

/**
 * Backward-compatible brush getter for unknown strings.
 * Falls back to monoline.
 */
export function getBrush(id: string): Brush<Record<string, unknown>>;

export function getBrush(id: string) {
  return (brushRegistry as unknown as Record<string, Brush<any>>)[id] ?? monolineBrush;
}

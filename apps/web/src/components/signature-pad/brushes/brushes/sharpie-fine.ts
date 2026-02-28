import type { Brush } from "../types";
import { monolineBrush, type MonolineSettings } from "./monoline";

export type SharpieFineSettings = MonolineSettings;

/**
 * Sharpie Fine: fairly constant width, opaque.
 * (Marker "bleed" is subtle; we keep it centerline for speed and clean SVG.)
 */
export const sharpieFineBrush: Brush<SharpieFineSettings> = {
  ...monolineBrush,
  id: "sharpie-fine",
  label: "Sharpie Fine",
  defaults: {
    pressureWidth: false,
    minPressureWidthFactor: 1,
    opacity: 1,
  },
  coerceSettings(raw) {
    const base = monolineBrush.coerceSettings(raw);
    return {
      ...base,
      pressureWidth: raw.pressureWidth === true ? true : false,
      minPressureWidthFactor: 1,
      opacity: typeof raw.opacity === "number" ? raw.opacity : 1,
    };
  },
};

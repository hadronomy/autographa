import type { Brush } from "../types";
import { monolineBrush, type MonolineSettings } from "./monoline";

export type UniJetstreamSettings = MonolineSettings;

/**
 * Uni Jetstream: crisp ballpoint feel.
 * - subtle pressure response
 * - full opacity
 */
export const uniJetstreamBrush: Brush<UniJetstreamSettings> = {
  ...monolineBrush,
  id: "uni-jetstream",
  label: "Uni Jetstream",
  defaults: {
    pressureWidth: true,
    minPressureWidthFactor: 0.78,
    opacity: 1,
  },
  coerceSettings(raw) {
    const base = monolineBrush.coerceSettings(raw);
    return {
      ...base,
      pressureWidth: raw.pressureWidth !== false,
      minPressureWidthFactor:
        typeof raw.minPressureWidthFactor === "number" ? raw.minPressureWidthFactor : 0.78,
      opacity: typeof raw.opacity === "number" ? raw.opacity : 1,
    };
  },
};

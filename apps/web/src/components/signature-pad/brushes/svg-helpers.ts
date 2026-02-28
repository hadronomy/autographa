import { escapeSvgAttr, svgStrokeAttrs } from "../svg";

export function hashToSeed(str: string, mod = 10000): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;

  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }

  return (h >>> 0) % mod;
}

function buildSmilReveal(args: { enabled: boolean; delayMs: number; durationMs: number }): string {
  if (!args.enabled) return "";

  const delayMs = Math.max(0, args.delayMs);
  const durationMs = Math.max(1, args.durationMs);

  /**
   * Fallback strategy:
   * - Base attribute on the path is dashoffset="0" (fully visible)
   * - If SMIL is supported, we immediately set dashoffset to 1 at t=0 (hidden),
   *   then animate to 0 beginning at delayMs.
   * - If SMIL is not supported, both <set> and <animate> are ignored and the
   *   mask stays visible (static, but never invisible).
   */
  return (
    `<set attributeName="stroke-dashoffset" to="1" begin="0ms" dur="0ms" fill="freeze" />` +
    `<animate attributeName="stroke-dashoffset" from="1" to="0" ` +
    `begin="${escapeSvgAttr(String(delayMs))}ms" ` +
    `dur="${escapeSvgAttr(String(durationMs))}ms" ` +
    `fill="freeze" />`
  );
}

export function buildRevealMaskSvg(args: {
  maskId: string;
  size: { width: number; height: number };
  centerlineD: string;
  revealWidth: number;
  animation: { enabled: boolean; delayMs: number; durationMs: number };
}): { defs: string; maskAttr: string } {
  const { maskId, size, centerlineD, revealWidth, animation } = args;

  if (!animation.enabled) {
    return { defs: "", maskAttr: "" };
  }

  const smil = buildSmilReveal(animation);

  // NOTE: no CSS class used here (do NOT use .sig-anim-path inside masks)
  const defs =
    `<mask id="${escapeSvgAttr(maskId)}" maskUnits="userSpaceOnUse" ` +
    `x="0" y="0" width="${escapeSvgAttr(String(size.width))}" ` +
    `height="${escapeSvgAttr(String(size.height))}">` +
    `<rect x="0" y="0" width="${escapeSvgAttr(String(size.width))}" ` +
    `height="${escapeSvgAttr(String(size.height))}" fill="black" />` +
    `<path d="${escapeSvgAttr(centerlineD)}"` +
    ` pathLength="1"` +
    ` stroke-dasharray="1"` +
    ` stroke-dashoffset="0"` +
    svgStrokeAttrs({
      stroke: "white",
      strokeWidth: revealWidth,
      linecap: "round",
      linejoin: "round",
    }) +
    `>` +
    smil +
    `</path>` +
    `</mask>`;

  return {
    defs,
    maskAttr: ` mask="url(#${escapeSvgAttr(maskId)})"`,
  };
}

export function buildSharpieFilterDef(args: {
  filterId: string;
  seed: number;
  inkColor: string;
  roughness: number;
  blur: number;
  glow: number;
}): string {
  const { filterId, seed, inkColor, roughness, blur, glow } = args;

  return (
    `<filter id="${escapeSvgAttr(filterId)}" x="-12%" y="-12%" width="124%" height="124%" ` +
    `color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" ` +
    `seed="${escapeSvgAttr(String(seed))}" result="noise" />` +
    `<feDisplacementMap in="SourceGraphic" in2="noise" scale="${escapeSvgAttr(
      String(roughness),
    )}" xChannelSelector="R" yChannelSelector="G" result="displaced" />` +
    `<feGaussianBlur in="displaced" stdDeviation="${escapeSvgAttr(
      String(blur),
    )}" result="soft" />` +
    `<feDropShadow dx="0" dy="0" stdDeviation="${escapeSvgAttr(
      String(blur + 0.35),
    )}" flood-color="${escapeSvgAttr(inkColor)}" flood-opacity="${escapeSvgAttr(
      String(glow),
    )}" result="glow" />` +
    `<feMerge>` +
    `<feMergeNode in="glow" />` +
    `<feMergeNode in="soft" />` +
    `<feMergeNode in="SourceGraphic" />` +
    `</feMerge>` +
    `</filter>`
  );
}

export function buildSharpieTextureMaskDef(args: {
  maskId: string;
  filterId: string;
  seed: number;
  size: { width: number; height: number };
  strength: number;
}): string {
  const { maskId, filterId, seed, size, strength } = args;

  const s = Math.max(0, Math.min(1, strength));
  const base = (1 - s * 0.28).toFixed(3);

  /**
   * Key idea:
   * - Derive an alpha field from turbulence (noise -> alpha).
   * - Then apply that alpha to a white flood (so the mask uses luminance=white).
   *
   * If we output black with alpha, luminance-masks treat it as 0 => invisible.
   */
  return (
    `<filter id="${escapeSvgAttr(filterId)}" x="0" y="0" width="100%" height="100%" ` +
    `color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.018 0.65" numOctaves="2" ` +
    `seed="${escapeSvgAttr(String(seed))}" result="n" />` +
    // Put grayscale noise into alpha channel
    `<feColorMatrix in="n" type="matrix" values="` +
    `0 0 0 0 0 ` +
    `0 0 0 0 0 ` +
    `0 0 0 0 0 ` +
    `0.333 0.333 0.333 0 0" result="a" />` +
    // Shape the alpha so texture is subtle
    `<feComponentTransfer in="a" result="aa">` +
    `<feFuncA type="table" tableValues="${escapeSvgAttr(base)} 1" />` +
    `</feComponentTransfer>` +
    // White flood, then apply alpha via "in"
    `<feFlood flood-color="white" flood-opacity="1" result="w" />` +
    `<feComposite in="w" in2="aa" operator="in" result="out" />` +
    `</filter>` +
    `<mask id="${escapeSvgAttr(maskId)}" maskUnits="userSpaceOnUse" ` +
    `x="0" y="0" width="${escapeSvgAttr(String(size.width))}" ` +
    `height="${escapeSvgAttr(String(size.height))}">` +
    `<rect x="0" y="0" width="${escapeSvgAttr(String(size.width))}" ` +
    `height="${escapeSvgAttr(String(size.height))}" fill="white" ` +
    `filter="url(#${escapeSvgAttr(filterId)})" />` +
    `</mask>`
  );
}

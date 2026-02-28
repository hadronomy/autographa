import type { Point } from "../machine";

const clamp = (min: number, max: number, v: number) => Math.max(min, Math.min(max, v));

export function toFixed(n: number, precision: number): string {
  const p = Number.isFinite(precision) ? Math.max(0, Math.min(6, precision)) : 1;
  return n.toFixed(p);
}

export function estimateStrokeLength(points: ReadonlyArray<{ x: number; y: number }>): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    len += Math.hypot(dx, dy);
  }
  return len;
}

/**
 * Quadratic-smoothed centerline path (matches your prior export behavior).
 */
export function buildCenterlinePathD(points: ReadonlyArray<Point>, precision: number): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const p = points[0];
    return `M ${toFixed(p.x, precision)} ${toFixed(p.y, precision)}`;
  }

  let d = `M ${toFixed(points[0].x, precision)} ${toFixed(points[0].y, precision)}`;

  for (let i = 1; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;

    d += ` Q ${toFixed(curr.x, precision)} ${toFixed(curr.y, precision)}, ${toFixed(
      midX,
      precision,
    )} ${toFixed(midY, precision)}`;
  }

  const last = points[points.length - 1];
  d += ` L ${toFixed(last.x, precision)} ${toFixed(last.y, precision)}`;

  return d;
}

type Vec = { x: number; y: number };

function norm(v: Vec): Vec {
  const m = Math.hypot(v.x, v.y);
  if (m < 1e-6) return { x: 0, y: 0 };
  return { x: v.x / m, y: v.y / m };
}

function perp(v: Vec): Vec {
  return { x: -v.y, y: v.x };
}

function direction(points: ReadonlyArray<Point>, i: number): Vec {
  const prev = points[Math.max(0, i - 1)];
  const next = points[Math.min(points.length - 1, i + 1)];
  return norm({ x: next.x - prev.x, y: next.y - prev.y });
}

function arcPoints(args: {
  center: Vec;
  radius: number;
  fromAngle: number;
  toAngle: number;
  steps: number;
}): Vec[] {
  const { center, radius, fromAngle, toAngle, steps } = args;
  const out: Vec[] = [];
  if (steps <= 0) return out;

  const span = toAngle - fromAngle;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = fromAngle + span * t;
    out.push({
      x: center.x + Math.cos(a) * radius,
      y: center.y + Math.sin(a) * radius,
    });
  }

  return out;
}

export type OutlineSettings = Readonly<{
  minWidthFactor: number;
  pressureExponent: number;
  taperStart: number;
  taperEnd: number;
  bleed: number;
  capSteps: number;
}>;

function radiusAtIndex(
  points: ReadonlyArray<Point>,
  i: number,
  args: OutlineSettings & { base: number },
): number {
  const base = Math.max(0, args.base);
  const n = points.length;

  const t = n <= 1 ? 0 : i / (n - 1);
  const taperMul = (1 - args.taperStart * (1 - t)) * (1 - args.taperEnd * t);

  const pressure = clamp(0, 1, points[i].pressure);
  const curve = Math.pow(pressure, Math.max(0.01, args.pressureExponent));

  const widthFactor = args.minWidthFactor + (1 - args.minWidthFactor) * curve;
  const width = base * widthFactor * (1 + args.bleed);

  return Math.max(0.25, width / 2) * taperMul;
}

export function buildOutlinePolygon(
  points: ReadonlyArray<Point>,
  args: OutlineSettings & { base: number },
): {
  left: Vec[];
  right: Vec[];
  startCap: Vec[];
  endCap: Vec[];
  maxRadius: number;
  startRadius: number;
  endRadius: number;
} {
  const n = points.length;
  const left: Vec[] = [];
  const right: Vec[] = [];

  let maxRadius = 0;

  const radii: number[] = Array.from({ length: n });

  for (let i = 0; i < n; i++) {
    const dir = direction(points, i);
    const normal = perp(dir);

    const r = radiusAtIndex(points, i, args);
    radii[i] = r;
    maxRadius = Math.max(maxRadius, r);

    const p = points[i];

    left.push({ x: p.x + normal.x * r, y: p.y + normal.y * r });
    right.push({ x: p.x - normal.x * r, y: p.y - normal.y * r });
  }

  const startRadius = radii[0] ?? 0;
  const endRadius = radii[n - 1] ?? 0;

  const p0 = points[0];
  const pN = points[n - 1];

  const d0 = direction(points, 0);
  const dN = direction(points, n - 1);

  const n0 = perp(d0);
  const a0 = Math.atan2(-n0.y, -n0.x);
  const a1 = Math.atan2(n0.y, n0.x);

  const startCap = arcPoints({
    center: { x: p0.x, y: p0.y },
    radius: startRadius,
    fromAngle: a0,
    toAngle: a1,
    steps: Math.max(6, args.capSteps),
  });

  const nN = perp(dN);
  const b0 = Math.atan2(nN.y, nN.x);
  const b1 = Math.atan2(-nN.y, -nN.x);

  const endCap = arcPoints({
    center: { x: pN.x, y: pN.y },
    radius: endRadius,
    fromAngle: b0,
    toAngle: b1,
    steps: Math.max(6, args.capSteps),
  });

  return { left, right, startCap, endCap, maxRadius, startRadius, endRadius };
}

export function buildClosedPathDFromVertices(
  vertices: ReadonlyArray<{ x: number; y: number }>,
  precision: number,
): string {
  if (vertices.length === 0) return "";
  let d = `M ${toFixed(vertices[0].x, precision)} ${toFixed(vertices[0].y, precision)}`;
  for (let i = 1; i < vertices.length; i++) {
    d += ` L ${toFixed(vertices[i].x, precision)} ${toFixed(vertices[i].y, precision)}`;
  }
  d += " Z";
  return d;
}

/**
 * Chaikin smoothing for closed polygons.
 */
export function chaikinSmoothClosed(
  vertices: ReadonlyArray<{ x: number; y: number }>,
  iterations: number,
): Array<{ x: number; y: number }> {
  let pts = vertices.slice();
  const iters = Math.max(0, Math.floor(iterations));

  for (let k = 0; k < iters; k++) {
    if (pts.length < 3) return pts;

    const next: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % pts.length];

      const q = { x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y };
      const r = { x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y };

      next.push(q, r);
    }
    pts = next;
  }

  return pts;
}

/**
 * Robust deterministic arc-length resample (linear interpolation).
 */
export function resamplePoints(points: ReadonlyArray<Point>, spacingPx: number): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [points[0]];

  const spacing = Math.max(0.25, spacingPx);

  const dists: number[] = Array.from({ length: points.length });
  dists[0] = 0;

  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    dists[i] = dists[i - 1] + Math.hypot(dx, dy);
  }

  const total = dists[dists.length - 1];
  if (total < 1e-6) return [points[0]];

  const out: Point[] = [];
  out.push(points[0]);

  let target = spacing;

  let seg = 1;

  while (target < total && seg < points.length) {
    while (seg < points.length && dists[seg] < target) seg += 1;
    if (seg >= points.length) break;

    const prev = seg - 1;
    const d0 = dists[prev];
    const d1 = dists[seg];
    const span = Math.max(1e-6, d1 - d0);
    const t = (target - d0) / span;

    const a = points[prev];
    const b = points[seg];

    out.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      pressure: a.pressure + (b.pressure - a.pressure) * t,
      timestamp: a.timestamp + (b.timestamp - a.timestamp) * t,
    });

    target += spacing;
  }

  out.push(points[points.length - 1]);
  return out;
}

function midPoint(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    pressure: (a.pressure + b.pressure) / 2,
    timestamp: (a.timestamp + b.timestamp) / 2,
  };
}

function quadAt(a: Point, c: Point, b: Point, t: number): Point {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;

  return {
    x: uu * a.x + 2 * u * t * c.x + tt * b.x,
    y: uu * a.y + 2 * u * t * c.y + tt * b.y,
    pressure: uu * a.pressure + 2 * u * t * c.pressure + tt * b.pressure,
    timestamp: uu * a.timestamp + 2 * u * t * c.timestamp + tt * b.timestamp,
  };
}

/**
 * Densify the centerline by sampling the same quadratic segments your canvas
 * renderer uses (moveTo p0, then Q(curr -> mid(curr,next))).
 *
 * This removes “polygonal” corners when input points are sparse.
 */
export function densifyQuadraticCenterline(
  points: ReadonlyArray<Point>,
  spacingPx: number,
  maxPoints = 4000,
): Point[] {
  if (points.length <= 2) return resamplePoints(points, spacingPx);

  const hardCap = Math.max(128, Math.floor(maxPoints));

  // If the stroke is long, increase spacing so we never hit the cap and
  // accidentally create a "straight line to the pointer" tail.
  const approxLen = estimateStrokeLength(points);

  const baseSpacing = Math.max(0.25, spacingPx);

  // Keep some headroom for endpoints/rounding.
  const targetSegments = Math.max(16, hardCap - 16);
  const capSpacing = approxLen > 0 ? approxLen / targetSegments : baseSpacing;

  const spacing = Math.max(baseSpacing, capSpacing);

  const out: Point[] = [];

  const p0 = points[0];
  out.push(p0);

  for (let i = 1; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];

    const start = i === 1 ? points[0] : midPoint(points[i - 1], curr);
    const end = midPoint(curr, next);

    const approxSegLen =
      Math.hypot(curr.x - start.x, curr.y - start.y) + Math.hypot(end.x - curr.x, end.y - curr.y);

    const steps = Math.max(2, Math.ceil(approxSegLen / spacing));

    // Avoid duplicating the start point (already emitted)
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      out.push(quadAt(start, curr, end, t));
    }
  }

  const last = points[points.length - 1];
  const lastOut = out[out.length - 1];

  if (!lastOut || lastOut.x !== last.x || lastOut.y !== last.y) {
    out.push(last);
  }

  // Normalize spacing after densification for stable outline geometry.
  // Using the same adaptive spacing keeps the output size controlled.
  return resamplePoints(out, spacing);
}

export function buildOutlinePathD(
  points: ReadonlyArray<Point>,
  args: OutlineSettings & { base: number },
  precision: number,
): { d: string; maxRadius: number; startRadius: number; endRadius: number } {
  if (points.length === 0) {
    return { d: "", maxRadius: 0, startRadius: 0, endRadius: 0 };
  }

  if (points.length === 1) {
    const p = points[0];
    const r = Math.max(0.5, (args.base * (1 + args.bleed)) / 2);
    const cx = toFixed(p.x, precision);
    const cy = toFixed(p.y, precision);
    const rr = toFixed(r, precision);

    const d =
      `M ${cx} ${cy} m -${rr} 0 ` +
      `a ${rr} ${rr} 0 1 0 ${toFixed(2 * r, precision)} 0 ` +
      `a ${rr} ${rr} 0 1 0 -${toFixed(2 * r, precision)} 0`;

    return { d, maxRadius: r, startRadius: r, endRadius: r };
  }

  const poly = buildOutlinePolygon(points, args);
  const { left, right, startCap, endCap, maxRadius, startRadius, endRadius } = poly;

  const vertices: Array<{ x: number; y: number }> = [];
  vertices.push(...startCap);
  vertices.push(...left.slice(1, -1));
  vertices.push(...endCap);
  vertices.push(...right.slice(1, -1).reverse());

  const d = buildClosedPathDFromVertices(vertices, precision);

  return { d, maxRadius, startRadius, endRadius };
}

export function buildOutlinePath2D(
  points: ReadonlyArray<Point>,
  args: OutlineSettings & { base: number },
): { path: Path2D; maxRadius: number } {
  const out = buildOutlinePathD(points, args, 2);
  return { path: new Path2D(out.d), maxRadius: out.maxRadius };
}

export interface Point {
  x: number;
  y: number;
}

export interface Extent {
  min: number;
  max: number;
}

export function extentOf(values: number[]): Extent | undefined {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === Infinity) return undefined;
  return { min, max };
}

/**
 * Widens a flat or tiny range so a day of constant temperature does not render
 * as a line glued to the top of the plot.
 */
export function paddedExtent(extent: Extent, minSpan = 4, pad = 0.18): Extent {
  let { min, max } = extent;
  const span = max - min;
  if (span < minSpan) {
    const grow = (minSpan - span) / 2;
    min -= grow;
    max += grow;
  }
  const padding = (max - min) * pad;
  return { min: min - padding, max: max + padding };
}

export function scaleY(
  value: number,
  extent: Extent,
  top: number,
  bottom: number,
): number {
  const span = extent.max - extent.min || 1;
  const ratio = (value - extent.min) / span;
  return bottom - ratio * (bottom - top);
}

/**
 * Fritsch-Carlson monotone cubic interpolation.
 *
 * A plain smoothing spline overshoots between points: two mild hours around one
 * warm one would draw a peak warmer than any forecast value. Monotone
 * interpolation cannot invent an extremum that is not in the data, which is the
 * difference between a smooth chart and a wrong one.
 */
export function monotonePath(points: Point[]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M ${points[0].x} ${points[0].y}`;
  if (n === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1].x - points[i].x || 1;
    slope[i] = (points[i + 1].y - points[i].y) / dx[i];
  }

  const tangent: number[] = new Array(n);
  tangent[0] = slope[0];
  tangent[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      tangent[i] = 0; // local extremum: flatten, never overshoot
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      tangent[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const third = dx[i] / 3;
    const c1x = points[i].x + third;
    const c1y = points[i].y + tangent[i] * third;
    const c2x = points[i + 1].x - third;
    const c2y = points[i + 1].y - tangent[i + 1] * third;
    d += ` C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${round(points[i + 1].x)} ${round(points[i + 1].y)}`;
  }
  return d;
}

export function areaPath(points: Point[], baseline: number): string {
  if (points.length === 0) return "";
  const line = monotonePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L ${round(last.x)} ${baseline} L ${round(first.x)} ${baseline} Z`;
}

const round = (n: number): number => Math.round(n * 100) / 100;

export { round };

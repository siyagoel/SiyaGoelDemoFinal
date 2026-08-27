/**
 * Chart geometry. Kept free of React so the shapes are unit-testable and the
 * chart components stay presentational — the app renders plain SVG on the
 * server rather than pulling in a charting dependency.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  width: number;
  height: number;
  padding?: number;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Maps values to evenly spaced points inside `box`, with y inverted for SVG.
 * A flat series is drawn along the middle rather than pinned to the floor.
 */
export function project(values: number[], box: Box): Point[] {
  const padding = box.padding ?? 0;
  const innerWidth = box.width - padding * 2;
  const innerHeight = box.height - padding * 2;
  if (values.length === 0) return [];
  if (values.length === 1) {
    return [{ x: round(box.width / 2), y: round(box.height / 2) }];
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min;
  const step = innerWidth / (values.length - 1);

  return values.map((value, index) => {
    const ratio = span === 0 ? 0.5 : (value - min) / span;
    return {
      x: round(padding + step * index),
      y: round(padding + innerHeight - ratio * innerHeight),
    };
  });
}

/** Catmull-Rom-ish smoothing: cubic segments with horizontal control points. */
export function linePath(points: Point[], smooth = true): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const [first, ...rest] = points;
  if (!smooth) {
    return `M ${first.x} ${first.y} ` + rest.map((p) => `L ${p.x} ${p.y}`).join(" ");
  }

  let path = `M ${first.x} ${first.y}`;
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const current = points[i];
    const controlX = round((previous.x + current.x) / 2);
    path += ` C ${controlX} ${previous.y}, ${controlX} ${current.y}, ${current.x} ${current.y}`;
  }
  return path;
}

/** The line path closed along the baseline, for the gradient fill. */
export function areaPath(points: Point[], baseline: number, smooth = true): string {
  if (points.length === 0) return "";
  const line = linePath(points, smooth);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`;
}

export interface DonutSegment {
  label: string;
  value: number;
  /** Fraction of the total, 0–1. */
  share: number;
  /** Length of this segment along the circumference. */
  dash: number;
  /** Offset that places the segment after all previous ones. */
  offset: number;
}

/**
 * Builds stroke-dasharray/dashoffset pairs for a donut drawn as a single
 * circle per segment — no arc maths in the component, no overlap at the seams.
 */
export function donutSegments(
  slices: { label: string; value: number }[],
  circumference: number,
  gap = 0,
): DonutSegment[] {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  if (total <= 0) return [];

  let consumed = 0;
  return slices
    .filter((slice) => slice.value > 0)
    .map((slice) => {
      const share = slice.value / total;
      const length = share * circumference;
      const segment: DonutSegment = {
        label: slice.label,
        value: slice.value,
        share: round(share),
        dash: round(Math.max(0, length - gap)),
        offset: round(circumference - consumed),
      };
      consumed += length;
      return segment;
    });
}

/** Bar heights in px for a set of counts, so an empty series stays flat. */
export function barHeights(values: number[], maxHeight: number, minHeight = 2): number[] {
  const max = Math.max(...values, 0);
  if (max <= 0) return values.map(() => minHeight);
  return values.map((value) =>
    value <= 0 ? minHeight : round(Math.max(minHeight, (value / max) * maxHeight)),
  );
}

/** Signed percentage change, or null when there is no baseline to compare to. */
export function percentageChange(previous: number, current: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return round(((current - previous) / previous) * 100);
}

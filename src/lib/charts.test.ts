import { describe, expect, it } from "vitest";
import {
  areaPath,
  barHeights,
  donutSegments,
  linePath,
  percentageChange,
  project,
} from "./charts";

const BOX = { width: 100, height: 40, padding: 0 };

describe("project", () => {
  it("spreads values across the box and inverts y for SVG", () => {
    const points = project([0, 5, 10], BOX);

    expect(points.map((p) => p.x)).toEqual([0, 50, 100]);
    expect(points[0].y).toBe(40);
    expect(points[2].y).toBe(0);
  });

  it("draws a flat series through the middle instead of on the floor", () => {
    expect(project([3, 3, 3], BOX).every((point) => point.y === 20)).toBe(true);
  });

  it("handles empty and single-value series", () => {
    expect(project([], BOX)).toEqual([]);
    expect(project([7], BOX)).toEqual([{ x: 50, y: 20 }]);
  });

  it("keeps points inside the padded area", () => {
    const points = project([1, 9], { width: 100, height: 40, padding: 4 });

    expect(points[0].x).toBe(4);
    expect(points[1].x).toBe(96);
    expect(Math.min(...points.map((p) => p.y))).toBeGreaterThanOrEqual(4);
    expect(Math.max(...points.map((p) => p.y))).toBeLessThanOrEqual(36);
  });
});

describe("linePath and areaPath", () => {
  it("emits straight segments when smoothing is off", () => {
    expect(linePath(project([0, 10], BOX), false)).toBe("M 0 40 L 100 0");
  });

  it("emits cubic segments when smoothing is on", () => {
    expect(linePath(project([0, 10], BOX))).toContain("C");
  });

  it("closes the area along the baseline", () => {
    const path = areaPath(project([0, 10], BOX), 40, false);

    expect(path.endsWith("L 100 40 L 0 40 Z")).toBe(true);
  });

  it("returns an empty path for an empty series", () => {
    expect(linePath([])).toBe("");
    expect(areaPath([], 40)).toBe("");
  });
});

describe("donutSegments", () => {
  const slices = [
    { label: "low", value: 1 },
    { label: "medium", value: 1 },
    { label: "high", value: 2 },
  ];

  it("splits the circumference by share and chains the offsets", () => {
    const segments = donutSegments(slices, 100);

    expect(segments.map((s) => s.share)).toEqual([0.25, 0.25, 0.5]);
    expect(segments.map((s) => s.dash)).toEqual([25, 25, 50]);
    expect(segments.map((s) => s.offset)).toEqual([100, 75, 50]);
  });

  it("leaves a gap between segments without moving them", () => {
    const segments = donutSegments(slices, 100, 2);

    expect(segments.map((s) => s.dash)).toEqual([23, 23, 48]);
    expect(segments.map((s) => s.offset)).toEqual([100, 75, 50]);
  });

  it("drops empty slices and returns nothing when everything is zero", () => {
    expect(donutSegments([{ label: "a", value: 0 }, { label: "b", value: 1 }], 100)).toHaveLength(1);
    expect(donutSegments([{ label: "a", value: 0 }], 100)).toEqual([]);
  });
});

describe("barHeights", () => {
  it("scales bars to the tallest value", () => {
    expect(barHeights([0, 5, 10], 100)).toEqual([2, 50, 100]);
  });

  it("keeps an all-zero series visible at the minimum height", () => {
    expect(barHeights([0, 0], 100, 3)).toEqual([3, 3]);
  });
});

describe("percentageChange", () => {
  it("reports signed change against the baseline", () => {
    expect(percentageChange(50, 75)).toBe(50);
    expect(percentageChange(50, 25)).toBe(-50);
  });

  it("has no baseline to compare against when the previous value is zero", () => {
    expect(percentageChange(0, 5)).toBeNull();
    expect(percentageChange(0, 0)).toBe(0);
  });
});

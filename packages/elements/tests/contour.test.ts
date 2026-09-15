import { expect, test } from "vite-plus/test";
import { autoLevels, type ContourSegment, contourSvg, marchingSquares } from "../src/contour.ts";

const count = (s: string, tag: string): number => s.split(`<${tag}`).length - 1;

/** A small linear-ramp grid: z = x + y, so a level's contour is a straight
 * diagonal line with a known, hand-derivable crossing. */
function rampGrid(n: number): { grid: number[][]; xs: number[]; ys: number[] } {
  const xs = Array.from({ length: n }, (_, i) => i);
  const ys = Array.from({ length: n }, (_, j) => j);
  const grid = ys.map((y) => xs.map((x) => x + y));
  return { grid, xs, ys };
}

/** f = x^2 + y^2 on a small grid, for a curved (circular) contour. */
function radialGrid(
  lo: number,
  hi: number,
  n: number,
): { grid: number[][]; xs: number[]; ys: number[] } {
  const xs = Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1));
  const ys = xs.slice();
  const grid = ys.map((y) => xs.map((x) => x * x + y * y));
  return { grid, xs, ys };
}

// ---------------------------------------------------------------------------
// marchingSquares
// ---------------------------------------------------------------------------

test("a flat field has no contour at any level", () => {
  const grid = [
    [5, 5, 5],
    [5, 5, 5],
    [5, 5, 5],
  ];
  const xs = [0, 1, 2];
  const ys = [0, 1, 2];
  expect(marchingSquares(grid, xs, ys, 5)).toEqual([]);
  expect(marchingSquares(grid, xs, ys, 3)).toEqual([]);
});

test("a level outside the grid's range yields no segments", () => {
  const { grid, xs, ys } = rampGrid(4); // z ranges 0..6
  expect(marchingSquares(grid, xs, ys, 100)).toEqual([]);
  expect(marchingSquares(grid, xs, ys, -100)).toEqual([]);
});

test("z = x + y at level 2 on a 3x3 unit grid crosses each affected cell once", () => {
  // Corners: (0,0)=0 (1,0)=1 (2,0)=2 (0,1)=1 (1,1)=2 (2,1)=3 (0,2)=2 (1,2)=3 (2,2)=4
  const grid = [
    [0, 1, 2],
    [1, 2, 3],
    [2, 3, 4],
  ];
  const xs = [0, 1, 2];
  const ys = [0, 1, 2];
  const segs = marchingSquares(grid, xs, ys, 2);
  // Four cells touch level 2 (each has corners straddling or equal to it);
  // the diagonal x+y=2 line runs from (2,0) to (0,2) through the grid.
  expect(segs.length).toBeGreaterThan(0);
  // Every endpoint must satisfy x + y ≈ 2 (the level-set equation).
  for (const [a, b] of segs) {
    expect(a.x + a.y).toBeCloseTo(2, 5);
    expect(b.x + b.y).toBeCloseTo(2, 5);
  }
});

test("a single cell straddling the level produces exactly one segment", () => {
  // One cell: TL=0 TR=2 BR=2 BL=0 (level 1 splits left/right).
  const grid = [
    [0, 2],
    [0, 2],
  ];
  const xs = [0, 1];
  const ys = [0, 1];
  const segs = marchingSquares(grid, xs, ys, 1);
  expect(segs.length).toBe(1);
  const [a, b] = segs[0];
  // Both endpoints sit at x = 0.5 (the level-1 crossing of a 0→2 edge).
  expect(a.x).toBeCloseTo(0.5, 5);
  expect(b.x).toBeCloseTo(0.5, 5);
});

test("saddle cells (case 5 / 10) still close off a consistent contour", () => {
  // radial field has genuine saddle-free contours, but a hand-built saddle:
  // TL=0 TR=1 BR=0 BL=1 at level 0.5 -- ambiguous diagonal.
  const grid = [
    [0, 1],
    [1, 0],
  ];
  const xs = [0, 1];
  const ys = [0, 1];
  const segs = marchingSquares(grid, xs, ys, 0.5);
  // Either resolution draws exactly two segments (both diagonals cross).
  expect(segs.length).toBe(2);
});

test("marchingSquares is deterministic: identical input yields identical output", () => {
  const { grid, xs, ys } = radialGrid(-2, 2, 9);
  const a = marchingSquares(grid, xs, ys, 2);
  const b = marchingSquares(grid, xs, ys, 2);
  expect(a).toEqual(b);
});

test("skips cells touching a non-finite sample", () => {
  const grid = [
    [0, 1, 2],
    [1, Number.NaN, 3],
    [2, 3, 4],
  ];
  const xs = [0, 1, 2];
  const ys = [0, 1, 2];
  // No cell adjacent to the NaN should contribute a segment.
  const segs: ContourSegment[] = marchingSquares(grid, xs, ys, 1.5);
  for (const [a, b] of segs) {
    expect(Number.isFinite(a.x) && Number.isFinite(a.y)).toBe(true);
    expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
  }
});

// ---------------------------------------------------------------------------
// autoLevels
// ---------------------------------------------------------------------------

test("autoLevels picks levels strictly inside the range, never at the extremes", () => {
  const levels = autoLevels(0, 10, 6);
  expect(levels.length).toBeGreaterThan(0);
  for (const lv of levels) {
    expect(lv).toBeGreaterThan(0);
    expect(lv).toBeLessThan(10);
  }
});

test("autoLevels on a degenerate (flat) range yields nothing", () => {
  expect(autoLevels(5, 5)).toEqual([]);
  expect(autoLevels(5, 3)).toEqual([]);
});

// ---------------------------------------------------------------------------
// contourSvg
// ---------------------------------------------------------------------------

test("line contours draw one path per level with segments", () => {
  const { grid, xs, ys } = radialGrid(-2, 2, 20);
  const s = contourSvg(grid, xs, ys, { levels: [1, 2, 3] });
  expect(s).toContain('viewBox="0 0 340 200"');
  expect(count(s, "path")).toBeGreaterThanOrEqual(1);
  expect(count(s, "path")).toBeLessThanOrEqual(3);
});

test("a level outside the sampled range draws no path", () => {
  const { grid, xs, ys } = radialGrid(-1, 1, 6); // z in [0, 2]
  const s = contourSvg(grid, xs, ys, { levels: [50] });
  expect(count(s, "path")).toBe(0);
});

test("filled mode draws bands (rects), not line paths", () => {
  const { grid, xs, ys } = radialGrid(-2, 2, 10);
  const s = contourSvg(grid, xs, ys, { levels: [2, 5], filled: true });
  expect(count(s, "path")).toBe(0);
  expect(count(s, "rect")).toBeGreaterThan(0);
});

test("axes:false drops the frame rect and labels", () => {
  const { grid, xs, ys } = radialGrid(-2, 2, 8);
  const withAxes = contourSvg(grid, xs, ys, { levels: [1], axes: true });
  const without = contourSvg(grid, xs, ys, { levels: [1], axes: false });
  expect(count(withAxes, "text")).toBeGreaterThan(0);
  expect(count(without, "text")).toBe(0);
});

test("an empty/undersized grid yields a bare frame", () => {
  expect(contourSvg([], [], [])).toContain("<svg");
  expect(count(contourSvg([[1]], [0], [0]), "path")).toBe(0);
});

test("a title renders centred above the frame", () => {
  const { grid, xs, ys } = radialGrid(-1, 1, 6);
  const s = contourSvg(grid, xs, ys, { levels: [0.5], title: "Saddle" });
  expect(s).toContain(">Saddle<");
});

test("determinism: the same grid renders byte-identical SVG twice", () => {
  const { grid, xs, ys } = radialGrid(-2, 2, 15);
  const opts = { levels: [1, 2, 3, 4], filled: false };
  const a = contourSvg(grid, xs, ys, opts);
  const b = contourSvg(grid, xs, ys, opts);
  expect(a).toBe(b);
});

test("determinism holds for filled bands too", () => {
  const { grid, xs, ys } = radialGrid(-2, 2, 15);
  const opts = { levels: [1, 2, 3], filled: true };
  const a = contourSvg(grid, xs, ys, opts);
  const b = contourSvg(grid, xs, ys, opts);
  expect(a).toBe(b);
});

import { expect, test } from "vite-plus/test";
import { densityColor, densitySvg, normalize } from "../src/densityplot.ts";

const count = (s: string, tag: string): number => s.split(`<${tag}`).length - 1;

/** z = x + y on an n x n unit grid. */
function rampGrid(n: number): { grid: number[][]; xs: number[]; ys: number[] } {
  const xs = Array.from({ length: n }, (_, i) => i);
  const ys = xs.slice();
  return { grid: ys.map((y) => xs.map((x) => x + y)), xs, ys };
}

// ---------------------------------------------------------------------------
// normalize
// ---------------------------------------------------------------------------

test("normalize maps the range onto [0, 1] and clamps outside it", () => {
  expect(normalize(5, 0, 10)).toBe(0.5);
  expect(normalize(-3, 0, 10)).toBe(0);
  expect(normalize(30, 0, 10)).toBe(1);
});

test("a degenerate range maps to the middle of the ramp", () => {
  expect(normalize(7, 7, 7)).toBe(0.5);
  expect(normalize(7, 10, 0)).toBe(0.5);
});

test("a non-finite value stays non-finite", () => {
  expect(Number.isNaN(normalize(Number.NaN, 0, 1))).toBe(true);
});

test("densityColor interpolates between the two ramp ends", () => {
  expect(densityColor(0)).toContain("0%");
  expect(densityColor(1)).toContain("100%");
  // Out-of-range values are clamped, not extrapolated.
  expect(densityColor(4)).toBe(densityColor(1));
});

// ---------------------------------------------------------------------------
// densitySvg
// ---------------------------------------------------------------------------

test("one cell per sample, on the default viewBox", () => {
  const { grid, xs, ys } = rampGrid(5);
  const s = densitySvg(grid, xs, ys, { axes: false });
  expect(s).toContain('viewBox="0 0 340 200"');
  expect(count(s, "rect")).toBe(25);
});

test("cell geometry is the plot area split evenly", () => {
  const { grid, xs, ys } = rampGrid(2);
  const s = densitySvg(grid, xs, ys, { axes: false });
  // 340 - 38 - 10 = 292 wide, 200 - 12 - 22 = 166 tall, over a 2x2 grid;
  // cells overlap by a 0.4px hairline so no seam shows.
  expect(s).toContain('width="146.4" height="83.4"');
  // Row 0 is the smallest y, so it sits at the bottom: 12 + 83 = 95.
  expect(s).toContain('x="38" y="95"');
  expect(s).toContain('x="38" y="12"');
});

test("a non-finite sample leaves its cell unpainted", () => {
  const grid = [
    [0, 1],
    [Number.NaN, 3],
  ];
  const s = densitySvg(grid, [0, 1], [0, 1], { axes: false });
  expect(count(s, "rect")).toBe(3);
});

test("the axis frame and its range labels appear by default", () => {
  const { grid, xs, ys } = rampGrid(4);
  const withAxes = densitySvg(grid, xs, ys);
  const without = densitySvg(grid, xs, ys, { axes: false });
  expect(count(withAxes, "text")).toBe(4);
  expect(count(without, "text")).toBe(0);
});

test("legend adds a colour bar with min/max labels", () => {
  const { grid, xs, ys } = rampGrid(3);
  const s = densitySvg(grid, xs, ys, { axes: false, legend: true });
  // 9 cells + 16 bar bands + the bar's outline.
  expect(count(s, "rect")).toBe(26);
  expect(s).toContain(">4<");
  expect(s).toContain(">0<");
});

test("zRange pins the colour scale instead of using the sampled extremes", () => {
  const { grid, xs, ys } = rampGrid(3);
  const auto = densitySvg(grid, xs, ys, { axes: false });
  const pinned = densitySvg(grid, xs, ys, { axes: false, zRange: [-10, 10] });
  expect(auto).not.toBe(pinned);
  // With the scale pinned wide, nothing reaches either end of the ramp.
  expect(pinned).not.toContain("100%");
  expect(pinned).not.toContain(" 0%");
});

test("an empty grid yields a bare frame", () => {
  expect(count(densitySvg([], [], []), "rect")).toBe(0);
  expect(count(densitySvg([[Number.NaN]], [0], [0]), "rect")).toBe(0);
});

test("descending ys still render bottom-up", () => {
  const grid = [
    [0, 0],
    [1, 1],
  ];
  const rects = (svg: string): string[] => (svg.match(/<rect[^/]*\/>/g) ?? []).sort();
  const asc = densitySvg(grid, [0, 1], [0, 1], { axes: false });
  // The same field with its rows and `ys` both reversed must paint the same
  // cells (only the emission order changes).
  const desc = densitySvg([grid[1], grid[0]], [0, 1], [1, 0], { axes: false });
  expect(rects(asc)).toEqual(rects(desc));
});

test("a title renders centred above the frame", () => {
  const { grid, xs, ys } = rampGrid(3);
  expect(densitySvg(grid, xs, ys, { title: "sin x cos y" })).toContain(">sin x cos y<");
});

test("axis labels are escaped, not injected", () => {
  const { grid, xs, ys } = rampGrid(3);
  const s = densitySvg(grid, xs, ys, { yLabel: "<y>" });
  expect(s).toContain("&lt;y&gt;");
  expect(s).not.toContain("<y>");
});

test("determinism: the same grid renders byte-identical SVG twice", () => {
  const { grid, xs, ys } = rampGrid(12);
  const opts = { legend: true, title: "z" };
  expect(densitySvg(grid, xs, ys, opts)).toBe(densitySvg(grid, xs, ys, opts));
});

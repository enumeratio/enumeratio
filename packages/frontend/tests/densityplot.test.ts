import { type BoxNode, optionsOfBox } from "@enumeratio/boxes";
import { expect, test } from "vite-plus/test";
import { densityColor, densityPlotBox, densitySvg, normalize } from "../src/densityplot.ts";
import { imagesIn } from "./png.ts";

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

test("densityColor runs along the gradient, viridis by default", () => {
  expect(densityColor(0)).toBe("#440154");
  expect(densityColor(1)).toBe("#fde725");
  // Out-of-range values are clamped, not extrapolated.
  expect(densityColor(4)).toBe(densityColor(1));
});

// ---------------------------------------------------------------------------
// densityPlotBox / densitySvg
// ---------------------------------------------------------------------------

/** The `Colors` of a density box's raster, and its options. */
function rasterOf(box: BoxNode): { colors: string[][]; range: unknown } {
  const tagged = ((box[1] as BoxNode)[1] as BoxNode[])[0] as BoxNode;
  const o = optionsOfBox(tagged[1] as BoxNode);
  return { colors: o.Colors as string[][], range: o.DataRange };
}

test("one cell per sample, in one raster on the default viewBox", () => {
  const { grid, xs, ys } = rampGrid(5);
  const s = densitySvg(grid, xs, ys, { axes: false });
  expect(s).toContain('viewBox="0 0 340 200"');
  expect(count(s, "image")).toBe(1);
  const [image] = imagesIn(s);
  expect([image!.width, image!.height]).toEqual([5, 5]);
});

test("the raster is the plot area, and its rows run bottom to top", () => {
  const { grid, xs, ys } = rampGrid(2);
  const s = densitySvg(grid, xs, ys, { axes: false });
  // 340 - 38 - 10 = 292 wide, 200 - 12 - 22 = 166 tall.
  expect(s).toContain('x="38" y="12" width="292" height="166"');
  // z = x + y: the least value is at the bottom left, the greatest at the top right.
  const [image] = imagesIn(s);
  expect(image!.pixels[1]![0]).toEqual([0x44, 0x01, 0x54, 255]);
  expect(image!.pixels[0]![1]).toEqual([0xfd, 0xe7, 0x25, 255]);
});

test("a non-finite sample leaves its cell clear", () => {
  const grid = [
    [0, 1],
    [Number.NaN, 3],
  ];
  const [image] = imagesIn(densitySvg(grid, [0, 1], [0, 1], { axes: false }));
  const clear = image!.pixels.flat().filter((p) => p[3] === 0);
  expect(clear).toHaveLength(1);
  expect(image!.pixels[0]![0]![3]).toBe(0);
});

test("the axis frame and its range labels appear by default", () => {
  const { grid, xs, ys } = rampGrid(4);
  const withAxes = densitySvg(grid, xs, ys);
  const without = densitySvg(grid, xs, ys, { axes: false });
  expect(count(withAxes, "text")).toBe(4);
  expect(count(without, "text")).toBe(0);
  expect(count(withAxes, "path")).toBe(1);
  expect(count(without, "path")).toBe(0);
});

test("legend adds a color bar with min/max labels", () => {
  const { grid, xs, ys } = rampGrid(3);
  const s = densitySvg(grid, xs, ys, { axes: false, legend: true });
  expect(count(s, "image")).toBe(2);
  const bar = imagesIn(s)[1]!;
  expect([bar.width, bar.height]).toEqual([1, 16]);
  expect(s).toContain(">4<");
  expect(s).toContain(">0<");
});

test("zRange pins the color scale instead of using the sampled extremes", () => {
  const { grid, xs, ys } = rampGrid(3);
  const auto = densitySvg(grid, xs, ys, { axes: false });
  const pinned = densitySvg(grid, xs, ys, { axes: false, zRange: [-10, 10] });
  expect(auto).not.toBe(pinned);
  // With the scale pinned wide, nothing reaches either end of the ramp.
  const colors = imagesIn(pinned)[0]!.pixels.flat();
  expect(colors).not.toContainEqual([0x44, 0x01, 0x54, 255]);
  expect(colors).not.toContainEqual([0xfd, 0xe7, 0x25, 255]);
});

test("an empty grid yields a bare frame", () => {
  expect(count(densitySvg([], [], []), "image")).toBe(0);
  expect(count(densitySvg([[Number.NaN]], [0], [0]), "image")).toBe(0);
});

test("descending axes still render bottom-up", () => {
  const grid = [
    [0, 0],
    [1, 1],
  ];
  const asc = densityPlotBox(grid, [0, 1], [0, 1], { axes: false });
  // The same field with its rows and `ys` both reversed is the same box.
  const desc = densityPlotBox([grid[1]!, grid[0]!], [0, 1], [1, 0], { axes: false });
  expect(rasterOf(desc as BoxNode)).toEqual(rasterOf(asc as BoxNode));
  const swapped = densityPlotBox([[1, 0]], [1, 0], [0], { axes: false });
  expect(rasterOf(swapped as BoxNode).colors[0]).toEqual(
    rasterOf(densityPlotBox([[0, 1]], [0, 1], [0], {}) as BoxNode).colors[0],
  );
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

test("a hostile title, label or gradient name cannot reach the markup", () => {
  const { grid, xs, ys } = rampGrid(3);
  const nasty = `"><script>alert('x')</script>&`;
  const s = densitySvg(grid, xs, ys, { title: nasty, xLabel: nasty, yLabel: nasty, gradient: nasty, legend: true });
  expect(s).not.toContain("<script");
  expect(s).not.toContain("alert('x')");
  expect(s).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&amp;");
  // The only attribute values besides numbers are the image's bytes.
  for (const [, href] of s.matchAll(/href="([^"]*)"/g))
    expect(href).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/);
});

test("determinism: the same grid renders byte-identical SVG twice", () => {
  const { grid, xs, ys } = rampGrid(12);
  const opts = { legend: true, title: "z" };
  expect(densitySvg(grid, xs, ys, opts)).toBe(densitySvg(grid, xs, ys, opts));
});

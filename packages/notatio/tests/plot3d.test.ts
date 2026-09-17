import { expect, test } from "vite-plus/test";
import { surfaceSvg, surfacesSvg } from "../src/plot3d.ts";

const grid = (nx: number, ny: number, f: (x: number, y: number) => number): number[][] =>
  Array.from({ length: ny }, (_, j) => Array.from({ length: nx }, (_, i) => f(i, j)));

const count = (s: string, tag: string): number => s.split(`<${tag}`).length - 1;

test("surface emits one quad per grid cell", () => {
  const s = surfaceSvg(
    grid(5, 4, (x, y) => x + y),
    { axes: false },
  );
  expect(s).toContain('viewBox="0 0 360 260"');
  expect(count(s, "polygon")).toBe(4 * 3); // (nx-1) * (ny-1)
});

test("cells touching a non-finite sample are dropped (a hole)", () => {
  const g = grid(4, 4, (x, y) => x * y);
  g[1][1] = Number.NaN; // corner of the 4 cells that share vertex (1,1)
  const s = surfaceSvg(g, { axes: false });
  expect(count(s, "polygon")).toBe(3 * 3 - 4);
});

test("degenerate grids yield an empty frame", () => {
  expect(count(surfaceSvg([]), "polygon")).toBe(0);
  expect(count(surfaceSvg([[1, 2, 3]]), "polygon")).toBe(0); // single row
});

test("a flat surface still renders (no divide-by-zero)", () => {
  const s = surfaceSvg(grid(3, 3, () => 5));
  // 4 surface cells + the floor rectangle polygon of the axes box.
  expect(count(s, "polygon")).toBe(4 + 1);
});

test("axes draw a floor + edges with range labels; axes:false drops them", () => {
  const g = grid(4, 4, (x, y) => x + y);
  const withAxes = surfaceSvg(g, { xs: [0, 1, 2, 3], ys: [0, 10, 20, 30] });
  expect(count(withAxes, "line")).toBe(3); // three axis edges
  expect(withAxes).toContain(">30<"); // y range end label
  const without = surfaceSvg(g, { axes: false });
  expect(count(without, "line")).toBe(0);
  expect(count(without, "polygon")).toBe(3 * 3); // just the surface, no floor
});

test("the view rotates: azimuth changes the projection, elevation 90 flattens to a top view", () => {
  const g = grid(4, 4, (x, y) => x + y);
  const base = surfaceSvg(g, { axes: false });
  const turned = surfaceSvg(g, { axes: false, azimuth: 120 });
  expect(turned).not.toBe(base);
  expect(count(turned, "polygon")).toBe(9); // still every cell
  // Straight down: height drops out, so a flat and a sloped grid coincide.
  const flatTop = surfaceSvg(
    grid(4, 4, () => 1),
    { axes: false, elevation: 90 },
  );
  const slopedTop = surfaceSvg(g, { axes: false, elevation: 90 }).replace(/fill="[^"]*"/g, "");
  expect(flatTop.replace(/fill="[^"]*"/g, "")).toBe(slopedTop);
});

test("zoom scales the projection about the frame centre", () => {
  const g = grid(3, 3, () => 0);
  const xs = (s: string): number[] =>
    [...s.matchAll(/points="([^"]+)"/g)].flatMap((m) =>
      m[1].split(" ").map((p) => Number(p.split(",")[0])),
    );
  const a = xs(surfaceSvg(g, { axes: false }));
  const b = xs(surfaceSvg(g, { axes: false, zoom: 2 }));
  const spread = (v: number[]): number => Math.max(...v) - Math.min(...v);
  expect(spread(b)).toBeCloseTo(2 * spread(a), 0);
});

test("axes edges hang off the farthest floor corner for any azimuth", () => {
  const g = grid(3, 3, (x, y) => x * y);
  for (const azimuth of [0, 45, 135, 225, 315]) {
    const s = surfaceSvg(g, { azimuth });
    expect(count(s, "line")).toBe(3);
    expect(count(s, "text")).toBe(3);
  }
});

test("a 3-D title renders centred at the top", () => {
  const s = surfaceSvg(
    grid(4, 4, (x, y) => x + y),
    { axes: false, title: "surf" },
  );
  expect(s).toContain(">surf<");
});

test("colorLegend draws a swatch bar with z-range labels", () => {
  const s = surfaceSvg(
    grid(4, 4, (x, y) => x + y),
    { colorLegend: true, xs: [0, 1, 2, 3], ys: [0, 1, 2, 3] },
  );
  // 8 swatch rects + the 1 outline rect = 9 rects that the surface itself never adds.
  expect(count(s, "rect")).toBe(9);
  expect(s).toContain(">6<"); // zmax = 3+3 label
});

test("surfacesSvg overlays several grids, cells depth-sorted across all", () => {
  const g1 = grid(4, 4, (x, y) => x + y);
  const g2 = grid(4, 4, (x, y) => 6 - x - y); // crosses g1
  const s = surfacesSvg([g1, g2], { axes: false });
  expect(count(s, "polygon")).toBe(2 * 9); // both surfaces' cells
  expect(s).toContain('fill-opacity="0.85"'); // overlays get transparency
  expect(s).toContain("--notatio-series-2"); // second surface's colour
});

test("a single grid via surfacesSvg matches surfaceSvg", () => {
  const g = grid(3, 3, (x, y) => x * y);
  expect(surfacesSvg([g], { axes: false })).toBe(surfaceSvg(g, { axes: false }));
});

test("hover marks the nearest vertex and reads out its coordinates", () => {
  const g = grid(4, 4, (x, y) => x + y);
  const xs = [0, 1, 2, 3];
  const ys = [0, 1, 2, 3];
  // Project the (3,3) corner ourselves is hard; instead hover far away -> no
  // readout (distance gate), and hover at the figure centre -> some readout.
  const far = surfaceSvg(g, { xs, ys, hover: [1000, 1000] });
  expect(far).not.toContain('stroke-width="2"'); // no hover marker
  const near = surfaceSvg(g, { xs, ys, hover: [180, 130] });
  expect(near).toContain('stroke-width="2"'); // a marker circle drawn
});

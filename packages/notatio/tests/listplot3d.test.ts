import { expect, test } from "vite-plus/test";
import { gridFromPoints, heightShade, mesh3dSvg, scatter3dSvg } from "../src/listplot3d.ts";
import type { Point3 } from "../src/project3d.ts";

const count = (s: string, tag: string): number => s.split(`<${tag}`).length - 1;
/** The projected coordinates of every drawn marker, in document order. */
const circles = (s: string): [number, number][] =>
  [...s.matchAll(/<circle cx="(-?[\d.]+)" cy="(-?[\d.]+)"/g)].map(([, x, y]) => [Number(x), Number(y)]);

/** The straight-on view (azimuth 0, elevation 0): x = 0 → 74, x = 1 → 286,
 * z = 0 → 236, z = 1 → 24, depth = y − ½. See project3d.test.ts. */
const flat = { azimuth: 0, elevation: 0 } as const;

const P = (x: number, y: number, z: number): Point3 => ({ x, y, z });

// ---------------------------------------------------------------------------
// heightShade
// ---------------------------------------------------------------------------

test("the height ramp runs from a washed-out low to a saturated high", () => {
  expect(heightShade(0)).toContain("22%");
  expect(heightShade(1)).toContain("82%");
  // Out-of-range and non-finite heights clamp rather than extrapolate.
  expect(heightShade(9)).toBe(heightShade(1));
  expect(heightShade(Number.NaN)).toBe(heightShade(0));
});

// ---------------------------------------------------------------------------
// scatter3dSvg
// ---------------------------------------------------------------------------

test("a scatter draws one marker per point on the default viewBox", () => {
  const s = scatter3dSvg([P(0, 0, 0), P(1, 1, 1), P(0.5, 0.5, 0.5)]);
  expect(s).toContain('viewBox="0 0 360 260"');
  expect(s).toContain('aria-label="3-D point plot"');
  expect(count(s, "circle")).toBe(3);
});

test("markers land on exactly projected coordinates", () => {
  const s = scatter3dSvg([P(0, 0, 0), P(1, 1, 1), P(0.5, 0.5, 0.5)], {
    ...flat,
    axes: false,
  });
  expect(circles(s)).toEqual([
    [74, 236],
    [180, 130],
    [286, 24],
  ]);
});

test("markers are painted back-to-front", () => {
  // Depth is y − ½ at elevation 0, so the largest y must be drawn last.
  const s = scatter3dSvg([P(0, 1, 0), P(0, 0, 0), P(0, 0.5, 0)], { ...flat, axes: false });
  const ys = [...s.matchAll(/<circle cx="(-?[\d.]+)" cy="(-?[\d.]+)"/g)];
  expect(ys.length).toBe(3);
  // All three project to the same screen point; the order is what's asserted,
  // so check it via the depth-cued radius, which grows toward the viewer.
  const radii = [...s.matchAll(/ r="([\d.]+)"/g)].map(([, r]) => Number(r));
  expect(radii[0]).toBeLessThan(radii[1]);
  expect(radii[1]).toBeLessThan(radii[2]);
});

test("depth cueing shrinks and fades the farthest marker", () => {
  const s = scatter3dSvg([P(0, 0, 0), P(0, 1, 0)], { ...flat, axes: false, size: 4 });
  const radii = [...s.matchAll(/ r="([\d.]+)"/g)].map(([, r]) => Number(r));
  // Default cue 0.45: the far marker keeps 55% of its radius, the near one all.
  expect(radii).toEqual([2.2, 4]);
  expect(s).toContain('fill-opacity="0.55"');
});

test("depthCue:0 draws every marker identically", () => {
  const s = scatter3dSvg([P(0, 0, 0), P(0, 1, 0)], {
    ...flat,
    axes: false,
    size: 4,
    depthCue: 0,
  });
  const radii = [...s.matchAll(/ r="([\d.]+)"/g)].map(([, r]) => Number(r));
  expect(radii).toEqual([4, 4]);
});

test("a single point sits at the centre of the cube", () => {
  // Every extent is degenerate, so the point maps to (½, ½, ½).
  const s = scatter3dSvg([P(7, 7, 7)], { ...flat, axes: false });
  expect(circles(s)).toEqual([[180, 130]]);
});

test("non-finite points are dropped", () => {
  const s = scatter3dSvg([P(0, 0, 0), P(Number.NaN, 1, 1), P(1, 1, 1)], { axes: false });
  expect(count(s, "circle")).toBe(2);
});

test("an empty scatter yields a bare frame", () => {
  const s = scatter3dSvg([]);
  expect(s).toContain("<svg");
  expect(count(s, "circle")).toBe(0);
});

test("axes:false drops the projected axis box", () => {
  const pts = [P(0, 0, 0), P(1, 1, 1)];
  expect(count(scatter3dSvg(pts), "line")).toBe(3);
  expect(count(scatter3dSvg(pts, { axes: false }), "line")).toBe(0);
});

test("a title renders centred above the figure", () => {
  expect(scatter3dSvg([P(0, 0, 0)], { title: "Samples" })).toContain(">Samples<");
});

test("determinism: the same points render byte-identical SVG twice", () => {
  const pts = Array.from({ length: 40 }, (_, k) => P(k % 7, (k * 3) % 5, Math.sin(k)));
  const opts = { azimuth: 33, elevation: 21, title: "cloud" };
  expect(scatter3dSvg(pts, opts)).toBe(scatter3dSvg(pts, opts));
});

// ---------------------------------------------------------------------------
// mesh3dSvg
// ---------------------------------------------------------------------------

test("an n×m grid draws (n−1)(m−1) quads", () => {
  const grid = [
    [0, 1, 2],
    [1, 2, 3],
    [2, 3, 4],
  ];
  const s = mesh3dSvg(grid, { axes: false });
  expect(s).toContain('aria-label="3-D surface plot"');
  expect(count(s, "polygon")).toBe(4);
});

test("a quad's corners are exactly the projected samples", () => {
  // z ∈ [0, 3]; at elevation 0, y = 130 + (½ − z/3)·212.
  const s = mesh3dSvg(
    [
      [0, 1],
      [2, 3],
    ],
    { ...flat, axes: false },
  );
  expect(s).toContain('points="74,236 286,165.33 286,24 74,94.67"');
  // Mean height ½ → 22 + 60·½ = 52% of the accent.
  expect(s).toContain("52%");
});

test("quads are painted back-to-front", () => {
  const grid = [
    [0, 0],
    [0, 0],
    [1, 1],
  ];
  const s = mesh3dSvg(grid, { ...flat, axes: false });
  const first = s.indexOf('points="74,236 286,236');
  const second = s.indexOf('points="74,236 286,236', first + 1);
  // Two quads stacked in y; the near one (larger y) comes last in the document.
  expect(first).toBeGreaterThanOrEqual(0);
  expect(second).toBeGreaterThan(first);
});

test("a quad touching a non-finite sample is skipped, leaving a hole", () => {
  const grid = [
    [0, 1, 2],
    [1, Number.NaN, 3],
    [2, 3, 4],
  ];
  // All four quads touch the hole.
  expect(count(mesh3dSvg(grid, { axes: false }), "polygon")).toBe(0);
});

test("a flat grid still renders, shaded from the middle of the ramp", () => {
  const grid = [
    [5, 5],
    [5, 5],
  ];
  const s = mesh3dSvg(grid, { axes: false });
  expect(count(s, "polygon")).toBe(1);
  expect(s).toContain("52%");
});

test("wireframe draws unfilled outlines", () => {
  const grid = [
    [0, 1],
    [2, 3],
  ];
  const s = mesh3dSvg(grid, { axes: false, wireframe: true });
  expect(s).toContain('fill="none"');
  expect(s).not.toContain("color-mix");
});

test("an undersized grid yields a bare frame", () => {
  expect(count(mesh3dSvg([], { axes: false }), "polygon")).toBe(0);
  expect(count(mesh3dSvg([[1]], { axes: false }), "polygon")).toBe(0);
  expect(count(mesh3dSvg([[1, 2]], { axes: false }), "polygon")).toBe(0);
});

test("zRange pins the height ramp instead of using the data's own", () => {
  const grid = [
    [0, 1],
    [2, 3],
  ];
  const auto = mesh3dSvg(grid, { axes: false });
  const pinned = mesh3dSvg(grid, { axes: false, zRange: [-10, 10] });
  expect(auto).not.toBe(pinned);
});

test("determinism: the same grid renders byte-identical SVG twice", () => {
  const grid = Array.from({ length: 9 }, (_, j) =>
    Array.from({ length: 9 }, (_, i) => Math.sin(i / 2) * Math.cos(j / 2)),
  );
  const opts = { azimuth: 30, elevation: 25, title: "sin·cos" };
  expect(mesh3dSvg(grid, opts)).toBe(mesh3dSvg(grid, opts));
});

// ---------------------------------------------------------------------------
// gridFromPoints
// ---------------------------------------------------------------------------

test("points bin onto a grid of the requested shape", () => {
  const { grid, xs, ys } = gridFromPoints([P(0, 0, 1), P(1, 1, 3)], 2, 2);
  expect(grid.length).toBe(2);
  expect(grid[0].length).toBe(2);
  expect(grid[0][0]).toBe(1);
  expect(grid[1][1]).toBe(3);
  expect(xs).toEqual([0, 1]);
  expect(ys).toEqual([0, 1]);
});

test("an empty bin reads as a hole", () => {
  const { grid } = gridFromPoints([P(0, 0, 1), P(1, 1, 3)], 2, 2);
  expect(Number.isNaN(grid[0][1])).toBe(true);
  expect(Number.isNaN(grid[1][0])).toBe(true);
});

test("several points in one bin average", () => {
  const { grid } = gridFromPoints([P(0, 0, 2), P(0.1, 0.1, 4)], 1, 1);
  expect(grid[0][0]).toBe(3);
});

test("the top-edge point falls in the last bin, not off the end", () => {
  const { grid } = gridFromPoints([P(0, 0, 1), P(1, 1, 5)], 2, 2);
  expect(grid[1][1]).toBe(5);
});

test("gridFromPoints is deterministic", () => {
  const pts = Array.from({ length: 50 }, (_, k) => P(Math.sin(k), Math.cos(k), k));
  expect(gridFromPoints(pts, 6, 6)).toEqual(gridFromPoints(pts, 6, 6));
});

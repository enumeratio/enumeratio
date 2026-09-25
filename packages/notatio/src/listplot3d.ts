// Pure 3-D list-plot geometry: points or a height grid in, a projected SVG out
// (Wolfram's `ListPointPlot3D`, `ListPlot3D` / `ListSurfacePlot3D`). The camera
// lives in project3d.ts; this module owns the data normalisation, the painter's
// ordering and the shading. Same input → byte-identical SVG.

import {
  axisBoxSvg,
  camera,
  type CameraOptions,
  frameSvg,
  type Point3,
  type ScreenPoint,
  titleSvg,
  unitScale,
} from "./project3d.ts";

const ACCENT = "var(--notatio-accent, var(--vp-c-brand-1, #d97706))";
const BG = "var(--notatio-bg, var(--vp-c-bg, #ffffff))";
const EDGE = "var(--notatio-border, var(--vp-c-divider, currentColor))";

const n2 = (x: number): string => String(Math.round(x * 100) / 100);

/** Height shading: the accent mixed into the page background, so a tall cell
 * reads as saturated and a low one as washed out, in either theme. */
export function heightShade(t: number): string {
  const k = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  return `color-mix(in srgb, ${ACCENT} ${n2(22 + 60 * k)}%, ${BG})`;
}

type Grid = readonly (readonly number[])[];

export interface List3dOptions extends CameraOptions {
  /** Draw the projected axis box behind the data (default true). */
  axes?: boolean;
  /** Sample coordinates along each axis; default the sample indices. */
  xs?: readonly number[];
  ys?: readonly number[];
  /** Explicit z bounds for the height ramp; otherwise the data's own. */
  zRange?: readonly [number, number];
  title?: string;
}

export interface Scatter3dOptions extends List3dOptions {
  /** Marker radius at the front of the figure, in viewBox units (default 3.2). */
  size?: number;
  /**
   * How much a far point shrinks and fades, 0…1 (default 0.45). At 0 every
   * marker is drawn identically; at 1 the farthest marker vanishes.
   */
  depthCue?: number;
}

export interface Mesh3dOptions extends List3dOptions {
  /** Draw only the quad outlines, unfilled (default false). */
  wireframe?: boolean;
}

/** The finite extent of `values`, widened when every value is the same so a
 * flat field still has a usable ramp. */
function extent(values: readonly number[]): [number, number] {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return [0, 1];
  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  return [lo, hi];
}

/**
 * Bin scattered `points` onto an `nx` × `ny` grid, each cell holding the mean z
 * of the points that fall in it (`NaN` where none do). Binning by position --
 * rather than fitting an interpolant -- keeps the result an exact function of
 * the input, which an SSR-rendered figure needs.
 */
export function gridFromPoints(
  points: readonly Point3[],
  nx: number,
  ny: number,
): { grid: number[][]; xs: number[]; ys: number[] } {
  const cols = Math.max(1, Math.round(nx));
  const rows = Math.max(1, Math.round(ny));
  const usable = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
  const [xlo, xhi] = extent(usable.map((p) => p.x));
  const [ylo, yhi] = extent(usable.map((p) => p.y));
  const sums = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  const hits = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  const bin = (v: number, lo: number, hi: number, count: number): number =>
    Math.max(0, Math.min(count - 1, Math.floor(((v - lo) / (hi - lo || 1)) * count)));
  for (const p of usable) {
    const i = bin(p.x, xlo, xhi, cols);
    const j = bin(p.y, ylo, yhi, rows);
    sums[j][i] += p.z;
    hits[j][i] += 1;
  }
  return {
    grid: sums.map((row, j) => row.map((s, i) => (hits[j][i] > 0 ? s / hits[j][i] : Number.NaN))),
    xs: Array.from({ length: cols }, (_, i) => (cols > 1 ? xlo + ((xhi - xlo) * i) / (cols - 1) : xlo)),
    ys: Array.from({ length: rows }, (_, j) => (rows > 1 ? ylo + ((yhi - ylo) * j) / (rows - 1) : ylo)),
  };
}

/**
 * Render `points` as a 3-D scatter (`ListPointPlot3D`): each point projected
 * orthographically, then drawn back-to-front so a near marker overlaps a far
 * one. Marker radius and opacity fall off with depth (`depthCue`), which is the
 * only cue an orthographic view has for distance.
 */
export function scatter3dSvg(points: readonly Point3[], opts: Scatter3dOptions = {}): string {
  const cam = camera(opts);
  const usable = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
  if (usable.length === 0) return frameSvg(cam.width, cam.height, "3-D point plot", titleSvg(cam.width, opts.title));

  const [xlo, xhi] = extent(usable.map((p) => p.x));
  const [ylo, yhi] = extent(usable.map((p) => p.y));
  const [zlo, zhi] = opts.zRange ? opts.zRange : extent(usable.map((p) => p.z));
  const sx = unitScale(xlo, xhi);
  const sy = unitScale(ylo, yhi);
  const sz = unitScale(zlo, zhi);

  const placed = usable.map((p) => {
    const t = sz(p.z);
    return { p: cam.at(sx(p.x), sy(p.y), t), t };
  });
  // Painter's order: farthest first, so nearer markers land on top.
  const [dLo, dHi] = extent(placed.map((m) => m.p.depth));
  const near = unitScale(dLo, dHi);
  placed.sort((a, b) => a.p.depth - b.p.depth);

  const size = opts.size ?? 3.2;
  const cue = Math.max(0, Math.min(1, opts.depthCue ?? 0.45));
  const markers = placed
    .map(({ p, t }) => {
      const k = 1 - cue * (1 - near(p.depth));
      return (
        `<circle cx="${n2(p.x)}" cy="${n2(p.y)}" r="${n2(size * k)}"` +
        ` fill="${heightShade(t)}" fill-opacity="${n2(k)}" stroke="${EDGE}" stroke-width="0.5"/>`
      );
    })
    .join("");

  const axes =
    opts.axes === false ? "" : axisBoxSvg(cam, { xEnd: xhi, yEnd: yhi, zEnd: opts.zRange ? opts.zRange[1] : zhi });
  return frameSvg(cam.width, cam.height, "3-D point plot", axes + markers + titleSvg(cam.width, opts.title));
}

/**
 * Render a height grid as a projected quad mesh (`ListPlot3D`). `grid[j][i]` is
 * z at the (i-th x, j-th y) sample -- the same row-major convention the contour
 * and surface renderers use. Quads are sorted back-to-front on their mean view
 * depth (the painter's algorithm) and shaded by mean height; a quad touching a
 * non-finite sample is skipped, leaving a hole rather than a spike.
 */
export function mesh3dSvg(grid: Grid, opts: Mesh3dOptions = {}): string {
  const cam = camera(opts);
  const aria = "3-D surface plot";
  const ny = grid.length;
  const nx = ny > 0 ? grid[0].length : 0;
  if (nx < 2 || ny < 2) return frameSvg(cam.width, cam.height, aria, titleSvg(cam.width, opts.title));

  const [zlo, zhi] = opts.zRange ? opts.zRange : extent(grid.flat());
  const sz = unitScale(zlo, zhi);
  const px = (i: number): number => (nx > 1 ? i / (nx - 1) : 0.5);
  const py = (j: number): number => (ny > 1 ? j / (ny - 1) : 0.5);

  interface Quad {
    depth: number;
    t: number;
    points: string;
  }
  const quads: Quad[] = [];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const zs = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]];
      if (!zs.every(Number.isFinite)) continue;
      const corners: ScreenPoint[] = [
        cam.at(px(i), py(j), sz(zs[0])),
        cam.at(px(i + 1), py(j), sz(zs[1])),
        cam.at(px(i + 1), py(j + 1), sz(zs[2])),
        cam.at(px(i), py(j + 1), sz(zs[3])),
      ];
      quads.push({
        depth: corners.reduce((sum, c) => sum + c.depth, 0) / 4,
        t: zs.reduce((sum, z) => sum + sz(z), 0) / 4,
        points: corners.map((c) => `${n2(c.x)},${n2(c.y)}`).join(" "),
      });
    }
  }
  quads.sort((a, b) => a.depth - b.depth);

  const mesh = quads
    .map((q) =>
      opts.wireframe
        ? `<polygon points="${q.points}" fill="none" stroke="${ACCENT}" stroke-width="0.7" stroke-linejoin="round" opacity="0.8"/>`
        : `<polygon points="${q.points}" fill="${heightShade(q.t)}" stroke="${EDGE}" stroke-width="0.5" stroke-linejoin="round"/>`,
    )
    .join("");

  const axes =
    opts.axes === false
      ? ""
      : axisBoxSvg(cam, {
          xEnd: opts.xs ? opts.xs[nx - 1] : nx - 1,
          yEnd: opts.ys ? opts.ys[ny - 1] : ny - 1,
          zEnd: zhi,
        });
  return frameSvg(cam.width, cam.height, aria, axes + mesh + titleSvg(cam.width, opts.title));
}

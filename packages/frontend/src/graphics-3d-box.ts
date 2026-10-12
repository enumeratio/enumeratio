// Figures in space as `Graphics3DBox`es (the wiki's Speculative-Box-Primitives, §6 slice 7). Wolfram's
// `Plot3D` returns `Graphics3D`, so a surface lowers to a `GraphicsComplex3DBox` (every vertex once,
// the quads as `Indices`), a bar to a `CuboidBox`, a curve to a `Line3DBox` and a scatter to a
// `Point3DBox`. The chrome rides as options (`Axes`, `PlotRange`, `ScalingFunctions`, `PlotLabel`,
// `PlotLegends`), and every color is resolved here, so a drawer needs no gradient table: it
// projects, sorts and paints (`graphics-3d-draw.ts`).
//
// Options that are ours, not Wolfram's: `Azimuth`, `Elevation` and `Zoom` (the view as the drawer's
// projection reads it, where Wolfram has `ViewPoint`), `Framing` (`Fixed`: a constant scale, as a
// surface is framed; `Fit`: the whole cube fills the frame, as bars and meshes are), `Description`
// (the figure's accessible name), and on a primitive `Behind`/`OnTop` (drawn under or over the
// depth-sorted rest), `Casing`, `DepthCue` and `Role`.

import {
  type Box,
  cuboid,
  graphics3d,
  graphicsComplex3d,
  inset,
  interpretation,
  line3d,
  type OptionValue,
  point3d,
  polygon3d,
  row,
} from "@enumeratio/boxes";
import { type Gradient, sampleGradient } from "./palettes.ts";
import { categoryColors, type ColorOptions, gradientOf, plotPalette, rampColor } from "./plot-color.ts";
import { label } from "./plot-box.ts";
import type { Triple } from "./plot3d.ts";
import { scale } from "./scales.ts";

const BG = "var(--notatio-bg, var(--vp-c-bg, #ffffff))";
const n2 = (x: number): string => String(Math.round(x * 100) / 100);

const WIDTH = 360;
const HEIGHT = 260;

/** What a figure in space is looked at with, and says about itself. */
export interface Graphics3dOptions extends ColorOptions {
  width?: number;
  height?: number;
  /** Draw the boxed axes with range labels (default true). */
  axes?: boolean;
  /** Rotation about the vertical, in degrees. */
  azimuth?: number;
  /** Tilt above the floor, in degrees. */
  elevation?: number;
  /** Magnification about the figure's center. */
  zoom?: number;
  /** A title centered at the top (`PlotLabel`). */
  title?: string;
  /** Scaling function names for the three axes (`ScalingFunctions`). */
  xScale?: string;
  yScale?: string;
  zScale?: string;
  /** A height color key at the right (`PlotLegends`). */
  colorLegend?: boolean;
}

type Range = readonly [number, number];

const scaleNames = (o: Graphics3dOptions): OptionValue => [
  o.xScale ?? "linear",
  o.yScale ?? "linear",
  o.zScale ?? "linear",
];

/** The options every figure in space carries; `defaults` are the view its kind starts at. */
function chrome(
  o: Graphics3dOptions,
  range: readonly [Range, Range, Range],
  framing: "Fixed" | "Fit",
  defaults: { azimuth: number; elevation: number },
  description: string,
): Record<string, OptionValue> {
  return {
    ImageSize: [o.width ?? WIDTH, o.height ?? HEIGHT],
    Axes: o.axes !== false,
    PlotRange: range.map((r) => [...r]),
    ScalingFunctions: scaleNames(o),
    Framing: framing,
    Azimuth: o.azimuth ?? defaults.azimuth,
    Elevation: o.elevation ?? defaults.elevation,
    Zoom: o.zoom ?? 1,
    Description: description,
    ...(o.title && { PlotLabel: o.title }),
  };
}

const EMPTY_RANGE: readonly [Range, Range, Range] = [
  [0, 1],
  [0, 1],
  [0, 1],
];

/** A figure with nothing to draw: an empty frame, with no axes around nothing. */
const emptyBox = (
  o: Graphics3dOptions,
  framing: "Fixed" | "Fit",
  defaults: { azimuth: number; elevation: number },
  description: string,
): Box => graphics3d(row([]), { ...chrome(o, EMPTY_RANGE, framing, defaults, description), Axes: false });

/** The finite extent of `values`, widened when every value is the same so a flat field has a usable ramp. */
function extent(values: readonly number[]): Range {
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

/** `[lo, hi]` as a map onto [0, 1]; a degenerate range maps everything to a half. */
function unitScale(lo: number, hi: number): (v: number) => number {
  return hi > lo ? (v) => (v - lo) / (hi - lo) : () => 0.5;
}

// ── Surfaces ─────────────────────────────────────────────────────────────────────────────

type Grid = readonly (readonly number[])[];

/** `base` washed toward the page by how low the face sits: the shading of one of several surfaces. */
const shade = (base: string, t: number): string => `color-mix(in srgb, ${base} ${n2(22 + 60 * t)}%, ${BG})`;

/** Swatches of the height key, top to bottom. */
const KEY_STEPS = 8;

/**
 * Height grids as surfaces. `grids[k][j][i]` is z at the (i-th of `xs`, j-th of `ys`) sample; a
 * cell with a non-finite corner is a hole. A lone surface takes the gradient by height; several are
 * told apart by color, each washed toward the page by its lower faces, and overlay translucently.
 */
export function surfaceBox(
  grids: readonly Grid[],
  xs: readonly number[],
  ys: readonly number[],
  o: Graphics3dOptions = {},
): Box {
  const ny = grids[0]?.length ?? 0;
  const nx = ny > 0 ? grids[0]![0]!.length : 0;
  const Z = scale(o.zScale);
  const finiteZ = grids
    .flatMap((g) => g.flat())
    .map((z) => Z.fwd(z))
    .filter(Number.isFinite);
  const description = "surface plot";
  if (nx < 2 || ny < 2 || finiteZ.length === 0)
    return emptyBox(o, "Fixed", { azimuth: 45, elevation: 15 }, description);

  const X = scale(o.xScale);
  const Y = scale(o.yScale);
  const axisRange = (coords: readonly number[], s: typeof X): Range => {
    const t = coords.map((c) => s.fwd(c)).filter(Number.isFinite);
    return [s.inv(Math.min(...t)), s.inv(Math.max(...t))];
  };
  let zmin = Math.min(...finiteZ);
  let zmax = Math.max(...finiteZ);
  if (zmin === zmax) {
    zmin -= 1;
    zmax += 1;
  }
  const range: readonly [Range, Range, Range] = [axisRange(xs, X), axisRange(ys, Y), [Z.inv(zmin), Z.inv(zmax)]];
  const height = (z: number): number => (Z.fwd(z) - zmin) / (zmax - zmin);

  const palette = plotPalette(o);
  const surfaceColors = categoryColors(palette, grids.length);
  const fill = (surface: number, t: number): string =>
    grids.length === 1 ? rampColor(palette, t) : shade(surfaceColors[surface]!, t);

  const complexes = grids.map((grid, s) => {
    const index = new Int32Array(nx * ny).fill(-1);
    const points: OptionValue[] = [];
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++)
        if (Number.isFinite(Z.fwd(grid[j]![i]!))) {
          index[j * nx + i] = points.length;
          points.push([xs[i]!, ys[j]!, grid[j]![i]!]);
        }
    const quads: OptionValue[] = [];
    const colors: OptionValue[] = [];
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = index[j * nx + i]!;
        const b = index[j * nx + i + 1]!;
        const c = index[(j + 1) * nx + i + 1]!;
        const d = index[(j + 1) * nx + i]!;
        if (a < 0 || b < 0 || c < 0 || d < 0) continue;
        quads.push([a, b, c, d]);
        colors.push(
          fill(
            s,
            (height(grid[j]![i]!) +
              height(grid[j]![i + 1]!) +
              height(grid[j + 1]![i + 1]!) +
              height(grid[j + 1]![i]!)) /
              4,
          ),
        );
      }
    return graphicsComplex3d(
      polygon3d({ Indices: quads, FaceColors: colors, EdgeWidth: 0.5, ...(grids.length > 1 && { Opacity: 0.85 }) }),
      { Points: points },
    );
  });

  const options = chrome(o, range, "Fixed", { azimuth: 45, elevation: 15 }, description);
  if (o.colorLegend) {
    const steps = Array.from({ length: KEY_STEPS }, (_, k) =>
      grids.length === 1 ? rampColor(palette, 1 - k / KEY_STEPS) : shade(surfaceColors[0]!, 1 - k / KEY_STEPS),
    );
    options["PlotLegends"] = [steps, [label(Z.inv(zmax)), label(Z.inv(zmin))]];
  }
  return graphics3d(row(complexes), options);
}

/** `ListPlot3D`'s options. */
export interface MeshOptions extends Graphics3dOptions {
  /** Explicit z bounds for the height ramp; otherwise the data's own. */
  zRange?: readonly [number, number];
  /** Quad outlines only, unfilled. */
  wireframe?: boolean;
}

/**
 * A height grid as a quad mesh, `grid[j][i]` at (i, j): positions are the sample indices, shaded by
 * mean height on the gradient. A quad touching a non-finite sample is a hole rather than a spike.
 */
export function meshBox(grid: Grid, o: MeshOptions = {}): Box {
  const ny = grid.length;
  const nx = ny > 0 ? grid[0]!.length : 0;
  const description = "3-D surface plot";
  const defaults = { azimuth: 30, elevation: 25 };
  if (nx < 2 || ny < 2) return emptyBox(o, "Fit", defaults, description);
  const [zlo, zhi] = o.zRange ?? extent(grid.flat());
  const sz = unitScale(zlo, zhi);
  const gradient = gradientOf(o);

  const index = new Int32Array(nx * ny).fill(-1);
  const points: OptionValue[] = [];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++)
      if (Number.isFinite(grid[j]![i]!)) {
        index[j * nx + i] = points.length;
        points.push([i, j, grid[j]![i]!]);
      }
  const quads: OptionValue[] = [];
  const colors: OptionValue[] = [];
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const corners = [
        index[j * nx + i]!,
        index[j * nx + i + 1]!,
        index[(j + 1) * nx + i + 1]!,
        index[(j + 1) * nx + i]!,
      ];
      if (corners.some((c) => c < 0)) continue;
      const t = (sz(grid[j]![i]!) + sz(grid[j]![i + 1]!) + sz(grid[j + 1]![i + 1]!) + sz(grid[j + 1]![i]!)) / 4;
      quads.push(corners);
      colors.push(heightShade(t, gradient));
    }
  const options = chrome(
    o,
    [
      [0, nx - 1],
      [0, ny - 1],
      [zlo, zhi],
    ],
    "Fit",
    defaults,
    description,
  );
  return graphics3d(
    graphicsComplex3d(
      polygon3d({ Indices: quads, FaceColors: colors, EdgeWidth: 0.5, ...(o.wireframe && { Wireframe: true }) }),
      { Points: points },
    ),
    options,
  );
}

/** Height coloring: the gradient at height `t` in [0, 1]. */
export const heightShade = (t: number, gradient: Gradient): string =>
  sampleGradient(gradient, Number.isFinite(t) ? t : 0);

// ── Scatter ──────────────────────────────────────────────────────────────────────────────

/** `ListPlot3D` read as points. */
export interface ScatterOptions extends MeshOptions {
  /** Marker radius at the front of the figure (default 3.2). */
  size?: number;
  /** How much a far point shrinks and fades, 0 to 1 (default 0.45). */
  depthCue?: number;
}

/** Points in space, colored by height on the gradient; a marker's size and opacity fall off with depth. */
export function scatterBox(points: readonly Triple[], o: ScatterOptions = {}): Box {
  const usable = points.filter((p) => p.every(Number.isFinite));
  const description = "3-D point plot";
  const defaults = { azimuth: 30, elevation: 25 };
  if (usable.length === 0) return emptyBox(o, "Fit", defaults, description);
  const xr = extent(usable.map((p) => p[0]));
  const yr = extent(usable.map((p) => p[1]));
  const zr = o.zRange ?? extent(usable.map((p) => p[2]));
  const sz = unitScale(zr[0], zr[1]);
  const gradient = gradientOf(o);
  return graphics3d(
    point3d({
      Points: usable.map((p) => [...p]),
      PointColors: usable.map((p) => heightShade(sz(p[2]), gradient)),
      PointSize: o.size ?? 3.2,
      DepthCue: Math.max(0, Math.min(1, o.depthCue ?? 0.45)),
    }),
    chrome(o, [xr, yr, zr], "Fit", defaults, description),
  );
}

// ── Bars ─────────────────────────────────────────────────────────────────────────────────

/** `BarChart3D`'s options. */
export interface BarOptions extends Graphics3dOptions {
  /** Gap between neighboring bars, as a fraction of a cell (0 to 0.9, default 0.2). */
  gap?: number;
  /** Explicit height bounds; otherwise min(0, data) to the data's maximum. */
  zRange?: readonly [number, number];
  /** Category labels along each axis, at the near edges of the floor. */
  rowLabels?: readonly string[];
  colLabels?: readonly string[];
}

/**
 * `matrix[j][i]` as bars: the one in row `j`, column `i` stands on the zero plane (hangs below it
 * when negative) in its own cell, inset by `gap`. A non-finite value, or one on the zero plane,
 * draws no bar.
 */
export function barChart3dBox(matrix: Grid, o: BarOptions = {}): Box {
  const ny = matrix.length;
  const nx = ny > 0 ? matrix[0]!.length : 0;
  const description = "3-D bar chart";
  const defaults = { azimuth: 30, elevation: 25 };
  const flat = matrix.flat().filter(Number.isFinite);
  if (nx < 1 || ny < 1 || flat.length === 0) return emptyBox(o, "Fit", defaults, description);
  const zlo = o.zRange ? o.zRange[0] : Math.min(0, ...flat);
  const zhi = o.zRange ? o.zRange[1] : Math.max(...flat);
  const top = zhi === zlo ? zlo + 1 : zhi;
  const sz = unitScale(zlo, top);
  const gradient = gradientOf(o);
  const gap = Math.max(0, Math.min(0.9, o.gap ?? 0.2));
  const [cw, ch, inset0] = [1 / nx, 1 / ny, gap / 2];
  // Bars stand on z = 0 where the data straddles it, and hang below it when negative.
  const zero = Math.max(zlo, Math.min(top, 0));

  const items: Box[] = [];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const h = matrix[j]![i]!;
      if (!Number.isFinite(h)) continue;
      const hi = Math.max(zero, h);
      const lo = Math.min(zero, h);
      if (sz(hi) === sz(lo)) continue;
      items.push(
        cuboid({
          Min: [(i + inset0) * cw, (j + inset0) * ch, lo],
          Max: [(i + 1 - inset0) * cw, (j + 1 - inset0) * ch, hi],
          FaceForm: heightShade(sz(h), gradient),
        }),
      );
    }
  // Category labels sit just outside the floor, on its two near edges.
  o.colLabels
    ?.slice(0, nx)
    .forEach((text, i) =>
      items.push(inset(text, { Center: [(i + 0.5) * cw, 1.06, zlo], Size: 9, Opacity: 0.7, Anchor: "Center" })),
    );
  o.rowLabels
    ?.slice(0, ny)
    .forEach((text, j) =>
      items.push(inset(text, { Center: [1.06, (j + 0.5) * ch, zlo], Size: 9, Opacity: 0.7, Anchor: "Left" })),
    );
  return graphics3d(row(items), {
    ...chrome(
      o,
      [
        [0, 1],
        [0, 1],
        [zlo, top],
      ],
      "Fit",
      defaults,
      description,
    ),
    Axes: o.axes === false ? [false, false, false] : [false, false, true],
  });
}

// ── Curves ───────────────────────────────────────────────────────────────────────────────

/** A curve in space's options. */
export interface CurveOptions extends Graphics3dOptions {
  /** Stroke width of the curve itself, in viewBox units. */
  stroke?: number;
  /** Close the curve back to its first point (a knot is a loop). */
  closed?: boolean;
  /** Draw the torus the curve lies on, faintly, behind it. */
  torus?: { major: number; minor: number } | undefined;
  /** Mark one point, as a fraction of the way along the curve. */
  marker?: number | undefined;
}

/** The torus's mesh around the curve's origin: `rings` around the axis by `around` the tube. */
const TORUS_RINGS = 28;
const TORUS_AROUND = 40;

/**
 * A parametric curve in space. The curve is framed in a cube of its own, one scale for every axis so
 * the shape is not distorted; color runs along the parameter on the gradient (default `sinebow`, a
 * cyclic rainbow, so a closed knot has no seam). It carries `Casing`: the drawer lays a background
 * stroke under each arc, so the nearer strand erases the farther where they cross.
 */
export function curveBox(points: readonly Triple[], o: CurveOptions = {}): Box {
  const usable = points.filter((p) => p.every(Number.isFinite));
  const description = "curve in space";
  const defaults = { azimuth: 45, elevation: 25 };
  if (usable.length < 2) return emptyBox(o, "Fixed", defaults, description);
  const loop = o.closed === false ? usable : [...usable, usable[0]!];
  const spans = [0, 1, 2].map((k) => {
    const v = usable.map((p) => p[k]!);
    return [Math.min(...v), Math.max(...v)] as const;
  });
  // One scale for every axis: each range is as wide as the widest, about its own middle.
  const span = Math.max(...spans.map(([lo, hi]) => hi - lo), 1e-9);
  const around = (k: number): Range => {
    const [lo, hi] = spans[k]!;
    return [(lo + hi) / 2 - span / 2, (lo + hi) / 2 + span / 2];
  };
  const range: readonly [Range, Range, Range] = [around(0), around(1), around(2)];

  const palette = plotPalette(o, "sinebow");
  const items: Box[] = [];
  if (o.torus) {
    const { major, minor } = o.torus;
    const at = (u: number, v: number): OptionValue => {
      const r = major + minor * Math.cos(v);
      return [r * Math.cos(u), r * Math.sin(u), -minor * Math.sin(v)];
    };
    const points3: OptionValue[] = [];
    for (let i = 0; i < TORUS_RINGS; i++)
      for (let j = 0; j < TORUS_AROUND; j++)
        points3.push(at((2 * Math.PI * i) / TORUS_RINGS, (2 * Math.PI * j) / TORUS_AROUND));
    const index = (i: number, j: number): number => (i % TORUS_RINGS) * TORUS_AROUND + (j % TORUS_AROUND);
    const quads: OptionValue[] = [];
    for (let i = 0; i < TORUS_RINGS; i++)
      for (let j = 0; j < TORUS_AROUND; j++)
        quads.push([index(i, j), index(i + 1, j), index(i + 1, j + 1), index(i, j + 1)]);
    items.push(
      graphicsComplex3d(
        polygon3d({
          Indices: quads,
          FaceForm: "currentColor",
          Opacity: 0.045,
          EdgeWidth: 0.3,
          EdgeColor: "currentColor",
          EdgeOpacity: 0.05,
          Behind: true,
        }),
        { Points: points3 },
      ),
    );
  }
  items.push(
    line3d({
      Points: loop.map((p) => [...p]),
      VertexColors: loop.map((_, i) => rampColor(palette, i / (loop.length - 1))),
      Thickness: o.stroke ?? 2.4,
      Casing: true,
    }),
  );
  if (o.marker !== undefined && Number.isFinite(o.marker)) {
    const phase = ((o.marker % 1) + 1) % 1;
    // The loop closes by repeating its first point; index into the open curve, or a marker at
    // phase 1 lands a sample early.
    const open = loop.length - 1;
    items.push(
      point3d({
        Points: [[...loop[Math.round(phase * open) % open]!]],
        PointSize: o.stroke ?? 2.4,
        Role: "Marker",
        OnTop: true,
      }),
    );
  }
  return graphics3d(row(items), { ...chrome(o, range, "Fixed", defaults, description), Axes: false });
}

// ── A plot not yet sampled ───────────────────────────────────────────────────────────────

/** A plot of an expression, not yet sampled: its expression and what samples it (`Producer`). */
export function unsampledGraphics3dBox(head: string, expr: unknown): Box {
  return graphics3d(interpretation(row([]), expr as never), { Producer: head });
}

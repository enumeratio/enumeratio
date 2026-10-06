// A 2-D lattice drawn as tiles: the point i·e₁ + j·e₂ of the plane owns its Voronoi cell, a
// rectangle or a hexagon depending on the basis, and a layer says how each point is painted.
// What the points mean (a ring's elements, a residue class, a crystal) is the layer's; the
// framing, tiling, grid and colors are here, so any lattice draws the same way and overlays any
// other plot sharing its view.

import type { BandMode, Palette } from "./palettes.ts";
import { bandPosition, discreteColors, sampleGradient } from "./palettes.ts";

export type Vec2 = readonly [number, number];

/**
 * How a category is painted: along the palette's gradient by the coloring's value, in its own
 * color from the palette's discrete scheme (in the order the categories list them), or in one
 * of the ground's roles.
 */
export type LatticePaint = "gradient" | "discrete" | "own" | "foreground" | "muted" | "none";

export interface LatticeCategory {
  readonly code: number;
  readonly label: string;
  readonly paint: LatticePaint;
  /** A filled tile (the default), its outline, or a dashed outline — for "not known". */
  readonly style?: "fill" | "outline" | "dashed";
}

/** One way to color the points: what each point's category is, and for ramps its value. */
export interface LatticeColoring {
  readonly id: string;
  readonly label: string;
  readonly categories: readonly LatticeCategory[];
  /** The category code of (i, j), or undefined when there is no point there. */
  code(i: number, j: number): number | undefined;
  /** A scalar for "gradient" categories (a norm, a height), placed on the gradient by the band. */
  value?(i: number, j: number): number;
  /**
   * The color of an "own" category's point, which the layer mixes itself from `colors`: the
   * discrete colors the plot gave this coloring's categories, in their order.
   */
  color?(i: number, j: number, colors: readonly string[]): string;
  /** What `value` is, for the legend's scale: `√|N|`. */
  readonly valueLabel?: string;
  /** How values meet the gradient when the plot doesn't say: a cyclic quantity wraps. */
  readonly bandMode?: BandMode;
}

export interface LatticeDescription {
  readonly title: string;
  readonly rows: readonly (readonly [label: string, value: string])[];
}

export interface LatticeHighlightMode {
  readonly id: string;
  readonly label: string;
}

/** A draggable marker sitting on a lattice point: a base, a digit, a generator. */
export interface LatticeHandle {
  readonly id: string;
  readonly at: Vec2;
  readonly label: string;
}

/** A setting a layer offers, which the plot renders as a control. */
export interface LatticeControl {
  readonly id: string;
  readonly label: string;
  readonly kind: "button" | "toggle" | "select" | "number" | "text";
  readonly value?: string;
  readonly options?: readonly { readonly id: string; readonly label: string }[];
  readonly min?: number;
  readonly max?: number;
  readonly title?: string;
}

/** Caption prose: text, emphasis, or a choice the reader can change in place. */
export type LatticeCaptionPart =
  | string
  | { readonly strong: string }
  | {
      readonly choice: string;
      readonly value: string;
      readonly options: readonly { readonly id: string; readonly label: string }[];
    };

/** What a lattice plot asks of the thing it draws. */
export interface LatticeLayer {
  /**
   * `lattice` (the default) draws the points i·e₁ + j·e₂ the colorings name; `points` draws
   * `points()`, anywhere in the plane, and every per-point call takes (index, 0) — handles then
   * sit at plane coordinates and move freely.
   */
  readonly kind?: "lattice" | "points";
  points?(): readonly Vec2[];
  /** A heading for the whole lattice. */
  readonly title: string;
  /** Plane coordinates of the generators e₁ and e₂. */
  readonly basis: readonly [Vec2, Vec2];
  /** The largest |i| and |j| the layer can answer exactly. */
  readonly maxIndex: number;
  readonly colorings: readonly LatticeColoring[];
  /** Whether coloring (i, j) costs nothing, so a frame out of time budget may still draw it. */
  known(i: number, j: number): boolean;
  /** Points drawn filled even where their category is drawn in outline. */
  emphasized?(i: number, j: number): boolean;
  /** Text to print inside a tile when tiles are large enough to hold it. */
  label?(i: number, j: number): string | undefined;
  /** The grid's generators, in lattice coordinates, and how a multiple of each is labelled. */
  readonly grid: readonly [Vec2, Vec2];
  gridLabel(axis: 0 | 1, k: number): string;
  readonly highlightModes: readonly LatticeHighlightMode[];
  /** Whether (i, j) stands in the given relation to the selected point. */
  related(mode: string, selected: Vec2, i: number, j: number): boolean;
  describe(i: number, j: number): LatticeDescription;
  /** Where to frame the lattice when the plot is given no view: around its points, say. */
  home?(): LatticeView;
  handles?(): readonly LatticeHandle[];
  /** Move a handle to a lattice point (or a plane point, for `points`); false when refused. */
  moveHandle?(id: string, to: Vec2): boolean;
  controls?(): readonly LatticeControl[];
  /** Apply a control's new value (a button's is ""); false when refused. */
  setControl?(id: string, value: string): boolean;
  /** Where the legend reads best when the plot doesn't say: `right` for a long list of digits. */
  readonly legendPlacement?: string;
  /** Prose describing the current configuration, for the caption. */
  caption?(): readonly LatticeCaptionPart[];
  /** Facts about the whole lattice, for the caption when nothing is selected. */
  summary?(): readonly (readonly [string, string])[];
}

/** Where a point sits in the plane: (i, j), or (index, 0) on a point layer. */
export const latticePointOf = (layer: LatticeLayer, [i, j]: Vec2): Vec2 =>
  layer.kind === "points" ? (layer.points?.()[i] ?? [0, 0]) : latticePoint(layer.basis, i, j);

/** Where a handle sits in the plane. */
export const handlePoint = (layer: LatticeLayer, handle: LatticeHandle): Vec2 =>
  layer.kind === "points" ? handle.at : latticePoint(layer.basis, handle.at[0], handle.at[1]);

/** A view of the plane: the center and the half-height shown, as `ComplexPlotView` frames it. */
export interface LatticeView {
  readonly center: Vec2;
  readonly extent: number;
}

const dot = (a: Vec2, b: Vec2): number => a[0] * b[0] + a[1] * b[1];
const scale = (a: Vec2, k: number): Vec2 => [a[0] * k, a[1] * k];
const plus = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
const minus = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];

export const latticePoint = (basis: readonly [Vec2, Vec2], i: number, j: number): Vec2 =>
  plus(scale(basis[0], i), scale(basis[1], j));

/** (i, j) with i·e₁ + j·e₂ = p, as reals. */
export function latticeCoordinates(basis: readonly [Vec2, Vec2], p: Vec2): Vec2 {
  const [[a, c], [b, d]] = basis;
  const det = a * d - b * c;
  return [(p[0] * d - p[1] * b) / det, (p[1] * a - p[0] * c) / det];
}

export const cellArea = (basis: readonly [Vec2, Vec2]): number =>
  Math.abs(basis[0][0] * basis[1][1] - basis[0][1] * basis[1][0]);

/**
 * The Voronoi cell of the origin: the polygon of points nearer 0 than any other lattice point.
 * After Lagrange reduction the neighbors that matter are ±b₁, ±b₂ and ±(b₁ ∓ b₂), so clipping a
 * box by their bisectors gives a rectangle for an orthogonal basis and a hexagon otherwise.
 */
export function voronoiCell(basis: readonly [Vec2, Vec2]): Vec2[] {
  let [u, v] = basis;
  for (let steps = 0; steps < 64; steps++) {
    if (dot(u, u) > dot(v, v)) [u, v] = [v, u];
    const k = Math.round(dot(u, v) / dot(u, u));
    if (k === 0) break;
    v = minus(v, scale(u, k));
  }
  const neighbors = [u, v, minus(v, u), plus(u, v)].flatMap((w) => [w, scale(w, -1)]);
  const r = Math.sqrt(dot(u, u) + dot(v, v)) * 2;
  let polygon: Vec2[] = [
    [-r, -r],
    [r, -r],
    [r, r],
    [-r, r],
  ];
  for (const w of neighbors) {
    const limit = dot(w, w) / 2;
    const next: Vec2[] = [];
    for (let k = 0; k < polygon.length; k++) {
      const p = polygon[k]!;
      const q = polygon[(k + 1) % polygon.length]!;
      const [fp, fq] = [dot(p, w) - limit, dot(q, w) - limit];
      if (fp <= 0) next.push(p);
      if (fp < 0 !== fq < 0 && fp !== fq) next.push(plus(p, scale(minus(q, p), fp / (fp - fq))));
    }
    polygon = next;
  }
  return polygon;
}

/** The index box covering a view of `width`×`height` pixels, one cell of margin. */
export function visibleRange(basis: readonly [Vec2, Vec2], view: LatticeView, aspect: number): { i: Vec2; j: Vec2 } {
  const [cx, cy] = view.center;
  const [hw, hh] = [view.extent * aspect, view.extent];
  const corners = [
    [cx - hw, cy - hh],
    [cx + hw, cy - hh],
    [cx + hw, cy + hh],
    [cx - hw, cy + hh],
  ].map((p) => latticeCoordinates(basis, p as unknown as Vec2));
  const is = corners.map((c) => c[0]);
  const js = corners.map((c) => c[1]);
  return {
    i: [Math.floor(Math.min(...is)) - 1, Math.ceil(Math.max(...is)) + 1],
    j: [Math.floor(Math.min(...js)) - 1, Math.ceil(Math.max(...js)) + 1],
  };
}

/** The largest half-height whose view holds at most `maxCells` lattice points. */
export const maxExtentFor = (basis: readonly [Vec2, Vec2], aspect: number, maxCells: number): number =>
  Math.sqrt((maxCells * cellArea(basis)) / (4 * aspect));

/**
 * Keep a view inside what a layer can answer and a cell budget: the extent between a few cells
 * and the budget's, the center within the layer's exact index range.
 */
export function clampLatticeView(
  layer: Pick<LatticeLayer, "basis" | "maxIndex">,
  view: LatticeView,
  aspect: number,
  maxCells: number,
): LatticeView {
  const unit = Math.sqrt(cellArea(layer.basis));
  const extent = Math.min(Math.max(view.extent, 1.5 * unit), maxExtentFor(layer.basis, aspect, maxCells));
  const shortest = Math.min(Math.hypot(...layer.basis[0]), Math.hypot(...layer.basis[1]));
  const radius = Math.max(0, layer.maxIndex * shortest * 0.5 - extent * Math.max(aspect, 1));
  const [cx, cy] = view.center;
  const r = Math.hypot(cx, cy);
  const center: Vec2 = r > radius ? [(cx * radius) / r, (cy * radius) / r] : [cx, cy];
  return { center, extent };
}

export interface LatticeDrawOptions {
  readonly palette: Palette;
  /** The coloring to paint by; the layer's first when absent or unknown. */
  readonly coloring?: string;
  /** Grid spacing in multiples of the grid generators; 0 hides the grid lines. */
  readonly gridStep: number;
  /** Draw the two axes and their labels (default true), grid or no grid. */
  readonly axes?: boolean;
  /** Fraction of a cell the tile fills; the rest is the gap between tiles. */
  readonly fill: number;
  /** Paint over the background or leave it transparent, for an overlay. */
  readonly transparent: boolean;
  /** The value between the gradient's two ends, and how values past it meet the gradient. */
  readonly band: number;
  readonly bandMode?: BandMode;
  /** Shifts every value by this many bands, for animating the gradient. */
  readonly phase: number;
  readonly selected?: Vec2;
  readonly highlight?: string;
  /** Draw the layer's handles. */
  readonly handles?: boolean;
  /** Stop computing new points once this many ms have passed; the caller redraws later. */
  readonly budgetMs: number;
}

/** Tiles narrower than this many device pixels are drawn as squares, and never labelled. */
const TINY_TILE = 3;
const LABEL_TILE = 34;

export const coloringOf = (layer: LatticeLayer, id: string | undefined): LatticeColoring =>
  layer.colorings.find((c) => c.id === id) ?? layer.colorings[0]!;

/** The color of each category whose color doesn't depend on the point. */
export function latticeCategoryColors(coloring: LatticeColoring, palette: Palette): Map<number, string> {
  const categories = coloring.categories;
  const own = (c: LatticeCategory) => c.paint === "discrete" || c.paint === "own";
  const scheme = discreteColors(palette, categories.filter(own).length);
  const colors = new Map<number, string>();
  let next = 0;
  for (const c of categories) {
    if (own(c)) colors.set(c.code, scheme[next++]!);
    else if (c.paint === "foreground" || c.paint === "muted") colors.set(c.code, palette[c.paint]);
  }
  return colors;
}

/** Where a value falls on the gradient under these options. */
export const gradientPosition = (
  coloring: LatticeColoring,
  options: Pick<LatticeDrawOptions, "band" | "bandMode" | "phase">,
  value: number,
): number =>
  bandPosition(value + options.phase * options.band, options.band, options.bandMode ?? coloring.bandMode ?? "reflect");

export interface LatticeFrame {
  /** Every visible point was drawn; when not, the caller draws again on a later frame. */
  readonly complete: boolean;
  /** The category codes on screen, for a legend. */
  readonly codes: ReadonlySet<number>;
}

/** Draw a lattice into a 2-D context of `width`×`height` device pixels. */
export function drawLattice(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layer: LatticeLayer,
  view: LatticeView,
  options: LatticeDrawOptions,
): LatticeFrame {
  const { palette } = options;
  const aspect = width / height;
  const pixels = height / (2 * view.extent);
  const toScreen = (p: Vec2): Vec2 => [
    (p[0] - view.center[0]) * pixels + width / 2,
    height / 2 - (p[1] - view.center[1]) * pixels,
  ];

  ctx.clearRect(0, 0, width, height);
  if (!options.transparent) {
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, width, height);
  }

  const range = visibleRange(layer.basis, view, aspect);
  const shape = voronoiCell(layer.basis).map((p) => scale([p[0], -p[1]], pixels * options.fill));
  const size = Math.sqrt(cellArea(layer.basis)) * pixels;
  const tiny = size < TINY_TILE;
  const half = (size * options.fill) / 2;
  const fills = new Map<string, Path2D>();
  const outlines = new Map<string, Path2D>();
  const dashed = new Map<string, Path2D>();
  const pathIn = (paths: Map<string, Path2D>, color: string): Path2D => {
    let path = paths.get(color);
    if (path === undefined) paths.set(color, (path = new Path2D()));
    return path;
  };
  const addTile = (path: Path2D, x: number, y: number): void => {
    if (tiny) {
      path.rect(x - half, y - half, 2 * half, 2 * half);
      return;
    }
    path.moveTo(x + shape[0]![0], y + shape[0]![1]);
    for (let k = 1; k < shape.length; k++) path.lineTo(x + shape[k]![0], y + shape[k]![1]);
    path.closePath();
  };

  const coloring = coloringOf(layer, options.coloring);
  const categories = new Map(coloring.categories.map((c) => [c.code, c]));
  const fixed = latticeCategoryColors(coloring, palette);
  const ownColors = coloring.categories.map((c) => fixed.get(c.code) ?? palette.muted);
  const gradientColor = (i: number, j: number): string =>
    sampleGradient(palette.gradient, gradientPosition(coloring, options, coloring.value?.(i, j) ?? 0));

  const deadline = performance.now() + options.budgetMs;
  let complete = true;
  const codes = new Set<number>();
  const highlighted = new Path2D();
  const labels: [number, number, string, string][] = [];
  const labelling = layer.label !== undefined && size * options.fill >= LABEL_TILE;
  const margin = 2 * half + 2;
  const limit = layer.maxIndex;
  const [i0, i1] = [Math.max(range.i[0], -limit), Math.min(range.i[1], limit)];
  const [j0, j1] = [Math.max(range.j[0], -limit), Math.min(range.j[1], limit)];
  // Center outwards, so that a budget-limited first frame fills in from where the reader looks.
  const center = latticeCoordinates(layer.basis, view.center).map(Math.round) as [number, number];
  const rows = Array.from({ length: Math.max(0, j1 - j0 + 1) }, (_, k) => j0 + k).toSorted(
    (a, b) => Math.abs(a - center[1]) - Math.abs(b - center[1]),
  );
  // One point: (i, j) are its lattice coordinates, or (index, 0) for a point layer.
  const visit = (i: number, j: number, x: number, y: number): void => {
    if (x < -margin || x > width + margin || y < -margin || y > height + margin) return;
    if (!layer.known(i, j) && performance.now() > deadline) {
      complete = false;
      return;
    }
    const code = coloring.code(i, j);
    if (code === undefined) return;
    codes.add(code);
    const category = categories.get(code);
    if (category !== undefined && category.paint !== "none") {
      const color =
        category.paint === "gradient"
          ? gradientColor(i, j)
          : category.paint === "own"
            ? (coloring.color?.(i, j, ownColors) ?? palette.muted)
            : fixed.get(code)!;
      const outline = category.style !== undefined && category.style !== "fill" && !tiny && !layer.emphasized?.(i, j);
      addTile(pathIn(!outline ? fills : category.style === "dashed" ? dashed : outlines, color), x, y);
      if (labelling) {
        const text = layer.label!(i, j);
        if (text !== undefined) labels.push([x, y, text, outline ? color : palette.background]);
      }
    }
    if (options.selected && options.highlight && layer.related(options.highlight, options.selected, i, j)) {
      addTile(highlighted, x, y);
    }
  };
  if (layer.kind === "points") {
    const points = layer.points?.() ?? [];
    for (let k = 0; k < points.length; k++) {
      const [x, y] = toScreen(points[k]!);
      visit(k, 0, x, y);
    }
  } else {
    for (const j of rows) {
      for (let i = i0; i <= i1; i++) {
        const [x, y] = toScreen(latticePoint(layer.basis, i, j));
        visit(i, j, x, y);
      }
    }
  }
  for (const [color, path] of fills) {
    ctx.fillStyle = color;
    ctx.fill(path);
  }
  ctx.lineWidth = Math.max(1, size * 0.08);
  for (const [color, path] of outlines) {
    ctx.strokeStyle = color;
    ctx.stroke(path);
  }
  ctx.setLineDash([Math.max(2, size * 0.12), Math.max(2, size * 0.1)]);
  for (const [color, path] of dashed) {
    ctx.strokeStyle = color;
    ctx.stroke(path);
  }
  ctx.setLineDash([]);
  if (labels.length > 0) drawLabels(ctx, labels, half);

  drawGrid(ctx, width, height, layer, view, options, toScreen, pixels);

  if (options.selected && options.highlight) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = palette.highlight;
    ctx.fill(highlighted);
    ctx.restore();
    ctx.lineWidth = Math.max(1, Math.min(3, half / 4));
    ctx.strokeStyle = palette.highlight;
    ctx.stroke(highlighted);
  }
  if (options.selected) {
    const ring = new Path2D();
    const [x, y] = toScreen(latticePointOf(layer, options.selected));
    addTile(ring, x, y);
    ctx.lineWidth = Math.max(2, Math.min(4, half / 3));
    ctx.strokeStyle = palette.background;
    ctx.stroke(ring);
    ctx.lineWidth = Math.max(1, Math.min(2.5, half / 5));
    ctx.strokeStyle = palette.foreground;
    ctx.stroke(ring);
  }
  if (options.handles) drawHandles(ctx, layer, palette, toScreen, half);
  return { complete, codes };
}

function drawLabels(
  ctx: CanvasRenderingContext2D,
  labels: readonly [number, number, string, string][],
  half: number,
): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const font = (px: number) => `${Math.round(px)}px system-ui, sans-serif`;
  for (const [x, y, text, color] of labels) {
    let px = half * 0.6;
    ctx.font = font(px);
    const width = ctx.measureText(text).width;
    if (width > half * 1.7) ctx.font = font((px *= (half * 1.7) / width));
    if (px < 7) continue;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}

/** Handle markers: a ring on the point, its label beside it. */
function drawHandles(
  ctx: CanvasRenderingContext2D,
  layer: LatticeLayer,
  palette: Palette,
  toScreen: (p: Vec2) => Vec2,
  half: number,
): void {
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  const radius = Math.max(7 * dpr, half * 0.9);
  ctx.save();
  ctx.font = `${Math.round(12 * dpr)}px system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  for (const handle of layer.handles?.() ?? []) {
    const [x, y] = toScreen(handlePoint(layer, handle));
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.lineWidth = 3 * dpr;
    ctx.strokeStyle = palette.background;
    ctx.stroke();
    ctx.lineWidth = 1.5 * dpr;
    ctx.strokeStyle = palette.highlight;
    ctx.stroke();
    ctx.fillStyle = palette.foreground;
    ctx.fillText(handle.label, x + radius + 4 * dpr, y - radius);
  }
  ctx.restore();
}

/** The handle within `slop` device pixels of a screen point, nearest first. */
export function handleAt(
  layer: LatticeLayer,
  view: LatticeView,
  width: number,
  height: number,
  screen: Vec2,
  slop: number,
): LatticeHandle | undefined {
  const pixels = height / (2 * view.extent);
  let best: LatticeHandle | undefined;
  let bestDistance = slop;
  for (const handle of layer.handles?.() ?? []) {
    const p = handlePoint(layer, handle);
    const x = (p[0] - view.center[0]) * pixels + width / 2;
    const y = height / 2 - (p[1] - view.center[1]) * pixels;
    const distance = Math.hypot(x - screen[0], y - screen[1]);
    if (distance <= bestDistance) [best, bestDistance] = [handle, distance];
  }
  return best;
}

/** The grid's own step when it has none (hidden), for spacing the axis labels. */
const LABEL_STEP = 10;
/** Least room, in device pixels, between neighboring axis labels. */
const LABEL_ROOM = 56;

/**
 * Grid lines through every `gridStep`-th multiple of each grid generator, the two axes through 0,
 * and labels along the axes — each part on its own: a hidden grid keeps its axes. Labels go on
 * last, over every line, and thin out (every 2nd, 5th, 10th…) where they would crowd.
 */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layer: LatticeLayer,
  view: LatticeView,
  options: LatticeDrawOptions,
  toScreen: (p: Vec2) => Vec2,
  pixels: number,
): void {
  const { palette } = options;
  const showGrid = options.gridStep > 0;
  const showAxes = options.axes !== false;
  if (!showGrid && !showAxes) return;
  const stepSize = showGrid ? options.gridStep : LABEL_STEP;
  const generators = layer.grid.map((g) => latticePoint(layer.basis, g[0], g[1])) as [Vec2, Vec2];
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  const aspect = width / height;
  const reach = Math.hypot(view.extent * aspect, view.extent) * 1.05;
  const labels: [number, number, string][] = [];
  const line = (from: Vec2, to: Vec2, axis: boolean): void => {
    const [a, b] = [toScreen(from), toScreen(to)];
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineWidth = (axis ? 2 : 1) * dpr;
    ctx.strokeStyle = palette.grid;
    ctx.globalAlpha = axis ? 1 : 0.8;
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  ctx.save();
  for (const axis of [0, 1] as const) {
    const step = scale(generators[axis], stepSize);
    const along = generators[1 - axis]!;
    const alongUnit = scale(along, 1 / Math.hypot(...along));
    // Line k sits at signed distance k·(step·n) from the origin; keep those within reach of the view.
    const normal: Vec2 = [-alongUnit[1], alongUnit[0]];
    const spacing = dot(step, normal);
    const [from, to] = [(dot(view.center, normal) - reach) / spacing, (dot(view.center, normal) + reach) / spacing];
    const room = Math.abs(dot(step, step) / Math.hypot(...step)) * pixels;
    const stride = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find((n) => n * room >= LABEL_ROOM * dpr) ?? 1000;
    for (let k = Math.ceil(Math.min(from, to)); k <= Math.floor(Math.max(from, to)); k++) {
      const base = scale(step, k);
      const foot = plus(base, scale(alongUnit, dot(minus(view.center, base), alongUnit)));
      if (k === 0 ? showAxes : showGrid && Math.abs(spacing) * pixels >= 6) {
        line(plus(foot, scale(alongUnit, -reach)), plus(foot, scale(alongUnit, reach)), k === 0);
      }
      // Label where this line meets the other axis.
      if (!showAxes || k === 0 || k % stride !== 0) continue;
      const [lx, ly] = toScreen(base);
      if (lx < 0 || lx > width || ly < 0 || ly > height) continue;
      labels.push([lx, ly, layer.gridLabel(axis, k * stepSize)]);
    }
  }
  ctx.font = `${Math.round(11 * dpr)}px system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  for (const [lx, ly, text] of labels) {
    const w = ctx.measureText(text).width;
    ctx.fillStyle = palette.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(lx - w / 2 - 3 * dpr, ly - 8 * dpr, w + 6 * dpr, 16 * dpr);
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.foreground;
    ctx.fillText(text, lx - w / 2, ly);
  }
  ctx.restore();
}

/** The lattice point nearest a plane point. */
export function nearestLatticePoint(basis: readonly [Vec2, Vec2], p: Vec2): Vec2 {
  const [fi, fj] = latticeCoordinates(basis, p);
  let best: Vec2 = [Math.round(fi), Math.round(fj)];
  let bestDistance = Infinity;
  for (const di of [-1, 0, 1]) {
    for (const dj of [-1, 0, 1]) {
      const candidate: Vec2 = [Math.round(fi) + di, Math.round(fj) + dj];
      const q = minus(latticePoint(basis, candidate[0], candidate[1]), p);
      const distance = dot(q, q);
      if (distance < bestDistance) [best, bestDistance] = [candidate, distance];
    }
  }
  return best;
}

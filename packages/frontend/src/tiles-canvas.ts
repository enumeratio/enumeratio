// Drawing a tile layer onto a canvas: each element styled by its rules (`graphics-rules.ts`),
// faces batched by the color they mix to, edges stroked inside one another in rule order, and
// new elements computed only within a frame's budget, centre outwards.

import {
  type BoundaryRule,
  type ColorMixing,
  type ColorRule,
  type ElementFacts,
  styleElement,
  valueOf,
} from "./graphics-rules.ts";
import { latticeCoordinates, latticePoint, type LatticeView, type Vec2, visibleRange, voronoiCell } from "./lattice.ts";

/** What a tile layer answers about its elements, for rules. */
export interface TileLayer {
  readonly basis: readonly [Vec2, Vec2];
  readonly maxIndex: number;
  /** Whether point (i, j) is classified already, so drawing it costs nothing. */
  known(i: number, j: number): boolean;
  /** Classify point (i, j) now. */
  prepare(i: number, j: number): void;
  has(i: number, j: number, property: string): boolean | undefined;
  value(i: number, j: number, name: string): number | undefined;
  relatedTo(relation: string, selected: Vec2, i: number, j: number): boolean;
}

export interface TileDrawOptions {
  readonly colorRules: readonly ColorRule[];
  readonly boundaryRules: readonly BoundaryRule[];
  readonly colorMixing: ColorMixing;
  readonly selection: readonly Vec2[];
  /** Fraction of a cell its tile fills. */
  readonly fill: number;
  /** Shifts every scheme by this many bands, to animate it. */
  readonly phase: number;
  /** Stop classifying new points once this many ms have passed; the caller draws again. */
  readonly budgetMs: number;
}

/** Tiles narrower than this many device pixels are drawn as squares, with no edges. */
const TINY_TILE = 3;

type ValueReader = (base: (name: string) => number | undefined) => number | undefined;

/** Draw a tile layer; whether every visible point was drawn. Clears nothing: layers stack. */
export function drawTiles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layer: TileLayer,
  view: LatticeView,
  options: TileDrawOptions,
): boolean {
  const pixels = height / (2 * view.extent);
  const toScreen = (p: Vec2): Vec2 => [
    (p[0] - view.center[0]) * pixels + width / 2,
    height / 2 - (p[1] - view.center[1]) * pixels,
  ];
  const area = Math.abs(layer.basis[0][0] * layer.basis[1][1] - layer.basis[0][1] * layer.basis[1][0]);
  const size = Math.sqrt(area) * pixels;
  const tiny = size < TINY_TILE;
  const half = (size * options.fill) / 2;
  const shape = voronoiCell(layer.basis).map(
    ([x, y]) => [x * pixels * options.fill, -y * pixels * options.fill] as Vec2,
  );
  const tile = (path: Path2D, x: number, y: number, inset = 0): void => {
    if (tiny) {
      path.rect(x - half, y - half, 2 * half, 2 * half);
      return;
    }
    // Shrink the cell toward its centre by `inset` device pixels, for nested edges.
    const k = half > 0 ? Math.max(0, 1 - inset / half) : 1;
    path.moveTo(x + shape[0]![0] * k, y + shape[0]![1] * k);
    for (let n = 1; n < shape.length; n++) path.lineTo(x + shape[n]![0] * k, y + shape[n]![1] * k);
    path.closePath();
  };

  // Value readers once per gradient, not per point.
  const readers = new Map<unknown, ValueReader | undefined>();
  const readerFor = (json: unknown): ValueReader | undefined => {
    if (!readers.has(json)) readers.set(json, valueOf(json));
    return readers.get(json);
  };

  const fills = new Map<string, Path2D>();
  const edges = new Map<string, Path2D>();
  const pathIn = (paths: Map<string, Path2D>, key: string): Path2D => {
    let path = paths.get(key);
    if (path === undefined) paths.set(key, (path = new Path2D()));
    return path;
  };

  const selected = new Set(options.selection.map(([i, j]) => `${i},${j}`));
  const range = visibleRange(layer.basis, view, width / height);
  const limit = layer.maxIndex;
  const [i0, i1] = [Math.max(range.i[0], -limit), Math.min(range.i[1], limit)];
  const [j0, j1] = [Math.max(range.j[0], -limit), Math.min(range.j[1], limit)];
  const centre = latticeCoordinates(layer.basis, view.center).map(Math.round) as [number, number];
  const rows = Array.from({ length: Math.max(0, j1 - j0 + 1) }, (_, k) => j0 + k).toSorted(
    (a, b) => Math.abs(a - centre[1]) - Math.abs(b - centre[1]),
  );
  const margin = 2 * half + 2;
  const deadline = performance.now() + options.budgetMs;
  let complete = true;

  for (const j of rows) {
    for (let i = i0; i <= i1; i++) {
      const [x, y] = toScreen(latticePoint(layer.basis, i, j));
      if (x < -margin || x > width + margin || y < -margin || y > height + margin) continue;
      if (!layer.known(i, j)) {
        if (performance.now() > deadline) {
          complete = false;
          continue;
        }
        layer.prepare(i, j);
      }
      const facts: ElementFacts = {
        has: (p) => layer.has(i, j, p) ?? false,
        related: (r) => options.selection.some((s) => layer.relatedTo(r, s, i, j)),
        selected: selected.has(`${i},${j}`),
      };
      const style = styleElement(
        options.colorRules,
        options.boundaryRules,
        options.colorMixing,
        facts,
        (json) => readerFor(json)?.((name) => layer.value(i, j, name)),
        options.phase,
      );
      if (style.color) tile(pathIn(fills, style.color), x, y);
      if (tiny) continue;
      let inset = 0;
      for (const e of style.edges) {
        const w = e.width * dprOf();
        tile(pathIn(edges, `${e.color}|${w}|${e.opacity}|${e.dashing.join(",")}`), x, y, inset + w / 2);
        inset += w;
      }
    }
  }

  ctx.save();
  for (const [color, path] of fills) {
    ctx.fillStyle = color;
    ctx.fill(path);
  }
  for (const [key, path] of edges) {
    const [color, w, opacity, dashing] = key.split("|");
    ctx.strokeStyle = color!;
    ctx.lineWidth = Number(w);
    ctx.globalAlpha = Number(opacity);
    ctx.setLineDash(dashing ? dashing.split(",").map((d) => Number(d) * dprOf()) : []);
    ctx.stroke(path);
  }
  ctx.restore();
  return complete;
}

export interface LineStyle {
  readonly color: string;
  /** CSS pixels. */
  readonly width: number;
  readonly opacity: number;
}

/** Device pixels per CSS pixel, capped as the canvases are. */
const dprOf = (): number => Math.min(globalThis.devicePixelRatio || 1, 2);

/**
 * The lines of a coarser lattice: through every `step`-th multiple of each generator (given in
 * lattice coordinates), parallel to the other. With `origin`, only the two lines through 0 (the
 * axes). Lines closer than a few pixels are skipped rather than smeared into a wash.
 */
export function drawLatticeLines(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  basis: readonly [Vec2, Vec2],
  generators: readonly [Vec2, Vec2],
  view: LatticeView,
  step: number,
  style: LineStyle,
  origin = false,
): void {
  const pixels = height / (2 * view.extent);
  const toScreen = (p: Vec2): Vec2 => [
    (p[0] - view.center[0]) * pixels + width / 2,
    height / 2 - (p[1] - view.center[1]) * pixels,
  ];
  const reach = Math.hypot((view.extent * width) / height, view.extent) * 1.05;
  const g = generators.map((v) => latticePoint(basis, v[0], v[1])) as [Vec2, Vec2];
  const dpr = dprOf();
  ctx.save();
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width * dpr;
  ctx.globalAlpha = style.opacity;
  ctx.beginPath();
  for (const axis of [0, 1] as const) {
    const along = g[1 - axis]!;
    const unit: Vec2 = [along[0] / Math.hypot(...along), along[1] / Math.hypot(...along)];
    const normal: Vec2 = [-unit[1], unit[0]];
    const stepVec: Vec2 = [g[axis]![0] * step, g[axis]![1] * step];
    const spacing = stepVec[0] * normal[0] + stepVec[1] * normal[1];
    if (!origin && Math.abs(spacing) * pixels < 6) continue;
    const c = view.center[0] * normal[0] + view.center[1] * normal[1];
    const [from, to] = origin
      ? [0, 0]
      : [
          Math.ceil(Math.min((c - reach) / spacing, (c + reach) / spacing)),
          Math.floor(Math.max((c - reach) / spacing, (c + reach) / spacing)),
        ];
    for (let k = from; k <= to; k++) {
      const base: Vec2 = [stepVec[0] * k, stepVec[1] * k];
      const t = (view.center[0] - base[0]) * unit[0] + (view.center[1] - base[1]) * unit[1];
      const foot: Vec2 = [base[0] + unit[0] * t, base[1] + unit[1] * t];
      const a = toScreen([foot[0] - unit[0] * reach, foot[1] - unit[1] * reach]);
      const b = toScreen([foot[0] + unit[0] * reach, foot[1] + unit[1] * reach]);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** Least room, in CSS pixels, between neighboring axis labels. */
const LABEL_ROOM = 56;

/**
 * Labels along both axes at multiples of `step`, each on a halo of the opposite lightness so it
 * reads over any tile; thinned (every 2nd, 5th, 10th…) where they would crowd.
 */
export function drawAxisLabels(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  basis: readonly [Vec2, Vec2],
  generators: readonly [Vec2, Vec2],
  view: LatticeView,
  step: number,
  label: (axis: 0 | 1, k: number) => string,
  style: { readonly color: string; readonly halo: string; readonly opacity: number },
): void {
  const pixels = height / (2 * view.extent);
  const toScreen = (p: Vec2): Vec2 => [
    (p[0] - view.center[0]) * pixels + width / 2,
    height / 2 - (p[1] - view.center[1]) * pixels,
  ];
  const g = generators.map((v) => latticePoint(basis, v[0], v[1])) as [Vec2, Vec2];
  const dpr = dprOf();
  const reach = Math.hypot((view.extent * width) / height, view.extent);
  ctx.save();
  ctx.font = `${Math.round(11 * dpr)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.globalAlpha = style.opacity;
  for (const axis of [0, 1] as const) {
    const v = g[axis]!;
    const room = Math.hypot(...v) * step * pixels;
    const stride = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find((n) => n * room >= LABEL_ROOM * dpr) ?? 1000;
    const kMax = Math.ceil((reach + Math.hypot(...view.center)) / (Math.hypot(...v) * step));
    for (let k = -kMax; k <= kMax; k++) {
      if (k === 0 || k % stride !== 0) continue;
      const [x, y] = toScreen([v[0] * step * k, v[1] * step * k]);
      if (x < 0 || x > width || y < 0 || y > height) continue;
      const text = label(axis, k * step);
      ctx.lineWidth = 3 * dpr;
      ctx.strokeStyle = style.halo;
      ctx.strokeText(text, x, y);
      ctx.fillStyle = style.color;
      ctx.fillText(text, x, y);
    }
  }
  ctx.restore();
}

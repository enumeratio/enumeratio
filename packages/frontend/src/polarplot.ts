// A polar plot as a `GraphicsBox`: (θ, r) samples lower to a curve in Cartesian coordinates (a
// `LineBox`, a `PolygonBox` when filled, a `PointBox` for a list's markers), with the outer radius
// as `PlotRange` and the grid as `PolarAxes`. Equal aspect (a circle stays a circle) and no
// randomness, so the output is deterministic. The element layer evaluates r(θ) with the compute
// engine and hands this module plain numbers, exactly as contour.ts takes a sampled grid.

import {
  type Box,
  type BoxNode,
  graphics,
  isNode,
  line,
  type Options,
  type OptionValue,
  optionsOfBox,
  point,
  polygon,
  row,
  style,
  tag,
} from "@enumeratio/boxes";
import type { Edge } from "./graphics-rules.ts";
import { label, type PlotFrame } from "./plot-box.ts";
import { runsThrough, samplesFor } from "./plot.ts";
import { svg } from "./svg-draw.ts";
import type { DisplayList, GraphicsPrimitive, MarkItem } from "./tiles-canvas.ts";

const ACCENT = "var(--notatio-accent, var(--vp-c-brand-1, #d97706))";
const AXIS = "var(--notatio-border, var(--vp-c-divider, currentColor))";
const FG = "var(--notatio-fg, currentColor)";

export interface PolarPoint {
  theta: number;
  r: number;
}

/** Polar → Cartesian. A negative `r` points the opposite way, as in Wolfram. */
export function polarToCartesian(theta: number, r: number): { x: number; y: number } {
  return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
}

/**
 * Sample `f` at `n` evenly spaced angles across `[t0, t1]` (both endpoints
 * included). Non-finite radii are kept as-is -- the renderer turns them into
 * gaps rather than dropping them, so a pole doesn't join two branches.
 */
export function samplePolar(f: (theta: number) => number, t0: number, t1: number, n: number): PolarPoint[] {
  const count = Math.max(2, Math.round(n));
  return Array.from({ length: count }, (_, i) => {
    const theta = t0 + ((t1 - t0) * i) / (count - 1);
    let r: number;
    try {
      r = f(theta);
    } catch {
      r = Number.NaN;
    }
    return { theta, r: typeof r === "number" ? r : Number.NaN };
  });
}

export interface PolarPlotOptions {
  width?: number;
  height?: number;
  /** Draw the polar grid: rings plus 30° spokes (default true). */
  axes?: boolean;
  /** Close the path back to its first point (default false). */
  closed?: boolean;
  /** Fill the enclosed region under the curve (default false). */
  filled?: boolean;
  /** Draw a dot at each sample -- the ListPolarPlot look (default false). */
  markers?: boolean;
  /** Explicit outer radius; otherwise the largest sampled |r|. */
  max?: number;
  title?: string;
  /** A zoomed view: the square of the plane shown (it clips what lies past it). Overrides the outer radius. */
  window?: PolarWindow;
}

/** The square of the plane a zoomed polar plot shows. */
export interface PolarWindow {
  readonly center: readonly [number, number];
  /** Half its side. */
  readonly half: number;
}

/**
 * `samplePolar` for a zoomed view: only the stretches of `[t0, t1]` that pass through `window`,
 * a sample every couple of pixels of curve across `pixels`, with a non-finite point between
 * stretches so the path breaks there.
 */
export function samplePolarIn(
  f: (theta: number) => number,
  t0: number,
  t1: number,
  window: PolarWindow,
  pixels: number,
  coarse = 720,
): PolarPoint[] {
  const radius = (theta: number): number => {
    try {
      const r = f(theta);
      return typeof r === "number" ? r : Number.NaN;
    } catch {
      return Number.NaN;
    }
  };
  const trace = (theta: number): [number, number] => {
    const c = polarToCartesian(theta, radius(theta));
    return [c.x, c.y];
  };
  const { center: c, half } = window;
  const box = { x: [c[0] - half, c[0] + half], y: [c[1] - half, c[1] + half] } as const;
  const gap: PolarPoint = { theta: Number.NaN, r: Number.NaN };
  return runsThrough(trace, t0, t1, coarse, box)
    .flatMap((run) => [gap, ...samplePolar(radius, run.lo, run.hi, samplesFor(run, box, pixels))])
    .slice(1);
}

const SIZE = 260;
const PAD = 14;
const CURVE_WIDTH = 1.6;
const DOT_RADIUS = 2.2;

/** A "nice" ring radius: 1, 2 or 5 × a power of ten, at most `max`. */
function ringStep(max: number): number {
  if (!(max > 0) || !Number.isFinite(max)) return 1;
  const raw = max / 2;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
}

const edge = (color: string, width: number, opacity = 1): OptionValue => [[color, width, opacity, []]];
const isFinitePoint = (p: PolarPoint): boolean => Number.isFinite(p.r) && Number.isFinite(p.theta);

/**
 * Polar `points` as a `GraphicsBox` (Wolfram's `PolarPlot`, or `ListPolarPlot` with `markers`).
 * Non-finite radii break the path into subpaths.
 */
export function polarPlotBox(points: readonly PolarPoint[], opts: PolarPlotOptions = {}): Box {
  const finite = points.filter(isFinitePoint);
  const rMax = opts.max && opts.max > 0 ? opts.max : finite.reduce((m, p) => Math.max(m, Math.abs(p.r)), 0) || 1;
  const options: Record<string, OptionValue> = {
    ImageSize: [opts.width ?? SIZE, opts.height ?? SIZE],
    ViewKind: "fixed",
    PolarAxes: opts.axes !== false,
    ...(opts.title && { PlotLabel: opts.title }),
  };
  if (finite.length === 0 && !opts.window) return graphics(row([]), options);
  const { center = [0, 0], half = rMax } = opts.window ?? {};
  options["PlotRange"] = [
    [center[0] - half, center[0] + half],
    [center[1] - half, center[1] + half],
  ];
  if (opts.window) options["Clipped"] = true;
  if (finite.length === 0) return graphics(row([]), options);

  const runs: PolarPoint[][] = [];
  let run: PolarPoint[] = [];
  for (const p of points) {
    if (isFinitePoint(p)) run.push(p);
    else if (run.length > 0) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length > 0) runs.push(run);

  const xy = (p: PolarPoint): number[] => {
    const c = polarToCartesian(p.theta, p.r);
    return [c.x, c.y];
  };
  const items: Box[] = [];
  if (opts.filled)
    for (const seg of runs)
      items.push(style(tag(polygon({ Points: seg.map(xy) }), "Fill"), { FaceForm: ACCENT, Opacity: 0.18 }));
  const breaks: number[] = [];
  const closing = opts.closed || opts.filled;
  const drawn = runs.map((seg, k) => (closing && k === runs.length - 1 ? [...seg, seg[0]!] : seg));
  drawn.reduce((at, seg) => {
    if (at > 0) breaks.push(at);
    return at + seg.length;
  }, 0);
  items.push(
    style(tag(line({ Points: drawn.flat().map(xy), ...(breaks.length > 0 && { Breaks: breaks }) }), "Series"), {
      EdgeForm: edge(ACCENT, CURVE_WIDTH),
    }),
  );
  if (opts.markers) items.push(style(tag(point({ Points: finite.map(xy) }), "Series"), { FaceForm: ACCENT }));
  return graphics(row(items), options);
}

/** Whether `box` is a polar plot's `GraphicsBox`. */
export const isPolarBox = (box: Box): box is BoxNode =>
  isNode(box) && box[0] === "GraphicsBox" && optionsOfBox(box).PolarAxes !== undefined;

const numbers = (value: unknown): number[] | undefined =>
  Array.isArray(value) && value.every((v) => typeof v === "number") ? (value as number[]) : undefined;

const solid = (color: string, width: number, opacity: number): Edge => ({ color, width, opacity, dashing: [] });

/** Where a polar plot's square sits in its SVG: the canvas, the square's center and its half side, in px. */
function polarGeometry(o: Options): { W: number; H: number; cx: number; cy: number; R: number } {
  const [W, H] = (numbers(o.ImageSize) ?? [SIZE, SIZE]) as [number, number];
  const top = typeof o.PlotLabel === "string" ? 26 : PAD;
  return { W, H, cx: W / 2, cy: top + (H - top - PAD) / 2, R: Math.min(W / 2 - PAD, (H - top - PAD) / 2) };
}

/** The plane a polar plot box shows and how it maps to the SVG (y down), for a pointer to read. */
export function polarFrameOf(box: BoxNode): PlotFrame | undefined {
  const o = optionsOfBox(box);
  const range = Array.isArray(o.PlotRange) ? (o.PlotRange as number[][]) : undefined;
  const { cx, cy, R } = polarGeometry(o);
  if (!range || !(R > 0)) return undefined;
  const [c0, c1] = [(range[0]![0]! + range[0]![1]!) / 2, (range[1]![0]! + range[1]![1]!) / 2];
  const h = (range[0]![1]! - range[0]![0]!) / 2;
  return {
    box: [cx - R, cy - R, cx + R, cy + R],
    toData: (px, py) => [c0 + ((px - cx) / R) * h, c1 - ((py - cy) / R) * h],
    toPixel: (x, y) => [cx + ((x - c0) / h) * R, cy - ((y - c1) / h) * R],
  };
}

/** A polar plot box drawn as SVG: the grid, then the curve, then its title. */
export function polarPlotBoxSvg(box: BoxNode): string {
  const o = optionsOfBox(box);
  const { W, H, cx, cy, R } = polarGeometry(o);
  const marks: MarkItem[] = [];
  const at = (x: number, y: number): [number, number] => [x, H - y];
  // A zoomed plot's marks are cut to its square.
  const clipped = o.Clipped === true;
  const push = (mark: GraphicsPrimitive, look: MarkItem["style"]): void => {
    marks.push({ address: [0, 0], at: [0, 0], mark, style: look, selected: false, ...(clipped && { clipped }) });
  };
  const range = Array.isArray(o.PlotRange) ? (o.PlotRange as number[][]) : undefined;
  if (range && R > 0) {
    const [c0, c1] = [(range[0]![0]! + range[0]![1]!) / 2, (range[1]![0]! + range[1]![1]!) / 2];
    // The window's half side; the rings and spokes reach its farthest corner when it is off the origin.
    const rMax = (range[0]![1]! - range[0]![0]!) / 2;
    const reach = c0 || c1 ? Math.hypot(Math.abs(c0) + rMax, Math.abs(c1) + rMax) : rMax;
    const px = (p: readonly number[]): [number, number] =>
      at(cx + ((p[0]! - c0) / rMax) * R, cy - ((p[1]! - c1) / rMax) * R);
    if (o.PolarAxes !== false) {
      const step = ringStep(reach);
      const origin = px([0, 0]);
      for (let r = step; r <= reach + step * 1e-9; r += step)
        push({ head: "Disk", radius: (r / rMax) * R, center: origin }, { edges: [solid(AXIS, 1, 0.35)] });
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI) / 6;
        push(
          { head: "Line", points: [origin, px([reach * Math.cos(a), reach * Math.sin(a)])] },
          { edges: [solid(AXIS, 1, 0.2)] },
        );
      }
      push(
        {
          head: "Text",
          text: label(reach),
          size: 10,
          at: at(cx + R, cy - 4),
          look: { anchor: "end", mono: true, opacity: 0.6 },
        },
        { color: FG, edges: [] },
      );
    }
    const content = box[1] as Box;
    const items = isNode(content) && content[0] === "RowBox" ? (content[1] as readonly Box[]) : [];
    for (const it of items) {
      if (!isNode(it) || it[0] !== "StyleBox") continue;
      const look = it[2] as Options;
      const tagged = it[1] as Box;
      if (!isNode(tagged) || tagged[0] !== "TagBox" || !isNode(tagged[1])) continue;
      const prim = tagged[1] as BoxNode;
      const p = optionsOfBox(prim);
      const pts = Array.isArray(p.Points) ? p.Points.flatMap((q) => (numbers(q) ? [numbers(q)!] : [])) : [];
      const color = typeof look.FaceForm === "string" ? look.FaceForm : undefined;
      if (prim[0] === "PolygonBox")
        push(
          { head: "Polygon", points: pts.map(px) },
          { ...(color && { color }), opacity: Number(look.Opacity ?? 1), edges: [] },
        );
      else if (prim[0] === "LineBox") {
        const breaks = numbers(p.Breaks);
        const e = Array.isArray(look.EdgeForm) ? look.EdgeForm[0] : undefined;
        push(
          { head: "Line", points: pts.map(px), ...(breaks && { breaks }) },
          { edges: [solid(Array.isArray(e) ? String(e[0]) : ACCENT, CURVE_WIDTH, 1)] },
        );
      } else if (prim[0] === "PointBox")
        for (const q of pts)
          push({ head: "Disk", radius: DOT_RADIUS, center: px(q) }, { ...(color && { color }), edges: [] });
    }
  }
  if (typeof o.PlotLabel === "string")
    push(
      { head: "Text", text: o.PlotLabel, size: 12, at: at(W / 2, 14), look: { anchor: "middle" } },
      { color: FG, edges: [] },
    );
  const list: DisplayList = { kind: "marks", view: "fixed", marks, links: [], complete: true };
  return svg(
    list,
    W,
    H,
    { center: [W / 2, H / 2], extent: H / 2 },
    { rounded: true, label: "polar plot", ...(clipped && { clip: [cx - R, cy - R, 2 * R, 2 * R] as const }) },
  );
}

/** Render polar `points` as a curve on a polar grid: `polarPlotBox` drawn. */
export function polarPlotSvg(points: readonly PolarPoint[], opts: PolarPlotOptions = {}): string {
  return polarPlotBoxSvg(polarPlotBox(points, opts) as BoxNode);
}

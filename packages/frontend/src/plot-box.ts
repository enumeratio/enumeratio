// A 2-D plot as a `GraphicsBox` (the wiki's Speculative-Box-Primitives, §3), and the box drawn:
// Wolfram's `Plot` returns `Graphics`, so sampled data lowers to primitives in data
// coordinates (a curve is a `LineBox`, dots a `PointBox`, a filled region a `PolygonBox`, an
// arrow an `ArrowBox`) and the chrome rides as options (`PlotRange`, `Axes`, `GridLines`,
// `ScalingFunctions`, `AxesLabel`, `PlotLabel`, `ImageSize`). The drawer maps the box onto a
// display list in pixels, which `svg()` writes; a terminal reads the same box.
//
// Non-finite y (poles, gaps) split a curve into segments rather than drawing a spurious jump;
// the lowering does that (it is data-space), the drawer only maps and adds chrome.

import {
  arrow,
  type Box,
  type BoxNode,
  graphics,
  inset,
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
import { categoryColors, type ColorOptions, plotPalette, rampColor } from "./plot-color.ts";
import type { Primitive } from "./primitives.ts";
import { isLinear, scale } from "./scales.ts";
import { svg } from "./svg-draw.ts";
import type { DisplayList, GraphicsPrimitive, MarkItem } from "./tiles-canvas.ts";

const ACCENT = "var(--notatio-accent, var(--vp-c-brand-1, #d97706))";
const AXIS = "var(--notatio-border, var(--vp-c-divider, currentColor))";
const FG = "var(--notatio-fg, currentColor)";
const BG = "var(--notatio-bg, var(--vp-c-bg, #ffffff))";

export interface PlotPoint {
  x: number;
  y: number;
}

export interface PlotSeries {
  points: readonly PlotPoint[];
  /** `line` joins consecutive samples (default); `points` draws each as a dot. */
  style?: "line" | "points";
  /** Optional name shown in the hover readout. */
  label?: string;
}

export interface PlotOptions extends ColorOptions {
  width?: number;
  height?: number;
  /** Marks drawn over the curves in data coordinates (Wolfram's `Epilog`). */
  epilog?: readonly Primitive[];
  /** Marks drawn under the curves (Wolfram's `Prolog`). */
  prolog?: readonly Primitive[];
  /** Draw the zero-axes and range labels (default true). */
  axes?: boolean;
  /** Scaling function name for the x / y axis (default "linear"). */
  xScale?: string;
  yScale?: string;
  /** Hover readout: the x (data space) under the pointer. Each series marks its nearest sample. */
  hover?: number;
  /** Force the y-window (data space), overriding the automatic one (PlotRange). */
  plotRange?: readonly [number, number];
  /** Draw light gridlines at nice tick positions (GridLines). */
  gridLines?: boolean;
  /** Fill each line series down to the zero axis (Filling -> Axis). */
  fill?: boolean;
  /** Draw a legend box for the labelled series (PlotLegends). */
  legend?: boolean;
  /** Axis labels (AxesLabel): x below-right, y above-left. */
  xLabel?: string;
  yLabel?: string;
  /** A title centred above the frame (PlotLabel). */
  title?: string;
  /** Recolor a series along the gradient by position (Wolfram's ColorFunction): by `x` or by `y`. */
  colorBy?: "x" | "y";
  /** `PlotRangePadding -> None`: the window is the data's own extent, to the pixel, as a terminal labels it. */
  tight?: boolean;
}

/**
 * The plot area's geometry, so something drawn OVER the picture -- a hover readout, a
 * `<locator-box>` -- can go between data and viewBox coordinates both ways.
 */
export interface PlotFrame {
  /** The plot area in viewBox units: left, top, right, bottom. */
  readonly box: readonly [number, number, number, number];
  /** Data coordinates for a viewBox point. */
  readonly toData: (px: number, py: number) => [number, number];
  /** ViewBox coordinates for a data point. */
  readonly toPixel: (x: number, y: number) => [number, number];
}

/** A rendered plot plus the pixel→data mapping the element needs for hover. */
export interface RenderedPlot {
  svg: string;
  /** Data-space x for a viewBox x-coordinate (NaN when the plot is empty). */
  xAt: (px: number) => number;
  /** The plot area, or undefined for an empty plot. */
  frame?: PlotFrame;
}

const WIDTH = 340;
const HEIGHT = 200;
const CURVE_WIDTH = 2;
const DOT_RADIUS = 2.5;
const MARK_RADIUS = 3;
const FILL_OPACITY = 0.12;
/** An arrow's head length in px unless the box gives `Arrowheads`. */
const HEAD = 8;
/** Margins around the plot area, in px. */
const [M_LEFT, M_RIGHT, M_BOTTOM] = [38, 10, 22];
const marginTop = (titled: boolean): number => (titled ? 26 : 12);

/** The plot area's size in px inside an `ImageSize` of `width` × `height`. */
export const plotArea = (width: number, height: number, titled: boolean): { plotW: number; plotH: number } => ({
  plotW: width - M_LEFT - M_RIGHT,
  plotH: height - marginTop(titled) - M_BOTTOM,
});

const isSeriesList = (input: readonly PlotPoint[] | readonly PlotSeries[]): input is readonly PlotSeries[] =>
  input.length > 0 && "points" in input[0]!;

/** Format a number for an axis label: compact, at most 3 significant digits. */
export function label(x: number): string {
  if (!Number.isFinite(x)) return "";
  if (x === 0) return "0";
  const abs = Math.abs(x);
  return abs >= 1000 || abs < 0.01 ? x.toExponential(1) : String(Math.round(x * 100) / 100);
}

/**
 * "Nice" round tick values inside `[lo, hi]` (roughly `count` of them), the
 * 1/2/5·10ⁿ ladder every axis library uses.
 */
export function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (!(hi > lo) || !Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  const raw = (hi - lo) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const first = Math.ceil(lo / step) * step;
  const out: number[] = [];
  for (let v = first; v <= hi + step * 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

// ── Lowering ─────────────────────────────────────────────────────────────────────────────

const pair = (p: readonly number[]): OptionValue => [p[0]!, p[1]!];
const stroke = (color: string, width: number, opacity = 1, dashing: readonly number[] = []): OptionValue => [
  [color, width, opacity, [...dashing]],
];

/** A mark's box: `look` is its `StyleBox`, `role` its `TagBox` (what draws it where). */
const item = (prim: Box, role: string, look: Options): Box => style(tag(prim, role), look);

/** The boxes of Wolfram-style primitives (a plot's `Prolog` or `Epilog`), in data coordinates. */
function primitiveBoxes(primitives: readonly Primitive[], role: string): Box[] {
  const out: Box[] = [];
  const ink = ACCENT;
  for (const p of primitives) {
    switch (p.kind) {
      case "point":
        out.push(item(point({ Points: p.points.map(pair) }), role, { FaceForm: ink }));
        break;
      case "line":
        if (p.points.length >= 2)
          out.push(item(line({ Points: p.points.map(pair) }), role, { EdgeForm: stroke(ink, 1.5) }));
        break;
      case "arrow":
        if (p.points.length >= 2)
          out.push(item(arrow({ Points: p.points.map(pair) }), role, { EdgeForm: stroke(ink, 1.5), FaceForm: ink }));
        break;
      case "polygon":
        if (p.points.length >= 3)
          out.push(
            item(polygon({ Points: p.points.map(pair) }), role, {
              FaceForm: ink,
              Opacity: 0.25,
              EdgeForm: stroke(ink, 1),
            }),
          );
        break;
      case "circle": {
        // Sampled in data space, so it follows the axes when they are scaled apart.
        const ring = Array.from({ length: 64 }, (_, k): OptionValue => {
          const a = (2 * Math.PI * k) / 64;
          return [p.center[0] + p.r * Math.cos(a), p.center[1] + p.r * Math.sin(a)];
        });
        out.push(
          item(polygon({ Points: ring }), role, {
            EdgeForm: stroke(ink, 1.5),
            ...(p.filled && { FaceForm: ink, Opacity: 0.35 }),
          }),
        );
        break;
      }
      case "rectangle":
        out.push(
          item(
            polygon({
              Points: [
                [p.min[0], p.min[1]],
                [p.max[0], p.min[1]],
                [p.max[0], p.max[1]],
                [p.min[0], p.max[1]],
              ],
            }),
            role,
            { FaceForm: ink, Opacity: 0.2, EdgeForm: stroke(ink, 1) },
          ),
        );
        break;
      case "text":
        out.push(item(inset(p.text, { Center: pair(p.at), Size: 10 }), role, { FaceForm: ink }));
        break;
    }
  }
  return out;
}

/**
 * Sampled data as a `GraphicsBox`. Curves break at poles, at samples far outside the window and
 * at jumps wider than the window; the window is `PlotRange` or the 2nd–98th percentile of y, so a
 * pole's spike does not flatten the rest. Everything but the pointer's hover is in the box.
 */
export function plotBox(input: readonly PlotPoint[] | readonly PlotSeries[], opts: PlotOptions = {}): Box {
  const series: readonly PlotSeries[] = isSeriesList(input) ? input : [{ points: input as readonly PlotPoint[] }];
  const points = series.flatMap((s) => s.points);
  const X = scale(opts.xScale);
  const Y = scale(opts.yScale);
  const options: Record<string, OptionValue> = {
    ImageSize: [opts.width ?? WIDTH, opts.height ?? HEIGHT],
    Axes: opts.axes !== false,
    ScalingFunctions: [opts.xScale ?? "linear", opts.yScale ?? "linear"],
    ViewKind: "fixed",
    ...(opts.gridLines && { GridLines: true }),
    ...((opts.xLabel || opts.yLabel) && { AxesLabel: [opts.xLabel ?? null, opts.yLabel ?? null] }),
    ...(opts.title && { PlotLabel: opts.title }),
    ...(opts.tight && { PlotRangePadding: "None" }),
    ...(series.some((s) => s.label) && { SeriesLabels: series.map((s) => s.label ?? "") }),
  };

  // Everything downstream works in scaled space; only labels invert back.
  const txs = points.map((p) => X.fwd(p.x)).filter(Number.isFinite);
  const tys = points
    .filter((p) => Number.isFinite(X.fwd(p.x)))
    .map((p) => Y.fwd(p.y))
    .filter(Number.isFinite);
  if (txs.length === 0 || tys.length === 0) return graphics(row([]), options);

  const txmin = Math.min(...txs);
  const txmax = Math.max(...txs);
  let tymin: number;
  let tymax: number;
  if (opts.tight) {
    // Marks off the curve widen the window, so they are on the page rather than lost.
    const marked = [...(opts.epilog ?? []), ...(opts.prolog ?? [])].flatMap((p) =>
      p.kind === "point" ? p.points.map((q) => Y.fwd(q[1])) : [],
    );
    const ys = [...tys, ...marked.filter(Number.isFinite)];
    [tymin, tymax] = [Math.min(...ys), Math.max(...ys)];
    if (tymin === tymax) {
      tymin -= 1;
      tymax += 1;
    }
  } else if (opts.plotRange) {
    [tymin, tymax] = [Y.fwd(opts.plotRange[0]), Y.fwd(opts.plotRange[1])];
    if (!(tymin < tymax)) [tymin, tymax] = [Math.min(...tys), Math.max(...tys)];
  } else {
    const sorted = [...tys].toSorted((a, b) => a - b);
    const quantile = (p: number): number => {
      const idx = p * (sorted.length - 1);
      const lo = Math.floor(idx);
      const hi = Math.ceil(idx);
      return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
    };
    tymin = quantile(0.02);
    tymax = quantile(0.98);
    if (tymin === tymax) {
      tymin = Math.min(...tys);
      tymax = Math.max(...tys);
    }
    if (tymin === tymax) {
      tymin -= 1;
      tymax += 1;
    }
    const pad = (tymax - tymin) * 0.06;
    tymin -= pad;
    tymax += pad;
  }
  const span = tymax - tymin;
  options["PlotRange"] = [
    [X.inv(txmin), X.inv(txmax)],
    [Y.inv(tymin), Y.inv(tymax)],
  ];

  const visible = (p: PlotPoint): boolean => {
    const ty = Y.fwd(p.y);
    return Number.isFinite(X.fwd(p.x)) && Number.isFinite(ty) && ty <= tymax + span && ty >= tymin - span;
  };
  const segmentsOf = (pts: readonly PlotPoint[]): PlotPoint[][] => {
    const segments: PlotPoint[][] = [];
    let current: PlotPoint[] = [];
    let prevTy = Number.NaN;
    const flush = (): void => {
      if (current.length > 0) segments.push(current);
      current = [];
    };
    for (const p of pts) {
      const ty = Y.fwd(p.y);
      const jump = Number.isFinite(prevTy) && Math.abs(ty - prevTy) > span;
      if (!visible(p) || jump) {
        flush();
        prevTy = Number.NaN;
        continue;
      }
      current.push(p);
      prevTy = ty;
    }
    flush();
    return segments;
  };

  const palette = plotPalette(opts);
  const seriesColors = categoryColors(palette, series.length);
  // ColorFunction: a position normalized to the window, on the gradient.
  const rampAt = (p: PlotPoint): number =>
    opts.colorBy === "x" ? (X.fwd(p.x) - txmin) / (txmax - txmin || 1) : (Y.fwd(p.y) - tymin) / (tymax - tymin || 1);
  const baseline = isLinear(opts.yScale) && tymin <= 0 && 0 <= tymax ? 0 : Y.inv(tymin);

  const fills: Box[] = [];
  const curves: Box[] = [];
  series.forEach((s, k) => {
    const color = seriesColors[k]!;
    if (s.style === "points") {
      const dots = s.points.filter(visible);
      curves.push(
        item(
          point({
            Points: dots.map((p) => [p.x, p.y]),
            ...(opts.colorBy && { PointColors: dots.map((p) => rampColor(palette, rampAt(p))) }),
          }),
          "Series",
          { FaceForm: color },
        ),
      );
      return;
    }
    const segs = segmentsOf(s.points);
    if (opts.fill)
      for (const seg of segs.filter((g) => g.length > 1))
        fills.push(
          item(
            polygon({
              Points: [[seg[0]!.x, baseline], ...seg.map((p) => [p.x, p.y]), [seg.at(-1)!.x, baseline]],
            }),
            "Fill",
            { FaceForm: color, Opacity: FILL_OPACITY },
          ),
        );
    const breaks: number[] = [];
    segs.reduce((at, seg) => {
      if (at > 0) breaks.push(at);
      return at + seg.length;
    }, 0);
    const pairColors: OptionValue[] = [];
    if (opts.colorBy)
      for (const seg of segs)
        for (let i = 1; i < seg.length; i++)
          pairColors.push(rampColor(palette, (rampAt(seg[i - 1]!) + rampAt(seg[i]!)) / 2));
    curves.push(
      item(
        line({
          Points: segs.flat().map((p) => [p.x, p.y]),
          ...(breaks.length > 0 && { Breaks: breaks }),
          ...(opts.colorBy && { SegmentColors: pairColors }),
        }),
        "Series",
        { EdgeForm: stroke(color, CURVE_WIDTH) },
      ),
    );
  });
  if (opts.legend) {
    const named = series.flatMap((s, k) => (s.label ? [[s.label, seriesColors[k]!] as OptionValue] : []));
    if (named.length > 0) options["PlotLegends"] = named;
  }
  return graphics(
    row([
      ...primitiveBoxes(opts.prolog ?? [], "Prolog"),
      ...fills,
      ...curves,
      ...primitiveBoxes(opts.epilog ?? [], "Epilog"),
    ]),
    options,
  );
}

// ── Drawing ──────────────────────────────────────────────────────────────────────────────

export interface PlotDrawing {
  /** The marks in a y-up pixel frame (`svg()` mirrors them back). */
  readonly list: DisplayList;
  readonly size: readonly [number, number];
  /** The rectangle curves are cut to, in px. */
  readonly clip: readonly [number, number, number, number];
  readonly xAt: (px: number) => number;
  readonly frame?: PlotFrame;
}

const numbers = (value: unknown): number[] | undefined =>
  Array.isArray(value) && value.every((v) => typeof v === "number") ? (value as number[]) : undefined;
const pointList = (value: unknown): number[][] =>
  Array.isArray(value) ? value.flatMap((p) => (numbers(p) ? [numbers(p)!] : [])) : [];

/** Whether `box` is a plot's `GraphicsBox` (one `plotBox` made), as opposed to a figure's. */
export const isPlotBox = (box: Box): box is BoxNode =>
  isNode(box) && box[0] === "GraphicsBox" && optionsOfBox(box).ScalingFunctions !== undefined;

/** The items of a plot box, each with its role and look. */
export function plotItems(box: BoxNode): { role: string; prim: BoxNode; look: Options }[] {
  const content = box[1] as Box;
  const items = isNode(content) && content[0] === "RowBox" ? (content[1] as readonly Box[]) : [content];
  const out: { role: string; prim: BoxNode; look: Options }[] = [];
  for (const it of items) {
    let look: Options = {};
    let tagged = it;
    if (isNode(tagged) && tagged[0] === "StyleBox") [tagged, look] = [tagged[1] as Box, tagged[2] as Options];
    if (isNode(tagged) && tagged[0] === "TagBox" && isNode(tagged[1]))
      out.push({ role: tagged[2] as string, prim: tagged[1] as BoxNode, look });
  }
  return out;
}

const edgesOf = (value: unknown): Edge[] =>
  Array.isArray(value)
    ? value.flatMap((e) =>
        Array.isArray(e) && typeof e[0] === "string"
          ? [{ color: e[0], width: Number(e[1]), opacity: Number(e[2]), dashing: numbers(e[3]) ?? [] }]
          : [],
      )
    : [];

const solid = (color: string, width: number, opacity = 1, dashing: readonly number[] = []): Edge => ({
  color,
  width,
  opacity,
  dashing,
});

/**
 * A plot box mapped to pixels: chrome (grid, axes, ticks, labels, legend, title), the box's marks,
 * and, with `hover`, a readout at that x. Pure; `svg()` writes it.
 */
export function drawPlot(box: BoxNode, hover?: number): PlotDrawing {
  const o = optionsOfBox(box);
  const [W, H] = (numbers(o.ImageSize) ?? [WIDTH, HEIGHT]) as [number, number];
  const [xs, ys] = Array.isArray(o.ScalingFunctions) ? (o.ScalingFunctions as string[]) : ["linear", "linear"];
  const X = scale(xs);
  const Y = scale(ys);
  const titled = typeof o.PlotLabel === "string";
  const mT = marginTop(titled);
  const [mL, mR, mB] = [M_LEFT, M_RIGHT, M_BOTTOM];
  const plotW = W - mL - mR;
  const plotH = H - mT - mB;
  const clip = [mL - 3, mT, plotW + 6, plotH] as const;
  const marks: MarkItem[] = [];
  // `svg()` mirrors the list, so a pixel row r is y = H - r.
  const at = (x: number, y: number): [number, number] => [x, H - y];
  const push = (mark: GraphicsPrimitive, look: MarkItem["style"], clipped = false): void => {
    marks.push({ address: [0, 0], at: [0, 0], mark, style: look, selected: false, ...(clipped && { clipped }) });
  };
  const text = (
    x: number,
    y: number,
    anchor: "start" | "middle" | "end",
    s: string,
    size = 10,
    extra: object = {},
  ): void => push({ head: "Text", text: s, size, at: at(x, y), look: { anchor, ...extra } }, { color: FG, edges: [] });
  const done = (xAt: (px: number) => number, frame?: PlotFrame): PlotDrawing => ({
    list: { kind: "marks", view: "fixed", marks, links: [], complete: true },
    size: [W, H],
    clip,
    xAt,
    ...(frame && { frame }),
  });
  const range = Array.isArray(o.PlotRange) ? (o.PlotRange as number[][]) : undefined;
  if (!range) {
    if (titled) text(W / 2, 14, "middle", o.PlotLabel as string, 12);
    return done(() => Number.NaN);
  }
  const [txmin, txmax] = [X.fwd(range[0]![0]!), X.fwd(range[0]![1]!)];
  const [tymin, tymax] = [Y.fwd(range[1]![0]!), Y.fwd(range[1]![1]!)];
  const sx = (x: number): number => mL + ((X.fwd(x) - txmin) / (txmax - txmin || 1)) * plotW;
  const syT = (ty: number): number => mT + ((tymax - ty) / (tymax - tymin || 1)) * plotH;
  const sy = (y: number): number => syT(Y.fwd(y));
  const xAt = (px: number): number => X.inv(txmin + ((px - mL) / plotW) * (txmax - txmin));
  const frame: PlotFrame = {
    box: [mL, mT, W - mR, H - mB],
    toData: (px, py) => [xAt(px), Y.inv(tymax - ((py - mT) / plotH) * (tymax - tymin))],
    toPixel: (x, y) => [sx(x), sy(y)],
  };
  const xZero = isLinear(xs) && txmin <= 0 && 0 <= txmax ? sx(0) : mL;
  const yZero = isLinear(ys) && tymin <= 0 && 0 <= tymax ? syT(0) : H - mB;
  const px = (p: readonly number[]): [number, number] => at(sx(p[0]!), sy(p[1]!));
  const stripe = (x1: number, y1: number, x2: number, y2: number, edge: Edge): void =>
    push({ head: "Line", points: [at(x1, y1), at(x2, y2)] }, { edges: [edge] });

  if (o.GridLines === true) {
    const grid = solid(AXIS, 0.5, 0.25);
    for (const tx of niceTicks(X.inv(txmin), X.inv(txmax))) stripe(sx(tx), mT, sx(tx), H - mB, grid);
    for (const ty of niceTicks(Y.inv(tymin), Y.inv(tymax))) stripe(mL, sy(ty), W - mR, sy(ty), grid);
  }

  const items = plotItems(box);
  const pointsOf = (prim: BoxNode): number[][] => pointList(optionsOfBox(prim).Points);
  const mark = (prim: BoxNode, look: Options, clipped: boolean): void => {
    const p = optionsOfBox(prim);
    const edges = edgesOf(look.EdgeForm);
    const color = typeof look.FaceForm === "string" ? look.FaceForm : undefined;
    const opacity = typeof look.Opacity === "number" ? look.Opacity : undefined;
    switch (prim[0]) {
      case "LineBox": {
        const breaks = numbers(p.Breaks);
        const points = pointsOf(prim).map(px);
        const colors = Array.isArray(p.SegmentColors) ? (p.SegmentColors as string[]) : undefined;
        if (!colors) return push({ head: "Line", points, ...(breaks && { breaks }) }, { edges }, clipped);
        // One colored segment per adjacent pair that the pen does not lift between.
        let k = 0;
        for (let i = 1; i < points.length; i++) {
          if (breaks?.includes(i)) continue;
          push(
            { head: "Line", points: [points[i - 1]!, points[i]!] },
            { edges: [solid(colors[k++] ?? "", edges[0]?.width ?? CURVE_WIDTH)] },
            clipped,
          );
        }
        return;
      }
      case "PointBox": {
        const colors = Array.isArray(p.PointColors) ? (p.PointColors as string[]) : undefined;
        pointsOf(prim).forEach((q, i) =>
          push(
            { head: "Disk", radius: clipped ? DOT_RADIUS : MARK_RADIUS, center: px(q) },
            { ...((colors?.[i] ?? color) && { color: colors?.[i] ?? color }), edges: [] },
            clipped,
          ),
        );
        return;
      }
      case "PolygonBox":
        return push(
          { head: "Polygon", points: pointsOf(prim).map(px) },
          { ...(color && { color }), ...(opacity !== undefined && { opacity }), edges },
          clipped,
        );
      case "ArrowBox": {
        const points = pointsOf(prim).map(px);
        push({ head: "Line", points }, { edges }, clipped);
        if (points.length >= 2) {
          const [b, a] = [points.at(-1)!, points.at(-2)!];
          const angle = Math.atan2(b[1]! - a[1]!, b[0]! - a[0]!);
          const head = typeof p.Arrowheads === "number" ? p.Arrowheads : HEAD;
          const wing = (turn: number): [number, number] => [
            b[0]! - head * Math.cos(angle + turn),
            b[1]! - head * Math.sin(angle + turn),
          ];
          push(
            { head: "Polygon", points: [b, wing(0.4), wing(-0.4)] },
            { ...(color && { color }), edges: [] },
            clipped,
          );
        }
        return;
      }
      case "InsetBox": {
        const c = numbers(p.Center);
        if (c && typeof prim[1] === "string" && color)
          push(
            { head: "Text", text: prim[1], size: Number(p.Size), at: px(c), look: { anchor: "middle" } },
            { color, edges: [] },
          );
        return;
      }
      default:
    }
  };
  for (const { role, prim, look } of items) if (role === "Prolog") mark(prim, look, false);

  if (o.Axes !== false) {
    const axis = solid(AXIS, 1, 0.5);
    stripe(mL, yZero, W - mR, yZero, axis);
    stripe(xZero, mT, xZero, H - mB, axis);
    const tick = { opacity: 0.6, mono: true };
    text(mL, H - 6, "start", label(X.inv(txmin)), 10, tick);
    text(W - mR, H - 6, "end", label(X.inv(txmax)), 10, tick);
    text(mL - 4, mT + 6, "end", label(Y.inv(tymax)), 10, tick);
    text(mL - 4, H - mB, "end", label(Y.inv(tymin)), 10, tick);
    const [xl, yl] = Array.isArray(o.AxesLabel) ? o.AxesLabel : [];
    const caption = { opacity: 0.75, mono: true, italic: true };
    if (typeof xl === "string") text(W - mR, mT + 10, "end", xl, 10, caption);
    if (typeof yl === "string") text(mL + 4, mT + 10, "start", yl, 10, caption);
  }

  for (const { role, prim, look } of items) if (role === "Fill") mark(prim, look, true);
  for (const { role, prim, look } of items) if (role === "Series") mark(prim, look, true);
  for (const { role, prim, look } of items) if (role === "Epilog") mark(prim, look, false);

  const legend = Array.isArray(o.PlotLegends) ? (o.PlotLegends as [string, string][]) : [];
  legend.forEach(([name, color], k) => {
    const y = mT + 6 + 13 * k;
    stripe(W - mR - 60, y, W - mR - 46, y, solid(color, 2));
    text(W - mR - 42, y + 3, "start", name, 9, { mono: true, halo: BG });
  });
  if (titled) text(W / 2, 14, "middle", o.PlotLabel as string, 12);

  if (hover !== undefined && Number.isFinite(hover)) {
    const hx = X.fwd(hover);
    const names = Array.isArray(o.SeriesLabels) ? (o.SeriesLabels as string[]) : [];
    const hits = items
      .filter((i) => i.role === "Series")
      .flatMap(({ prim, look }, k) => {
        let best: number[] | undefined;
        for (const p of pointsOf(prim))
          if (!best || Math.abs(X.fwd(p[0]!) - hx) < Math.abs(X.fwd(best[0]!) - hx)) best = p;
        const color = typeof look.FaceForm === "string" ? look.FaceForm : (edgesOf(look.EdgeForm)[0]?.color ?? FG);
        return best ? [{ p: best, color, name: names[k] }] : [];
      });
    if (hits.length > 0) {
      const gx = sx(hits[0]!.p[0]!);
      stripe(gx, mT, gx, H - mB, solid(AXIS, 1, 0.7, [3, 3]));
      hits.forEach((h, k) => {
        push({ head: "Disk", radius: 3.5, center: px(h.p) }, { color: BG, edges: [solid(h.color, 2)] });
        const readout = `${h.name ? `${h.name}: ` : ""}(${label(h.p[0]!)}, ${label(h.p[1]!)})`;
        push(
          {
            head: "Text",
            text: readout,
            size: 10,
            at: at(mL + 6, mT + 11 + 12 * k),
            look: { anchor: "start", mono: true, halo: BG },
          },
          { color: h.color, edges: [] },
        );
      });
    }
  }
  return done(xAt, frame);
}

/** A plot box as SVG, with the pixel→data mapping hover needs. */
export function renderPlot(box: BoxNode, hover?: number): RenderedPlot {
  const d = drawPlot(box, hover);
  const [W, H] = d.size;
  const out = svg(
    d.list,
    W,
    H,
    { center: [W / 2, H / 2], extent: H / 2 },
    { rounded: true, clip: d.clip, label: "plot" },
  );
  return { svg: out, xAt: d.xAt, ...(d.frame && { frame: d.frame }) };
}

/** Render sampled points as an SVG line plot: `plotBox` drawn. */
export function linePlot(input: readonly PlotPoint[] | readonly PlotSeries[], opts: PlotOptions = {}): RenderedPlot {
  return renderPlot(plotBox(input, opts) as BoxNode, opts.hover);
}

/** As `linePlot`, the SVG alone. */
export function linePlotSvg(input: readonly PlotPoint[] | readonly PlotSeries[], opts: PlotOptions = {}): string {
  return linePlot(input, opts).svg;
}

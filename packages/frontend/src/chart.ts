// The 2-D charts as a `GraphicsBox` (the wiki's Speculative-Box-Primitives, §3), and the box drawn:
// Wolfram's `BarChart`, `Histogram`, `PieChart`, `BoxWhiskerChart`, `ArrayPlot` and `DiscretePlot`
// return `Graphics`, so a chart's data lowers to primitives in data coordinates (a bar or a cell is
// a `RectangleBox`, a pie's wedge a `DiskBox` sector, a stem or a whisker a `LineBox`, a stem's dot
// a `PointBox`) and the chrome rides as options (`PlotRange`, `Ticks`, `GridLines`, `PlotLabel`,
// `ImageSize`, `ImagePadding`). The drawer maps the box onto a display list in pixels, which `svg()`
// writes; a terminal reads the same box.
//
// `ListPlot` and `ListLinePlot` are plots (plot-box.ts); this file starts where they leave off.

import {
  type Box,
  type BoxNode,
  disk,
  graphics,
  isNode,
  line,
  type Options,
  type OptionValue,
  optionsOfBox,
  point,
  rectangle,
  row,
  style,
  tag,
} from "@enumeratio/boxes";
import { label, niceTicks, optionEdges, optionNumbers, optionPoints, plotItems, solidEdge } from "./plot-box.ts";
import { categoryColors, type ColorOptions, plotPalette, rampColor } from "./plot-color.ts";
import { svg } from "./svg-draw.ts";
import type { DisplayList, GraphicsPrimitive, MarkItem } from "./tiles-canvas.ts";

/** The members of the `Chart` family, by the attribute `type` that picks one. */
export type ChartType = "list" | "listline" | "bar" | "histogram" | "pie" | "box" | "array" | "discrete";

/** The members drawn as charts; `list` and `listline` are plots. */
export type ChartKind = Exclude<ChartType, "list" | "listline">;

export const CHART_KINDS: readonly ChartKind[] = ["bar", "histogram", "pie", "box", "array", "discrete"];

export const isChartKind = (type: string | undefined): type is ChartKind =>
  (CHART_KINDS as readonly (string | undefined)[]).includes(type);

export const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const AXIS = "var(--notatio-border, var(--vp-c-divider, currentColor))";
const FG = "var(--notatio-fg, currentColor)";
const BG = "var(--notatio-bg, var(--vp-c-bg, #ffffff))";

/** A box's `ChartKind` option, and the name its picture takes (`role="img"`). */
const KINDS: Readonly<Record<ChartKind, { option: string; name: string }>> = {
  bar: { option: "Bar", name: "bar chart" },
  histogram: { option: "Histogram", name: "histogram" },
  pie: { option: "Pie", name: "pie chart" },
  box: { option: "BoxWhisker", name: "box-whisker chart" },
  array: { option: "Array", name: "array plot" },
  discrete: { option: "Discrete", name: "discrete plot" },
};

/**
 * Common frame options every chart shares. Color: categories (a pie's wedges, a box per
 * series, a bar chart's one series) take the discrete scheme; values (an array plot's cells)
 * take the gradient.
 */
export interface ChartOptions extends ColorOptions {
  width?: number;
  height?: number;
  /** A title centred above the frame (PlotLabel). */
  title?: string;
  /** Category labels where the chart shows them (ChartLabels). */
  labels?: readonly string[];
}

const WIDTH = 340;
const HEIGHT = 200;
/** The margins around a chart's plot area, in px. */
const [M_LEFT, M_RIGHT] = [32, 10];
const marginTop = (titled: boolean, untitled = 12): number => (titled ? 26 : untitled);
/** The gap between neighboring bars, as a fraction of a bar's slot. */
const BAR_GAP = 0.2;
const DOT_RADIUS = 2.5;

// ── Lowering ─────────────────────────────────────────────────────────────────────────────

type Tick = readonly [number, string];

/** What a chart's box says besides its marks: the frame, the scales and the chrome. */
interface Frame {
  readonly kind: ChartKind;
  readonly size: readonly [number, number];
  /** `ImagePadding`: left, right, bottom, top. */
  readonly pad: readonly [number, number, number, number];
  /** `PlotRange`, in data coordinates; absent for a chart with nothing to draw. */
  readonly range?: readonly [readonly [number, number], readonly [number, number]];
  readonly title?: string | undefined;
  /** `Ticks`: where the x axis and the y axis are labeled. */
  readonly ticks?: readonly [readonly Tick[], readonly Tick[]];
  /** `GridLines`: the y values faint rules are drawn at. */
  readonly grid?: readonly number[];
  /** `AxesOrigin`: where the horizontal axis crosses; absent for no axis. */
  readonly axis?: readonly [number, number];
  /** `Frame`: a border round the plot area. */
  readonly frame?: boolean;
  /** `PlotLegends` and `LegendPosition`: a swatch and a name each, from a data point down. */
  readonly legend?: {
    readonly at: readonly [number, number];
    readonly entries: readonly (readonly [string, string])[];
  };
}

const stroke = (color: string, width: number, opacity = 1): OptionValue => [[color, width, opacity, []]];

/** A mark's box: `look` is its `StyleBox`, `role` its `TagBox`. */
const item = (prim: Box, role: string, look: Options): Box => style(tag(prim, role), look);

function chartBoxOf(frame: Frame, marks: readonly Box[]): Box {
  const options: Record<string, OptionValue> = {
    ChartKind: KINDS[frame.kind].option,
    ImageSize: [...frame.size],
    ImagePadding: [
      [frame.pad[0], frame.pad[1]],
      [frame.pad[2], frame.pad[3]],
    ],
    ...(frame.range && { PlotRange: frame.range.map((r) => [...r]) }),
    ...(frame.title && { PlotLabel: frame.title }),
    ...(frame.ticks && { Ticks: frame.ticks.map((ts) => ts.map((t): OptionValue => [...t])) }),
    ...(frame.grid && { GridLines: [[], [...frame.grid]] }),
    ...(frame.axis && { Axes: [true, false], AxesOrigin: [...frame.axis] }),
    ...(frame.frame && { Frame: true }),
    ...(frame.legend && {
      PlotLegends: frame.legend.entries.map((e): OptionValue => [...e]),
      LegendPosition: [...frame.legend.at],
    }),
  };
  return graphics(row([...marks]), options);
}

const sizeOf = (opts: ChartOptions): [number, number] => [opts.width ?? WIDTH, opts.height ?? HEIGHT];

/** A window `[lo, hi]` grown by `fraction` of its span each end; a flat one first opens to ±1. */
function padded(lo: number, hi: number, fraction: number): [number, number] {
  if (lo === hi) [lo, hi] = [lo - 1, hi + 1];
  const pad = (hi - lo) * fraction;
  return [lo - pad, hi + pad];
}

/** Ticks at `values`, labeled by `label`. */
const labeled = (values: readonly number[]): Tick[] => values.map((v) => [v, label(v)]);

/** One tick per category label, centred in its slot. */
const slotTicks = (labels: readonly string[] | undefined, n: number): Tick[] =>
  (labels ?? []).slice(0, n).flatMap((text, i): Tick[] => (text ? [[i + 0.5, text]] : []));

export interface BarChartOptions extends ChartOptions {}

/** Vertical bars for a value list, from a zero baseline (negative values dip below it). */
export function barChartBox(values: readonly number[], opts: BarChartOptions = {}): Box {
  const mT = marginTop(Boolean(opts.title));
  const mB = opts.labels?.length ? 28 : 18;
  const frame = { kind: "bar", size: sizeOf(opts), pad: [M_LEFT, M_RIGHT, mB, mT], title: opts.title } as const;
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return chartBoxOf(frame, []);
  const [lo, hi] = padded(Math.min(0, ...finite), Math.max(0, ...finite), 0.06);
  const [color] = categoryColors(plotPalette(opts), 1);
  const bars = values.flatMap((v, i) =>
    Number.isFinite(v)
      ? [
          item(
            rectangle({ Min: [i + BAR_GAP / 2, Math.min(0, v)], Max: [i + 1 - BAR_GAP / 2, Math.max(0, v)] }),
            "Bar",
            { FaceForm: color! },
          ),
        ]
      : [],
  );
  const yTicks = niceTicks(lo, hi);
  return chartBoxOf(
    {
      ...frame,
      range: [
        [0, values.length],
        [lo, hi],
      ],
      ticks: [slotTicks(opts.labels, values.length), labeled(yTicks)],
      grid: yTicks,
      axis: [0, 0],
    },
    bars,
  );
}

export interface HistogramOptions extends ChartOptions {
  /** Fixed bin count; default is Sturges' rule (ceil(log2 n) + 1). */
  bins?: number | undefined;
}

/** Sturges' rule: a reasonable default bin count for `n` samples. */
export function sturgesBins(n: number): number {
  return n <= 1 ? 1 : Math.max(1, Math.ceil(Math.log2(n) + 1));
}

/** Bin a number list into equal-width bars (simple equal-width binning). */
export function histogramBox(values: readonly number[], opts: HistogramOptions = {}): Box {
  const frame = {
    kind: "histogram",
    size: sizeOf(opts),
    pad: [M_LEFT, M_RIGHT, 22, marginTop(Boolean(opts.title))],
    title: opts.title,
  } as const;
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return chartBoxOf(frame, []);
  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  const bins = Math.max(1, Math.round(opts.bins ?? sturgesBins(finite.length)));
  const width = (hi - lo || 1) / bins;
  const counts = Array.from<number>({ length: bins }).fill(0);
  for (const v of finite) counts[Math.min(bins - 1, Math.floor((v - lo) / width))]!++;
  const [color] = categoryColors(plotPalette(opts), 1);
  // A background edge parts neighboring bars.
  const bars = counts.map((c, i) =>
    item(rectangle({ Min: [lo + i * width, 0], Max: [lo + (i + 1) * width, c] }), "Bar", {
      FaceForm: color!,
      EdgeForm: stroke(BG, 1),
    }),
  );
  const end = lo + bins * width;
  return chartBoxOf(
    {
      ...frame,
      range: [
        [lo, end],
        [0, Math.max(1, ...counts)],
      ],
      ticks: [
        [
          [lo, label(lo)],
          [end, label(hi)],
        ],
        [],
      ],
      axis: [lo, 0],
    },
    bars,
  );
}

export interface PieChartOptions extends ChartOptions {}

/** Wedge proportions of a value list. Non-positive/non-finite values are dropped. */
export function pieChartBox(values: readonly number[], opts: PieChartOptions = {}): Box {
  const [W, H] = sizeOf(opts);
  const mT = marginTop(Boolean(opts.title));
  const cx = W * 0.38;
  const r = Math.min(cx - 10, (H - mT) / 2 - 10, W / 2 - 10);
  // The window is the plot area at r px to the unit, so a wedge of radius 1 is a circle on the page.
  const half = (H - mT) / 2 / r;
  const frame = { kind: "pie", size: [W, H], pad: [0, 0, 0, mT], title: opts.title } as const;
  const entries = values.map((v, i) => ({ v, i })).filter((e) => Number.isFinite(e.v) && e.v > 0);
  const total = entries.reduce((a, e) => a + e.v, 0);
  if (entries.length === 0 || total <= 0 || r <= 0) return chartBoxOf(frame, []);
  const colors = categoryColors(plotPalette(opts), values.length);
  let acc = 0;
  const wedges = entries.map((e) => {
    const start = (acc / total) * 2 * Math.PI;
    acc += e.v;
    const end = (acc / total) * 2 * Math.PI;
    // Wedges run clockwise from twelve o'clock; a disk's angles run counterclockwise from three.
    return item(disk({ Center: [0, 0], Radius: 1, Angles: [Math.PI / 2 - end, Math.PI / 2 - start] }), "Wedge", {
      FaceForm: colors[e.i]!,
      EdgeForm: stroke(BG, 1),
    });
  });
  const names = opts.labels ?? [];
  const entriesLegend = entries.map((e): readonly [string, string] => [names[e.i] ?? label(e.v), colors[e.i]!]);
  return chartBoxOf(
    {
      ...frame,
      range: [
        [-cx / r, (W - cx) / r],
        [-half, half],
      ],
      legend: { at: [(r + 14) / r, ((H - mT) / 2 + 3) / r], entries: entriesLegend },
    },
    wedges,
  );
}

export interface FiveNumberSummary {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

/** Five-number summary via linear interpolation between order statistics. */
export function fiveNumberSummary(values: readonly number[]): FiveNumberSummary | undefined {
  const sorted = values
    .filter(Number.isFinite)
    .slice()
    .toSorted((a, b) => a - b);
  if (sorted.length === 0) return undefined;
  const quantile = (p: number): number => {
    const idx = p * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
  };
  return {
    min: sorted[0]!,
    q1: quantile(0.25),
    median: quantile(0.5),
    q3: quantile(0.75),
    max: sorted.at(-1)!,
  };
}

export interface BoxWhiskerOptions extends ChartOptions {}

/** The widest a box grows, in px. */
const MAX_BOX_WIDTH = 36;

/** One box-and-whisker per series (min/Q1/median/Q3/max), side by side. */
export function boxWhiskerChartBox(series: readonly (readonly number[])[], opts: BoxWhiskerOptions = {}): Box {
  const [W, H] = sizeOf(opts);
  const mB = opts.labels?.length ? 28 : 18;
  const frame = {
    kind: "box",
    size: [W, H],
    pad: [M_LEFT, M_RIGHT, mB, marginTop(Boolean(opts.title))],
    title: opts.title,
  } as const;
  const summaries = series.map(fiveNumberSummary);
  const found = summaries.filter((s): s is FiveNumberSummary => s !== undefined);
  if (found.length === 0) return chartBoxOf(frame, []);
  const dataLo = Math.min(...found.map((s) => s.min));
  const dataHi = Math.max(...found.map((s) => s.max));
  const [lo, hi] = padded(dataLo, dataHi, 0.08);
  const n = series.length;
  // A slot is cw px wide; a box takes half of it, or the widest a box grows.
  const cw = (W - M_LEFT - M_RIGHT) / n;
  const bw = Math.min(cw * 0.5, MAX_BOX_WIDTH) / cw;
  const colors = categoryColors(plotPalette(opts), n);
  const marks = summaries.flatMap((s, i): Box[] => {
    if (!s) return [];
    const c = i + 0.5;
    const color = colors[i]!;
    const cap = (v: number): Box =>
      item(
        line({
          Points: [
            [c - bw / 4, v],
            [c + bw / 4, v],
          ],
        }),
        "Cap",
        { EdgeForm: stroke(color, 1) },
      );
    return [
      item(
        line({
          Points: [
            [c, s.min],
            [c, s.max],
          ],
        }),
        "Whisker",
        { EdgeForm: stroke(color, 1) },
      ),
      cap(s.min),
      cap(s.max),
      item(rectangle({ Min: [c - bw / 2, s.q1], Max: [c + bw / 2, s.q3] }), "Box", {
        FaceForm: color,
        Opacity: 0.25,
        EdgeForm: stroke(color, 1.5),
      }),
      item(
        line({
          Points: [
            [c - bw / 2, s.median],
            [c + bw / 2, s.median],
          ],
        }),
        "Median",
        { EdgeForm: stroke(color, 2) },
      ),
    ];
  });
  return chartBoxOf(
    {
      ...frame,
      range: [
        [0, n],
        [lo, hi],
      ],
      ticks: [slotTicks(opts.labels, n), labeled([dataLo, dataHi])],
      axis: [0, lo],
    },
    marks,
  );
}

export interface ArrayPlotOptions extends ChartOptions {}

// The tallest a square-celled grid grows before it narrows instead: a square frame.
const ARRAY_MAX_H = 340;

/**
 * A 2-D numeric matrix as a grid of cells. Cells are square by default (the frame's height
 * follows rows/cols, as Wolfram's AspectRatio does), up to a square frame; past that the
 * grid narrows and centres. An explicit `height` stretches cells to fill the frame instead.
 * A 0/1 matrix is drawn two-tone -- 0 background, 1 foreground, like Wolfram's white/black;
 * anything else maps value -> the gradient.
 */
export function arrayPlotBox(matrix: readonly (readonly number[])[], opts: ArrayPlotOptions = {}): Box {
  const W = opts.width ?? WIDTH;
  const mT = marginTop(Boolean(opts.title), 6);
  const m = 6;
  const rows = matrix.length;
  const cols = rows > 0 ? Math.max(...matrix.map((r) => r.length)) : 0;
  if (rows === 0 || cols === 0)
    return chartBoxOf({ kind: "array", size: [W, opts.height ?? HEIGHT], pad: [0, 0, 0, mT], title: opts.title }, []);

  const flat = matrix.flat().filter(Number.isFinite);
  const lo = flat.length ? Math.min(...flat) : 0;
  const hi = flat.length ? Math.max(...flat) : 1;
  const span = hi - lo || 1;
  const binary = flat.every((v) => v === 0 || v === 1);

  let plotW = W - 2 * m;
  let H: number;
  if (opts.height !== undefined) H = opts.height;
  else {
    const cell = Math.min(plotW / cols, (ARRAY_MAX_H - mT - m) / rows);
    plotW = cell * cols;
    H = mT + cell * rows + m;
  }
  const x0 = (W - plotW) / 2;
  const palette = plotPalette(opts);
  const fill = binary
    ? (v: number): string => (v === 1 ? FG : BG)
    : (v: number): string => rampColor(palette, (v - lo) / span);
  // A cell's own color edges it, so neighbors meet without a seam.
  const cells = matrix.flatMap((cellRow, j) =>
    cellRow.flatMap((v, i) =>
      Number.isFinite(v)
        ? [
            item(rectangle({ Min: [i, rows - 1 - j], Max: [i + 1, rows - j] }), "Cell", {
              FaceForm: fill(v),
              EdgeForm: stroke(fill(v), 0.5),
            }),
          ]
        : [],
    ),
  );
  return chartBoxOf(
    {
      kind: "array",
      size: [W, H],
      pad: [x0, W - x0 - plotW, m, mT],
      title: opts.title,
      range: [
        [0, cols],
        [0, rows],
      ],
      frame: true,
    },
    cells,
  );
}

export interface DiscretePlotOptions extends ChartOptions {}

/** A stem plot: a vertical stem from the zero baseline to each value, dot on top. */
export function discretePlotBox(values: readonly number[], opts: DiscretePlotOptions = {}): Box {
  const frame = {
    kind: "discrete",
    size: sizeOf(opts),
    pad: [M_LEFT, M_RIGHT, 18, marginTop(Boolean(opts.title))],
    title: opts.title,
  } as const;
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return chartBoxOf(frame, []);
  const [lo, hi] = padded(Math.min(0, ...finite), Math.max(0, ...finite), 0.08);
  const [color] = categoryColors(plotPalette(opts), 1);
  const n = values.length;
  const stems = values.flatMap((v, i) =>
    Number.isFinite(v)
      ? [
          item(
            line({
              Points: [
                [i, 0],
                [i, v],
              ],
            }),
            "Stem",
            { EdgeForm: stroke(color!, 1.5) },
          ),
        ]
      : [],
  );
  const dots = item(point({ Points: values.flatMap((v, i) => (Number.isFinite(v) ? [[i, v]] : [])) }), "Dots", {
    FaceForm: color!,
  });
  return chartBoxOf(
    {
      ...frame,
      range: [n <= 1 ? [-1, 1] : [0, n - 1], [lo, hi]],
      axis: [0, 0],
    },
    [...stems, dots],
  );
}

// ── The data a chart reads ───────────────────────────────────────────────────────────────

/** A number list, dropping anything non-numeric. */
export function chartValues(data: unknown): number[] {
  return Array.isArray(data) ? data.filter(isNumber) : [];
}

/** One series per row for BoxWhiskerChart: a flat number list is a single series. */
export function chartSeries(data: unknown): number[][] {
  if (!Array.isArray(data)) return [];
  if (data.every((e) => Array.isArray(e))) return (data as unknown[][]).map(chartValues);
  const values = chartValues(data);
  return values.length ? [values] : [];
}

/** A 2-D numeric matrix for ArrayPlot. */
export function chartMatrix(data: unknown): number[][] {
  if (!Array.isArray(data) || !data.every((e) => Array.isArray(e))) return [];
  return (data as unknown[][]).map(chartValues);
}

export interface ChartBoxOptions extends ChartOptions {
  /** Histogram bin count; absent chooses one from the data. */
  bins?: number | undefined;
}

/** The chart `kind` of `data` (a JSON value, as the `data` attribute holds it) as a `GraphicsBox`. */
export function chartBox(kind: ChartKind, data: unknown, opts: ChartBoxOptions = {}): Box {
  switch (kind) {
    case "bar":
      return barChartBox(chartValues(data), opts);
    case "histogram":
      return histogramBox(chartValues(data), opts);
    case "pie":
      return pieChartBox(chartValues(data), opts);
    case "box":
      return boxWhiskerChartBox(chartSeries(data), opts);
    case "array":
      return arrayPlotBox(chartMatrix(data), opts);
    default:
      return discretePlotBox(chartValues(data), opts);
  }
}

// ── Drawing ──────────────────────────────────────────────────────────────────────────────

/** Whether `box` is a chart's `GraphicsBox` (one `chartBox` made). */
export const isChartBox = (box: Box): box is BoxNode =>
  isNode(box) && box[0] === "GraphicsBox" && typeof optionsOfBox(box).ChartKind === "string";

export interface ChartDrawing {
  /** The marks in a y-up pixel frame (`svg()` mirrors them back). */
  readonly list: DisplayList;
  readonly size: readonly [number, number];
  /** What the picture is, for its accessible name. */
  readonly name: string;
}

const pairOf = (value: unknown): [number, number] | undefined => {
  const p = optionNumbers(value);
  return p && p.length >= 2 ? [p[0]!, p[1]!] : undefined;
};

const ticksOf = (value: unknown): Tick[] =>
  Array.isArray(value)
    ? value.flatMap((t): Tick[] =>
        Array.isArray(t) && typeof t[0] === "number" && typeof t[1] === "string" ? [[t[0], t[1]]] : [],
      )
    : [];

/** A chart box mapped to pixels: its grid, axis, marks, frame, tick labels, legend and title. Pure; `svg()` writes it. */
export function drawChart(box: BoxNode): ChartDrawing {
  const o = optionsOfBox(box);
  const kind = (Object.keys(KINDS) as ChartKind[]).find((k) => KINDS[k].option === o.ChartKind) ?? "bar";
  const [W, H] = (optionNumbers(o.ImageSize) ?? [WIDTH, HEIGHT]) as [number, number];
  const [[mL, mR], [mB, mT]] = Array.isArray(o.ImagePadding)
    ? (o.ImagePadding as number[][]).map((p) => p.map(Number))
    : [
        [0, 0],
        [0, 0],
      ];
  const plotW = W - mL! - mR!;
  const plotH = H - mT! - mB!;
  const marks: MarkItem[] = [];
  // `svg()` mirrors the list, so a pixel row r is y = H - r.
  const at = (x: number, y: number): [number, number] => [x, H - y];
  const push = (mark: GraphicsPrimitive, look: MarkItem["style"]): void => {
    marks.push({ address: [0, 0], at: [0, 0], mark, style: look, selected: false });
  };
  const text = (
    x: number,
    y: number,
    anchor: "start" | "middle" | "end",
    s: string,
    size = 9,
    extra: object = {},
  ): void => push({ head: "Text", text: s, size, at: at(x, y), look: { anchor, ...extra } }, { color: FG, edges: [] });
  const done = (): ChartDrawing => ({
    list: { kind: "marks", view: "fixed", marks, links: [], complete: true },
    size: [W, H],
    name: KINDS[kind].name,
  });
  const title = (): void => {
    if (typeof o.PlotLabel === "string") text(W / 2, 14, "middle", o.PlotLabel, 12);
  };
  const range = Array.isArray(o.PlotRange) ? (o.PlotRange as number[][]) : undefined;
  if (!range) {
    title();
    return done();
  }
  const [[x0, x1], [y0, y1]] = range as [[number, number], [number, number]];
  const [dx, dy] = [x1! - x0! || 1, y1! - y0! || 1];
  const sx = (x: number): number => mL! + ((x - x0!) / dx) * plotW;
  const sy = (y: number): number => mT! + ((y1! - y) / dy) * plotH;
  const px = (p: readonly number[]): [number, number] => at(sx(p[0]!), sy(p[1]!));
  const stripe = (xa: number, ya: number, xb: number, yb: number, edge: ReturnType<typeof solidEdge>): void =>
    push({ head: "Line", points: [at(xa, ya), at(xb, yb)] }, { edges: [edge] });

  const [, gridY] = Array.isArray(o.GridLines) ? o.GridLines : [];
  for (const y of optionNumbers(gridY) ?? []) stripe(mL!, sy(y), W - mR!, sy(y), solidEdge(AXIS, 0.5, 0.15));
  const [axisOn] = Array.isArray(o.Axes) ? o.Axes : [];
  const origin = pairOf(o.AxesOrigin);
  if (axisOn === true && origin) stripe(mL!, sy(origin[1]), W - mR!, sy(origin[1]), solidEdge(AXIS, 1, 0.5));

  // Units to the pixel across: a disk's radius is in x units.
  const unit = plotW / dx;
  for (const { prim, look } of plotItems(box)) {
    const p = optionsOfBox(prim);
    const edges = optionEdges(look.EdgeForm);
    const color = typeof look.FaceForm === "string" ? look.FaceForm : undefined;
    const opacity = typeof look.Opacity === "number" ? look.Opacity : undefined;
    const face = { ...(color && { color }), ...(opacity !== undefined && { opacity }), edges };
    switch (prim[0]) {
      case "RectangleBox": {
        const [lo, hi] = [pairOf(p.Min), pairOf(p.Max)];
        if (lo && hi)
          push(
            {
              head: "Polygon",
              points: [px(lo), px([hi[0], lo[1]]), px(hi), px([lo[0], hi[1]])],
            },
            face,
          );
        break;
      }
      case "DiskBox": {
        const center = pairOf(p.Center);
        const angles = pairOf(p.Angles);
        if (center && typeof p.Radius === "number")
          push({ head: "Disk", radius: p.Radius * unit, center: px(center), ...(angles && { angles }) }, face);
        break;
      }
      case "LineBox":
        push({ head: "Line", points: optionPoints(p.Points).map(px) }, { edges });
        break;
      case "PointBox":
        for (const q of optionPoints(p.Points))
          push({ head: "Disk", radius: DOT_RADIUS, center: px(q) }, { ...(color && { color }), edges: [] });
        break;
      case "PolygonBox":
        push({ head: "Polygon", points: optionPoints(p.Points).map(px) }, face);
        break;
      case "InsetBox": {
        const c = pairOf(p.Center);
        const align = Array.isArray(p.Alignment) ? p.Alignment[0] : undefined;
        if (c && typeof prim[1] === "string" && color)
          push(
            {
              head: "Text",
              text: prim[1],
              size: Number(p.Size),
              at: px(c),
              look: { anchor: align === "Left" ? "start" : align === "Right" ? "end" : "middle" },
            },
            { color, edges: [] },
          );
        break;
      }
      default:
    }
  }
  // Wolfram frames an ArrayPlot; it also keeps 0-cells from bleeding into the page.
  if (o.Frame === true) {
    const edge = solidEdge(AXIS, 1, 0.5);
    push(
      {
        head: "Polygon",
        points: [at(mL!, mT!), at(W - mR!, mT!), at(W - mR!, H - mB!), at(mL!, H - mB!)],
      },
      { edges: [edge] },
    );
  }

  const tick = { opacity: 0.6, mono: true };
  const [xTicks, yTicks] = Array.isArray(o.Ticks) ? o.Ticks : [];
  for (const [v, s] of ticksOf(xTicks)) text(sx(v), H - mB! + 10, "middle", s, 9, tick);
  for (const [v, s] of ticksOf(yTicks)) text(mL! - 4, sy(v), "end", s, 9, tick);

  const legend = pairOf(o.LegendPosition);
  const entries = Array.isArray(o.PlotLegends) ? (o.PlotLegends as [string, string][]) : [];
  if (legend) {
    const [lx, ly] = [sx(legend[0]), sy(legend[1])];
    entries.forEach(([name, color], k) => {
      const top = ly + 13 * k;
      const [l, r, b, t] = [lx, lx + 8, top + 8, top];
      push({ head: "Polygon", points: [at(l, t), at(r, t), at(r, b), at(l, b)] }, { color, edges: [] });
      text(lx + 12, top + 4, "start", name, 9, { mono: true, opacity: 0.85 });
    });
  }
  title();
  return done();
}

/** A chart box as SVG. */
export function renderChart(box: BoxNode): string {
  const d = drawChart(box);
  const [W, H] = d.size;
  return svg(d.list, W, H, { center: [W / 2, H / 2], extent: H / 2 }, { rounded: true, label: d.name });
}

/** `chartBox` drawn: the SVG alone. */
export function chartSvg(kind: ChartKind, data: unknown, opts: ChartBoxOptions = {}): string {
  return renderChart(chartBox(kind, data, opts) as BoxNode);
}

/**
 * The chart the data asks for, when none is named -- the `Chart` family head's rule, and
 * the element's when `type` is `auto` or empty. Read off the shape alone:
 *
 * - a matrix (rows of numbers, more than one row) is an `array` plot;
 * - rows of unequal length are series, one `box` per row;
 * - `[x, y]` pairs are a `list` plot (so a two-column matrix reads as pairs, as it does
 *   for `ListPlot`);
 * - a short number list is a `bar` per value, a long one is a `histogram` of them.
 *
 * A hint -- `labels`, which only a categorical chart shows -- pulls a number list to
 * `bar` whatever its length. Anything unreadable falls to `bar`, whose renderer draws
 * nothing for it.
 */
export function chooseChartType(data: unknown, hints: { labels?: boolean } = {}): ChartType {
  if (!Array.isArray(data) || data.length === 0) return "bar";
  if (data.every(isNumber)) {
    if (hints.labels) return "bar";
    return data.length > 12 ? "histogram" : "bar";
  }
  if (data.every((e) => Array.isArray(e) && e.length === 2 && e.every(isNumber))) return "list";
  if (data.every((e) => Array.isArray(e) && e.every(isNumber))) {
    const widths = new Set((data as unknown[][]).map((row) => row.length));
    return widths.size === 1 && data.length > 1 ? "array" : "box";
  }
  return "bar";
}

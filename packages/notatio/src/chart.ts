// Pure 2-D chart geometry, mirroring plot.ts's shape: data in, themeable SVG
// string out, no DOM/CE dependency so every renderer is unit-testable. Covers
// Wolfram's Data Visualization guide -- BarChart, Histogram, PieChart,
// BoxWhiskerChart, ArrayPlot, DiscretePlot. ListPlot / ListLinePlot reuse
// plot.ts's `linePlot` (a bare number list there already reads as index vs
// value); this file starts where that leaves off.

import { niceTicks } from "./plot.ts";

/** The members of the `Chart` family, by the attribute `type` that picks one. */
export type ChartType =
  | "list"
  | "listline"
  | "bar"
  | "histogram"
  | "pie"
  | "box"
  | "array"
  | "discrete";

export const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const ACCENT = "var(--notatio-accent, var(--vp-c-brand-1, #d97706))";
const AXIS = "var(--notatio-border, var(--vp-c-divider, currentColor))";
const FG = "var(--notatio-fg, currentColor)";
const BG = "var(--notatio-bg, var(--vp-c-bg, #ffffff))";
// Same series ramp as plot.ts / plot3d.ts, kept in sync by eye (each module
// stays dependency-free rather than sharing a constants module).
const SERIES = [
  ACCENT,
  "var(--notatio-series-2, #2f7ed8)",
  "var(--notatio-series-3, #2ca02c)",
  "var(--notatio-series-4, #d62728)",
  "var(--notatio-series-5, #9467bd)",
  "var(--notatio-series-6, #8c564b)",
];

const n2 = (x: number): string => String(Math.round(x * 100) / 100);

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function label(x: number): string {
  if (!Number.isFinite(x)) return "";
  if (x === 0) return "0";
  const abs = Math.abs(x);
  return abs >= 1000 || abs < 0.01 ? x.toExponential(1) : String(Math.round(x * 100) / 100);
}

/** Common frame options every chart shares. */
export interface ChartOptions {
  width?: number;
  height?: number;
  /** A title centred above the frame (PlotLabel). */
  title?: string;
}

const frame = (w: number, h: number, body: string, ariaLabel: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${ariaLabel}">${body}</svg>`;

const titleSvg = (w: number, title: string | undefined): string =>
  title
    ? `<text x="${n2(w / 2)}" y="14" text-anchor="middle" font-size="12" font-family="ui-sans-serif, system-ui, sans-serif" fill="${FG}">${esc(title)}</text>`
    : "";

const tickText = (x: number, y: number, anchor: string, s: string): string =>
  `<text x="${n2(x)}" y="${n2(y)}" text-anchor="${anchor}" font-size="9" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.6">${esc(s)}</text>`;

// ---------------------------------------------------------------------------
// BarChart
// ---------------------------------------------------------------------------

export interface BarChartOptions extends ChartOptions {
  /** Category labels under each bar (BarChart's ChartLabels). */
  labels?: readonly string[];
}

/** Vertical bars for a value list, from a zero baseline (negative values dip below it). */
export function barChartSvg(values: readonly number[], opts: BarChartOptions = {}): string {
  const W = opts.width ?? 340;
  const H = opts.height ?? 200;
  const mL = 32;
  const mR = 10;
  const mT = opts.title ? 26 : 12;
  const mB = opts.labels?.length ? 28 : 18;
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return frame(W, H, titleSvg(W, opts.title), "bar chart");

  let lo = Math.min(0, ...finite);
  let hi = Math.max(0, ...finite);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.06;
  lo -= pad;
  hi += pad;

  const plotW = W - mL - mR;
  const plotH = H - mT - mB;
  const n = values.length;
  const gap = 0.2;
  const bw = plotW / n;
  const yAt = (v: number): number => mT + ((hi - v) / (hi - lo)) * plotH;
  const zeroY = yAt(0);

  const bars = values
    .map((v, i) => {
      if (!Number.isFinite(v)) return "";
      const x = mL + i * bw + (bw * gap) / 2;
      const w = bw * (1 - gap);
      const y = Math.min(yAt(v), zeroY);
      const h = Math.abs(yAt(v) - zeroY);
      return `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" fill="${SERIES[0]}"/>`;
    })
    .join("");

  const labels = opts.labels ?? [];
  const labelsSvg = labels.length
    ? values
        .map((_, i) => {
          const x = mL + i * bw + bw / 2;
          const text = labels[i] ?? "";
          return text ? tickText(x, H - mB + 12, "middle", text) : "";
        })
        .join("")
    : "";

  const axis = `<line x1="${n2(mL)}" y1="${n2(zeroY)}" x2="${n2(W - mR)}" y2="${n2(zeroY)}" stroke="${AXIS}" stroke-width="1" opacity="0.5"/>`;
  const yTicks = niceTicks(lo, hi)
    .map(
      (t) =>
        `<line x1="${n2(mL)}" y1="${n2(yAt(t))}" x2="${n2(W - mR)}" y2="${n2(yAt(t))}" stroke="${AXIS}" stroke-width="0.5" opacity="0.15"/>` +
        tickText(mL - 4, yAt(t) + 3, "end", label(t)),
    )
    .join("");

  return frame(W, H, titleSvg(W, opts.title) + yTicks + axis + bars + labelsSvg, "bar chart");
}

// ---------------------------------------------------------------------------
// Histogram
// ---------------------------------------------------------------------------

export interface HistogramOptions extends ChartOptions {
  /** Fixed bin count; default is Sturges' rule (ceil(log2 n) + 1). */
  bins?: number;
}

/** Sturges' rule: a reasonable default bin count for `n` samples. */
export function sturgesBins(n: number): number {
  return n <= 1 ? 1 : Math.max(1, Math.ceil(Math.log2(n) + 1));
}

/** Bin a number list into equal-width bars (simple equal-width binning). */
export function histogramSvg(values: readonly number[], opts: HistogramOptions = {}): string {
  const W = opts.width ?? 340;
  const H = opts.height ?? 200;
  const mL = 32;
  const mR = 10;
  const mT = opts.title ? 26 : 12;
  const mB = 22;
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return frame(W, H, titleSvg(W, opts.title), "histogram");

  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  const bins = Math.max(1, Math.round(opts.bins ?? sturgesBins(finite.length)));
  const width = (hi - lo || 1) / bins;
  const counts = Array.from<number>({ length: bins }).fill(0);
  for (const v of finite) {
    const idx = width === 0 ? 0 : Math.min(bins - 1, Math.floor((v - lo) / width));
    counts[idx]++;
  }
  const maxCount = Math.max(1, ...counts);

  const plotW = W - mL - mR;
  const plotH = H - mT - mB;
  const bw = plotW / bins;
  const yAt = (c: number): number => mT + (1 - c / maxCount) * plotH;

  const bars = counts
    .map((c, i) => {
      const x = mL + i * bw;
      const y = yAt(c);
      const h = mT + plotH - y;
      return `<rect x="${n2(x + 0.5)}" y="${n2(y)}" width="${n2(Math.max(0, bw - 1))}" height="${n2(h)}" fill="${SERIES[0]}"/>`;
    })
    .join("");

  const axis = `<line x1="${n2(mL)}" y1="${n2(mT + plotH)}" x2="${n2(W - mR)}" y2="${n2(mT + plotH)}" stroke="${AXIS}" stroke-width="1" opacity="0.5"/>`;
  const ticks = tickText(mL, H - 6, "start", label(lo)) + tickText(W - mR, H - 6, "end", label(hi));

  return frame(W, H, titleSvg(W, opts.title) + axis + bars + ticks, "histogram");
}

// ---------------------------------------------------------------------------
// PieChart
// ---------------------------------------------------------------------------

export interface PieChartOptions extends ChartOptions {
  labels?: readonly string[];
}

/** Wedge proportions of a value list. Non-positive/non-finite values are dropped. */
export function pieChartSvg(values: readonly number[], opts: PieChartOptions = {}): string {
  const W = opts.width ?? 340;
  const H = opts.height ?? 200;
  const mT = opts.title ? 26 : 12;
  const cx = W * 0.38;
  const cy = mT + (H - mT) / 2;
  const r = Math.min(cx - 10, (H - mT) / 2 - 10, W / 2 - 10);

  const entries = values.map((v, i) => ({ v, i })).filter((e) => Number.isFinite(e.v) && e.v > 0);
  const total = entries.reduce((a, e) => a + e.v, 0);
  if (entries.length === 0 || total <= 0 || r <= 0)
    return frame(W, H, titleSvg(W, opts.title), "pie chart");

  const arcPoint = (angle: number): [number, number] => [
    cx + r * Math.sin(angle),
    cy - r * Math.cos(angle),
  ];

  let acc = 0;
  const wedges = entries
    .map((e) => {
      const start = (acc / total) * 2 * Math.PI;
      acc += e.v;
      const end = (acc / total) * 2 * Math.PI;
      const large = end - start > Math.PI ? 1 : 0;
      const [x1, y1] = arcPoint(start);
      const [x2, y2] = arcPoint(end);
      const color = SERIES[e.i % SERIES.length];
      // A full circle (one entry) can't be drawn as a single arc; split it.
      if (end - start >= 2 * Math.PI - 1e-9) {
        return `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="${color}"/>`;
      }
      return `<path d="M${n2(cx)},${n2(cy)} L${n2(x1)},${n2(y1)} A${n2(r)},${n2(r)} 0 ${large} 1 ${n2(x2)},${n2(y2)} Z" fill="${color}" stroke="${BG}" stroke-width="1"/>`;
    })
    .join("");

  const labels = opts.labels ?? [];
  let legend = "";
  entries.forEach((e, k) => {
    const y = mT + 4 + 13 * k;
    const text = labels[e.i] ?? label(e.v);
    legend +=
      `<rect x="${n2(cx + r + 14)}" y="${n2(y - 7)}" width="8" height="8" fill="${SERIES[e.i % SERIES.length]}"/>` +
      `<text x="${n2(cx + r + 26)}" y="${n2(y)}" font-size="9" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.85">${esc(text)}</text>`;
  });

  return frame(W, H, titleSvg(W, opts.title) + wedges + legend, "pie chart");
}

// ---------------------------------------------------------------------------
// BoxWhiskerChart
// ---------------------------------------------------------------------------

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
    .sort((a, b) => a - b);
  if (sorted.length === 0) return undefined;
  const quantile = (p: number): number => {
    const idx = p * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  return {
    min: sorted[0],
    q1: quantile(0.25),
    median: quantile(0.5),
    q3: quantile(0.75),
    max: sorted[sorted.length - 1],
  };
}

export interface BoxWhiskerOptions extends ChartOptions {
  labels?: readonly string[];
}

/** One box-and-whisker per series (min/Q1/median/Q3/max), side by side. */
export function boxWhiskerChartSvg(
  series: readonly (readonly number[])[],
  opts: BoxWhiskerOptions = {},
): string {
  const W = opts.width ?? 340;
  const H = opts.height ?? 200;
  const mL = 32;
  const mR = 10;
  const mT = opts.title ? 26 : 12;
  const mB = opts.labels?.length ? 28 : 18;
  const summaries = series.map(fiveNumberSummary);
  const finite = summaries.filter((s): s is FiveNumberSummary => s !== undefined);
  if (finite.length === 0) return frame(W, H, titleSvg(W, opts.title), "box-whisker chart");

  let lo = Math.min(...finite.map((s) => s.min));
  let hi = Math.max(...finite.map((s) => s.max));
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;

  const plotW = W - mL - mR;
  const plotH = H - mT - mB;
  const n = series.length;
  const cw = plotW / n;
  const yAt = (v: number): number => mT + ((hi - v) / (hi - lo)) * plotH;

  const boxes = summaries
    .map((s, i) => {
      if (!s) return "";
      const cx = mL + i * cw + cw / 2;
      const bw = Math.min(cw * 0.5, 36);
      const color = SERIES[i % SERIES.length];
      const whisker = `<line x1="${n2(cx)}" y1="${n2(yAt(s.min))}" x2="${n2(cx)}" y2="${n2(yAt(s.max))}" stroke="${color}" stroke-width="1"/>`;
      const cap = (v: number): string =>
        `<line x1="${n2(cx - bw / 4)}" y1="${n2(yAt(v))}" x2="${n2(cx + bw / 4)}" y2="${n2(yAt(v))}" stroke="${color}" stroke-width="1"/>`;
      const box = `<rect x="${n2(cx - bw / 2)}" y="${n2(yAt(s.q3))}" width="${n2(bw)}" height="${n2(Math.max(0.5, yAt(s.q1) - yAt(s.q3)))}" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="1.5"/>`;
      const median = `<line x1="${n2(cx - bw / 2)}" y1="${n2(yAt(s.median))}" x2="${n2(cx + bw / 2)}" y2="${n2(yAt(s.median))}" stroke="${color}" stroke-width="2"/>`;
      return whisker + cap(s.min) + cap(s.max) + box + median;
    })
    .join("");

  const labels = opts.labels ?? [];
  const labelsSvg = labels.length
    ? series
        .map((_, i) => {
          const cx = mL + i * cw + cw / 2;
          const text = labels[i] ?? "";
          return text ? tickText(cx, H - mB + 12, "middle", text) : "";
        })
        .join("")
    : "";

  const axis = `<line x1="${n2(mL)}" y1="${n2(mT + plotH)}" x2="${n2(W - mR)}" y2="${n2(mT + plotH)}" stroke="${AXIS}" stroke-width="1" opacity="0.5"/>`;
  const yTicks =
    tickText(mL - 4, yAt(lo + pad) + 3, "end", label(lo + pad)) +
    tickText(mL - 4, yAt(hi - pad) + 3, "end", label(hi - pad));

  return frame(
    W,
    H,
    titleSvg(W, opts.title) + axis + yTicks + boxes + labelsSvg,
    "box-whisker chart",
  );
}

// ---------------------------------------------------------------------------
// ArrayPlot
// ---------------------------------------------------------------------------

export interface ArrayPlotOptions extends ChartOptions {}

// The tallest a square-celled grid grows before it narrows instead: a square frame.
const ARRAY_MAX_H = 340;

/**
 * A 2-D numeric matrix as a grid of cells. Cells are square by default (the frame's height
 * follows rows/cols, as Wolfram's AspectRatio does), up to a square frame; past that the
 * grid narrows and centres. An explicit `height` stretches cells to fill the frame instead.
 * A 0/1 matrix is drawn two-tone -- 0 background, 1 foreground, like Wolfram's white/black;
 * anything else maps value -> a blue-to-accent ramp.
 */
export function arrayPlotSvg(
  matrix: readonly (readonly number[])[],
  opts: ArrayPlotOptions = {},
): string {
  const W = opts.width ?? 340;
  const mT = opts.title ? 26 : 6;
  const m = 6;
  const rows = matrix.length;
  const cols = rows > 0 ? Math.max(...matrix.map((r) => r.length)) : 0;
  if (rows === 0 || cols === 0)
    return frame(W, opts.height ?? 200, titleSvg(W, opts.title), "array plot");

  const flat = matrix.flat().filter(Number.isFinite);
  const lo = flat.length ? Math.min(...flat) : 0;
  const hi = flat.length ? Math.max(...flat) : 1;
  const span = hi - lo || 1;
  const binary = flat.every((v) => v === 0 || v === 1);

  let plotW = W - 2 * m;
  let H: number;
  let cw: number;
  let ch: number;
  if (opts.height !== undefined) {
    H = opts.height;
    cw = plotW / cols;
    ch = (H - mT - m) / rows;
  } else {
    cw = ch = Math.min(plotW / cols, (ARRAY_MAX_H - mT - m) / rows);
    plotW = cw * cols;
    H = mT + ch * rows + m;
  }
  const x0 = (W - plotW) / 2;
  const plotH = ch * rows;

  const fill = binary
    ? (v: number): string => (v === 1 ? FG : BG)
    : (v: number): string =>
        `color-mix(in srgb, ${ACCENT} ${n2(Math.max(0, Math.min(1, (v - lo) / span)) * 100)}%, ${SERIES[1]})`;

  const cells = matrix
    .flatMap((row, j) =>
      row.map((v, i) => {
        if (!Number.isFinite(v)) return "";
        const x = x0 + i * cw;
        const y = mT + j * ch;
        return `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(cw + 0.5)}" height="${n2(ch + 0.5)}" fill="${fill(v)}"/>`;
      }),
    )
    .join("");
  // Wolfram frames an ArrayPlot; it also keeps 0-cells from bleeding into the page.
  const border = `<rect x="${n2(x0)}" y="${n2(mT)}" width="${n2(plotW)}" height="${n2(plotH)}" fill="none" stroke="${AXIS}" stroke-width="1" opacity="0.5"/>`;

  return frame(W, H, titleSvg(W, opts.title) + cells + border, "array plot");
}

// ---------------------------------------------------------------------------
// DiscretePlot
// ---------------------------------------------------------------------------

export interface DiscretePlotOptions extends ChartOptions {}

/** A stem plot: a vertical stem from the zero baseline to each value, dot on top. */
export function discretePlotSvg(values: readonly number[], opts: DiscretePlotOptions = {}): string {
  const W = opts.width ?? 340;
  const H = opts.height ?? 200;
  const mL = 32;
  const mR = 10;
  const mT = opts.title ? 26 : 12;
  const mB = 18;
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return frame(W, H, titleSvg(W, opts.title), "discrete plot");

  let lo = Math.min(0, ...finite);
  let hi = Math.max(0, ...finite);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;

  const plotW = W - mL - mR;
  const plotH = H - mT - mB;
  const n = values.length;
  const xAt = (i: number): number => mL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number): number => mT + ((hi - v) / (hi - lo)) * plotH;
  const zeroY = yAt(0);

  const stems = values
    .map((v, i) => {
      if (!Number.isFinite(v)) return "";
      const x = xAt(i);
      const y = yAt(v);
      return (
        `<line x1="${n2(x)}" y1="${n2(zeroY)}" x2="${n2(x)}" y2="${n2(y)}" stroke="${SERIES[0]}" stroke-width="1.5"/>` +
        `<circle cx="${n2(x)}" cy="${n2(y)}" r="2.5" fill="${SERIES[0]}"/>`
      );
    })
    .join("");

  const axis = `<line x1="${n2(mL)}" y1="${n2(zeroY)}" x2="${n2(W - mR)}" y2="${n2(zeroY)}" stroke="${AXIS}" stroke-width="1" opacity="0.5"/>`;

  return frame(W, H, titleSvg(W, opts.title) + axis + stems, "discrete plot");
}

/**
 * The chart the data asks for, when none is named -- the `Chart` family head's rule, and
 * the component's when `type` is `auto` or empty. Read off the shape alone:
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

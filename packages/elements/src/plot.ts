// Pure 2-D line-plot geometry: sampled (x, y) points in, themeable SVG string
// out. The element layer (notatio-plot) does the compute-engine sampling; this
// stays dependency-free and unit-testable. Non-finite y (poles, gaps) split the
// curve into separate polyline segments rather than drawing a spurious jump.
// Axes can be turned off (Wolfram's Axes) and either axis can carry a scaling
// function (Wolfram's ScalingFunctions -- log, sqrt, …). Several series overlay
// in distinct colours; a series can draw as points (ListPlot) instead of a
// line; a parametric curve is just a series whose points aren't x-sorted.

import { isLinear, scale } from "./scales.ts";

const ACCENT = "var(--notatio-accent, var(--vp-c-brand-1, #d97706))";
const AXIS = "var(--notatio-border, var(--vp-c-divider, currentColor))";
const FG = "var(--notatio-fg, currentColor)";
const BG = "var(--notatio-bg, var(--vp-c-bg, #ffffff))";
// Series colours: the accent first, then themeable fallbacks (Wolfram-ish 97).
const SERIES = [
  ACCENT,
  "var(--notatio-series-2, #2f7ed8)",
  "var(--notatio-series-3, #2ca02c)",
  "var(--notatio-series-4, #d62728)",
  "var(--notatio-series-5, #9467bd)",
  "var(--notatio-series-6, #8c564b)",
];

export interface PlotPoint {
  x: number;
  y: number;
}

export interface AdaptiveOptions {
  /** Uniform samples taken before refinement (default 41). */
  init?: number;
  /** Maximum times a segment may be halved (Wolfram's MaxRecursion; default 6). */
  maxDepth?: number;
  /** Relative bend tolerance: split when the midpoint deviates from the chord
   * by more than `tol` of the sampled y-span (default 0.004). */
  tol?: number;
  /** Hard cap on total evaluations, so a pathological curve stays bounded. */
  maxPoints?: number;
}

/**
 * Sample `f` over `[lo, hi]` the way Wolfram's `Plot` does: a uniform pass, then
 * recursive refinement wherever the curve bends (or crosses in/out of the
 * finite domain), so smooth stretches stay cheap and sharp features get extra
 * points. `f` is the only side of this that touches compute-engine; the routine
 * itself is pure and unit-tested. Returns points in ascending x.
 */
export function adaptiveSample(
  f: (x: number) => number,
  lo: number,
  hi: number,
  opts: AdaptiveOptions = {},
): PlotPoint[] {
  const init = Math.max(2, opts.init ?? 41);
  const maxDepth = Math.max(0, opts.maxDepth ?? 6);
  const tol = opts.tol ?? 0.004;
  const maxPoints = opts.maxPoints ?? 4000;

  const ys = new Map<number, number>();
  const at = (x: number): number => {
    let y = ys.get(x);
    if (y === undefined) {
      y = f(x);
      ys.set(x, y);
    }
    return y;
  };

  const x0 = Array.from({ length: init }, (_, i) => lo + ((hi - lo) * i) / (init - 1));
  for (const x of x0) at(x);

  const finite = [...ys.values()].filter(Number.isFinite);
  const span =
    finite.length > 0 ? Math.max(...finite) - Math.min(...finite) || Math.abs(finite[0]) || 1 : 1;

  const shouldSplit = (a: number, m: number, b: number): boolean => {
    const fa = Number.isFinite(a);
    const fm = Number.isFinite(m);
    const fb = Number.isFinite(b);
    // A finiteness transition (a pole/edge) is worth localizing.
    if (fa !== fm || fm !== fb) return true;
    if (!fm) return false;
    // How far the midpoint sits off the straight chord, relative to the span.
    return Math.abs(m - (a + b) / 2) > tol * span;
  };

  const rec = (xa: number, xb: number, ya: number, yb: number, depth: number): void => {
    if (depth >= maxDepth || ys.size >= maxPoints) return;
    const xm = (xa + xb) / 2;
    if (xm === xa || xm === xb) return; // floating-point floor
    const ym = at(xm);
    if (shouldSplit(ya, ym, yb)) {
      rec(xa, xm, ya, ym, depth + 1);
      rec(xm, xb, ym, yb, depth + 1);
    }
  };
  for (let i = 0; i < x0.length - 1; i++) rec(x0[i], x0[i + 1], at(x0[i]), at(x0[i + 1]), 0);

  return [...ys.entries()].sort((p, q) => p[0] - q[0]).map(([x, y]) => ({ x, y }));
}

/**
 * Adaptive parametric sampling: refine `f(t) = [x, y]` over `[lo, hi]` where the
 * traced curve bends in the plane (not just in y), so a Lissajous figure or a
 * tight loop gets extra points on its corners while straight runs stay cheap.
 * Points are returned in ascending `t` (curve order), never re-sorted by x.
 */
export function adaptiveParam(
  f: (t: number) => readonly [number, number],
  lo: number,
  hi: number,
  opts: AdaptiveOptions = {},
): PlotPoint[] {
  const init = Math.max(2, opts.init ?? 41);
  const maxDepth = Math.max(0, opts.maxDepth ?? 6);
  const tol = opts.tol ?? 0.004;
  const maxPoints = opts.maxPoints ?? 4000;

  const pts = new Map<number, readonly [number, number]>();
  const at = (t: number): readonly [number, number] => {
    let p = pts.get(t);
    if (p === undefined) {
      p = f(t);
      pts.set(t, p);
    }
    return p;
  };
  const t0 = Array.from({ length: init }, (_, i) => lo + ((hi - lo) * i) / (init - 1));
  for (const t of t0) at(t);

  // Scale the deviation test by the curve's bounding-box diagonal.
  const finite = [...pts.values()].filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const xs = finite.map((p) => p[0]);
  const ys = finite.map((p) => p[1]);
  const diag =
    Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;

  const ok = (p: readonly [number, number]): boolean =>
    Number.isFinite(p[0]) && Number.isFinite(p[1]);
  const shouldSplit = (
    a: readonly [number, number],
    m: readonly [number, number],
    b: readonly [number, number],
  ): boolean => {
    if (ok(a) !== ok(m) || ok(m) !== ok(b)) return true;
    if (!ok(m)) return false;
    // Distance of the midpoint from the chord's midpoint, relative to the box.
    return Math.hypot(m[0] - (a[0] + b[0]) / 2, m[1] - (a[1] + b[1]) / 2) > tol * diag;
  };
  const rec = (ta: number, tb: number, depth: number): void => {
    if (depth >= maxDepth || pts.size >= maxPoints) return;
    const tm = (ta + tb) / 2;
    if (tm === ta || tm === tb) return;
    if (shouldSplit(at(ta), at(tm), at(tb))) {
      rec(ta, tm, depth + 1);
      rec(tm, tb, depth + 1);
    }
  };
  for (let i = 0; i < t0.length - 1; i++) rec(t0[i], t0[i + 1], 0);

  return [...pts.entries()].sort((p, q) => p[0] - q[0]).map(([, [x, y]]) => ({ x, y }));
}

export interface PlotSeries {
  points: readonly PlotPoint[];
  /** `line` joins consecutive samples (default); `points` draws each as a dot. */
  style?: "line" | "points";
  /** Optional name shown in the hover readout. */
  label?: string;
}

export interface PlotOptions {
  width?: number;
  height?: number;
  /** Draw the zero-axes and range labels (default true). */
  axes?: boolean;
  /** Scaling function name for the x / y axis (default "linear"). */
  xScale?: string;
  yScale?: string;
  /**
   * Hover readout: the x (data space) under the pointer. Each series marks its
   * sample nearest that x and lists the coordinates.
   */
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
  /**
   * Recolour a line (or points) series along a blue→accent ramp by position
   * (Wolfram's ColorFunction) -- `"y"` by height, `"x"` by horizontal position.
   */
  colorBy?: "x" | "y";
}

/** A rendered plot plus the pixel→data mapping the element needs for hover. */
export interface RenderedPlot {
  svg: string;
  /** Data-space x for a viewBox x-coordinate (NaN when the plot is empty). */
  xAt: (px: number) => number;
}

const isSeriesList = (
  input: readonly PlotPoint[] | readonly PlotSeries[],
): input is readonly PlotSeries[] => input.length > 0 && "points" in input[0];

/** Format a number for an axis label: compact, at most 3 significant digits. */
function label(x: number): string {
  if (!Number.isFinite(x)) return "";
  if (x === 0) return "0";
  const abs = Math.abs(x);
  const s = abs >= 1000 || abs < 0.01 ? x.toExponential(1) : String(Math.round(x * 100) / 100);
  return s;
}

const n2 = (x: number): string => String(Math.round(x * 100) / 100);

/** Escape the few characters that can't sit as text inside SVG markup. */
const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * "Nice" round tick values inside `[lo, hi]` (roughly `count` of them), the
 * 1/2/5·10ⁿ ladder every axis library uses. Pure; drives gridlines and could
 * feed richer axis ticks later.
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

/**
 * Render sampled points as an SVG line plot. `points` are taken in x-order; y
 * values that are non-finite (or fall outside a scale's domain) break the line.
 * Returns an empty frame when nothing is finite.
 */
export function linePlotSvg(
  input: readonly PlotPoint[] | readonly PlotSeries[],
  opts: PlotOptions = {},
): string {
  return linePlot(input, opts).svg;
}

/** As `linePlotSvg`, also returning the pixel→data x mapping. */
export function linePlot(
  input: readonly PlotPoint[] | readonly PlotSeries[],
  opts: PlotOptions = {},
): RenderedPlot {
  const series: readonly PlotSeries[] = isSeriesList(input) ? input : [{ points: input }];
  const points = series.flatMap((s) => s.points);
  const W = opts.width ?? 340;
  const H = opts.height ?? 200;
  const mL = 38;
  const mR = 10;
  // A title needs headroom above the plot area.
  const mT = opts.title ? 26 : 12;
  const mB = 22;
  const showAxes = opts.axes !== false;
  const X = scale(opts.xScale);
  const Y = scale(opts.yScale);

  const frame = (body: string): string =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="plot">${body}</svg>`;

  // Everything downstream works in scaled space; only labels invert back.
  const txs = points.map((p) => X.fwd(p.x)).filter(Number.isFinite);
  const tys = points
    .filter((p) => Number.isFinite(X.fwd(p.x)))
    .map((p) => Y.fwd(p.y))
    .filter(Number.isFinite);
  if (txs.length === 0 || tys.length === 0) return { svg: frame(""), xAt: () => Number.NaN };

  const txmin = Math.min(...txs);
  const txmax = Math.max(...txs);
  let tymin: number;
  let tymax: number;
  if (opts.plotRange) {
    // Explicit window (PlotRange): take it verbatim in scaled space, no padding.
    [tymin, tymax] = [Y.fwd(opts.plotRange[0]), Y.fwd(opts.plotRange[1])];
    if (!(tymin < tymax)) [tymin, tymax] = [Math.min(...tys), Math.max(...tys)];
  } else {
    // Robust y-window from the 2nd/98th percentiles, so a pole's spike doesn't
    // dominate the range and flatten the rest of the curve.
    const sorted = [...tys].sort((a, b) => a - b);
    const quantile = (p: number): number => {
      const idx = p * (sorted.length - 1);
      const lo = Math.floor(idx);
      const hi = Math.ceil(idx);
      return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
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

  const plotW = W - mL - mR;
  const sx = (x: number): number => mL + ((X.fwd(x) - txmin) / (txmax - txmin || 1)) * plotW;
  const syT = (ty: number): number => mT + ((tymax - ty) / (tymax - tymin || 1)) * (H - mT - mB);
  const xAt = (px: number): number => X.inv(txmin + ((px - mL) / plotW) * (txmax - txmin));

  // Zero-axis pixel positions, shared by the axes, the fill baseline, and grid.
  const xZeroPx = isLinear(opts.xScale) && txmin <= 0 && 0 <= txmax ? sx(0) : mL;
  const yZeroPx = isLinear(opts.yScale) && tymin <= 0 && 0 <= tymax ? syT(0) : H - mB;

  const visible = (p: PlotPoint): boolean => {
    const ty = Y.fwd(p.y);
    return (
      Number.isFinite(X.fwd(p.x)) && Number.isFinite(ty) && ty <= tymax + span && ty >= tymin - span
    );
  };

  // Split into pixel-space segments so poles don't draw a vertical streak: break
  // on a non-finite/out-of-domain sample, one that shoots far outside the window
  // (an asymptote), or a jump larger than the whole window (a discontinuity).
  const lineSegments = (pts: readonly PlotPoint[]): Array<Array<[number, number]>> => {
    const segments: Array<Array<[number, number]>> = [];
    let current: Array<[number, number]> = [];
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
      current.push([sx(p.x), syT(ty)]);
      prevTy = ty;
    }
    flush();
    return segments;
  };
  const poly = (seg: ReadonlyArray<readonly [number, number]>): string =>
    seg.map(([x, y]) => `${n2(x)},${n2(y)}`).join(" ");

  // ColorFunction ramp: normalize a pixel position to [0,1] and mix blue→accent.
  const plotH = H - mT - mB;
  const rampAt = (px: number, py: number): number =>
    opts.colorBy === "x" ? (px - mL) / (plotW || 1) : (H - mB - py) / (plotH || 1);
  const ramp = (t: number): string =>
    `color-mix(in srgb, ${ACCENT} ${n2(Math.max(0, Math.min(1, t)) * 100)}%, ${SERIES[1]})`;

  let fills = "";
  const curves = series
    .map((s, k) => {
      const color = SERIES[k % SERIES.length];
      if (s.style === "points")
        return s.points
          .filter(visible)
          .map((p) => {
            const cx = sx(p.x);
            const cy = syT(Y.fwd(p.y));
            const fill = opts.colorBy ? ramp(rampAt(cx, cy)) : color;
            return `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="2.5" fill="${fill}"/>`;
          })
          .join("");
      const segs = lineSegments(s.points);
      if (opts.fill)
        fills += segs
          .filter((seg) => seg.length > 1)
          .map(
            (seg) =>
              `<polygon points="${n2(seg[0][0])},${n2(yZeroPx)} ${poly(seg)} ${n2(seg.at(-1)![0])},${n2(yZeroPx)}" fill="${color}" fill-opacity="0.12" stroke="none"/>`,
          )
          .join("");
      // ColorFunction: draw each adjacent pair as its own segment, coloured by
      // the pair's midpoint. Otherwise one polyline in the series colour.
      if (opts.colorBy)
        return segs
          .flatMap((seg) =>
            seg.slice(1).map((b, i) => {
              const a = seg[i];
              const t = rampAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
              return `<polyline points="${n2(a[0])},${n2(a[1])} ${n2(b[0])},${n2(b[1])}" fill="none" stroke="${ramp(t)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
            }),
          )
          .join("");
      return segs
        .map(
          (seg) =>
            `<polyline points="${poly(seg)}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
        )
        .join("");
    })
    .join("");

  // Gridlines sit behind everything, at nice tick positions in data space.
  let grid = "";
  if (opts.gridLines) {
    const gline = (x1: number, y1: number, x2: number, y2: number): string =>
      `<line x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}" stroke="${AXIS}" stroke-width="0.5" opacity="0.25"/>`;
    for (const tx of niceTicks(X.inv(txmin), X.inv(txmax)))
      grid += gline(sx(tx), mT, sx(tx), H - mB);
    for (const ty of niceTicks(Y.inv(tymin), Y.inv(tymax)))
      grid += gline(mL, syT(Y.fwd(ty)), W - mR, syT(Y.fwd(ty)));
  }

  // Axes + labels are the "chrome"; Axes:false drops them for a bare curve.
  let chrome = "";
  if (showAxes) {
    chrome += `<line x1="${n2(mL)}" y1="${n2(yZeroPx)}" x2="${n2(W - mR)}" y2="${n2(yZeroPx)}" stroke="${AXIS}" stroke-width="1" opacity="0.5"/>`;
    chrome += `<line x1="${n2(xZeroPx)}" y1="${n2(mT)}" x2="${n2(xZeroPx)}" y2="${n2(H - mB)}" stroke="${AXIS}" stroke-width="1" opacity="0.5"/>`;
    const text = (x: number, y: number, anchor: string, s: string): string =>
      `<text x="${n2(x)}" y="${n2(y)}" text-anchor="${anchor}" font-size="10" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.6">${s}</text>`;
    chrome +=
      text(mL, H - 6, "start", label(X.inv(txmin))) +
      text(W - mR, H - 6, "end", label(X.inv(txmax))) +
      text(mL - 4, mT + 6, "end", label(Y.inv(tymax))) +
      text(mL - 4, H - mB, "end", label(Y.inv(tymin)));
    if (opts.xLabel)
      chrome += `<text x="${n2(W - mR)}" y="${n2(mT + 10)}" text-anchor="end" font-size="10" font-style="italic" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.75">${esc(opts.xLabel)}</text>`;
    if (opts.yLabel)
      chrome += `<text x="${n2(mL + 4)}" y="${n2(mT + 10)}" text-anchor="start" font-size="10" font-style="italic" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.75">${esc(opts.yLabel)}</text>`;
  }

  // A centred title above the frame (PlotLabel).
  let titleSvg = "";
  if (opts.title)
    titleSvg = `<text x="${n2(W / 2)}" y="14" text-anchor="middle" font-size="12" font-family="ui-sans-serif, system-ui, sans-serif" fill="${FG}">${esc(opts.title)}</text>`;

  // Legend: a small stacked key of the labelled series, top-right.
  let legend = "";
  if (opts.legend) {
    const named = series
      .map((s, k) => ({ label: s.label, color: SERIES[k % SERIES.length] }))
      .filter((s) => s.label);
    named.forEach((s, k) => {
      const y = mT + 6 + 13 * k;
      legend +=
        `<line x1="${n2(W - mR - 60)}" y1="${n2(y)}" x2="${n2(W - mR - 46)}" y2="${n2(y)}" stroke="${s.color}" stroke-width="2"/>` +
        `<text x="${n2(W - mR - 42)}" y="${n2(y + 3)}" font-size="9" font-family="ui-monospace, monospace" fill="${FG}" paint-order="stroke" stroke="${BG}" stroke-width="2.5" stroke-linejoin="round">${esc(s.label as string)}</text>`;
    });
  }

  // Hover readout: a guide line at the pointer's x, and per series a marker on
  // the sample nearest it plus its coordinates, listed top-left of the plot.
  let readout = "";
  if (opts.hover !== undefined && Number.isFinite(opts.hover)) {
    const hx = X.fwd(opts.hover);
    const hits = series
      .map((s, k) => {
        let best: PlotPoint | undefined;
        for (const p of s.points) {
          if (!visible(p)) continue;
          if (!best || Math.abs(X.fwd(p.x) - hx) < Math.abs(X.fwd(best.x) - hx)) best = p;
        }
        return best ? { p: best, color: SERIES[k % SERIES.length], label: s.label } : undefined;
      })
      .filter((h) => h !== undefined);
    if (hits.length > 0) {
      const gx = sx(hits[0].p.x);
      readout += `<line x1="${n2(gx)}" y1="${n2(mT)}" x2="${n2(gx)}" y2="${n2(H - mB)}" stroke="${AXIS}" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>`;
      hits.forEach((h, k) => {
        const cx = n2(sx(h.p.x));
        const cy = n2(syT(Y.fwd(h.p.y)));
        readout += `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${BG}" stroke="${h.color}" stroke-width="2"/>`;
        const text = `${h.label ? `${h.label}: ` : ""}(${label(h.p.x)}, ${label(h.p.y)})`;
        readout += `<text x="${n2(mL + 6)}" y="${n2(mT + 11 + 12 * k)}" font-size="10" font-family="ui-monospace, monospace" fill="${h.color}" paint-order="stroke" stroke="${BG}" stroke-width="3" stroke-linejoin="round">${text}</text>`;
      });
    }
  }

  // Clip the curves to the plot area so a near-asymptote sample runs up to the
  // frame edge and stops there, rather than spilling past the figure. Unique id
  // per call: several plots share one document.
  const clipId = `nplot-${Math.random().toString(36).slice(2, 9)}`;
  // A little horizontal slack so an edge dot isn't sliced in half.
  const clip = `<clipPath id="${clipId}"><rect x="${n2(mL - 3)}" y="${n2(mT)}" width="${n2(plotW + 6)}" height="${n2(H - mT - mB)}"/></clipPath>`;
  const clipped = `<g clip-path="url(#${clipId})">${fills}${curves}</g>`;

  return { svg: frame(clip + grid + chrome + clipped + legend + titleSvg + readout), xAt };
}

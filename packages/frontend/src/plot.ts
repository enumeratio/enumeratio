// 2-D plot sampling: an expression's curves as points, adaptively where they bend. The drawing is
// `plot-box.ts` (sampled points lower to a `GraphicsBox`, which `svg()` writes); the element layer
// (`<graphics-box>`) does the compute-engine sampling. A parametric curve is just a series whose
// points aren't x-sorted.

import type { PlotPoint, PlotSeries } from "./plot-box.ts";

export {
  linePlot,
  linePlotSvg,
  niceTicks,
  type PlotFrame,
  type PlotOptions,
  type PlotPoint,
  type PlotSeries,
  type RenderedPlot,
} from "./plot-box.ts";

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
  const span = finite.length > 0 ? Math.max(...finite) - Math.min(...finite) || Math.abs(finite[0]) || 1 : 1;

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

  return [...ys.entries()].toSorted((p, q) => p[0] - q[0]).map(([x, y]) => ({ x, y }));
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
  const diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;

  const ok = (p: readonly [number, number]): boolean => Number.isFinite(p[0]) && Number.isFinite(p[1]);
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

  return [...pts.entries()].toSorted((p, q) => p[0] - q[0]).map(([, [x, y]]) => ({ x, y }));
}

/** A compiled curve as `plotSeries` reads it: its label, or the point it is. */
export interface SeriesItem {
  readonly label: string;
  readonly point?: readonly [number, number];
}

export interface SeriesOptions {
  readonly domain: readonly [number, number];
  readonly samples: number;
  /** `points` draws dots; anything else, lines (data points default to dots). */
  readonly mode?: string;
  readonly adaptive?: boolean;
  /** Read a pair of items as `(x(t), y(t))`. */
  readonly parametric?: boolean;
}

/**
 * The series `<Plot>` draws: `items` sampled over the domain by `at(k)`, item `k` as a
 * function of the plot variable. A pair of items is a parametric curve when asked; items that
 * are all points are data; otherwise each item is a curve, sampled adaptively unless not.
 */
export function plotSeries(
  items: readonly SeriesItem[],
  at: (k: number) => (t: number) => number,
  options: SeriesOptions,
): PlotSeries[] {
  const [lo, hi] = options.domain;
  const count = Math.max(2, Math.min(1000, options.samples));
  const ts = Array.from({ length: count }, (_, i) => lo + ((hi - lo) * i) / (count - 1));
  const style = options.mode === "points" ? "points" : "line";
  const useAdaptive = options.adaptive !== false && style === "line";
  if (options.parametric === true && items.length === 2) {
    // (x(t), y(t)) traced over the domain in t; refined by planar bend.
    const fxn = at(0);
    const fyn = at(1);
    const trace = (t: number): [number, number] => [fxn(t), fyn(t)];
    const points = useAdaptive
      ? adaptiveParam(trace, lo, hi, { init: count })
      : ts.map((t) => {
          const [x, y] = trace(t);
          return { x, y };
        });
    return [{ points, style }];
  }
  if (items.length > 0 && items.every((item) => item.point !== undefined)) {
    // A list of numeric pairs: data points, drawn as dots unless told otherwise.
    const points = items.map((item) => ({ x: item.point![0], y: item.point![1] }));
    return [{ points, style: options.mode === "line" ? "line" : "points" }];
  }
  return items.map((item, k) => {
    const en = at(k);
    return {
      points: useAdaptive ? adaptiveSample(en, lo, hi, { init: count }) : ts.map((t) => ({ x: t, y: en(t) })),
      style,
      label: items.length > 1 ? item.label : undefined,
    };
  });
}

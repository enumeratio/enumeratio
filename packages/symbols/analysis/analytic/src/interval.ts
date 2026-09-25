import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { ballImage } from "./interval-balls.ts";
import { type BoundOrigin, outwardBound } from "./interval-bounds.ts";
import { logShape, SHAPES, type Shape } from "./interval-shapes.ts";
import { imageOverArg } from "./tagged-calculus.ts";
import type { Resolver } from "./tagged-arithmetic.ts";

// Interval arithmetic over compute-engine's native `Interval(a, b)` -- a real set with no
// arithmetic of its own (`Add(Interval(1,2), Interval(3,4))` is a type error out of the box).
// A result CONTAINS every value the operation takes on its inputs (rigorous containment, as
// Wolfram's `Interval` promises): exact where the inputs are exact, rounded outward where they
// are not (interval-bounds.ts).
//
// A function's image over an interval is the least and greatest of its values at the endpoints
// and at every critical point inside. How the critical points are found decides whether the
// image is rigorous, so each head goes the first of these routes that applies:
//
// 1. Periodic heads (Sin … Csc) enumerate their critical points and poles exactly, period by
//    period. An interval across a pole has an image in two unbounded pieces, returned as a
//    `Union` of intervals, as Wolfram returns it.
// 2. Heads whose shape is a textbook fact (interval-shapes.ts: monotonic, or a single minimum
//    at a known point -- Cosh's at 0, Γ's at 1.4616…) need nothing else: exact endpoints give
//    an exact image, inexact ones a rigorous enclosure.
// 3. Heads whose value and derivative have certified kernels (interval-balls.ts: BarnesG and
//    LogBarnesG, PolyLog in z) prove their image by branch and bound over balls, at exact
//    arguments and endpoints: monotonic pieces give their ends' values, and the mean-value form
//    closes in on an extremum. Where those kernels can't cover the interval, sampling takes over.
// 4. Everything else samples its derivative's sign (tagged-calculus.ts) and declines when that
//    is ambiguous. That can miss a pair of extrema between two samples, so these heads are NOT
//    rigorous -- `NOT_RIGOROUS` below lists them, and their reference entries say so.
//
// compute-engine ships a floating-point interval kernel (`@cortex-js/compute-engine/interval`)
// that looks like it would serve for Γ, but it is not rigorous there: its `gamma` misses the
// true value by a few ulps (Γ(2.5) falls below its lower bound), and its `gammaln` returns
// `lo > hi` on (0, 1.4616…). Both are recorded in design/upstreaming.md §8; Γ's shape is known,
// so route 2 covers it without the kernel.

// `Subtract(a, b)` is not handled directly: compute-engine canonicalizes it to
// `Add(a, Negate(b))` at box time, before any operator-level hook sees a `Subtract` head, so
// a `Negate` resolver plus the generic `Add` one already covers it (and reproduces the
// "dependency problem" example: `Interval(1,2) - Interval(1,2)` is `Interval(-1,1)`, not
// `Interval(0,0)`, since the two copies are treated as independent quantities).
//
// Endpoints are kept as exact boxed expressions (not doubles), so `Interval(1, 2) +
// Interval(3, 4)` stays `Interval(4, 6)` rather than losing exactness. `numAt` (a numeric
// approximation) only ever decides WHICH endpoint is smaller/larger — the returned
// expression is the exact one, or, when it is inexact, its outward rounding.
//
// Registered via tagged-arithmetic.ts's `registerTaggedHeads`, not directly: see that file
// for why (a per-head, per-tagged-type `wrapOperator` chain cost ~4x on every Add/Multiply
// in the engine, tagged or not).

const isInterval = (e: BoxedExpression): boolean =>
  e.operator === "Interval" && operandsOf(e).length === 2;

const lo = (e: BoxedExpression): BoxedExpression => operandsOf(e)[0];
const hi = (e: BoxedExpression): BoxedExpression => operandsOf(e)[1];

/** A numeric approximation of `e`, for ordering endpoints only — never the returned value. */
const numAt = (e: BoxedExpression): number => e.N().re;

const minOf = (xs: readonly BoxedExpression[]): BoxedExpression =>
  xs.reduce((a, b) => (numAt(b) < numAt(a) ? b : a));
const maxOf = (xs: readonly BoxedExpression[]): BoxedExpression =>
  xs.reduce((a, b) => (numAt(b) > numAt(a) ? b : a));

/** Unary heads with no known shape (interval-shapes.ts), or one known on part of the axis only
 * (Zeta, right of its pole): their images come from sampling the derivative's sign
 * (tagged-calculus.ts), which can miss a pair of extrema lying between two samples -- except
 * where the third route proves them (BarnesG, LogBarnesG). */
const NOT_RIGOROUS_UNARY = [
  "BarnesG",
  "LogBarnesG",
  "DirichletEta",
  "DirichletBeta",
  "Zeta",
  "CatalanNumber",
] as const;

/** `{head: the argument position an Interval can occupy}` for the multi-argument heads --
 * every other argument is taken as given (exact, fixed) by `imageOverArg`. All of them are
 * sampled, like `NOT_RIGOROUS_UNARY` -- PolyLog only where the third route declines. */
const MULTI_ARG_IMAGE_HEADS: Readonly<Record<string, number>> = {
  StieltjesGamma: 1,
  HarmonicNumber: 1,
  DirichletL: 2,
  PolyGamma: 1,
  PolyLog: 1,
  GammaRegularized: 1,
  BetaRegularized: 0,
  Binomial: 1,
};

/** Every head whose interval image is, or may be, sampled rather than guaranteed -- see the file
 * header's fourth route. BarnesG, LogBarnesG and PolyLog are sampled only where the third
 * route's proof declines, Zeta only left of its pole. The reference entries say so. */
export const NOT_RIGOROUS: readonly string[] = [
  ...NOT_RIGOROUS_UNARY,
  ...Object.keys(MULTI_ARG_IMAGE_HEADS),
];

/** This module's resolvers, one per head it extends — see the file header. Built once per
 * engine and merged with CenteredInterval's and Around's before a single
 * `registerTaggedHeads` call per head (see `declare-tagged-arithmetic.ts`) — never
 * registered here directly, so Add/Multiply/etc. are wrapped exactly once no matter how
 * many of the three tagged types extend them. */
export function intervalResolvers(ce: ComputeEngine): Readonly<Record<string, Resolver>> {
  const add = (a: BoxedExpression, b: BoxedExpression) => ce.function("Add", [a, b]).evaluate();
  const neg = (a: BoxedExpression) => ce.function("Negate", [a]).evaluate();
  const mul = (a: BoxedExpression, b: BoxedExpression) =>
    ce.function("Multiply", [a, b]).evaluate();
  const div = (a: BoxedExpression, b: BoxedExpression) => ce.function("Divide", [a, b]).evaluate();
  const pow = (a: BoxedExpression, n: number) => ce.function("Power", [a, n]).evaluate();
  const interval = (l: BoxedExpression | number, h: BoxedExpression | number) =>
    ce.function("Interval", [l, h]).evaluate();
  /** `e` as an interval, degenerate `[e, e]` if it is a plain number. */
  const asInterval = (e: BoxedExpression) => (isInterval(e) ? e : interval(e, e));
  /** `[l, h]` with each bound made safe: exact when it is, otherwise rounded outward (see
   * interval-bounds.ts for why an arithmetic result and a function value differ). */
  const enclosure = (l: BoxedExpression, h: BoxedExpression, origin: BoundOrigin) =>
    interval(outwardBound(ce, l, "lo", origin), outwardBound(ce, h, "hi", origin));

  const intervalNegate = (a: BoxedExpression): BoxedExpression => {
    const A = asInterval(a);
    return interval(neg(hi(A)), neg(lo(A)));
  };
  const intervalAdd = (a: BoxedExpression, b: BoxedExpression): BoxedExpression => {
    const A = asInterval(a);
    const B = asInterval(b);
    return enclosure(add(lo(A), lo(B)), add(hi(A), hi(B)), "arithmetic");
  };
  const intervalMul = (a: BoxedExpression, b: BoxedExpression): BoxedExpression => {
    const A = asInterval(a);
    const B = asInterval(b);
    const products = [mul(lo(A), lo(B)), mul(lo(A), hi(B)), mul(hi(A), lo(B)), mul(hi(A), hi(B))];
    return enclosure(minOf(products), maxOf(products), "arithmetic");
  };
  /** 1/I for an interval not containing 0 — decreasing on each branch, so `[1/hi, 1/lo]`
   * whichever side of 0 it's on. */
  const intervalRecip = (a: BoxedExpression): BoxedExpression | undefined => {
    const A = asInterval(a);
    if (numAt(lo(A)) <= 0 && numAt(hi(A)) >= 0) return undefined; // 0 in range: no reciprocal
    return enclosure(div(ce.One, hi(A)), div(ce.One, lo(A)), "arithmetic");
  };
  const intervalDiv = (a: BoxedExpression, b: BoxedExpression): BoxedExpression | undefined => {
    const recip = intervalRecip(b);
    return recip === undefined ? undefined : intervalMul(a, recip);
  };
  /** Integer powers only — the exponent the examples use, and the case with a clean rule:
   * odd powers are monotonic, even powers fold to `[0, …]` once the interval straddles 0. */
  const intervalPow = (a: BoxedExpression, n: BoxedExpression): BoxedExpression | undefined => {
    if (n.im !== 0 || !Number.isInteger(n.re) || n.re < 0) return undefined;
    const A = asInterval(a);
    const l = lo(A);
    const h = hi(A);
    if (n.re % 2 === 1) return enclosure(pow(l, n.re), pow(h, n.re), "arithmetic");
    if (numAt(l) >= 0) return enclosure(pow(l, n.re), pow(h, n.re), "arithmetic");
    if (numAt(h) <= 0) return enclosure(pow(h, n.re), pow(l, n.re), "arithmetic");
    return enclosure(ce.Zero, maxOf([pow(l, n.re), pow(h, n.re)]), "arithmetic");
  };
  const intervalAbs = (a: BoxedExpression): BoxedExpression => {
    const A = asInterval(a);
    const l = lo(A);
    const h = hi(A);
    if (numAt(l) >= 0) return A;
    if (numAt(h) <= 0) return interval(neg(h), neg(l));
    return interval(0, maxOf([neg(l), h]));
  };
  /** `Interval(-∞, ∞)`-ish bound: is this endpoint infinite? Only `Sin`/`Cos` get a rule for
   * it (bounded oscillation, so the image is `[-1, 1]` regardless of how wide the interval
   * is) — every other head here declines on an infinite bound, via `imageOverArg`'s own
   * `Number.isFinite` check. */
  const isInfinite = (e: BoxedExpression): boolean => !Number.isFinite(numAt(e));

  /** Exact `(k + phaseNum/phaseDen)·π` — a periodic head's poles and critical points are both
   * equally spaced multiples of π plus a half-integer phase, so this builds either kind of
   * point exactly (an integer or half-integer coefficient times the exact symbol `Pi`, never
   * a decimal), for `pointsInRange` below. */
  const piMultiple = (k: number, phaseNum: number, phaseDen: number): BoxedExpression => {
    const numerator = k * phaseDen + phaseNum;
    const coefficient =
      phaseDen === 1
        ? ce.number(numerator)
        : ce.function("Rational", [numerator, phaseDen]).evaluate();
    return ce.function("Multiply", [coefficient, "Pi"]).evaluate();
  };

  /** Every point `(k + phaseNum/phaseDen)·π` in the CLOSED interval `[l, h]` (numeric bounds),
   * for integer `k` — used for both a periodic head's poles and its critical points, which are
   * both equally-spaced families of this shape. Inclusive (with a small tolerance) rather than
   * strictly-interior: a pole sitting right at an endpoint is still a pole to decline on, and a
   * critical point sitting right at an endpoint is already covered by the endpoint evaluation,
   * so including it again is harmless. */
  const pointsInRange = (
    l: number,
    h: number,
    phaseNum: number,
    phaseDen: number,
  ): BoxedExpression[] => {
    const phase = phaseNum / phaseDen;
    const eps = 1e-9;
    const kLow = Math.ceil(l / Math.PI - phase - eps);
    const kHigh = Math.floor(h / Math.PI - phase + eps);
    const points: BoxedExpression[] = [];
    for (let k = kLow; k <= kHigh; k++) points.push(piMultiple(k, phaseNum, phaseDen));
    return points;
  };

  /** `{head: [phaseNum, phaseDen]}` for the phase of a periodic head's POLES — all at
   * `(k + phase)·π`. `Tan`/`Sec` at `π/2 + kπ`; `Cot`/`Csc` at `kπ`. `Sin`/`Cos` have none. */
  const PERIODIC_POLES: Readonly<Record<string, readonly [number, number]>> = {
    Tan: [1, 2],
    Sec: [1, 2],
    Cot: [0, 1],
    Csc: [0, 1],
  };

  /** `{head: [phaseNum, phaseDen]}` for the phase of a periodic head's CRITICAL points (where
   * its derivative is 0 or undefined-but-extremal) — `Sin` at `π/2 + kπ`, `Cos` at `kπ`,
   * `Sec`'s extrema sit at `Cos`'s (`kπ`, where `Sec = ±1`), `Csc`'s at `Sin`'s (`π/2 + kπ`,
   * where `Csc = ±1`). `Tan`/`Cot` have none — strictly monotonic on each branch between
   * poles, so once a pole is ruled out, their two endpoints alone bound the image. */
  const PERIODIC_CRITICAL: Readonly<Record<string, readonly [number, number]>> = {
    Sin: [1, 2],
    Cos: [0, 1],
    Sec: [0, 1],
    Csc: [1, 2],
  };

  /** Which way a periodic head heads off to infinity just beside the pole `pole`, on the side
   * `side` of it: the sign of its value a hair away. Near a simple pole the sign is constant on
   * each side, so one nearby point decides it. */
  const infinityBeside = (
    head: string,
    pole: BoxedExpression,
    side: "below" | "above",
  ): BoxedExpression => {
    const p = numAt(pole);
    const hair = 1e-9 * Math.max(1, Math.abs(p));
    const value = ce.function(head, [ce.number(side === "below" ? p - hair : p + hair)]).N().re;
    return value > 0 ? ce.PositiveInfinity : ce.NegativeInfinity;
  };

  /** `[a, b]` pieces merged where they overlap or touch, as one `Interval`, or a `Union` of
   * disjoint ones in increasing order. */
  const unionOf = (pieces: readonly (readonly [BoxedExpression, BoxedExpression])[]) => {
    const sorted = [...pieces].sort((x, y) => numAt(x[0]) - numAt(y[0]));
    const merged: [BoxedExpression, BoxedExpression][] = [];
    for (const [a, b] of sorted) {
      const last = merged.at(-1);
      if (last !== undefined && numAt(a) <= numAt(last[1])) {
        if (numAt(b) > numAt(last[1])) last[1] = b;
      } else {
        merged.push([a, b]);
      }
    }
    const intervals = merged.map(([a, b]) => enclosure(a, b, "function"));
    return intervals.length === 1 ? intervals[0]! : ce.function("Union", intervals);
  };

  /**
   * `Sin`, `Cos`, `Tan`, `Cot`, `Sec`, `Csc` over a finite `Interval`: exact enumeration, not
   * sampling — a periodic function can oscillate arbitrarily many times across a wide interval
   * (`Cos(Interval(-1, 4))` spans both a maximum at 0 and a minimum at π), so no finite sample
   * of its derivative can be trusted. The interval is cut at every pole in it; on each piece
   * the image is the min/max of its values at the piece's ends and at every critical point
   * inside, each evaluated exactly (a critical point is an exact multiple of π), and a piece's
   * end AT a pole runs off to the infinity the head approaches there. The pieces' images are
   * merged: `Cot(Interval(-π/4, π/4))` is `(-∞, -1] ∪ [1, ∞)`, and `Tan(Interval(0, π))`,
   * whose two pieces cover every real, is `Interval(-∞, ∞)`.
   */
  const periodicImage = (head: string, a: BoxedExpression): BoxedExpression | undefined => {
    const A = asInterval(a);
    const l = lo(A);
    const h = hi(A);
    const lNum = numAt(l);
    const hNum = numAt(h);
    if (!Number.isFinite(lNum) || !Number.isFinite(hNum)) return undefined;
    const evaluateHeadAt = (x: BoxedExpression) => ce.function(head, [x]).evaluate();
    const phase = PERIODIC_POLES[head];
    const poles = phase === undefined ? [] : pointsInRange(lNum, hNum, phase[0], phase[1]);
    const critical = PERIODIC_CRITICAL[head];

    // Cut [l, h] at each pole: a piece is [start, end] with either end possibly a pole.
    const pieces: (readonly [BoxedExpression, BoxedExpression])[] = [];
    const cuts: { at: BoxedExpression; pole: boolean }[] = [
      { at: l, pole: false },
      ...poles.map((at) => ({ at, pole: true })),
      { at: h, pole: false },
    ];
    for (let i = 0; i + 1 < cuts.length; i++) {
      const start = cuts[i]!;
      const end = cuts[i + 1]!;
      if (numAt(end.at) - numAt(start.at) <= 0) continue; // a pole sitting on an endpoint
      const values: BoxedExpression[] = [];
      if (start.pole) values.push(infinityBeside(head, start.at, "above"));
      else values.push(evaluateHeadAt(start.at));
      if (end.pole) values.push(infinityBeside(head, end.at, "below"));
      else values.push(evaluateHeadAt(end.at));
      if (critical !== undefined) {
        const [s, e] = [numAt(start.at), numAt(end.at)];
        for (const point of pointsInRange(s, e, critical[0], critical[1])) {
          values.push(evaluateHeadAt(point));
        }
      }
      pieces.push([minOf(values), maxOf(values)]);
    }
    if (pieces.length === 0) return undefined;
    return unionOf(pieces);
  };

  /** A head of known `shape` over `[l, h]`: its values at the endpoints, plus the minimum if it
   * lies inside -- exact whenever the endpoints are. Declines past the head's real domain. */
  const shapedImage = (
    shape: Shape,
    valueAt: (x: BoxedExpression) => BoxedExpression,
    l: BoxedExpression,
    h: BoxedExpression,
  ): BoxedExpression | undefined => {
    const lNum = numAt(l);
    const hNum = numAt(h);
    if (Number.isNaN(lNum) || Number.isNaN(hNum) || lNum > hNum) return undefined;
    const domain = shape.domain;
    if (domain !== undefined) {
      if (lNum < domain.from || hNum > domain.to) return undefined;
      if (domain.open === true && lNum === domain.from) return undefined; // a pole at `from`
    }
    const [fl, fh] = [valueAt(l), valueAt(h)];
    if (shape.kind === "increasing") return enclosure(fl, fh, "function");
    if (shape.kind === "decreasing") return enclosure(fh, fl, "function");
    const bottom = ce.number(shape.at);
    const least = lNum <= shape.at && shape.at <= hNum ? valueAt(bottom) : minOf([fl, fh]);
    return enclosure(least, maxOf([fl, fh]), "function");
  };

  /**
   * `head`'s image over `ops[argIndex]` (an [[Interval]]), by the first route in the file
   * header that answers: a known shape, a proof over balls, or -- for the heads in
   * `NOT_RIGOROUS` only -- `imageOverArg`'s derivative-sign sampling. Declines when none does,
   * never a guess past them.
   */
  const image = (
    ops: readonly BoxedExpression[],
    head: string,
    argIndex: number,
  ): BoxedExpression | undefined => {
    const target = ops[argIndex];
    if (target === undefined || !isInterval(target)) return undefined;
    const [l, h] = [lo(target), hi(target)];
    const shape = ops.length === 1 ? SHAPES[head] : undefined;
    if (shape !== undefined) {
      const shaped = shapedImage(shape, (x) => ce.function(head, [x]).evaluate(), l, h);
      if (shaped !== undefined) return shaped;
    }
    const proven = ballImage(head, ops, argIndex, l, h);
    if (proven !== undefined) {
      // Already rigorous and rounded outward: not to be stepped out again.
      return interval(ce.box({ num: proven.lo.toString() }), ce.box({ num: proven.hi.toString() }));
    }
    if (!NOT_RIGOROUS.includes(head)) return undefined;
    const result = imageOverArg(ce, head, ops, argIndex, l, h);
    return result === undefined ? undefined : enclosure(result.lo, result.hi, "function");
  };

  /** `Log(x, b)`, with `Log(x)` base 10 (compute-engine's reading, and what `Log10` and
   * `Log2` canonicalize to): monotonic in `x` for any base in (0, 1) or above 1. */
  const logImage = (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
    const [x, b] = ops;
    if (x === undefined || !isInterval(x) || ops.length > 2) return undefined;
    const base = b ?? ce.number(10);
    const shape = logShape(numAt(base));
    if (shape === undefined) return undefined;
    const valueAt = (at: BoxedExpression) =>
      ce.function("Log", b === undefined ? [at] : [at, base]).evaluate();
    return shapedImage(shape, valueAt, lo(x), hi(x));
  };

  /** `Sin`/`Cos` alone: bounded oscillation makes the image `[-1, 1]` on an infinite bound,
   * where `periodicImage`'s finite-endpoint enumeration can't apply at all. A finite bound
   * falls through to `periodicImage`. */
  const boundedOscillation = (a: BoxedExpression, head: string): BoxedExpression | undefined => {
    const A = asInterval(a);
    if (isInfinite(lo(A)) || isInfinite(hi(A))) return interval(-1, 1);
    return periodicImage(head, a);
  };

  /** Unary heads whose image over an `Interval` argument is `image([a], head, 0)`: a shape
   * from interval-shapes.ts, or else sampling (`NOT_RIGOROUS`). */
  const UNARY_IMAGE_HEADS = [...new Set([...Object.keys(SHAPES), ...NOT_RIGOROUS_UNARY])];

  const resolvers: Record<string, Resolver> = {
    Negate: (ops) =>
      ops.length === 1 && ops[0] !== undefined && isInterval(ops[0])
        ? intervalNegate(ops[0])
        : undefined,
    Add: (ops) => (ops.some(isInterval) ? ops.reduce((acc, e) => intervalAdd(acc, e)) : undefined),
    Multiply: (ops) =>
      ops.some(isInterval) ? ops.reduce((acc, e) => intervalMul(acc, e)) : undefined,
    Divide: (ops) => {
      if (ops.length !== 2) return undefined;
      const [a, b] = ops;
      return a !== undefined && b !== undefined && (isInterval(a) || isInterval(b))
        ? intervalDiv(a, b)
        : undefined;
    },
    Power: (ops, raw) => {
      if (ops.length !== 2) return undefined;
      const [a, n] = ops;
      if (a === undefined || n === undefined) return undefined;
      if (isInterval(a)) return intervalPow(a, n);
      // `Exp`, which canonicalizes to `Power(E, x)` — `raw` (pre-numericization) catches
      // this even under N(), where `a` has already been decimalized (see
      // tagged-arithmetic.ts's Resolver doc); Exp is monotonic increasing everywhere, no
      // extremum to find, so a direct endpoint image is exact.
      const rawA = raw[0] ?? a;
      if (rawA.isSame(ce.E) && isInterval(n)) {
        const exp = (x: BoxedExpression) => ce.function("Exp", [x]).evaluate();
        return shapedImage({ kind: "increasing" }, exp, lo(n), hi(n));
      }
      return undefined;
    },
    Abs: (ops) =>
      ops.length === 1 && ops[0] !== undefined && isInterval(ops[0])
        ? intervalAbs(ops[0])
        : undefined,
    Sin: (ops) =>
      ops.length === 1 && ops[0] !== undefined && isInterval(ops[0])
        ? boundedOscillation(ops[0], "Sin")
        : undefined,
    Cos: (ops) =>
      ops.length === 1 && ops[0] !== undefined && isInterval(ops[0])
        ? boundedOscillation(ops[0], "Cos")
        : undefined,
    Tan: (ops) =>
      ops.length === 1 && ops[0] !== undefined && isInterval(ops[0])
        ? periodicImage("Tan", ops[0])
        : undefined,
    Cot: (ops) =>
      ops.length === 1 && ops[0] !== undefined && isInterval(ops[0])
        ? periodicImage("Cot", ops[0])
        : undefined,
    Sec: (ops) =>
      ops.length === 1 && ops[0] !== undefined && isInterval(ops[0])
        ? periodicImage("Sec", ops[0])
        : undefined,
    Csc: (ops) =>
      ops.length === 1 && ops[0] !== undefined && isInterval(ops[0])
        ? periodicImage("Csc", ops[0])
        : undefined,
    Log: logImage,
    Sign: (ops) => {
      const a = ops.length === 1 ? ops[0] : undefined;
      if (a === undefined || !isInterval(a)) return undefined;
      const A = asInterval(a);
      if (numAt(lo(A)) > 0) return ce.One;
      if (numAt(hi(A)) < 0) return ce.NegativeOne;
      return undefined; // straddles (or touches) 0: no single sign, decline
    },
    Max: (ops) => {
      if (ops.length !== 2 || !ops.some(isInterval)) return undefined;
      const [a, b] = ops.map(asInterval) as [BoxedExpression, BoxedExpression];
      return interval(maxOf([lo(a), lo(b)]), maxOf([hi(a), hi(b)]));
    },
    Min: (ops) => {
      if (ops.length !== 2 || !ops.some(isInterval)) return undefined;
      const [a, b] = ops.map(asInterval) as [BoxedExpression, BoxedExpression];
      return interval(minOf([lo(a), lo(b)]), minOf([hi(a), hi(b)]));
    },
  };
  for (const head of UNARY_IMAGE_HEADS) {
    resolvers[head] = (ops) => (ops.length === 1 ? image(ops, head, 0) : undefined);
  }
  for (const [head, argIndex] of Object.entries(MULTI_ARG_IMAGE_HEADS)) {
    resolvers[head] = (ops) => image(ops, head, argIndex);
  }
  return resolvers;
}

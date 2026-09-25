import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { imageOverArg } from "./tagged-calculus.ts";
import type { Resolver } from "./tagged-arithmetic.ts";

// Interval arithmetic over compute-engine's native `Interval(a, b)` — a real set with no
// arithmetic of its own (`Add(Interval(1,2), Interval(3,4))` is a type error out of the
// box). This covers the arithmetic operators Wolfram's examples actually push an interval
// through: Add, Negate (which also covers Subtract — see below), Multiply, Divide, Power
// (integer exponents), Abs, and Sin over a sub-range of one monotonic branch. Every other
// function stays untouched — Wolfram's own interval support is comparably narrow outside
// the elementary functions.
//
// `Subtract(a, b)` is not handled directly: compute-engine canonicalizes it to
// `Add(a, Negate(b))` at box time, before any operator-level hook sees a `Subtract` head, so
// a `Negate` resolver plus the generic `Add` one already covers it (and reproduces the
// "dependency problem" example: `Interval(1,2) - Interval(1,2)` is `Interval(-1,1)`, not
// `Interval(0,0)`, since the two copies are treated as independent quantities).
//
// Endpoints are kept as exact boxed expressions (not doubles), so `Interval(1, 2) +
// Interval(3, 4)` stays `Interval(4, 6)` rather than losing exactness. `numAt` (a numeric
// approximation) only ever decides WHICH endpoint is smaller/larger — the returned
// expression is always the exact one, never the approximation.
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

  const intervalNegate = (a: BoxedExpression): BoxedExpression => {
    const A = asInterval(a);
    return interval(neg(hi(A)), neg(lo(A)));
  };
  const intervalAdd = (a: BoxedExpression, b: BoxedExpression): BoxedExpression => {
    const A = asInterval(a);
    const B = asInterval(b);
    return interval(add(lo(A), lo(B)), add(hi(A), hi(B)));
  };
  const intervalMul = (a: BoxedExpression, b: BoxedExpression): BoxedExpression => {
    const A = asInterval(a);
    const B = asInterval(b);
    const products = [mul(lo(A), lo(B)), mul(lo(A), hi(B)), mul(hi(A), lo(B)), mul(hi(A), hi(B))];
    return interval(minOf(products), maxOf(products));
  };
  /** 1/I for an interval not containing 0 — decreasing on each branch, so `[1/hi, 1/lo]`
   * whichever side of 0 it's on. */
  const intervalRecip = (a: BoxedExpression): BoxedExpression | undefined => {
    const A = asInterval(a);
    if (numAt(lo(A)) <= 0 && numAt(hi(A)) >= 0) return undefined; // 0 in range: no reciprocal
    return interval(div(ce.One, hi(A)), div(ce.One, lo(A)));
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
    if (n.re % 2 === 1) return interval(pow(l, n.re), pow(h, n.re));
    if (numAt(l) >= 0) return interval(pow(l, n.re), pow(h, n.re));
    if (numAt(h) <= 0) return interval(pow(h, n.re), pow(l, n.re));
    return interval(0, maxOf([pow(l, n.re), pow(h, n.re)]));
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

  /**
   * `head`'s image over `ops[argIndex]` (an [[Interval]]), via `imageOverArg`'s
   * derivative-sign-and-bisection rule — correct for a monotonic branch AND for the single
   * interior extremum case (Γ's minimum inside [1.4, 1.5] is exactly this: the derivative
   * flips sign, `imageOverArg` bisects on it and adds the extremum as a third candidate,
   * rather than just sorting the two endpoints). Declines whenever the derivative isn't
   * finite at an endpoint or the sign check doesn't resolve — never a guess past what the
   * derivative shows.
   */
  const image = (
    ops: readonly BoxedExpression[],
    head: string,
    argIndex: number,
  ): BoxedExpression | undefined => {
    const target = ops[argIndex];
    if (target === undefined || !isInterval(target)) return undefined;
    const result = imageOverArg(ce, head, ops, argIndex, lo(target), hi(target));
    return result === undefined ? undefined : interval(result.lo, result.hi);
  };

  /** `Sin`/`Cos` alone: bounded oscillation makes the image `[-1, 1]` on an infinite bound,
   * where `imageOverArg`'s finite-endpoint derivative check can't apply at all. A finite
   * bound falls through to the general `image` rule above. */
  const boundedOscillation = (a: BoxedExpression, head: string): BoxedExpression | undefined => {
    const A = asInterval(a);
    if (isInfinite(lo(A)) || isInfinite(hi(A))) return interval(-1, 1);
    return image([a], head, 0);
  };

  /** Does the OPEN interval `(l, h)` contain a pole at `phase + k·period` for some integer
   * `k`? Declines `Tan`/`Cot`/`Sec`/`Csc` rather than return an interval that silently skips
   * the unbounded piece on either side (Wolfram's own answer there is a `Union` of two
   * unbounded intervals — out of scope for a rule that returns one `Interval`). */
  const hasPoleBetween = (l: number, h: number, period: number, phase: number): boolean => {
    const kLow = Math.ceil((l - phase) / period + 1e-9);
    const kHigh = Math.floor((h - phase) / period - 1e-9);
    return kLow <= kHigh;
  };

  const HALF_PI = Math.PI / 2;
  /** `Tan`/`Sec` have poles at `π/2 + kπ`; `Cot`/`Csc` at `kπ`. */
  const declinesOnPole = (
    l: BoxedExpression,
    h: BoxedExpression,
    period: number,
    phase: number,
  ): boolean => hasPoleBetween(numAt(l), numAt(h), period, phase);

  /** Unary heads whose image over an `Interval` argument is exactly `image([a], head, 0)` —
   * every one checked against `derivativeAt` (see tagged-calculus.ts and .scratch/probe2.ts)
   * either resolves symbolically or falls back to a numeric derivative that still correctly
   * detects the sign flip a Γ- or ζ-shaped function can have. `Cosh`, `Log2` and `Log10` are
   * NOT here: an Interval argument to any of the three is rejected before our resolver is
   * even reached — see declare-tagged-arithmetic.ts's header comment. */
  const UNARY_IMAGE_HEADS = [
    "Arcsin",
    "Arccos",
    "Arctan",
    "Sinh",
    "Tanh",
    "Ln",
    "Sqrt",
    "Gamma",
    "GammaLn",
    "LogGamma",
    "Digamma",
    "BarnesG",
    "LogBarnesG",
    "DirichletEta",
    "DirichletBeta",
    "Erf",
    "Erfc",
    "ErfInv",
    "Zeta",
    "CatalanNumber",
  ] as const;

  /** `{head: the argument position an Interval can occupy}` for the multi-argument heads —
   * every other argument is taken as given (exact, fixed) by `imageOverArg`. */
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
        const N = asInterval(n);
        return interval(
          ce.function("Exp", [lo(N)]).evaluate(),
          ce.function("Exp", [hi(N)]).evaluate(),
        );
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
    Tan: (ops) => {
      const a = ops.length === 1 ? ops[0] : undefined;
      if (a === undefined || !isInterval(a)) return undefined;
      const A = asInterval(a);
      if (declinesOnPole(lo(A), hi(A), Math.PI, HALF_PI)) return undefined;
      return image([a], "Tan", 0);
    },
    Cot: (ops) => {
      const a = ops.length === 1 ? ops[0] : undefined;
      if (a === undefined || !isInterval(a)) return undefined;
      const A = asInterval(a);
      if (declinesOnPole(lo(A), hi(A), Math.PI, 0)) return undefined;
      return image([a], "Cot", 0);
    },
    Sec: (ops) => {
      const a = ops.length === 1 ? ops[0] : undefined;
      if (a === undefined || !isInterval(a)) return undefined;
      const A = asInterval(a);
      if (declinesOnPole(lo(A), hi(A), Math.PI, HALF_PI)) return undefined;
      return image([a], "Sec", 0);
    },
    Csc: (ops) => {
      const a = ops.length === 1 ? ops[0] : undefined;
      if (a === undefined || !isInterval(a)) return undefined;
      const A = asInterval(a);
      if (declinesOnPole(lo(A), hi(A), Math.PI, 0)) return undefined;
      return image([a], "Csc", 0);
    },
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

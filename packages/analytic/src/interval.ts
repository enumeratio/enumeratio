import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
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
  /** Sin over an interval fully inside `[-π/2, π/2]`, where it is monotonic increasing.
   * Declines (stays unevaluated) outside that branch — Wolfram's own interval support for
   * transcendental functions is this narrow too, branch-by-branch. */
  const intervalSin = (a: BoxedExpression): BoxedExpression | undefined => {
    const A = asInterval(a);
    const l = lo(A);
    const h = hi(A);
    const HALF_PI = Math.PI / 2;
    if (numAt(l) < -HALF_PI || numAt(h) > HALF_PI) return undefined;
    return interval(ce.function("Sin", [l]).evaluate(), ce.function("Sin", [h]).evaluate());
  };

  return {
    Negate: ([a]) => (a !== undefined && isInterval(a) ? intervalNegate(a) : undefined),
    Add: (ops) => (ops.some(isInterval) ? ops.reduce((acc, e) => intervalAdd(acc, e)) : undefined),
    Multiply: (ops) =>
      ops.some(isInterval) ? ops.reduce((acc, e) => intervalMul(acc, e)) : undefined,
    Divide: ([a, b]) =>
      a !== undefined && b !== undefined && (isInterval(a) || isInterval(b))
        ? intervalDiv(a, b)
        : undefined,
    Power: ([a, n]) =>
      a !== undefined && n !== undefined && isInterval(a) ? intervalPow(a, n) : undefined,
    Abs: ([a]) => (a !== undefined && isInterval(a) ? intervalAbs(a) : undefined),
    Sin: ([a]) => (a !== undefined && isInterval(a) ? intervalSin(a) : undefined),
  };
}

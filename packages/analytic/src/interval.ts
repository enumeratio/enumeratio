import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, wrapOperator } from "@enumeratio/boxed";

// Interval arithmetic over compute-engine's native `Interval(a, b)` — a real set with no
// arithmetic of its own (`Add(Interval(1,2), Interval(3,4))` is a type error out of the
// box). This wraps the arithmetic operators Wolfram's examples actually push an interval
// through: Add, Negate (which also covers Subtract — see below), Multiply, Divide, Power
// (integer exponents), Abs, and Sin over a sub-range of one monotonic branch. Every other
// function stays untouched — Wolfram's own interval support is comparably narrow outside
// the elementary functions.
//
// `Subtract(a, b)` is not wrapped directly: compute-engine canonicalizes it to
// `Add(a, Negate(b))` at box time, before any operator-level hook sees a `Subtract` head, so
// a `Negate` wrapper plus the generic `Add` one already covers it (and reproduces the
// "dependency problem" example: `Interval(1,2) - Interval(1,2)` is `Interval(-1,1)`, not
// `Interval(0,0)`, since the two copies are treated as independent quantities).
//
// Endpoints are kept as exact boxed expressions (not doubles), so `Interval(1, 2) +
// Interval(3, 4)` stays `Interval(4, 6)` rather than losing exactness. `numAt` (a numeric
// approximation) only ever decides WHICH endpoint is smaller/larger — the returned
// expression is always the exact one, never the approximation.

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

function declareIntervalOps(ce: ComputeEngine): void {
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

  wrapOperator(
    ce,
    ["Negate", 1],
    (ops) => isInterval(ops[0]),
    () =>
      ([a]) =>
        intervalNegate(a),
  );
  wrapOperator(
    ce,
    ["Add", 2],
    (ops) => ops.some(isInterval),
    () => (ops) => ops.reduce((acc, e) => intervalAdd(acc, e)),
  );
  wrapOperator(
    ce,
    ["Multiply", 2],
    (ops) => ops.some(isInterval),
    () => (ops) => ops.reduce((acc, e) => intervalMul(acc, e)),
  );
  wrapOperator(
    ce,
    ["Divide", 2],
    (ops) => ops.some(isInterval),
    () =>
      ([a, b]) =>
        intervalDiv(a, b),
  );
  wrapOperator(
    ce,
    ["Power", 2],
    (ops) => isInterval(ops[0]),
    () =>
      ([a, n]) =>
        intervalPow(a, n),
  );
  wrapOperator(
    ce,
    ["Abs", 1],
    (ops) => isInterval(ops[0]),
    () =>
      ([a]) =>
        intervalAbs(a),
  );
  wrapOperator(
    ce,
    ["Sin", 1],
    (ops) => isInterval(ops[0]),
    () =>
      ([a]) =>
        intervalSin(a),
  );
}

/** Extend compute-engine's native `Interval(a, b)` with arithmetic — see the file header.
 * `Interval` itself needs no declaration; it already exists as a real-set head. */
export function declareInterval(ce: ComputeEngine): void {
  declareIntervalOps(ce);
}

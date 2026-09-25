import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import type { Json } from "./bernoulli.ts";
import { type BoxInput, isFiniteNum, isRealInt, numberResult } from "./box.ts";
import { cx, mul, scale, sub, type Cx } from "./complex.ts";

// LegendrePolynomial(n, x): P_0 = 1, P_1 = x, (k+1) P_{k+1} = (2k+1) x P_k − k P_{k−1}.
// Fungrim's name; Wolfram's is `LegendreP` (bridged in the wolfram package's HEADS map,
// the same way `HarmonicNumber`/`Stirling` rename at that boundary — this package keeps
// its own spelling).
//
// Negative integer order folds first, per Wolfram (checked against a kernel):
// P_{−n} = P_{n−1} for n ≥ 1.
//
// Unlike Chebyshev, the coefficients are rational (denominators are powers of 2), so the
// exact path carries bigint rationals rather than plain integers — the same shape as
// `bernoulliPolyExpr`. A concrete numeric x runs the recurrence directly in Cx instead.

type Rat = readonly [bigint, bigint]; // [num, den], den > 0, reduced

const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};

const normalize = ([n, d]: readonly [bigint, bigint]): Rat => {
  if (d < 0n) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1n;
  return [n / g, d / g];
};

const rSub = (x: Rat, y: Rat): Rat => normalize([x[0] * y[1] - y[0] * x[1], x[1] * y[1]]);
const rMulInt = (x: Rat, k: bigint): Rat => normalize([x[0] * k, x[1]]);
const rDivInt = (x: Rat, k: bigint): Rat => normalize([x[0], x[1] * k]);

const ZERO: Rat = [0n, 1n];

/** Coefficient vector (index = power of x) for P_n, n ≥ 0. */
function coeffs(n: number): Rat[] {
  if (n === 0) return [[1n, 1n]];
  let prev: Rat[] = [[1n, 1n]]; // P_0
  let cur: Rat[] = [
    [0n, 1n],
    [1n, 1n],
  ]; // P_1 = x
  for (let k = 1; k < n; k++) {
    // P_{k+1} = ((2k+1) x P_k − k P_{k−1}) / (k+1)
    const shifted: Rat[] = [ZERO, ...cur.map((c) => rMulInt(c, BigInt(2 * k + 1)))];
    const len = Math.max(shifted.length, prev.length);
    const next: Rat[] = [];
    for (let i = 0; i < len; i++) {
      const s = shifted[i] ?? ZERO;
      const p = prev[i] ?? ZERO;
      next[i] = rDivInt(rSub(s, rMulInt(p, BigInt(k))), BigInt(k + 1));
    }
    prev = cur;
    cur = next;
  }
  return cur;
}

const intNode = (v: bigint): Json =>
  v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(v) : { num: v.toString() };

const ratNode = ([n, d]: Rat): Json => (d === 1n ? intNode(n) : ["Rational", intNode(n), intNode(d)]);

/** The coefficient vector as a MathJSON polynomial in `x`. */
function coeffsExpr(cs: readonly Rat[], x: Json): Json {
  const terms: Json[] = [];
  cs.forEach(([num, den], k) => {
    if (num === 0n) return;
    if (k === 0) {
      terms.push(ratNode([num, den]));
      return;
    }
    const xk: Json = k === 1 ? x : ["Power", x, k];
    if (num === den) terms.push(xk);
    else if (num === -den) terms.push(["Negate", xk]);
    else terms.push(["Multiply", ratNode([num, den]), xk]);
  });
  if (terms.length === 0) return 0;
  return terms.length === 1 ? terms[0] : ["Add", ...terms];
}

/** The same recurrence run directly in Cx, for a concrete (real or complex) x. */
function legendreAt(n: number, x: Cx): Cx {
  if (n === 0) return cx(1);
  let prev = cx(1);
  let cur = x;
  for (let k = 1; k < n; k++) {
    const next = scale(sub(scale(mul(x, cur), 2 * k + 1), scale(prev, k)), 1 / (k + 1));
    prev = cur;
    cur = next;
  }
  return cur;
}

export function evaluateLegendreP(
  ce: ComputeEngine,
  n: BoxedExpression,
  x: BoxedExpression,
  numeric: boolean,
): BoxedExpression | undefined {
  if (!isRealInt(n)) return undefined;
  const index = n.re >= 0 ? n.re : -n.re - 1; // P_{−n} = P_{n−1}, n ≥ 1
  const box = (expr: Json) => ce.box(expr as unknown as BoxInput);
  const finish = (expr: BoxedExpression) => (numeric ? expr.N() : expr.evaluate());
  if (numeric && isFiniteNum(x)) {
    return numberResult(ce, legendreAt(index, cx(x.re, x.im)));
  }
  return finish(box(coeffsExpr(coeffs(index), x.json as unknown as Json)));
}

// unstable: the BoxedExpression and ComputeEngine types, which the nucleus facade doesn't re-export
import type { BoxedExpression, ComputeEngine } from "@enumeratio/engine/unstable";
import type { Json } from "@enumeratio/ce-patches";
import {
  type BoxInput,
  isFiniteNum,
  isRealInt,
  numberResult,
  cx,
  mul,
  scale,
  sub,
  type Cx,
} from "@enumeratio/ce-patches";
import { coeffsExpr } from "./chebyshev.ts";

// HermiteH(n, x): the physicists' Hermite polynomial, H_0 = 1, H_1 = 2x,
// H_{k+1} = 2x H_k − 2k H_{k−1}. Wolfram spells it the same way.
//
// Integer n ≥ 0 only. A negative or non-integer order is Wolfram's continuation through
// Hypergeometric1F1 / U (H_{−1} = √π/2 · e^{x²} erfc(x)), which is not implemented, so the
// head stays unevaluated there.
//
// The coefficients are integers, built once over bigints and emitted as a MathJSON polynomial
// (the shape ChebyshevT uses). A concrete numeric x runs the recurrence in Cx instead.

/** The highest order whose exact polynomial is built; past it the head stays unevaluated. */
const MAX_EXACT_ORDER = 2000;

/** The highest order the numeric recurrence runs; past it the head stays unevaluated. */
const MAX_NUMERIC_ORDER = 100_000;

/** Coefficient vector (index = power of x) of H_n, n ≥ 0. */
function coeffs(n: number): bigint[] {
  if (n === 0) return [1n];
  let prev: bigint[] = [1n];
  let cur: bigint[] = [0n, 2n];
  for (let k = 1; k < n; k++) {
    // H_{k+1} = 2x H_k − 2k H_{k−1}
    const shifted = [0n, ...cur.map((c) => c * 2n)];
    const next = shifted.map((c, i) => c - BigInt(2 * k) * (prev[i] ?? 0n));
    prev = cur;
    cur = next;
  }
  return cur;
}

/** The same recurrence run directly in Cx, for a concrete (real or complex) x. */
function hermiteAt(n: number, x: Cx): Cx {
  let prev = cx(1);
  if (n === 0) return prev;
  let cur = scale(x, 2);
  for (let k = 1; k < n; k++) {
    const next = sub(scale(mul(x, cur), 2), scale(prev, 2 * k));
    prev = cur;
    cur = next;
  }
  return cur;
}

export function evaluateHermiteH(
  ce: ComputeEngine,
  n: BoxedExpression,
  x: BoxedExpression,
  numeric: boolean,
): BoxedExpression | undefined {
  if (!isRealInt(n) || n.re < 0) return undefined;
  const order = n.re;
  if (numeric && isFiniteNum(x)) {
    if (order > MAX_NUMERIC_ORDER) return undefined;
    const v = hermiteAt(order, cx(x.re, x.im));
    // The recurrence overflowing is not a value.
    return Number.isFinite(v.re) && Number.isFinite(v.im) ? numberResult(ce, v) : undefined;
  }
  if (order > MAX_EXACT_ORDER) return undefined;
  const expr = ce.box(coeffsExpr(coeffs(order), x.json as unknown as Json) as unknown as BoxInput);
  return numeric ? expr.N() : expr.evaluate();
}

/**
 * A JavaScript `compile` handler: the recurrence inline, for a real x, NaN for an order that
 * is negative, non-integer or past `MAX_NUMERIC_ORDER`. Other targets aren't lowered (undefined).
 */
export const compileHermiteH = (
  args: readonly BoxedExpression[],
  compile: (e: BoxedExpression) => string,
  ctx: { language?: string },
): string | undefined => {
  const [n, x] = args;
  if (ctx.language !== "javascript" || n === undefined || x === undefined) return undefined;
  return (
    `((n, x) => { if (!Number.isInteger(n) || n < 0 || n > ${MAX_NUMERIC_ORDER}) return NaN; ` +
    `if (n === 0) return 1; let p = 1, c = 2 * x; ` +
    `for (let k = 1; k < n; k++) { const t = 2 * x * c - 2 * k * p; p = c; c = t; } ` +
    `return c; })(${compile(n)}, ${compile(x)})`
  );
};

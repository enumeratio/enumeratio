import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import type { Json } from "./bernoulli.ts";
import { type BoxInput, isFiniteNum, isRealInt, numberResult } from "./box.ts";
import { cx, mul, scale, sub, type Cx } from "./complex.ts";

// ChebyshevT(n, x) / ChebyshevU(n, x): T_0 = 1, T_1 = x, T_k = 2x T_{k-1} − T_{k-2}
// (U seeded U_0 = 1, U_1 = 2x — the same recurrence, a different start). Wolfram uses
// the same two names, so no rename is needed at the wolfram-transpiler boundary.
//
// Negative integer order folds into a nonnegative one first, per Wolfram (checked
// against a kernel): T_{−n} = T_n; U_{−1} = 0 and U_{−n} = −U_{n−2} for n ≥ 2.
//
// Exact integer n, any x (symbolic, exact rational, or a plain number): the coefficient
// vector is integer, no denominators in either family, so it is built once via the
// recurrence over bigints and emitted as a MathJSON polynomial — the same shape as
// `bernoulliPolyExpr`. A concrete numeric x instead runs the recurrence directly in Cx,
// which covers real and complex x alike and is cheaper than round-tripping through
// MathJSON for a value that is going to be N()'d anyway.

const bigIntNode = (v: bigint): Json =>
  v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(v) : { num: v.toString() };

/** Coefficient vector (index = power of x) for T_n or U_n, n ≥ 0. */
function coeffs(n: number, kind: "T" | "U"): bigint[] {
  if (n === 0) return [1n];
  let prev: bigint[] = [1n];
  let cur: bigint[] = kind === "T" ? [0n, 1n] : [0n, 2n];
  for (let k = 2; k <= n; k++) {
    const shifted = [0n, ...cur.map((c) => c * 2n)]; // 2x · cur
    const len = Math.max(shifted.length, prev.length);
    const next: bigint[] = [];
    for (let i = 0; i < len; i++) next[i] = (shifted[i] ?? 0n) - (prev[i] ?? 0n);
    prev = cur;
    cur = next;
  }
  return cur;
}

/** The coefficient vector as a MathJSON polynomial in `x`. */
function coeffsExpr(cs: readonly bigint[], x: Json): Json {
  const terms: Json[] = [];
  cs.forEach((c, k) => {
    if (c === 0n) return;
    if (k === 0) {
      terms.push(bigIntNode(c));
      return;
    }
    const xk: Json = k === 1 ? x : ["Power", x, k];
    if (c === 1n) terms.push(xk);
    else if (c === -1n) terms.push(["Negate", xk]);
    else terms.push(["Multiply", bigIntNode(c), xk]);
  });
  if (terms.length === 0) return 0;
  return terms.length === 1 ? terms[0] : ["Add", ...terms];
}

/** The same recurrence run directly in Cx, for a concrete (real or complex) x. */
function chebyshevAt(n: number, x: Cx, kind: "T" | "U"): Cx {
  if (n === 0) return cx(1);
  let prev = cx(1);
  let cur = kind === "T" ? x : scale(x, 2);
  for (let k = 2; k <= n; k++) {
    const next = sub(scale(mul(x, cur), 2), prev);
    prev = cur;
    cur = next;
  }
  return cur;
}

/** Fold a negative order into Wolfram's nonnegative-order identity, or a literal zero. */
function normalizeOrder(n: number, kind: "T" | "U"): { index: number; negate: boolean; zero: boolean } {
  if (n >= 0) return { index: n, negate: false, zero: false };
  const m = -n;
  if (kind === "T") return { index: m, negate: false, zero: false }; // T_{−n} = T_n
  if (m === 1) return { index: 0, negate: false, zero: true }; // U_{−1} = 0
  return { index: m - 2, negate: true, zero: false }; // U_{−n} = −U_{n−2}, n ≥ 2
}

function evaluate(
  ce: ComputeEngine,
  kind: "T" | "U",
  n: BoxedExpression,
  x: BoxedExpression,
  numeric: boolean,
): BoxedExpression | undefined {
  if (!isRealInt(n)) return undefined;
  const { index, negate, zero } = normalizeOrder(n.re, kind);
  const box = (expr: Json) => ce.box(expr as unknown as BoxInput);
  const finish = (expr: BoxedExpression) => (numeric ? expr.N() : expr.evaluate());
  if (zero) return finish(box(0));
  if (numeric && isFiniteNum(x)) {
    const v = chebyshevAt(index, cx(x.re, x.im), kind);
    return numberResult(ce, negate ? { re: -v.re, im: -v.im } : v);
  }
  const expr = coeffsExpr(coeffs(index, kind), x.json as unknown as Json);
  return finish(box(negate ? ["Negate", expr] : expr));
}

export function evaluateChebyshevT(
  ce: ComputeEngine,
  n: BoxedExpression,
  x: BoxedExpression,
  numeric: boolean,
): BoxedExpression | undefined {
  return evaluate(ce, "T", n, x, numeric);
}

export function evaluateChebyshevU(
  ce: ComputeEngine,
  n: BoxedExpression,
  x: BoxedExpression,
  numeric: boolean,
): BoxedExpression | undefined {
  return evaluate(ce, "U", n, x, numeric);
}

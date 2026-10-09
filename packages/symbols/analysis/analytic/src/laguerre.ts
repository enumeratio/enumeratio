// unstable: the BoxedExpression and ComputeEngine types, which the nucleus facade doesn't re-export
import type { BoxedExpression, ComputeEngine } from "@enumeratio/engine/unstable";
import type { Json } from "@enumeratio/ce-patches";
import {
  type BoxInput,
  isFiniteNum,
  isRealInt,
  numberResult,
  add,
  cx,
  mul,
  scale,
  sub,
  type Cx,
} from "@enumeratio/ce-patches";

// LaguerreL(n, x) = L_n(x) and LaguerreL(n, a, x) = L_n^(a)(x), one head: the two-argument
// form is a = 0. Wolfram spells both the same way.
//
// Integer n ≥ 0 only. A negative or non-integer order is Wolfram's continuation through the
// confluent hypergeometric 1F1, which is not implemented, so the head stays unevaluated there.
//
// At a symbolic or exact x the result is the explicit sum Σ_k (−1)^k C(n+a, n−k) x^k / k!,
// built as MathJSON so that a symbolic a stays symbolic. A concrete x runs the three-term
// recurrence in Cx instead, which needs no binomials and so takes a complex a as well.

/** The highest order whose explicit sum is built; past it the head stays unevaluated. */
const MAX_EXACT_ORDER = 50;

/** The highest order the numeric recurrence runs; past it the head stays unevaluated. */
const MAX_NUMERIC_ORDER = 100_000;

/** (−1)^k C(n+a, m) x^k / k!, with m = n − k, where C(n+a, m) = (n+a)(n+a−1)⋯(n+a−m+1) / m!. */
function termJson(n: number, k: number, a: Json, x: Json): Json {
  const m = n - k;
  const numerator: Json[] = [k % 2 === 0 ? 1 : -1];
  for (let j = 0; j < m; j++) numerator.push(["Add", a, n - j]);
  if (k > 0) numerator.push(["Power", x, k]);
  return ["Divide", ["Multiply", ...numerator], ["Multiply", ["Factorial", m], ["Factorial", k]]];
}

/** The explicit sum over k from 0 to n, as MathJSON. */
function sumJson(n: number, a: Json, x: Json): Json {
  const terms: Json[] = [];
  for (let k = 0; k <= n; k++) terms.push(termJson(n, k, a, x));
  return terms.length === 1 ? terms[0]! : ["Add", ...terms];
}

/** L_n^(a)(x) by (k+1) L_{k+1} = (2k+1+a−x) L_k − (k+a) L_{k−1}, from L_0 = 1 and L_1 = 1+a−x. */
function laguerreAt(n: number, a: Cx, x: Cx): Cx {
  let prev = cx(1);
  if (n === 0) return prev;
  let cur = sub(add(cx(1), a), x);
  for (let k = 1; k < n; k++) {
    const next = scale(sub(mul(sub(add(cx(2 * k + 1), a), x), cur), mul(add(a, cx(k)), prev)), 1 / (k + 1));
    prev = cur;
    cur = next;
  }
  return cur;
}

/** `ops` is (n, x) or (n, a, x). */
export function evaluateLaguerreL(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  numeric: boolean,
): BoxedExpression | undefined {
  const n = ops[0];
  const a = ops.length === 3 ? ops[1] : undefined;
  const x = ops.length === 3 ? ops[2] : ops[1];
  if (n === undefined || x === undefined || !isRealInt(n) || n.re < 0) return undefined;
  const order = n.re;
  if (numeric && isFiniteNum(x) && (a === undefined || isFiniteNum(a))) {
    if (order > MAX_NUMERIC_ORDER) return undefined;
    const v = laguerreAt(order, a === undefined ? cx(0) : cx(a.re, a.im), cx(x.re, x.im));
    // The recurrence overflowing is not a value.
    return Number.isFinite(v.re) && Number.isFinite(v.im) ? numberResult(ce, v) : undefined;
  }
  if (order > MAX_EXACT_ORDER) return undefined;
  const expr = ce.box(sumJson(order, (a?.json ?? 0) as Json, x.json as Json) as unknown as BoxInput);
  return numeric ? expr.N() : expr.evaluate();
}

/**
 * A JavaScript `compile` handler: the recurrence inline, for real n-, a- and x-values, NaN for an
 * order that is negative, non-integer or past `MAX_NUMERIC_ORDER`. Other targets aren't lowered.
 */
export const compileLaguerreL = (
  args: readonly BoxedExpression[],
  compile: (e: BoxedExpression) => string,
  ctx: { language?: string },
): string | undefined => {
  const n = args[0];
  const a = args.length === 3 ? args[1] : undefined;
  const x = args.length === 3 ? args[2] : args[1];
  if (ctx.language !== "javascript" || n === undefined || x === undefined) return undefined;
  return (
    `((n, a, x) => { if (!Number.isInteger(n) || n < 0 || n > ${MAX_NUMERIC_ORDER}) return NaN; ` +
    `if (n === 0) return 1; let p = 1, c = 1 + a - x; ` +
    `for (let k = 1; k < n; k++) { const t = ((2 * k + 1 + a - x) * c - (k + a) * p) / (k + 1); p = c; c = t; } ` +
    `return c; })(${compile(n)}, ${a === undefined ? "0" : compile(a)}, ${compile(x)})`
  );
};

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, threadOverLists, widenSignature, wrapOperator } from "@enumeratio/boxed";
import type { EvalOptions, NativeEval } from "./box.ts";

/** No free variable anywhere in `expr` — a plain number, `Pi`/`ExponentialE`, or a closed
 * call over them (`Exp(Sqrt(2))`) all qualify, even though `evaluate()` alone leaves the
 * last one exactly as symbolic as `Add(1.2, Multiply(6.7, x))` does. */
const isClosed = (expr: BoxedExpression): boolean => expr.freeVariables.length === 0;

// #113 threading gaps: heads that reject or ignore a list/matrix argument where
// Wolfram's Listable heads thread over it. `threadOverLists` just flips the
// already-declared operator's `broadcastable` flag in place -- confirmed empirically
// (packages/symbols/analysis/analytic/check3.mjs, not committed) that compute-engine's broadcast
// machinery calls the operator's OWN `evaluate` once per scalar element, so it
// composes for free with whatever exact-value wrapper is layered on afterward
// (closed-forms-113.ts): the list case and the bare scalar case run the identical
// code path, they just used to disagree about it.
//
// Rationalize doesn't fit that flag -- compute-engine's own Rationalize takes a
// single real, so `List(...)` and a symbolic expression both need to be walked and
// rebuilt here rather than threaded structurally.

/**
 * Recursively rationalize every inexact number inside `expr`, leaving exact numbers and
 * free symbols alone, and rebuild every compound node that still has a free variable in
 * it (Add, Multiply, ...) around the results. `List` is always walked structurally, since
 * it never itself reduces to a single number; anything else CLOSED (no free variable —
 * see `isClosed`) is handed whole to the native single-argument evaluator, the same
 * handler a direct `Rationalize(0.5)` call already uses, so a closed but still-symbolic
 * value like `Exp(Sqrt(2))` reaches native's own numeric reduction (N()) rather than
 * being walked apart into `Sqrt(2)`, which alone would rationalize to nothing useful.
 */
function rationalizeDeep(
  ce: ComputeEngine,
  native: NativeEval,
  expr: BoxedExpression,
  tolerance: BoxedExpression | undefined,
  options: EvalOptions,
): BoxedExpression {
  if (expr.operator !== "List" && isClosed(expr)) {
    if ((expr as Partial<{ isExact: boolean }>).isExact !== false) return expr; // already exact
    const args = tolerance === undefined ? [expr] : [expr, tolerance];
    return native?.(args, options) ?? expr;
  }
  const ops = operandsOf(expr);
  if (ops.length === 0) return expr; // a bare free symbol
  const rebuilt = ops.map((op) => rationalizeDeep(ce, native, op, tolerance, options));
  return ce.function(expr.operator, rebuilt).evaluate();
}

export function declareThreading113(ce: ComputeEngine): void {
  // Native heads that reject a list or a matrix with a type error, where Wolfram's
  // Listable heads thread over it: HurwitzZeta([2,3,4], 1/2); StieltjesGamma([1,2,3], a)
  // (in n); DirichletCharacter(k, j, [n...]) (in n); DirichletL(k, j, [s...]) (in s);
  // HarmonicNumber([n...]) and HarmonicNumber(n, matrix-of-orders).
  threadOverLists(ce, [
    "HurwitzZeta",
    "HarmonicNumber",
    "StieltjesGamma",
    "DirichletCharacter",
    "DirichletL",
  ]);

  // HurwitzZeta's own `evaluate` reads only `options.numericApproximation` to decide
  // whether to go numeric -- unlike the heads built on `wants()` (special-functions.ts),
  // it doesn't treat a float OPERAND as an implicit numeric request. That was invisible
  // before broadcastable threading: a bare `HurwitzZeta(2, 0.5)` call is rare, but
  // threading a list of integer orders against a float `a` (HurwitzZeta([2,3,4], 0.5))
  // hits it on every element. Forcing the request here, ahead of HurwitzZeta's own
  // evaluate, is additive -- it only fires when a plain (non-numeric) evaluate() would
  // otherwise leave a float-argument call unevaluated.
  wrapOperator(
    ce,
    ["HurwitzZeta", 2],
    (ops) =>
      !ops.some((o) => o === undefined) &&
      ops.some((o) => (o as Partial<{ isExact: boolean }>).isExact === false),
    (native) => (ops, options) =>
      options.numericApproximation
        ? native?.(ops, options)
        : native?.(ops, { ...options, numericApproximation: true }),
    2,
  );

  // Rationalize(list) and Rationalize(expression-with-floats-inside): compute-engine's
  // own Rationalize takes a single real and rejects both. Widen past its native
  // "(number, number?) -> number" signature first, so a List or a symbolic expression
  // even reaches `evaluate` -- otherwise boxing itself rejects the call with a type
  // error before the wrapper below ever runs. `nativeAccepts` gates the native path to
  // a CLOSED value (`isClosed`, no free variable) exactly as it always accepted --
  // including a compound one like `Exp(Sqrt(2))`, which native already reduces
  // internally; only a List, or an expression with a genuine free variable in it,
  // reaches the wrapper.
  widenSignature(ce, "Rationalize", "(value, number?) -> value", isClosed);
  wrapOperator(
    ce,
    ["Rationalize", 1],
    (ops) => ops[0] !== undefined && (ops[0].operator === "List" || !isClosed(ops[0])),
    (native) => (ops, options) => rationalizeDeep(ce, native, ops[0], ops[1], options),
    1,
  );
}

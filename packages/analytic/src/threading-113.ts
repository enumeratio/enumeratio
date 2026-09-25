import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { threadOverLists, widenSignature, wrapOperator } from "@enumeratio/boxed";
import type { EvalOptions, NativeEval } from "./box.ts";

// #113 threading gaps: heads that reject or ignore a list/matrix argument where
// Wolfram's Listable heads thread over it. `threadOverLists` just flips the
// already-declared operator's `broadcastable` flag in place -- confirmed empirically
// (packages/analytic/check3.mjs, not committed) that compute-engine's broadcast
// machinery calls the operator's OWN `evaluate` once per scalar element, so it
// composes for free with whatever exact-value wrapper is layered on afterward
// (closed-forms-113.ts): the list case and the bare scalar case run the identical
// code path, they just used to disagree about it.
//
// Rationalize doesn't fit that flag -- compute-engine's own Rationalize takes a
// single real, so `List(...)` and a symbolic expression both need to be walked and
// rebuilt here rather than threaded structurally.

/**
 * Recursively rationalize every inexact (float) number literal inside `expr`,
 * leaving exact numbers and symbols alone, and rebuild every compound node (List,
 * Add, Multiply, ...) around the results. A leaf is handed to the native
 * single-argument evaluator, the same handler a direct `Rationalize(0.5)` call
 * already uses, so the tolerance argument and every existing precision behavior are
 * unchanged -- only where inside the expression the leaves are found is new.
 */
function rationalizeDeep(
  ce: ComputeEngine,
  native: NativeEval,
  expr: BoxedExpression,
  tolerance: BoxedExpression | undefined,
  options: EvalOptions,
): BoxedExpression {
  const ops = (expr as { ops?: readonly BoxedExpression[] }).ops;
  if (ops === undefined) {
    if ((expr as Partial<{ isExact: boolean }>).isExact !== false) return expr; // exact, or not a number
    const args = tolerance === undefined ? [expr] : [expr, tolerance];
    return native?.(args, options) ?? expr;
  }
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
  );

  // Rationalize(list) and Rationalize(expression-with-floats-inside): compute-engine's
  // own Rationalize takes a single real and rejects both. `applies` only fires when the
  // operand is still a COMPOUND expression at evaluate time -- a numeric sub-expression
  // like Exp(Sqrt(2)) is already reduced to a plain number by the time Rationalize sees
  // it, so the existing single-real path is untouched; only a List, or a genuinely
  // symbolic expression (a free variable blocks that reduction), reaches here.
  // Widen past the native "(number, number?) -> number" signature first, so a List or
  // a symbolic expression even reaches `evaluate` -- otherwise boxing itself rejects
  // the call with a type error before the wrapper below ever runs. `nativeAccepts`
  // keeps the native path gated to an actual leaf, matching what it always accepted.
  widenSignature(
    ce,
    "Rationalize",
    "(value, number?) -> value",
    (op) => (op as { ops?: unknown }).ops === undefined,
  );
  wrapOperator(
    ce,
    ["Rationalize", 1],
    (ops) => ops[0] !== undefined && (ops[0] as { ops?: unknown }).ops !== undefined,
    (native) => (ops, options) => rationalizeDeep(ce, native, ops[0], ops[1], options),
  );
}

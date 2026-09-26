import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf, widenSignature, wrapOperator } from "@enumeratio/boxed";
import {
  optimizeRecognized,
  parseInterval,
  recognize,
  type Recognized,
  UNBOUNDED_IVL,
  type Ivl,
} from "./optimize-core.ts";

// Minimize, Maximize, MinValue, MaxValue, ArgMin, ArgMax -- Wolfram's exact global
// optimizers, over the scope `optimize-core.ts` documents (its header has the full list;
// the short version: univariate polynomials, rational functions, sqrt/log of an
// affine-or-quadratic argument, exp of an affine argument, with a simple interval
// constraint or none). `Minimize`/`Maximize` match Wolfram's own output shape, `{value, {x
// -> point}}`; `MinValue`/`MaxValue`/`ArgMin`/`ArgMax` are projections of the same
// computation onto just the value or just the point.
//
// `ArgMin`/`ArgMax` are ALREADY compute-engine heads -- the index of a collection's
// extremal element (`ArgMax([3, 1, 4], key)` is `3`, not `4`) -- an entirely different
// question from Wolfram's `ArgMin(f, x)`. Extended in place with `widenSignature` +
// `wrapOperator` (never redeclared: that would drop the collection form), dispatching on
// shape: this file's form always has a bare symbol as its second argument (a collection's
// key, when given at all, is a function/lambda), so that alone safely tells the two apart.

// ---- multivariate is out of scope for now (see Minimize.yaml's `details`) -------------

/** The single real variable a `Minimize`-family call names -- a bare symbol, or a
 * one-element `{x}` list (Wolfram accepts both). More than one variable, or anything else,
 * declines: multivariate optimization isn't attempted here. */
function targetVar(varsArg: BoxedExpression): string | undefined {
  const bare = symbolNameOf(varsArg);
  if (bare !== undefined) return bare;
  if (varsArg.operator === "List") {
    const ops = operandsOf(varsArg);
    if (ops.length === 1) return symbolNameOf(ops[0]!);
  }
  return undefined;
}

/** The problem a call's first argument poses: `f` alone (unconstrained), or Wolfram's
 * `{f, cons}` with a simple interval constraint on `x`. `undefined` declines -- an
 * unparseable constraint (`Or`, one coupling `x` to another variable, ...) is not silently
 * dropped. */
function parseProblem(
  ce: ComputeEngine,
  firstArg: BoxedExpression,
  x: string,
): { expr: BoxedExpression; ivl: Ivl } | undefined {
  if (firstArg.operator !== "List") return { expr: firstArg, ivl: UNBOUNDED_IVL };
  const ops = operandsOf(firstArg);
  if (ops.length !== 2) return undefined;
  const ivl = parseInterval(ce, ops[1]!, x);
  return ivl === undefined ? undefined : { expr: ops[0]!, ivl };
}

interface Solved {
  readonly value: BoxedExpression;
  readonly point: BoxedExpression | undefined;
}

/**
 * The shared computation behind every head this file declares. `needPoint` distinguishes
 * `MinValue`/`MaxValue` (a value alone is enough) from `Minimize`/`Maximize`/`ArgMin`/
 * `ArgMax` (need a specific, reproducible point) -- the one place this matters is sin/cos
 * of an affine argument, UNCONSTRAINED: the exact amplitude (+-1) is well defined, but
 * Wolfram's own choice of a witnessing `x` (one of infinitely many, picked by an internal
 * search this file cannot reproduce or verify -- see optimize-core.ts's header) is not, so
 * that shortcut only fires when a point isn't required.
 */
function solve(
  ce: ComputeEngine,
  firstArg: BoxedExpression,
  varsArg: BoxedExpression,
  direction: "min" | "max",
  needPoint: boolean,
): Solved | undefined {
  const x = targetVar(varsArg);
  if (x === undefined) return undefined;
  const problem = parseProblem(ce, firstArg, x);
  if (problem === undefined) return undefined;
  const { expr, ivl } = problem;
  const rec = recognize(expr, x);
  if (rec === undefined) return undefined;
  const unconstrained = ivl.lo.expr === undefined && ivl.hi.expr === undefined;
  if (!needPoint && rec.tag === "trig" && rec.fn !== "Tan" && unconstrained) {
    return { value: ce.number(direction === "min" ? -1 : 1), point: undefined };
  }
  const ext = optimizeRecognized(ce, rec, expr, x, ivl, direction);
  if (ext === undefined) return undefined;
  return { value: ext.value, point: ext.point };
}

function declareValueHead(ce: ComputeEngine, name: string, direction: "min" | "max"): void {
  ce.declare(name, {
    signature: "(any, any) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [firstArg, varsArg] = ops;
      if (firstArg === undefined || varsArg === undefined) return undefined;
      return solve(ce, firstArg, varsArg, direction, false)?.value;
    },
  });
}

function declareMinMax(ce: ComputeEngine, name: string, direction: "min" | "max"): void {
  ce.declare(name, {
    signature: "(any, any) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [firstArg, varsArg] = ops;
      if (firstArg === undefined || varsArg === undefined) return undefined;
      const x = targetVar(varsArg);
      if (x === undefined) return undefined;
      const solved = solve(ce, firstArg, varsArg, direction, true);
      if (solved === undefined || solved.point === undefined) return undefined;
      return ce.function("List", [
        solved.value,
        ce.function("List", [ce.function("Rule", [ce.symbol(x), solved.point])]),
      ]);
    },
  });
}

/** `ArgMin`/`ArgMax`'s new, Wolfram-shaped form: `(f, x)`, never a collection (an
 * `indexed_collection`'s own key argument, when given, is a function, not a bare symbol,
 * so this predicate never intercepts a genuine collection call). */
const isFunctionForm = (ops: readonly BoxedExpression[]): boolean =>
  ops.length === 2 && symbolNameOf(ops[1]!) !== undefined;

function declareArg(ce: ComputeEngine, name: string, direction: "min" | "max"): void {
  // Last call to touch this signature wins (see `widenSignature`'s own doc comment) --
  // nothing else in this repo widens ArgMin/ArgMax today, so declaring first (this
  // package always does -- see hurwitz-zeta.ts's `LIBRARY_DECLARATIONS` order in
  // packages/reference/scripts/engines.ts) is safe. A future library that also widens
  // either head needs to keep both the collection-index and the `(f, x)` shapes wide.
  widenSignature(ce, name, "(any, any?) -> any");
  wrapOperator(
    ce,
    [name],
    isFunctionForm,
    () => (ops: readonly BoxedExpression[]) => solve(ce, ops[0]!, ops[1]!, direction, true)?.point,
    2,
  );
}

export function declareOptimize(ce: ComputeEngine): void {
  declareMinMax(ce, "Minimize", "min");
  declareMinMax(ce, "Maximize", "max");
  declareValueHead(ce, "MinValue", "min");
  declareValueHead(ce, "MaxValue", "max");
  declareArg(ce, "ArgMin", "min");
  declareArg(ce, "ArgMax", "max");
}

export type { Recognized };

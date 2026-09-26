import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "@enumeratio/boxed";
import {
  optimizeRecognized,
  parseInterval,
  recognize,
  type Recognized,
  UNBOUNDED_IVL,
  type Ivl,
} from "./optimize-core.ts";

// Minimize, Maximize, MinValue, MaxValue -- Wolfram's exact global optimizers, over the
// scope `optimize-core.ts` documents (its header has the full list; the short version:
// univariate polynomials, rational functions, sqrt/log of an affine-or-quadratic argument,
// exp of an affine argument, with a simple interval constraint or none). `Minimize`/
// `Maximize` match Wolfram's own output shape, `{value, {x -> point}}`; `MinValue`/
// `MaxValue` are projections of the same computation onto just the value.
//
// `ArgMin`/`ArgMax` are declined entirely, and deliberately NOT declared here. They are
// ALREADY compute-engine heads -- the index of a collection's extremal element
// (`ArgMax([3, 1, 4], key)` is `3`, not `4`) -- an entirely different question from
// Wolfram's `ArgMin(f, x)`. The obvious route (`wrapOperator`/`widenSignature`, extending
// the head in place -- see `@enumeratio/boxed`) does not work here: verified empirically
// (a throwaway script mutating `ce.lookupDefinition("ArgMin").operator` every way that
// utility exposes -- `evaluate`, `signature`, `canEnumerate`, and the fully-spread
// `ce.declare` override CE's own tests use for this exact idiom) that a call whose first
// argument is not a collection is rejected before `evaluate` is ever reached, regardless of
// what the operator's `signature` or handlers say. `ArgMin`/`ArgMax`'s box-time acceptance
// of `indexed_collection<T>` is evidently resolved through machinery this package's public
// surface doesn't reach, at least in compute-engine 0.134 -- redeclaring the head outright
// would satisfy Wolfram's form but silently drop the collection one, which every other rule
// in this package treats as a worse outcome than declining. `solve` below already
// implements exactly the computation `ArgMin`/`ArgMax` would need (see its own comment);
// wiring it up is a one-function change if a future compute-engine version (or a documented
// hook this session didn't find) makes the extension possible.

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
 * The shared computation behind every head this file declares (and behind `ArgMin`/
 * `ArgMax`, the day extending them becomes possible -- see the file header). `needPoint`
 * distinguishes `MinValue`/`MaxValue` (a value alone is enough) from `Minimize`/`Maximize`
 * (need a specific, reproducible point) -- the one place this matters is sin/cos of an
 * affine argument, UNCONSTRAINED: the exact amplitude (+-1) is well defined, but Wolfram's
 * own choice of a witnessing `x` (one of infinitely many, picked by an internal search this
 * file cannot reproduce or verify -- see optimize-core.ts's header) is not, so that
 * shortcut only fires when a point isn't required.
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

export function declareOptimize(ce: ComputeEngine): void {
  declareMinMax(ce, "Minimize", "min");
  declareMinMax(ce, "Maximize", "max");
  declareValueHead(ce, "MinValue", "min");
  declareValueHead(ce, "MaxValue", "max");
}

export type { Recognized };

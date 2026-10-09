import { type BoxedExpression, type ComputeEngine, isFunction, isSymbol } from "@cortex-js/compute-engine";
import type { Patch } from "../patch.ts";
import { declareCompile } from "@enumeratio/engine";

// Wolfram's `Sum[f, {k, n}]` and `Product[f, {k, n}]` run k from 1 to n. compute-engine 0.146
// reads `(k, n)` as `Limits(k, Nothing, n)`, one bound, and leaves the sum unevaluated (the
// same rule as an integral with one bound). Reading the single bound as the upper one with a
// lower bound of 1 is Wolfram's iterator; a lower bound written alone (`Limits(k, 1, Nothing)`)
// stays as it is.
//
// A bare index (`Product(f, k)`, `Limits(k, Nothing, Nothing)`) is Wolfram's indefinite sum or
// product, defined only up to a constant. compute-engine reads its two equal `Nothing` bounds as
// the degenerate range `k = Nothing .. Nothing` and answers the body at `k := Nothing` (a
// dropped factor: `3 q^(2k) + 5` answers `3 q^2 + 5`), so it holds instead.
export const iteratorUpperBound: Patch = {
  id: "iterator-upper-bound",
  lands:
    "Sum and Product of a lone upper bound (k, n) run from 1, as Wolfram's {k, n} iterator does; an unbounded index stays unevaluated",
  files: ["src/patches/iterator-upper-bound.ts"],
  heads: ["Sum", "Product"],

  fixed: (ce) =>
    ce
      .box(["Sum", "k", ["Tuple", "k", 3]])
      .evaluate()
      .is(6) && ce.box(["Product", ["Power", 2, "k"], "k"]).evaluate().operator === "Product",

  apply: (ce) => {
    for (const head of ["Sum", "Product"]) {
      const definition = ce.lookupDefinition(head);
      const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
      const native = operator?.canonical;
      if (operator === undefined || native === undefined) continue;
      (operator as { canonical: unknown }).canonical = (ops: readonly BoxedExpression[], context: never) =>
        native(
          ops.map((op, i) => (i === 0 ? op : withLowerBound(ce, op))),
          context,
        );
      // compile builtin: reads an iterator at canonicalization, before compile sees the expression
      declareCompile(ce, head, "builtin");
      holdUnbounded(operator as Operator, "evaluate");
      holdUnbounded(operator as Operator, "evaluateAsync");
    }
  },
};

type Operator = Record<
  "evaluate" | "evaluateAsync",
  ((ops: readonly BoxedExpression[], options: never) => unknown) | undefined
>;

/** `operator[key]` declining (staying the call) when an index has no bounds at all. */
function holdUnbounded(operator: Operator, key: "evaluate" | "evaluateAsync"): void {
  const native = operator[key];
  if (native === undefined) return;
  operator[key] = (ops, options) => (ops.slice(1).some(isUnbounded) ? undefined : native(ops, options));
}

/** `Limits(k, Nothing, Nothing)`: an index with neither bound. */
const isUnbounded = (op: BoxedExpression): boolean =>
  isFunction(op) && op.operator === "Limits" && op.ops.length === 3 && isNothing(op.ops[1]) && isNothing(op.ops[2]);

const isNothing = (op: BoxedExpression | undefined): boolean =>
  op !== undefined && isSymbol(op) && op.symbol === "Nothing";

/** `(k, n)` or `Limits(k, Nothing, n)` as `Limits(k, 1, n)`; anything else as it is. */
function withLowerBound(ce: ComputeEngine, op: BoxedExpression): BoxedExpression {
  if (!isFunction(op)) return op;
  const parts = op.ops;
  const [index, lower, upper] = parts;
  if (op.operator === "Tuple" && parts.length === 2 && index !== undefined && isSymbol(index)) {
    return ce.function("Limits", [index, ce.number(1), parts[1]!], { form: "raw" });
  }
  if (op.operator === "Limits" && parts.length === 3 && isNothing(lower) && !isNothing(upper) && index !== undefined) {
    return ce.function("Limits", [index, ce.number(1), upper!], { form: "raw" });
  }
  return op;
}

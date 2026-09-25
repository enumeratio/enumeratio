import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";

// Assuming(cond, expr) and Refine(expr, cond?) — thin wrappers over compute-engine's own
// assumption system (`ce.assume`/`ce.pushScope`/`ce.popScope`), which already makes several
// heads assumption-aware:
//   - Abs, Sign, and Ln∘Exp resolve during plain `evaluate()` once the sign of their
//     argument is known (`Abs(x)` → `x` under `assume(x > 0)`).
//   - Sqrt(x^2)-style algebraic rewrites resolve during `simplify()` the same way
//     (`Sqrt(x^2)` → `x` under `x > 0`, → `-x` under `x < 0`).
// Neither head reimplements that reasoning — both just scope an assumption and call
// through to compute-engine's own evaluate/simplify, so they cover exactly what compute-engine
// itself can decide from a sign/domain assumption. A case compute-engine can't decide (no
// native rule consults the assumption) is left unevaluated, same as Wolfram would leave it
// short of a dedicated `Simplify`.
//
// Scoping: assumptions made here live in a `pushScope()`/`popScope()` bracket.
// compute-engine documents assumptions as scoped — "when exiting the current lexical scope,
// the previous assumptions will be restored" — so a `popScope()` after the body runs undoes
// exactly what this call assumed, even when Assuming/Refine nest, and even when this runs
// inside another expression's evaluation (unlike `ce.checkpoint()`, which refuses mid-eval).

/** The individual boolean conditions from a single condition, an `And` of conditions, or a
 * `List` of conditions — Wolfram's `Assuming`/`Refine` accept all three shapes for their
 * assumptions argument. */
function flattenConditions(cond: BoxedExpression): BoxedExpression[] {
  if (cond.operator === "And" || cond.operator === "List") {
    return operandsOf(cond).flatMap(flattenConditions);
  }
  return [cond];
}

/** Assume every condition in a fresh scope, run `body`, then restore no matter what
 * `body` does (including throwing). */
function withAssumptions<T>(ce: ComputeEngine, conds: readonly BoxedExpression[], body: () => T): T {
  ce.pushScope();
  try {
    for (const c of conds) ce.assume(c);
    return body();
  } finally {
    ce.popScope();
  }
}

function declareAssuming(ce: ComputeEngine): void {
  ce.declare("Assuming", {
    signature: "(value, value) -> unknown",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [cond, body] = ops;
      if (!cond || !body) return undefined;
      return withAssumptions(ce, flattenConditions(cond), () => body.evaluate());
    },
  });
}

function declareRefine(ce: ComputeEngine): void {
  ce.declare("Refine", {
    signature: "(value, value?) -> unknown",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [expr, cond] = ops;
      if (!expr) return undefined;
      if (!cond) return expr.simplify();
      return withAssumptions(ce, flattenConditions(cond), () => expr.simplify());
    },
  });
}

export function declareRefineAssuming(ce: ComputeEngine): void {
  declareAssuming(ce);
  declareRefine(ce);
}

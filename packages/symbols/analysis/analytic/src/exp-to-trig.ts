import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import type { EvalOptions } from "./box.ts";

// ExpToTrig(expr) — rewrite every exponential in `expr` as circular or hyperbolic functions,
// the inverse of compute-engine's native TrigToExp: `Exp(ix)` becomes `cos(x) + i·sin(x)`
// (Euler's formula) and a real `Exp(x)` becomes `cosh(x) + sinh(x)`. Recognizing a symmetric
// combination back down to a single `Cosh`/`Sinh`/`Sin` (the backlog's Scope examples) falls
// out of doing this substitution EVERYWHERE in the tree and then simplifying — no separate
// pattern for "this looks like a cosh definition" is needed.
//
// `Exp(u)` canonicalizes to `Power(E, u)` at box time, so `rewriteExp` matches on that, the
// same gotcha `around.ts`, `matrix-function.ts` and `complex-expand.ts` all work around.

/**
 * Is `u` a purely imaginary multiple of something real, `k·i·rest`? Returns `k·rest` (the
 * coefficient of `i`), or `undefined`. compute-engine folds a literal `i` factor into a
 * concrete `Complex(0, k)` numeric coefficient rather than keeping a bare `ImaginaryUnit`
 * operand around, so this looks for THAT.
 */
function pureImaginaryArg(ce: ComputeEngine, u: BoxedExpression): BoxedExpression | undefined {
  if (u.re === 0 && u.im !== 0 && Number.isFinite(u.im)) return ce.number(u.im); // atomic k·i
  if (u.operator !== "Multiply") return undefined;
  const ops = operandsOf(u);
  if (ops.length === 0) return undefined;
  const coeffIndex = ops.findIndex((o) => o.re === 0 && Number.isFinite(o.im) && o.im !== 0);
  if (coeffIndex === -1) return undefined;
  const k = ops[coeffIndex].im;
  const rest = ops.filter((_, i) => i !== coeffIndex);
  const restExpr = rest.length === 0 ? ce.One : rest.length === 1 ? rest[0] : ce.function("Multiply", rest).evaluate();
  return k === 1 ? restExpr : ce.function("Multiply", [ce.number(k), restExpr]).evaluate();
}

function rewriteExp(ce: ComputeEngine, e: BoxedExpression): BoxedExpression {
  const ops = operandsOf(e);
  if (e.operator === "Power" && ops.length === 2 && ops[0].isSame(ce.E)) {
    const u = rewriteExp(ce, ops[1]);
    const t = pureImaginaryArg(ce, u);
    if (t !== undefined) {
      return ce
        .function("Add", [
          ce.function("Cos", [t]).simplify(),
          ce.function("Multiply", [ce.symbol("ImaginaryUnit"), ce.function("Sin", [t]).simplify()]),
        ])
        .evaluate();
    }
    return ce.function("Add", [ce.function("Cosh", [u]).simplify(), ce.function("Sinh", [u]).simplify()]).evaluate();
  }
  if (ops.length === 0) return e;
  return ce
    .function(
      e.operator!,
      ops.map((o) => rewriteExp(ce, o)),
    )
    .evaluate();
}

export function evaluateExpToTrig(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  const expr = ops[0];
  return expr === undefined ? undefined : rewriteExp(ce, expr).simplify();
}

export function declareExpToTrig(ce: ComputeEngine): void {
  ce.declare("ExpToTrig", {
    signature: "(value) -> value",
    evaluate: (ops: readonly BoxedExpression[], _options: EvalOptions) => evaluateExpToTrig(ce, ops),
  });
}

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bernoulliPolyExpr, bernoulliPolyAt } from "./bernoulli.ts";
import type { BoxInput } from "./box.ts";
import { isFiniteNum, isRealInt, numberResult } from "./box.ts";
import { cx } from "./complex.ts";

// BernoulliPolynomial(n, x) — Fungrim's name for Bernoulli polynomials B_n(x),
// delegated to the native BernoulliB(n, x) when numeric.

export function evaluateBernoulliPolynomial(
  ce: ComputeEngine,
  n: BoxedExpression,
  x: BoxedExpression,
  numeric: boolean,
): BoxedExpression | undefined {
  // Exact symbolic: B_n(x) as a MathJSON polynomial for integer n
  if (!numeric && isRealInt(n) && n.re >= 0) {
    const poly = bernoulliPolyExpr(n.re, x.json as never);
    return ce.box(poly as unknown as BoxInput).evaluate();
  }

  // Numeric with real x: use the exact polynomial evaluator
  if (numeric && isRealInt(n) && n.re >= 0 && isFiniteNum(x) && x.im === 0) {
    const result = bernoulliPolyAt(n.re, x.re);
    return numberResult(ce, cx(result));
  }

  // Numeric: delegate to native BernoulliB(n, x) for non-integer n or complex x
  if (numeric) {
    const native = ce.box(["BernoulliB", n.json, x.json] as never);
    return native.N();
  }

  return undefined;
}

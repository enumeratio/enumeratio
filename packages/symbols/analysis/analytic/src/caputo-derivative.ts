import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "@enumeratio/boxed";

// CaputoD(f, {x, alpha}): the Caputo fractional derivative of order `alpha` > 0 of `f`
// with respect to `x`, at base point 0 — D^alpha_C f(x) = 1/Gamma(n - alpha) *
// integral_0^x f^(n)(t) (x-t)^(n-alpha-1) dt, n = ceil(alpha) (or alpha itself when
// alpha is already a nonnegative integer, reducing to the ordinary derivative).
//
// Covered, by linearity: constants (any x-free subexpression -> 0), `Add`/`Negate`,
// a constant `Multiply` factor, and the power function `x^beta` (`beta` a concrete
// real number; bare `x` is `beta = 1`):
//   - `beta` a nonnegative INTEGER less than `n`: exactly 0 — f's own n-th ordinary
//     derivative already vanishes there (a genuine classical-calculus fact, confirmed
//     against Wolfram's own `CaputoD` numerically — see the head's reference `details`
//     for the one case Wolfram's symbolic engine leaves unreduced even though it's 0).
//   - `beta > n - 1` (strictly — the standard existence condition, covering every other
//     concrete `beta` this file accepts, integer or not): `Gamma(beta+1)/Gamma(beta-alpha+1)
//     * x^(beta-alpha)`. Verified against `wolframscript`'s own `CaputoD` AND, independently,
//     against direct numerical fractional integration (`mpmath.quad` on the definition
//     above) for several `{beta, alpha}` pairs.
//   - anything else (`beta` real but `beta <= n - 1` and not a qualifying nonnegative
//     integer, e.g. `beta = 0.5` at `alpha = 1.5`): declined — `f^(n)` has a
//     non-integrable singularity at the base point (confirmed by the same numerical
//     integral diverging), a real gap in this table, not a computational shortcut.
//
// Declined entirely: a non-numeric-literal `alpha` (computing `n = ceil(alpha)` needs a
// concrete value) or `alpha <= 0`; a symbolic exponent `beta`; two or more x-dependent
// factors in one `Multiply` (no product rule here); and any transcendental of `x`
// (`e^(a x)` included — its Caputo derivative is a Mittag-Leffler function, and this
// repo has no `MittagLefflerE` head to express it with, so it stays undeclared rather
// than being invented for this one head — see AGENTS.md's instruction to decline rather
// than add a head this table doesn't otherwise need).

const opAt = (expr: BoxedExpression, i: number): BoxedExpression => operandsOf(expr)[i];
const isSym = (x: BoxedExpression, name: string): boolean => symbolNameOf(x) === name;
const hasVar = (expr: BoxedExpression, name: string): boolean => expr.has(name);

/** A concrete (non-`x`-dependent) real number literal — `NaN`/complex declines by
 * returning `undefined`. */
function realLiteral(expr: BoxedExpression): number | undefined {
  return expr.im === 0 && Number.isFinite(expr.re) ? expr.re : undefined;
}

/** `x^beta` (`beta` a real-literal exponent) or bare `x` (`beta = 1`) — the one shape
 * this file's power-function rule accepts. */
function powerBeta(ce: ComputeEngine, expr: BoxedExpression, xName: string): BoxedExpression | undefined {
  if (isSym(expr, xName)) return ce.One;
  if (expr.operator === "Power" && isSym(opAt(expr, 0), xName) && !hasVar(opAt(expr, 1), xName)) {
    return opAt(expr, 1);
  }
  return undefined;
}

/** `Gamma(beta+1)/Gamma(beta-alpha+1) * x^(beta-alpha)`, or the classical-vanishing `0`,
 * or `undefined` (declined) — see the header comment for which is which. */
function caputoOfPower(
  ce: ComputeEngine,
  betaExpr: BoxedExpression,
  xName: string,
  alphaExpr: BoxedExpression,
): BoxedExpression | undefined {
  const alpha = realLiteral(alphaExpr);
  const beta = realLiteral(betaExpr);
  if (alpha === undefined || beta === undefined || alpha <= 0) return undefined;
  const n = Number.isInteger(alpha) ? alpha : Math.ceil(alpha);
  if (Number.isInteger(beta) && beta >= 0 && beta < n) return ce.Zero;
  if (!(beta > n - 1)) return undefined; // singular at the base point: decline
  const x = ce.symbol(xName);
  const shifted = ce.function("Subtract", [betaExpr, alphaExpr]);
  return ce
    .function("Multiply", [
      ce.function("Divide", [
        ce.function("Gamma", [ce.function("Add", [betaExpr, 1])]),
        ce.function("Gamma", [ce.function("Add", [shifted, 1])]),
      ]),
      ce.function("Power", [x, shifted]),
    ])
    .evaluate();
}

export function matchCaputoD(
  ce: ComputeEngine,
  expr: BoxedExpression,
  xName: string,
  alpha: BoxedExpression,
): BoxedExpression | undefined {
  if (!hasVar(expr, xName)) return ce.Zero;
  if (expr.operator === "Add") {
    const parts = operandsOf(expr).map((o) => matchCaputoD(ce, o, xName, alpha));
    if (parts.some((p) => p === undefined)) return undefined;
    return ce.function("Add", parts as BoxedExpression[]).evaluate();
  }
  if (expr.operator === "Negate") {
    const inner = matchCaputoD(ce, opAt(expr, 0), xName, alpha);
    return inner === undefined ? undefined : ce.function("Negate", [inner]).evaluate();
  }
  if (expr.operator === "Multiply") {
    const ops = operandsOf(expr);
    const consts = ops.filter((o) => !hasVar(o, xName));
    const rest = ops.filter((o) => hasVar(o, xName));
    if (rest.length !== 1) return undefined;
    const core = matchCaputoD(ce, rest[0]!, xName, alpha);
    if (core === undefined) return undefined;
    return consts.length === 0 ? core : ce.function("Multiply", [...consts, core]).evaluate();
  }
  const beta = powerBeta(ce, expr, xName);
  if (beta === undefined) return undefined;
  return caputoOfPower(ce, beta, xName, alpha);
}

export function declareCaputoD(ce: ComputeEngine): void {
  ce.declare("CaputoD", {
    signature: "(value, tuple) -> value",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [f, spec] = ops;
      if (f === undefined || spec === undefined || ops.length !== 2) return undefined;
      const specOps = operandsOf(spec);
      if (specOps.length !== 2) return undefined;
      const [xExpr, alpha] = specOps as [BoxedExpression, BoxedExpression];
      const xName = symbolNameOf(xExpr);
      if (xName === undefined) return undefined;
      return matchCaputoD(ce, f, xName, alpha);
    },
  });
}

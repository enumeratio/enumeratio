import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { type EvalOptions, isFiniteNum, numberResult, wantsNumber } from "./box.ts";
import { cx, type Cx } from "./complex.ts";
import { pfqSeries } from "./hypergeometric.ts";

// HypergeometricPFQ(upper, lower, z) = pFq(upper; lower; z), the general series — built
// directly on `pfqSeries` from hypergeometric.ts (already generic in the operand counts;
// only the 0F1/1F1/2F1/3F2 Regularized forms needed their own declarations there). Three
// cases have exact closed forms Wolfram documents and this keeps exact, symbolic z included,
// ahead of the numeric series: 0F0(;;z) = e^z, 1F0(a;;z) = (1−z)^(−a), and pFq(…; 0) = 1 for
// any parameter lists (the series' own first term, before any convergence question arises).
// Otherwise: p ≤ q converges for any z; p = q + 1 only inside the unit disc (declined outside,
// per the same policy as the Regularized forms — no analytic continuation attempted here).

const mag = (z: Cx): number => Math.hypot(z.re, z.im);

const listOf = (expr: BoxedExpression | undefined): readonly BoxedExpression[] =>
  expr?.operator === "List" ? operandsOf(expr) : [];

const isZero = (x: BoxedExpression): boolean => x.re === 0 && x.im === 0;

export function declareHypergeometricPFQ(ce: ComputeEngine): void {
  ce.declare("HypergeometricPFQ", {
    signature: "(list, list, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [upperExpr, lowerExpr, z] = ops;
      if (upperExpr === undefined || lowerExpr === undefined || z === undefined) return undefined;
      const upper = listOf(upperExpr);
      const lower = listOf(lowerExpr);

      if (upper.length === 0 && lower.length === 0) {
        const expr = ce.function("Power", ["ExponentialE", z]);
        return wantsNumber(ops, options) ? expr.N() : expr.evaluate();
      }
      if (upper.length === 1 && lower.length === 0) {
        const expr = ce.function("Power", [
          ce.function("Subtract", [ce.One, z]),
          ce.function("Negate", [upper[0]]),
        ]);
        return wantsNumber(ops, options) ? expr.N() : expr.evaluate();
      }
      if (isZero(z)) return ce.One; // the series' own leading term — true for any lists

      if (!wantsNumber(ops, options)) return undefined;
      if (
        !isFiniteNum(z) ||
        upper.some((o) => !isFiniteNum(o)) ||
        lower.some((o) => !isFiniteNum(o))
      )
        return undefined;
      const upperCx = upper.map((o) => cx(o.re, o.im));
      const lowerCx = lower.map((o) => cx(o.re, o.im));
      const zCx = cx(z.re, z.im);
      if (upperCx.length > lowerCx.length + 1) return undefined; // divergent series in general
      if (upperCx.length === lowerCx.length + 1 && mag(zCx) >= 1) return undefined; // outside the disc
      const r = pfqSeries(upperCx, lowerCx, zCx);
      return r === undefined ? undefined : numberResult(ce, r);
    },
  });
}

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type EvalOptions, isFiniteNum, wantsNumber } from "./box.ts";

// ExpIntegralE(n, z) = E_n(z) = ∫₁^∞ e^{−zt}/tⁿ dt, built on this package's own generalized
// incomplete Gamma (`Gamma(s, z₀)`, already extended for complex operands): the standard
// identity E_n(z) = z^(n−1)·Γ(1−n, z). Two cases need handling before that general formula,
// since it hits a genuine 0·∞ there rather than the finite limit Wolfram's page documents:
//   • n = 0: Γ(1, z) is already exactly e^{−z} (checked: `Gamma(1, x)` symbolic), so
//     E_0(z) = e^{−z}/z holds for any z, symbolic included — no numeric approximation needed.
//   • z = 0, Re(n) > 1: E_n(0) = 1/(n − 1), the removable limit the z^(n−1) factor (0 to a
//     negative power) can't see through when evaluated at z = 0 directly.
export function declareExpIntegralE(ce: ComputeEngine): void {
  ce.declare("ExpIntegralE", {
    signature: "(number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [n, z] = ops;
      if (n === undefined || z === undefined) return undefined;

      if (n.re === 0 && n.im === 0) {
        const expr = ce.function("Divide", [ce.function("Gamma", [ce.One, z]), z]);
        return wantsNumber(ops, options) ? expr.N() : expr.evaluate();
      }
      if (z.re === 0 && z.im === 0 && n.re > 1) {
        const expr = ce.function("Divide", [ce.One, ce.function("Subtract", [n, ce.One])]);
        return wantsNumber(ops, options) ? expr.N() : expr.evaluate();
      }

      if (!wantsNumber(ops, options) || !isFiniteNum(n) || !isFiniteNum(z)) return undefined;
      if (z.re === 0 && z.im === 0) return undefined; // pole/undefined for other n — decline

      const expr = ce.function("Multiply", [
        ce.function("Power", [z, ce.function("Subtract", [n, ce.One])]),
        ce.function("Gamma", [ce.function("Subtract", [ce.One, n]), z]),
      ]);
      return expr.N();
    },
  });
}

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  atDigits,
  bigRealOperand,
  bigResult,
  type EvalOptions,
  exceedsDoublePrecision,
  isFiniteNum,
  wantsNumber,
} from "@enumeratio/ce-patches";
import { BigDecimal } from "@enumeratio/engine/unstable";

// ExpIntegralE(n, z) = E_n(z) = ∫₁^∞ e^{−zt}/tⁿ dt, built on this package's own generalized
// incomplete Gamma (`Gamma(s, z₀)`, already extended for complex operands): the standard
// identity E_n(z) = z^(n−1)·Γ(1−n, z). Two cases need handling before that general formula,
// since it hits a genuine 0·∞ there rather than the finite limit Wolfram's page documents:
//   • n = 0: Γ(1, z) is already exactly e^{−z} (checked: `Gamma(1, x)` symbolic), so
//     E_0(z) = e^{−z}/z holds for any z, symbolic included — no numeric approximation needed.
//   • z = 0, Re(n) > 1: E_n(0) = 1/(n − 1), the removable limit the z^(n−1) factor (0 to a
//     negative power) can't see through when evaluated at z = 0 directly.

/** Past this z the series' terms outgrow the answer by more digits than are worth carrying. */
const MAX_BIG_Z = 100;
const GUARD = 15;

/** γ to `digits` digits, from the engine's own constant. */
function eulerGammaAt(ce: ComputeEngine, digits: number): BigDecimal | undefined {
  const saved = ce.precision;
  ce.precision = digits;
  try {
    return ce.box("EulerGamma").N().bignumRe;
  } finally {
    ce.precision = saved;
  }
}

/**
 * E_n(z) for integer n ≥ 1 and real z > 0 on the convergent series (DLMF 8.19.8)
 *   E_n(z) = (−z)^(n−1)/(n−1)! · (ψ(n) − ln z) − Σ_{k≠n−1} (−z)^k / ((k−n+1)·k!),
 * with ψ(n) = −γ + H_(n−1). Its terms reach about e^z before they cancel, so the working
 * digits grow with z.
 */
function expIntegralEBig(ce: ComputeEngine, n: number, z: BigDecimal, digits: number): BigDecimal | undefined {
  if (!Number.isInteger(n) || n < 1 || !z.isPositive() || z.gt(MAX_BIG_Z)) return undefined;
  // The terms reach about e^z and the answer is about e^(−z): 2z·log10(e) digits cancel.
  const working = digits + GUARD + Math.ceil(2 * z.toNumber() * Math.LOG10E);
  const gamma = eulerGammaAt(ce, working);
  if (gamma === undefined) return undefined;
  return atDigits(working, () => {
    const tol = new BigDecimal(10).pow(-(working + 2));
    let term = new BigDecimal(1); // (−z)^k / k!
    let rest = new BigDecimal(0);
    let pivot = new BigDecimal(0); // the k = n − 1 term
    for (let k = 0; k < 100_000; k++) {
      if (k === n - 1) pivot = term;
      else rest = rest.add(term.div(k - n + 1)).toPrecision(working);
      if (k > n && k > z.toNumber() && term.abs().lt(tol)) break;
      term = term
        .mul(z.neg())
        .div(k + 1)
        .toPrecision(working);
    }
    let harmonic = new BigDecimal(0);
    for (let k = 1; k < n; k++) harmonic = harmonic.add(new BigDecimal(1).div(k));
    const psi = harmonic.sub(gamma);
    return pivot.mul(psi.sub(z.ln())).sub(rest).toPrecision(digits);
  });
}

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

      // Past a double's digits: the bignum series for integer n and real z > 0, else decline
      // (the Gamma route below is a double).
      if (exceedsDoublePrecision(ce, options.numericApproximation)) {
        const big = bigRealOperand(ce, z);
        if (big === undefined || n.im !== 0) return undefined;
        const value = expIntegralEBig(ce, n.re, big, ce.precision);
        return value === undefined ? undefined : bigResult(ce, value);
      }

      const expr = ce.function("Multiply", [
        ce.function("Power", [z, ce.function("Subtract", [n, ce.One])]),
        ce.function("Gamma", [ce.function("Subtract", [ce.One, n]), z]),
      ]);
      return expr.N();
    },
  });
}

// unstable: BigDecimal, the class compute-engine's boxed numbers hold; no /numerics subpath yet
import type { Expression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  atDigits,
  bigRealOperand,
  bigResult,
  type EvalOptions,
  exceedsDoublePrecision,
  isFiniteNum,
  asDouble,
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

/** The named constant (γ, π) to `digits` digits, from the engine's own. */
function constantAt(ce: ComputeEngine, name: "EulerGamma" | "Pi", digits: number): BigDecimal | undefined {
  const saved = ce.precision;
  ce.precision = digits;
  try {
    return ce.box(name).N().bignumRe;
  } finally {
    ce.precision = saved;
  }
}

/**
 * E_n(z) for integer n ≥ 1 and real z ≠ 0, |z| ≤ 100, on the convergent series (DLMF 8.19.8)
 *   E_n(z) = (−z)^(n−1)/(n−1)! · (ψ(n) − ln z) − Σ_{k≠n−1} (−z)^k / ((k−n+1)·k!),
 * with ψ(n) = −γ + H_(n−1). For z > 0 its terms reach about e^z before they cancel, so the
 * working digits grow with z; for z < 0 they are all one sign, and ln z carries the −iπ of
 * the principal branch, so the imaginary part is −π·(−z)^(n−1)/(n−1)!.
 */
function expIntegralEBig(
  ce: ComputeEngine,
  n: number,
  z: BigDecimal,
  digits: number,
): { readonly re: BigDecimal; readonly im: BigDecimal } | undefined {
  const negative = !z.isPositive();
  if (!Number.isInteger(n) || n < 1 || z.isZero() || z.abs().gt(MAX_BIG_Z)) return undefined;
  // The terms reach about e^z and the answer is about e^(−z): 2z·log10(e) digits cancel.
  const working =
    digits + GUARD + (negative ? Math.ceil(Math.log10(n + 1)) : Math.ceil(2 * z.toNumber() * Math.LOG10E));
  const gamma = constantAt(ce, "EulerGamma", working);
  const pi = negative ? constantAt(ce, "Pi", working) : new BigDecimal(0);
  if (gamma === undefined || pi === undefined) return undefined;
  return atDigits(working, () => {
    const tol = new BigDecimal(10).pow(-(working + 2));
    let term = new BigDecimal(1); // (−z)^k / k!
    let rest = new BigDecimal(0);
    let pivot = new BigDecimal(0); // the k = n − 1 term
    for (let k = 0; k < 100_000; k++) {
      if (k === n - 1) pivot = term;
      else rest = rest.add(term.div(k - n + 1)).toPrecision(working);
      if (k > n && k > Math.abs(z.toNumber()) && term.abs().lt(tol)) break;
      term = term
        .mul(z.neg())
        .div(k + 1)
        .toPrecision(working);
    }
    let harmonic = new BigDecimal(0);
    for (let k = 1; k < n; k++) harmonic = harmonic.add(new BigDecimal(1).div(k));
    const psi = harmonic.sub(gamma);
    return {
      re: pivot.mul(psi.sub(z.abs().ln())).sub(rest).toPrecision(digits),
      im: pivot.mul(pi).neg().toPrecision(digits),
    };
  });
}

/** From this order up the continued fraction below is used; the Gamma route's z^(n−1) over/underflows. */
const CONTINUED_FRACTION_ORDER = 20;

/**
 * E_n(x) for real n ≥ 1 and x > 0 by the continued fraction (modified Lentz,
 * E_n(x) = e^(−x)/(x + n − 1·n/(x + n + 2 − 2(n+1)/(x + n + 4 − …))): it converges quickly once n is
 * large and never forms z^(n−1).
 */
function expIntegralEContinued(n: number, x: number): number | undefined {
  const tiny = 1e-300;
  let b = x + n;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 10_000; i++) {
    const a = -i * (n - 1 + i);
    b += 2;
    d = 1 / (a * d + b);
    c = b + a / c;
    const delta = c * d;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) return h * Math.exp(-x);
  }
  return undefined;
}

export function declareExpIntegralE(ce: ComputeEngine): void {
  ce.declare("ExpIntegralE", {
    signature: "(number, number) -> number",
    evaluate: (ops: readonly Expression[], options: EvalOptions) => {
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

      // E_n(z) ~ Γ(1−n)·z^(n−1) (a logarithm at n = 1) diverges at z = 0 for Re(n) ≤ 1.
      if (z.re === 0 && z.im === 0 && n.im === 0 && n.re <= 1) return ce.symbol("ComplexInfinity");

      if (!wantsNumber(ops, options) || !isFiniteNum(n) || !isFiniteNum(z)) return undefined;
      if (z.re === 0 && z.im === 0) return undefined; // pole/undefined for other n — decline

      // Past a double's digits: the bignum series for integer n and real z > 0, else decline
      // (the Gamma route below is a double).
      if (exceedsDoublePrecision(ce, options.numericApproximation)) {
        const big = bigRealOperand(ce, z);
        if (big === undefined || n.im !== 0) return undefined;
        const value = big.isPositive() ? expIntegralEBig(ce, n.re, big, ce.precision) : undefined;
        return value === undefined ? undefined : bigResult(ce, value.re);
      }

      // A negative real z at high order: the Gamma route below underflows (z^(n−1)·Γ(1−n, z)
      // is 0 where E_n is about e^|z|), so a double is read off the series instead.
      if (n.im === 0 && z.im === 0 && z.re < 0 && Number.isInteger(n.re) && n.re >= CONTINUED_FRACTION_ORDER) {
        const value = expIntegralEBig(ce, n.re, new BigDecimal(z.re), 20);
        if (value !== undefined) return asDouble(ce, ce.number(ce.complex(value.re.toNumber(), value.im.toNumber())));
      }

      if (n.im === 0 && z.im === 0 && z.re > 0 && n.re >= CONTINUED_FRACTION_ORDER) {
        const value = expIntegralEContinued(n.re, z.re);
        if (value !== undefined) return ce.number(value);
      }

      const expr = ce.function("Multiply", [
        ce.function("Power", [z, ce.function("Subtract", [n, ce.One])]),
        ce.function("Gamma", [ce.function("Subtract", [ce.One, n]), z]),
      ]);
      return expr.N();
    },
  });
}

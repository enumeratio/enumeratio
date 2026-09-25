import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type EvalOptions, isFiniteNum, wantsNumber } from "./box.ts";
import { logGammaReal } from "./loggamma.ts";

// InverseGammaRegularized(a, s) and InverseBetaRegularized(s, a, b): neither has a closed
// form in general, so both are solved numerically — a safeguarded Newton's method (falling
// back to bisection whenever a step would leave the bracket) against compute-engine's own
// native GammaRegularized / BetaRegularized as the forward function, whose accuracy was
// checked directly (GammaRegularized(2.5, 3) and BetaRegularized(0.5, 2.5, 1.5) both matched
// Wolfram to 20 digits). The derivative in each case is the corresponding density, evaluated
// in log space (via `logGammaReal`) so it doesn't overflow/underflow away from the mode.

/**
 * Solve f(x) = target for x in [lo, hi], where f is monotonically DEcreasing (both Q(a, z) in
 * z and I_x(a, b) in... no — I_x is increasing in x; `sign` flips the comparison). `fPrime`
 * gets the (unsigned) derivative magnitude; the bracket update infers direction from
 * `increasing`.
 */
function safeguardedSolve(
  f: (x: number) => number,
  fPrime: (x: number) => number,
  lo: number,
  hi: number,
  target: number,
  increasing: boolean,
): number {
  let x = 0.5 * (lo + hi);
  for (let i = 0; i < 100; i++) {
    const fx = f(x) - target;
    if (Math.abs(fx) < 1e-14 * (1 + Math.abs(target))) return x;
    if (increasing === fx < 0) lo = x;
    else hi = x;
    const d = fPrime(x);
    let xn = d === 0 || !Number.isFinite(d) ? Number.NaN : x - fx / (increasing ? d : -d);
    if (!(xn > lo && xn < hi)) xn = 0.5 * (lo + hi);
    if (Math.abs(xn - x) < 1e-15 * (1 + Math.abs(x))) return xn;
    x = xn;
  }
  return x;
}

const forwardGammaRegularized = (ce: ComputeEngine, a: number, z: number): number =>
  ce.box(["GammaRegularized", a, z] as never).N().re;

const forwardBetaRegularized = (ce: ComputeEngine, x: number, a: number, b: number): number =>
  ce.box(["BetaRegularized", x, a, b] as never).N().re;

/** Solve Q(a, z) = s for z > 0. Q decreases from 1 (z=0) to 0 (z→∞); doubling search finds a
 * bracket, then `safeguardedSolve` refines against Q'(z) = −z^(a−1)·e^(−z)/Γ(a) (in log space). */
function inverseGammaRegularized(ce: ComputeEngine, a: number, s: number): number {
  const logGammaA = logGammaReal(a);
  let hi = 1;
  while (forwardGammaRegularized(ce, a, hi) > s) hi *= 2;
  const density = (z: number): number => (z <= 0 ? 0 : Math.exp((a - 1) * Math.log(z) - z - logGammaA));
  return safeguardedSolve(
    (z) => forwardGammaRegularized(ce, a, z),
    density,
    0,
    hi,
    s,
    false, // Q(a, z) decreases in z
  );
}

/** Solve I_x(a, b) = s for x in (0, 1). I_x increases from 0 to 1; the density
 * dI/dx = x^(a−1)·(1−x)^(b−1)/B(a,b), also in log space via logGammaReal. */
function inverseBetaRegularized(ce: ComputeEngine, a: number, b: number, s: number): number {
  const logBeta = logGammaReal(a) + logGammaReal(b) - logGammaReal(a + b);
  const density = (x: number): number =>
    x <= 0 || x >= 1 ? 0 : Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logBeta);
  return safeguardedSolve(
    (x) => forwardBetaRegularized(ce, x, a, b),
    density,
    0,
    1,
    s,
    true, // I_x(a, b) increases in x
  );
}

export function declareInverseGammaRegularized(ce: ComputeEngine): void {
  ce.declare("InverseGammaRegularized", {
    signature: "(number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [a, s] = ops;
      if (a === undefined || s === undefined) return undefined;
      // Q(a, 0) = 1 and Q(a, ∞) = 0 for ANY a — even a symbolic one.
      if (s.re === 1 && s.im === 0) return ce.Zero;
      if (s.re === 0 && s.im === 0) return ce.symbol("PositiveInfinity");
      // Q(1, z) = e^{−z} inverts exactly, symbolic s included.
      if (a.re === 1 && a.im === 0) {
        const expr = ce.function("Negate", [ce.function("Ln", [s])]);
        return wantsNumber(ops, options) ? expr.N() : expr.evaluate();
      }
      if (!wantsNumber(ops, options) || !isFiniteNum(a) || !isFiniteNum(s)) return undefined;
      if (a.im !== 0 || s.im !== 0 || a.re <= 0 || s.re < 0 || s.re > 1) return undefined;
      return ce.number(inverseGammaRegularized(ce, a.re, s.re));
    },
  });
}

export function declareInverseBetaRegularized(ce: ComputeEngine): void {
  ce.declare("InverseBetaRegularized", {
    signature: "(number, number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [s, a, b] = ops;
      if (s === undefined || a === undefined || b === undefined) return undefined;
      if (s.re === 0 && s.im === 0) return ce.Zero;
      if (s.re === 1 && s.im === 0) return ce.One;
      // I_x(1, 1) = x is its own inverse — symbolic s included.
      if (a.re === 1 && a.im === 0 && b.re === 1 && b.im === 0) {
        return wantsNumber(ops, options) ? s.N() : s.evaluate();
      }
      // I_x(a, 1) = x^a inverts to s^(1/a) — symbolic s included.
      if (b.re === 1 && b.im === 0) {
        const expr = ce.function("Power", [s, ce.function("Divide", [ce.One, a])]);
        return wantsNumber(ops, options) ? expr.N() : expr.evaluate();
      }
      if (!wantsNumber(ops, options) || !isFiniteNum(s) || !isFiniteNum(a) || !isFiniteNum(b)) return undefined;
      if (a.im !== 0 || b.im !== 0 || s.im !== 0 || a.re <= 0 || b.re <= 0) return undefined;
      if (s.re < 0 || s.re > 1) return undefined;
      return ce.number(inverseBetaRegularized(ce, a.re, b.re, s.re));
    },
  });
}

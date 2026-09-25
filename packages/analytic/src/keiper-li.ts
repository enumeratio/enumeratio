import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type EvalOptions, isRealInt, wantsNumber } from "./box.ts";
import { add, cexp, clog, cx, type Cx, mul, scale, sub } from "./complex.ts";
import { hurwitzZeta } from "./hurwitz-zeta.ts";
import { logGamma } from "./loggamma.ts";

// The Keiper–Li coefficients λₙ (Fungrim, "riemann_zeta" topic; Keiper 1992). Fungrim
// states two closed forms — λ₀ = 0 and λ₁ = 1 + γ/2 − ½ln(4π) — plus the general
// definition as a derivative of log ξ at s = 1 (Fungrim rewrites it at s = 0 under
// s ↦ s/(s−1); this uses the equivalent, more standard form the task states):
//   λₙ = 1/(n−1)! · dⁿ/dsⁿ [ sⁿ⁻¹ log ξ(s) ]  at s = 1,   n ≥ 1
// where ξ(s) = ½ s(s−1) π^(−s/2) Γ(s/2) ζ(s) is the completed (Riemann) xi function —
// entire, with the same nontrivial zeros as ζ, so log ξ(s) is single-valued and analytic
// on any disk around s = 1 that avoids them (the nearest, ½ ± 14.13i, is ~14 away).

const LOG_PI = Math.log(Math.PI);

/**
 * log ξ(s), computed as one sum of logs rather than log(xi(s)) after the fact — ξ can be
 * tiny or huge near its zeros, but nothing here is evaluated close to one (see above), so
 * this is for clarity, not to dodge overflow. `hurwitzZeta(s, 1)` is ζ(s); s itself never
 * lands exactly on 1 in the sampling below, so its pole there is never hit.
 */
function logXi(s: Cx): Cx {
  const logPrefactor = add(clog(s), clog(sub(s, cx(1)))); // log s + log(s−1)
  const halfS = scale(s, 0.5);
  const logPiTerm = scale(halfS, -LOG_PI); // −(s/2)·log π
  const lnGammaHalfS = logGamma(halfS);
  const lnZeta = clog(hurwitzZeta(s, cx(1)));
  return add(add(add(logPrefactor, logPiTerm), lnGammaHalfS), add(lnZeta, cx(-Math.LN2)));
}

/**
 * nᵗʰ derivative of `g` at `s0`, by Cauchy's differentiation formula sampled on a
 * circle of radius `r` with `steps` points (trapezoidal quadrature, which for an
 * analytic integrand on the whole circle converges geometrically — the standard way
 * to get several derivatives of one analytic function at once without the numerical
 * instability of repeated finite differences). `r` and `steps` are fixed by
 * `keiperLiLambda` below, tuned against the mpmath golden data (see
 * packages/reference/tests/keiper-li.test.ts) rather than adapted per call.
 */
function nthDerivative(g: (s: Cx) => Cx, s0: Cx, n: number, r: number, steps: number): Cx {
  let sum = cx(0);
  for (let k = 0; k < steps; k++) {
    const theta = (2 * Math.PI * k) / steps;
    const z = cx(s0.re + r * Math.cos(theta), s0.im + r * Math.sin(theta));
    const weight = cx(Math.cos(-n * theta), Math.sin(-n * theta)); // e^{−inθ}
    sum = add(sum, mul(g(z), weight));
  }
  let factorial = 1;
  for (let i = 2; i <= n; i++) factorial *= i;
  return scale(sum, factorial / (steps * r ** n));
}

function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

/**
 * The largest n this evaluator stands behind. Fixed contour radius 1.2 and 256 sample
 * points hold λₙ to better than 1e-9 absolute error through n = 20 (checked against
 * 50-digit mpmath contour differentiation of the same integral — see
 * packages/reference/tests/keiper-li.test.ts); the error grows roughly geometrically
 * with n past that (dividing the Cauchy sum by rⁿ amplifies float64 rounding faster
 * than a fixed radius/point-count can resolve it), so this declines rather than
 * returning a number that has quietly lost several digits.
 */
const MAX_N = 20;
const RADIUS = 1.2;
const STEPS = 256;

/** λ₁ = 1 + γ/2 − ½ln(4π) (Fungrim fungrim:d8d820) — computed symbolically, not numerically. */
function lambda1(ce: ComputeEngine, options: EvalOptions): BoxedExpression {
  return ce
    .box([
      "Subtract",
      ["Add", ["Divide", "EulerGamma", 2], 1],
      ["Divide", ["Ln", ["Multiply", 4, "Pi"]], 2],
    ])
    .evaluate(options);
}

/**
 * λₙ for a concrete nonnegative integer n ≤ `MAX_N`. n = 0 is Fungrim's stated value
 * (fungrim:081205); n = 1 the closed form above, evaluated under the same `options` the
 * call arrived with so `N(KeiperLiLambda(1))` comes back numeric while plain
 * `evaluate()` keeps the exact symbolic form; n ≥ 2 is always numeric (the contour
 * differentiation of `logXi` at s = 1 below).
 */
function keiperLiLambda(ce: ComputeEngine, n: number, options: EvalOptions): BoxedExpression {
  if (n === 0) return ce.Zero;
  if (n === 1) return lambda1(ce, options);
  const g = (s: Cx): Cx => mul(cexp(scale(clog(s), n - 1)), logXi(s)); // s^(n-1)·log ξ(s)
  const d = nthDerivative(g, cx(1), n, RADIUS, STEPS);
  // λₙ is real by construction (it sums to a real quantity over conjugate-paired zeta
  // zeros) — the contour sum's residual imaginary part is float64 noise, not signal, so
  // it is dropped rather than fed through `numberResult`'s real/complex threshold, which
  // is tuned for kernels whose result can genuinely be complex.
  return ce.number(scale(d, 1 / factorial(n - 1)).re);
}

/**
 * Declare `KeiperLiLambda(n)` — Fungrim's Keiper–Li coefficients. n = 0, 1 have exact
 * closed forms and evaluate unconditionally; n ≥ 2 is numeric-only (needs N() or a float
 * operand). n outside [0, `MAX_N`] — or non-integer/symbolic, which the `integer`
 * signature above already rejects — leaves the call unevaluated rather than guess.
 */
export function declareKeiperLi(ce: ComputeEngine): void {
  if (ce.lookupDefinition("KeiperLiLambda") !== undefined) return; // never redeclare

  ce.declare("KeiperLiLambda", {
    signature: "(integer) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [n] = ops;
      if (n === undefined || !isRealInt(n) || n.re < 0 || n.re > MAX_N) return undefined;
      if (n.re > 1 && !wantsNumber(ops, options)) return undefined;
      return keiperLiLambda(ce, n.re, options);
    },
  });
}

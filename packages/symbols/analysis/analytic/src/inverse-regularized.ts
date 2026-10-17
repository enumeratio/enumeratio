// unstable: BigDecimal, the class compute-engine's boxed numbers hold; no /numerics subpath yet
import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  atDigits,
  bigRealOperand,
  bigResult,
  type EvalOptions,
  exceedsDoublePrecision,
  isFiniteNum,
  wantsNumber,
  logGammaReal,
} from "@enumeratio/ce-patches";
import { BigDecimal } from "@enumeratio/engine/unstable";
import { inverseGamma } from "./hypergeometric-big.ts";

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
  start = 0.5 * (lo + hi),
): number | undefined {
  // The residual is judged relative to the target; a root the solver cannot reach (a double
  // underflows before f gets near the target) is declined, not answered with its last iterate.
  const settled = (x: number): boolean => Math.abs(f(x) - target) <= RESIDUAL_TOLERANCE * target;
  let x = start > lo && start < hi ? start : 0.5 * (lo + hi);
  for (let i = 0; i < 100; i++) {
    const fx = f(x) - target;
    if (Math.abs(fx) < 1e-14 * target) return x;
    if (increasing === fx < 0) lo = x;
    else hi = x;
    const d = fPrime(x);
    let xn = d === 0 || !Number.isFinite(d) ? Number.NaN : x - fx / (increasing ? d : -d);
    if (!(xn > lo && xn < hi)) xn = 0.5 * (lo + hi);
    // Relative, not absolute: a root near 0 is only reached to its own scale.
    if (Math.abs(xn - x) < 1e-15 * Math.abs(x)) return settled(xn) ? xn : undefined;
    x = xn;
  }
  return settled(x) ? x : undefined;
}

/** Largest |f(x) - target| / target at which a root is accepted. The step floor stops a little
 *  short of the last digit, but a root the double cannot represent leaves a residual of the order
 *  of the target itself (InverseBetaRegularized(0.3, 2.5e-6, 1.5e-6)). */
const RESIDUAL_TOLERANCE = 1e-10;

const forwardGammaRegularized = (ce: ComputeEngine, a: number, z: number): number =>
  ce.box(["GammaRegularized", a, z] as never).N().re;

const forwardBetaRegularized = (ce: ComputeEngine, x: number, a: number, b: number): number =>
  ce.box(["BetaRegularized", x, a, b] as never).N().re;

// Tiny roots. The solver's tolerances are absolute, so a root near 0 (or near 1) can't be
// reached by stepping in x, and the answer may be below the smallest double: I_x(2.5e-6, 1.5e-6)
// = 0.3 has x ≈ e^-89257. There the forward function is its leading term,
//   I_x(a, b) = x^a/(a·B(a, b)) · (1 + O(max(1, |b−1|)·x)),   P(a, z) = z^a/Γ(a+1) · (1 + O(z)),
// which inverts in log space: ln x = (ln p + ln Γ(a+1) + ln Γ(b) − ln Γ(a+b))/a. Once the
// correction is negligible that is the answer; the beta's upper tail is the lower tail of the
// swapped one (x = 1 − y, with I_y(b, a) = 1 − p).

/** Below this the leading term's relative error is under a double's epsilon. */
const NEGLIGIBLE = 1e-17;

const NORMAL_MIN = 2.2250738585072014e-308;

/** ln of the root of x^a/(a·B(a, b)) = p. */
const betaLogRoot = (a: number, b: number, p: number): number =>
  (Math.log(p) + logGammaReal(a + 1) + logGammaReal(b) - logGammaReal(a + b)) / a;

interface BetaTail {
  upper: boolean;
  /** ln of the root, of x (lower tail) or of y = 1 − x (upper tail). */
  logRoot: number;
}

/** The tail whose leading term is exact to a double for I_x(a, b) = p, if either is. */
function betaTail(a: number, b: number, p: number): BetaTail | undefined {
  const lower = betaLogRoot(a, b, p);
  if (Math.exp(lower) * Math.max(1, Math.abs(b - 1)) < NEGLIGIBLE) return { upper: false, logRoot: lower };
  const upper = betaLogRoot(b, a, 1 - p);
  if (Math.exp(upper) * Math.max(1, Math.abs(a - 1)) < NEGLIGIBLE) return { upper: true, logRoot: upper };
  return undefined;
}

/** e^(ln q / a) at `digits` digits, `logRoot` (a double estimate) sizing the guard digits that
 * the exponent's magnitude eats; exact down to the true value however far below a double it is. */
function bigLogRootExp(q: () => BigDecimal, a: BigDecimal, logRoot: number, digits: number): BigDecimal {
  const working = digits + 10 + Math.ceil(Math.log10(Math.abs(logRoot) + 1));
  return atDigits(working, () => q().ln().div(a).exp()).toPrecision(digits);
}

/** Bignum lower-tail root of I_x(a, b) = p, or undefined when the leading term is not exact to
 * `digits` digits. `logRoot` is the double estimate. */
function betaTailBig(
  a: BigDecimal,
  b: BigDecimal,
  p: BigDecimal,
  logRoot: number,
  digits: number,
): BigDecimal | undefined {
  if (Math.exp(logRoot) * Math.max(1, Math.abs(b.toNumber() - 1)) >= 10 ** -(digits + 3)) return undefined;
  const working = digits + 15;
  // p·a·B(a, b) = p·Γ(a+1)·Γ(b)/Γ(a+b)
  const q = () =>
    p.mul(inverseGamma(a.add(b), working)).div(inverseGamma(a.add(1), working).mul(inverseGamma(b, working)));
  return bigLogRootExp(q, a, logRoot, digits);
}

/** Bignum root of P(a, z) = 1 − s likewise. */
function gammaTailBig(a: BigDecimal, s: BigDecimal, logRoot: number, digits: number): BigDecimal | undefined {
  if (Math.exp(logRoot) >= 10 ** -(digits + 3)) return undefined;
  const working = digits + 15;
  const q = () => new BigDecimal(1).sub(s).div(inverseGamma(a.add(1), working));
  return bigLogRootExp(q, a, logRoot, digits);
}

/** P(a, z) = z^a e^(−z) Σ z^k/Γ(a+k+1), summed directly: every term is positive, so unlike
 * 1 − Q(a, z) it keeps its relative precision however small P is. NaN where the sum overflows. */
function lowerGammaRegularized(a: number, z: number): number {
  if (z <= 0) return 0;
  let term = 1;
  let sum = 1;
  for (let k = 1; k < 100_000; k++) {
    term *= z / (a + k);
    sum += term;
    if (term < 1e-17 * sum) return Math.exp(a * Math.log(z) - z - logGammaReal(a + 1)) * sum;
    if (!Number.isFinite(sum)) break;
  }
  return Number.NaN;
}

const gammaDensity =
  (a: number) =>
  (z: number): number =>
    z <= 0 ? 0 : Math.exp((a - 1) * Math.log(z) - z - logGammaReal(a));

/** Solve Q(a, z) = s for z > 0, `q` being 1 − s (carried apart: s itself may have rounded to 1).
 * Q decreases from 1 (z=0) to 0 (z→∞); doubling search finds a
 * bracket, then `safeguardedSolve` refines against Q'(z) = −z^(a−1)·e^(−z)/Γ(a) (in log space).
 * 1 − s is the tail when s is near 1; the lower tail P(a, z) = 1 − s is then solved instead, as
 * 1 − Q has lost its digits of z. P's own prefactor costs about a·ε, Q's 1 − s costs ε/(1 − s). */
function inverseGammaRegularized(ce: ComputeEngine, a: number, s: number, q: number): number | undefined {
  const start = Math.exp((Math.log(q) + logGammaReal(a + 1)) / a); // the leading term: a good start for a small root
  if (s > 0.5 && q * Math.max(1, a) < 0.5) {
    let hi = start > 0 ? Math.min(1, start) : 1;
    while (lowerGammaRegularized(a, hi) < q) hi *= 2;
    const z = safeguardedSolve(
      (z) => lowerGammaRegularized(a, z),
      gammaDensity(a),
      0,
      hi,
      q,
      true, // P(a, z) increases in z
      start,
    );
    if (z !== undefined) return z;
  }
  let hi = 1;
  while (forwardGammaRegularized(ce, a, hi) > s) hi *= 2;
  return safeguardedSolve(
    (z) => forwardGammaRegularized(ce, a, z),
    gammaDensity(a),
    0,
    hi,
    s,
    false, // Q(a, z) decreases in z
    start,
  );
}

/** Solve I_x(a, b) = s for x in (0, 1). I_x increases from 0 to 1; the density
 * dI/dx = x^(a−1)·(1−x)^(b−1)/B(a,b), also in log space via logGammaReal. */
function inverseBetaRegularized(ce: ComputeEngine, a: number, b: number, s: number): number | undefined {
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
    Math.exp(betaLogRoot(a, b, s)),
  );
}

/**
 * Newton's method on the bignum series for P(a, z) = z^a e^(−z) Σ z^k/Γ(a+k+1), from the double
 * answer: each step doubles the digits, so a few reach any precision asked. Q = 1 − P loses the
 * digits of 1/s (and of 1/(1 − s) near s = 1, where P is the small one), which the working
 * precision covers. `undefined` if it does not settle.
 */
function inverseGammaRegularizedBig(a: BigDecimal, s: BigDecimal, z0: number, digits: number): BigDecimal | undefined {
  const tail = s.lt(0.5) ? s : new BigDecimal(1).sub(s);
  const working = digits + 15 + Math.max(0, Math.ceil(-tail.ln().toNumber() * Math.LOG10E));
  return atDigits(working, () => {
    const one = new BigDecimal(1);
    const tol = new BigDecimal(10).pow(-(working + 2));
    const settled = new BigDecimal(10).pow(-(digits + 6)); // a step this small is below the digits asked
    const invGamma = inverseGamma(a.add(1), working); // 1/Γ(a+1)
    let z = new BigDecimal(z0);
    for (let iter = 0; iter < 12; iter++) {
      let term = one;
      let sum = one;
      for (let k = 1; k < 100_000; k++) {
        term = term.mul(z).div(a.add(k)).toPrecision(working);
        sum = sum.add(term);
        if (term.lt(tol.mul(sum))) break;
      }
      const prefix = z.ln().mul(a).sub(z).exp().mul(invGamma).toPrecision(working);
      const q = one.sub(prefix.mul(sum));
      // dQ/dz = −(a/z)·prefix, so the step is z·(Q − s)/(a·prefix) up.
      const step = q.sub(s).mul(z).div(a.mul(prefix));
      z = z.add(step).toPrecision(working);
      if (step.abs().lt(settled.mul(z.abs()))) return z.toPrecision(digits);
    }
    return undefined;
  });
}

export function declareInverseGammaRegularized(ce: ComputeEngine): void {
  ce.declare("InverseGammaRegularized", {
    signature: "(number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [a, s] = ops;
      if (a === undefined || s === undefined) return undefined;
      // Q(a, 0) = 1 and Q(a, ∞) = 0 for ANY a — even a symbolic one.
      // (`is`, not `re`: a bignum s a hair under 1, or over 0, rounds to 1 or 0 as a double.)
      if (s.is(1)) return ce.Zero;
      if (s.is(0)) return ce.symbol("PositiveInfinity");
      // Q(1, z) = e^{−z} inverts exactly, symbolic s included.
      if (a.is(1)) {
        const expr = ce.function("Negate", [ce.function("Ln", [s])]);
        return wantsNumber(ops, options) ? expr.N() : expr.evaluate();
      }
      if (!wantsNumber(ops, options) || !isFiniteNum(a) || !isFiniteNum(s)) return undefined;
      if (a.im !== 0 || s.im !== 0 || a.re <= 0 || s.re < 0 || s.re > 1) return undefined;
      const wantsBig = exceedsDoublePrecision(ce, options.numericApproximation);
      const [big, bigS] = wantsBig ? [bigRealOperand(ce, a), bigRealOperand(ce, s)] : [undefined, undefined];
      // A root too small to step to is the leading term's, however far below a double it falls.
      const logQ = bigS === undefined ? Math.log1p(-s.re) : new BigDecimal(1).sub(bigS).ln().toNumber();
      const logRoot = (logQ + logGammaReal(a.re + 1)) / a.re;
      const tiny = Math.exp(logRoot) < NEGLIGIBLE;
      if (tiny && big !== undefined && bigS !== undefined) {
        const root = gammaTailBig(big, bigS, logRoot, ce.precision);
        if (root !== undefined) return bigResult(ce, root);
        // No double start to fall back on once the root has left the doubles.
        if (!(Math.exp(logRoot) > NORMAL_MIN)) return undefined;
      }
      const z0 = tiny
        ? Math.exp(logRoot)
        : inverseGammaRegularized(ce, a.re, s.re, bigS === undefined ? 1 - s.re : Math.exp(logQ));
      if (z0 === undefined) return undefined;
      // The double solve is the start; past a double's digits the bignum series finishes it.
      if (wantsBig) {
        if (big === undefined || bigS === undefined) return undefined;
        const value = inverseGammaRegularizedBig(big, bigS, z0, ce.precision);
        return value === undefined ? undefined : bigResult(ce, value);
      }
      return ce.number(z0);
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
      const tail = betaTail(a.re, b.re, s.re);
      if (tail === undefined) {
        const x = inverseBetaRegularized(ce, a.re, b.re, s.re);
        return x === undefined ? undefined : ce.number(x);
      }
      const root = Math.exp(tail.logRoot);
      if (exceedsDoublePrecision(ce, options.numericApproximation)) {
        const [bigA, bigB, bigS] = [bigRealOperand(ce, a), bigRealOperand(ce, b), bigRealOperand(ce, s)];
        if (bigA === undefined || bigB === undefined || bigS === undefined) return undefined;
        const one = new BigDecimal(1);
        const [tailA, tailB, tailP] = tail.upper ? [bigB, bigA, one.sub(bigS)] : [bigA, bigB, bigS];
        const bigRoot = betaTailBig(tailA, tailB, tailP, tail.logRoot, ce.precision);
        if (bigRoot !== undefined) {
          if (!tail.upper) return bigResult(ce, bigRoot);
          // 1 − y rounds to 1 once y is below the precision; skip building the exact difference.
          return bigResult(ce, bigRoot.lt(new BigDecimal(10).pow(-(ce.precision + 2))) ? one : one.sub(bigRoot));
        }
        // A double answer is wrong once the root has left the doubles.
        if (!(root > NORMAL_MIN)) return undefined;
      }
      return ce.number(tail.upper ? 1 - root : root);
    },
  });
}

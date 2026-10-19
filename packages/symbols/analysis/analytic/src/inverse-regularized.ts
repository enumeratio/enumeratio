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
// form in general, so both are solved numerically — a safeguarded Newton's method in ln x on
// ln F (falling back to bisection whenever a step would leave the bracket) against
// compute-engine's own native GammaRegularized / BetaRegularized as the forward function, whose
// accuracy was checked directly (GammaRegularized(2.5, 3) and BetaRegularized(0.5, 2.5, 1.5) both
// matched Wolfram to 20 digits). The derivative in each case is the corresponding density,
// evaluated in log space (via `logGammaReal`) so it doesn't overflow/underflow away from the mode.

interface LogProblem {
  /** The forward function F(x); NaN where it cannot be evaluated. */
  f: (x: number) => number;
  /** d ln F / d ln x at x, F(x) = fx. */
  slope: (x: number, fx: number) => number;
  increasing: boolean;
  /** ln of the largest x searched: 0 for the beta's x ≤ 1, the double range for a gamma's z. */
  maxLog: number;
}

interface Solved {
  /** The last iterate; a start for a finer solver when `settled` is false. */
  x: number;
  settled: boolean;
}

/** A double holds e^-745 (subnormal) up to e^709. */
const MIN_LOG = -745;

/** Newton steps in ln x. ln F is close to linear in ln x on both tails (ln P ≈ a·ln z, ln Q ≈ −z),
 * so a few dozen are ample; past the cap the root is declined. */
const LOG_STEPS = 60;

/** Newton steps in x itself. ln x carries only |ln x|·ε of the root's digits, so the last steps
 * run on x, where the step is already tiny and Newton is locally exact. */
const POLISH_STEPS = 4;

/** A step in ln x below this is a relative step in x below it: the polish takes over. */
const LOG_STEP_TOLERANCE = 1e-9;

/**
 * Solve F(x) = target for x in (0, e^maxLog] by Newton's method on ln F − ln target as a function
 * of ln x, bisecting in ln x whenever a step would leave the bracket. A root past the double range
 * (or one the residual check does not vouch for) is `settled: false`. `scale` is the tail the
 * residual is judged against.
 */
function solveInLog(problem: LogProblem, target: number, startLog: number, scale = target): Solved {
  const { f, slope, increasing, maxLog } = problem;
  // log1p keeps the residual when F is within an epsilon of a target near 1.
  const residual = (fx: number): number => (fx > 0 ? Math.log1p((fx - target) / target) : -Infinity);
  let lo = MIN_LOG;
  let hi = maxLog;
  let u = Math.min(Math.max(startLog, lo), hi);
  let converged = false;
  for (let i = 0; i < LOG_STEPS; i++) {
    const fx = f(Math.exp(u));
    if (Number.isNaN(fx)) break;
    const h = residual(fx);
    if (h === 0) {
      converged = true;
      break;
    }
    if (increasing === h < 0) lo = u;
    else hi = u;
    const d = slope(Math.exp(u), fx);
    let un = d === 0 || !Number.isFinite(d) || !Number.isFinite(h) ? Number.NaN : u - h / d;
    if (!(un > lo && un < hi)) un = 0.5 * (lo + hi);
    const step = Math.abs(un - u);
    u = un;
    if (step < LOG_STEP_TOLERANCE) {
      converged = true;
      break;
    }
  }
  let x = Math.exp(u);
  if (!converged || x === 0) return { x, settled: false };
  for (let i = 0; i < POLISH_STEPS; i++) {
    const fx = f(x);
    const d = slope(x, fx);
    const xn = x * (1 - residual(fx) / d);
    if (!(xn > 0 && xn <= Math.exp(maxLog)) || !Number.isFinite(xn)) break;
    const done = Math.abs(xn - x) < 1e-15 * x;
    x = xn;
    if (done) break;
  }
  // The residual is judged relative to the smaller tail (`scale`): near a target of 1 the
  // forward function's own rounding would pass any x. A root the solver cannot reach (a double
  // underflows before f gets near the target) is declined, not answered with its last iterate.
  return { x, settled: Math.abs(f(x) - target) <= RESIDUAL_TOLERANCE * scale };
}

/** Largest |F(x) − target| / scale at which a root is accepted, `scale` being the smaller of the
 *  target and its complement. The polish stops a little short of the last digit, but a root the
 *  double cannot represent leaves a residual of the order of the target itself
 *  (InverseBetaRegularized(0.3, 2.5e-6, 1.5e-6)). */
const RESIDUAL_TOLERANCE = 1e-10;

/** Q(a, z) for z ≥ a + 1 by its continued fraction (DLMF 8.9.2, evaluated by the modified Lentz
 * method), which keeps its relative precision however small Q is: compute-engine's own
 * GammaRegularized(500, 911.6) is −7e-43, the rounding of 1 − P. NaN past the cap (the solve then
 * declines). Convergence is three consecutive factors within a few ε of 1, not one lucky one. */
function upperGammaRegularizedFraction(a: number, z: number): number {
  const floor = 1e-300;
  let b = z + 1 - a;
  let c = 1 / floor;
  let d = 1 / b;
  let h = d;
  let settled = 0;
  for (let i = 1; i < FRACTION_TERMS; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < floor) d = floor;
    c = b + an / c;
    if (Math.abs(c) < floor) c = floor;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    settled = Math.abs(delta - 1) < 4e-16 ? settled + 1 : 0;
    if (settled === 3) return Math.exp(a * Math.log(z) - z - logGammaReal(a)) * h;
  }
  return Number.NaN;
}

/** Terms of the fraction before it declines: it needs about √a near z = a + 1. */
const FRACTION_TERMS = 10_000;

/** Q(a, z): the continued fraction where it applies (NaN if it does not converge), else
 * compute-engine's, where Q ≥ ~0.4 and 1 − P keeps its digits. */
const forwardGammaRegularized = (ce: ComputeEngine, a: number, z: number): number =>
  z >= a + 1 ? upperGammaRegularizedFraction(a, z) : ce.box(["GammaRegularized", a, z] as never).N().re;

const forwardBetaRegularized = (ce: ComputeEngine, x: number, a: number, b: number): number =>
  ce.box(["BetaRegularized", x, a, b] as never).N().re;

// Tiny roots. The answer may be below the smallest double, out of reach of any step in ln x:
// I_x(2.5e-6, 1.5e-6) = 0.3 has x ≈ e^-89257. There the forward function is its leading term,
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
function betaTail(a: number, b: number, p: number, q: number): BetaTail | undefined {
  const lower = betaLogRoot(a, b, p);
  if (Math.exp(lower) * Math.max(1, Math.abs(b - 1)) < NEGLIGIBLE) return { upper: false, logRoot: lower };
  const upper = betaLogRoot(b, a, q);
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

/** d ln P/d ln z = z·P'(z)/P = e^(a·ln z − z − ln Γ(a) − ln P); Q's slope is its negative. */
const gammaSlope =
  (a: number, sign: 1 | -1) =>
  (z: number, fz: number): number =>
    sign * Math.exp(a * Math.log(z) - z - logGammaReal(a) - Math.log(fz));

/** ln z for Q(a, z) = s from Q ≈ z^(a−1)·e^(−z)/Γ(a) (DLMF 8.11.2), i.e.
 *  z = −ln(s·Γ(a)) + (a−1)·ln z, iterated from the larger of a and the exponential part. Only a
 *  start: in the tail Newton in ln z takes over within a few steps
 *  (InverseGammaRegularized(100, 1e-100) = 520.25, where the leading term P ≈ z^a/Γ(a+1) starts
 *  at 37). */
function gammaTailStartLog(a: number, s: number): number {
  const exponent = -Math.log(s) - logGammaReal(a);
  let z = Math.max(a, exponent);
  for (let i = 0; i < 4; i++) {
    const next = exponent + (a - 1) * Math.log(z);
    if (!(next > 0)) break;
    z = next;
  }
  return Math.log(z);
}

/** Doublings of a bracket before the root is declared out of reach: 2^1100 is past a double. */
const MAX_DOUBLINGS = 1100;

/** q = 1 − s. A decimal a double holds (a literal like 0.99999999999999, or a double) is read as
 * that double, as everywhere else. One finer than a double (a Rational or bignum s a hair under 1:
 * 1 − 1e-20 rounds to 1, and 1 − 3e-17 gives q off by tens of percent) takes q from the exact
 * value, which compute-engine subtracts exactly. */
function complementOf(ce: ComputeEngine, s: BoxedExpression): number {
  const exact = s.bignumRe;
  if (exact === undefined || exact.sub(new BigDecimal(String(s.re))).isZero()) return 1 - s.re;
  return ce.One.sub(s).re;
}
/** Solve Q(a, z) = s for z > 0, `q` being 1 − s (carried apart: s itself may have rounded to 1).
 * Q decreases from 1 (z=0) to 0 (z→∞); doubling search bounds the root, then `solveInLog`
 * refines it against Q'(z) = −z^(a−1)·e^(−z)/Γ(a).
 * 1 − s is the tail when s is near 1; the lower tail P(a, z) = 1 − s is then solved instead, as
 * 1 − Q has lost its digits of z. P's own prefactor costs about a·ε, Q's 1 − s costs ε/(1 − s). */
function inverseGammaRegularized(ce: ComputeEngine, a: number, s: number, q: number): Solved {
  // P(a, z) = z^a/Γ(a+1) at small z: a good start for a root below 1, else the tail's.
  const leadLog = (Math.log(q) + logGammaReal(a + 1)) / a;
  const startLog = leadLog < 0 ? leadLog : s < 0.5 ? gammaTailStartLog(a, s) : leadLog;
  if (s > 0.5 && q * Math.max(1, a) < 0.5) {
    let hi = leadLog < 0 ? Math.min(1, Math.exp(leadLog)) : 1;
    if (!(hi > 0)) hi = 1;
    let n = 0;
    while (!(lowerGammaRegularized(a, hi) >= q) && n++ < MAX_DOUBLINGS) hi *= 2;
    if (n > MAX_DOUBLINGS) return { x: hi, settled: false };
    return solveInLog(
      { f: (z) => lowerGammaRegularized(a, z), slope: gammaSlope(a, 1), increasing: true, maxLog: Math.log(hi) },
      q,
      startLog,
    );
  }
  let hi = 1;
  let n = 0;
  while (forwardGammaRegularized(ce, a, hi) > s && n++ < MAX_DOUBLINGS) hi *= 2;
  if (n > MAX_DOUBLINGS) return { x: hi, settled: false };
  return solveInLog(
    { f: (z) => forwardGammaRegularized(ce, a, z), slope: gammaSlope(a, -1), increasing: false, maxLog: Math.log(hi) },
    s,
    startLog,
    Math.min(s, q),
  );
}

/** I_x(a, b) as a log problem: d ln I/d ln x = x·x^(a−1)·(1−x)^(b−1)/(B(a, b)·I). */
function betaProblem(ce: ComputeEngine, a: number, b: number): LogProblem {
  const logBeta = logGammaReal(a) + logGammaReal(b) - logGammaReal(a + b);
  return {
    f: (x) => forwardBetaRegularized(ce, x, a, b),
    slope: (x, fx) => Math.exp(a * Math.log(x) + (b - 1) * Math.log1p(-x) - logBeta - Math.log(fx)),
    increasing: true, // I_x(a, b) increases in x
    maxLog: 0,
  };
}

/** At or above this a root found as 1 − y keeps a double's digits (y rounds to 1 − x with an
 *  absolute error of ε, so x keeps ε/x of them): a relative error of 1e-13 at worst. */
const COMPLEMENT_PREFERRED = 1e-3;

/** Below this a root found as 1 − y has lost the digits the residual check asks for (1e-10). */
const COMPLEMENT_MIN = 1e-6;

/** Below this a target s = 1 − q cannot tell roots apart to the residual check's 1e-10: s is a
 *  double, spaced ε apart, and q is only ε/q of them (InverseBetaRegularized(1 − 1e-14, 3, 1000)
 *  = 0.0381333 is the same double target as 0.0381321, which the direct solve cannot see). */
const RESOLVABLE_TAIL = 1e-6;

/** Solve I_x(a, b) = s for x in (0, 1). Above s = 1/2 the upper tail is the small one:
 * I_x(a, b) = s is I_y(b, a) = 1 − s with y = 1 − x, judged against 1 − s. The direct solve is
 * kept for a small root (where 1 − y has lost x's digits) when s resolves the tail. */
function inverseBetaRegularized(ce: ComputeEngine, a: number, b: number, s: number, q: number): Solved {
  const direct = (): Solved => solveInLog(betaProblem(ce, a, b), s, betaLogRoot(a, b, s), Math.min(s, q));
  if (s <= 0.5) return direct();
  const upper = solveInLog(betaProblem(ce, b, a), q, betaLogRoot(b, a, q));
  const complement = { x: 1 - upper.x, settled: upper.settled };
  if (complement.settled && complement.x >= COMPLEMENT_PREFERRED) return complement;
  if (q >= RESOLVABLE_TAIL) {
    const lower = direct();
    if (lower.settled) return lower;
  }
  return { x: complement.x, settled: complement.settled && complement.x >= COMPLEMENT_MIN };
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
      let summed = false;
      for (let k = 1; k < 100_000 && !summed; k++) {
        term = term.mul(z).div(a.add(k)).toPrecision(working);
        sum = sum.add(term);
        summed = term.lt(tol.mul(sum));
      }
      if (!summed) return undefined; // a truncated sum is not P
      const prefix = z.ln().mul(a).sub(z).exp().mul(invGamma).toPrecision(working);
      const q = one.sub(prefix.mul(sum));
      // dQ/dz = −(a/z)·prefix, so the step is z·(Q − s)/(a·prefix) up.
      const step = q.sub(s).mul(z).div(a.mul(prefix));
      z = z.add(step).toPrecision(working);
      if (!z.isPositive()) return undefined; // a start the series cannot step from
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
      // Q(a, z) is a probability: a real s outside [0, 1] has no inverse.
      if (isFiniteNum(s) && s.im === 0 && (s.re < 0 || s.re > 1)) return undefined;
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
      const q = bigS === undefined ? complementOf(ce, s) : Number.NaN;
      if (bigS === undefined && !(q > 0)) return undefined;
      const logQ = bigS === undefined ? Math.log(q) : new BigDecimal(1).sub(bigS).ln().toNumber();
      const logRoot = (logQ + logGammaReal(a.re + 1)) / a.re;
      const tiny = Math.exp(logRoot) < NEGLIGIBLE;
      if (tiny && big !== undefined && bigS !== undefined) {
        const root = gammaTailBig(big, bigS, logRoot, ce.precision);
        if (root !== undefined) return bigResult(ce, root);
        // No double start to fall back on once the root has left the doubles.
        if (!(Math.exp(logRoot) > NORMAL_MIN)) return undefined;
      }
      const solved: Solved = tiny
        ? { x: Math.exp(logRoot), settled: true }
        : inverseGammaRegularized(ce, a.re, s.re, bigS === undefined ? q : Math.exp(logQ));
      // The double solve is the start; past a double's digits the bignum series finishes it, from
      // the last iterate even when the double solve could not vouch for it.
      if (wantsBig) {
        if (big === undefined || bigS === undefined || !(solved.x > 0) || !Number.isFinite(solved.x)) return undefined;
        const value = inverseGammaRegularizedBig(big, bigS, solved.x, ce.precision);
        return value === undefined ? undefined : bigResult(ce, value);
      }
      return solved.settled ? ce.number(solved.x) : undefined;
    },
  });
}

export function declareInverseBetaRegularized(ce: ComputeEngine): void {
  ce.declare("InverseBetaRegularized", {
    signature: "(number, number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [s, a, b] = ops;
      if (s === undefined || a === undefined || b === undefined) return undefined;
      if (s.is(0)) return ce.Zero;
      if (s.is(1)) return ce.One;
      // A probability: a real s outside [0, 1] has no inverse, whatever the closed forms below say.
      if (isFiniteNum(s) && s.im === 0 && (s.re < 0 || s.re > 1)) return undefined;
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
      const q = complementOf(ce, s);
      if (!(q > 0)) return undefined;
      const wantsBig = exceedsDoublePrecision(ce, options.numericApproximation);
      const tail = betaTail(a.re, b.re, s.re, q);
      if (tail === undefined) {
        // There is no bignum solve: a double is not the answer to a precision beyond a double's.
        if (wantsBig) return undefined;
        const solved = inverseBetaRegularized(ce, a.re, b.re, s.re, q);
        return solved.settled ? ce.number(solved.x) : undefined;
      }
      const root = Math.exp(tail.logRoot);
      if (wantsBig) {
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
        // A double answer is not the answer at this precision.
        return undefined;
      }
      return ce.number(tail.upper ? 1 - root : root);
    },
  });
}

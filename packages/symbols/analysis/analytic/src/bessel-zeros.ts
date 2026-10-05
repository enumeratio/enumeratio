import { BigDecimal, type BoxedExpression, type ComputeEngine } from "@cortex-js/compute-engine";
import {
  atDigits,
  bigCx,
  DOUBLE_DIGITS,
  type EvalOptions,
  isFiniteNum,
  logGammaBig,
  logGammaReal,
  wantsNumber,
} from "@enumeratio/ce-patches";

// BesselJZero(ν, k) — the k-th positive zero of the Bessel function J_ν, real ν > −1,
// positive integer k. compute-engine 0.128's native `BesselJ` only evaluates
// numerically at integer order (probed: `BesselJ(1.5, x).N()` stays symbolic), so the
// zero-finder below carries its own real J_ν, real x series rather than depending on
// a head that would fail on exactly the half-integer orders Fungrim's identities use
// (e.g. j_{3/2,1}, the sinc function's first turning point).
//
// J_ν(x) = (x/2)^ν Σ_{m≥0} (−1)^m (x/2)^{2m} / (m! Γ(m+ν+1)), computed by the term
// ratio t_m = t_{m−1} · (−(x/2)²)/(m(m+ν)) rather than raw factorials/gammas — stable
// for the x ≲ 60 range zero-finding needs. The derivative uses J_ν'(x) = J_{ν−1}(x) −
// (ν/x) J_ν(x), so one extra series (sharing the (x/2)² term) gives both a value and a
// slope for Newton's method. McMahon's asymptotic expansion seeds the search close
// enough (see `mcmahonZero`) that a bracket-and-bisect around it is enough to land the
// k-th zero without walking the earlier k−1 zeros first.

/** J_ν(x) and J_{ν−1}(x) together, both by the term-ratio series. */
function besselJPair(nu: number, x: number): { j: number; jPrev: number } {
  const halfX = x / 2;
  const q = -halfX * halfX;
  // J_ν: t_0 = (x/2)^ν / Γ(ν+1); t_m = t_{m-1} · q / (m(m+ν)).
  let tNu = Math.exp(nu * Math.log(halfX) - logGammaReal(nu + 1));
  let sumNu = tNu;
  // J_{ν−1}: t_0 = (x/2)^{ν−1} / Γ(ν); t_m = t_{m-1} · q / (m(m+ν−1)).
  let tPrev = Math.exp((nu - 1) * Math.log(halfX) - logGammaReal(nu));
  let sumPrev = tPrev;
  for (let m = 1; m < 400; m++) {
    tNu *= q / (m * (m + nu));
    sumNu += tNu;
    tPrev *= q / (m * (m + nu - 1));
    sumPrev += tPrev;
    if (Math.abs(tNu) < 1e-17 * Math.abs(sumNu) && Math.abs(tPrev) < 1e-17 * Math.abs(sumPrev)) {
      break;
    }
  }
  return { j: sumNu, jPrev: sumPrev };
}

/** J_ν'(x) alongside J_ν(x), from the recurrence J_ν' = J_{ν−1} − (ν/x) J_ν. */
function besselJAndDeriv(nu: number, x: number): { j: number; jp: number } {
  const { j, jPrev } = besselJPair(nu, x);
  return { j, jp: jPrev - (nu / x) * j };
}

/** McMahon's asymptotic estimate of the k-th positive zero of J_ν — a seed, not the answer. */
function mcmahonZero(nu: number, k: number): number {
  const beta = (k + nu / 2 - 0.25) * Math.PI;
  const mu = 4 * nu * nu;
  const eightBeta = 8 * beta;
  return (
    beta -
    (mu - 1) / eightBeta -
    (4 * (mu - 1) * (7 * mu - 31)) / (3 * eightBeta ** 3) -
    (32 * (mu - 1) * (83 * mu * mu - 982 * mu + 3779)) / (15 * eightBeta ** 5)
  );
}

/** The k-th positive zero of J_ν, ν > −1, k ≥ 1: bracket the McMahon seed, then bisect. */
export function besselJZero(nu: number, k: number): number {
  const seed = Math.max(1e-6, mcmahonZero(nu, k));
  // Widen outward from the seed until J_ν changes sign, then bisect the bracket.
  const step = Math.max(0.25, 0.1 * seed);
  let lo = seed;
  let hi = seed;
  let fLo = besselJPair(nu, Math.max(lo, 1e-9)).j;
  let fHi = fLo;
  for (let i = 0; i < 200 && fLo * fHi > 0; i++) {
    lo = Math.max(1e-9, seed - (i + 1) * step);
    hi = seed + (i + 1) * step;
    fLo = besselJPair(nu, lo).j;
    fHi = besselJPair(nu, hi).j;
  }
  for (let i = 0; i < 100; i++) {
    const mid = 0.5 * (lo + hi);
    const fm = besselJPair(nu, mid).j;
    if (fm === 0 || hi - lo < 1e-15 * mid) return mid;
    if ((fLo < 0 && fm < 0) || (fLo > 0 && fm > 0)) {
      lo = mid;
      fLo = fm;
    } else {
      hi = mid;
    }
  }
  // A few Newton polishing steps once bisection has a tight bracket (J_ν'(x) ≠ 0 there).
  let x = 0.5 * (lo + hi);
  for (let i = 0; i < 6; i++) {
    const { j, jp } = besselJAndDeriv(nu, x);
    if (jp === 0) break;
    x -= j / jp;
  }
  return x;
}

// --- BigDecimal refinement -------------------------------------------------------------------
// The double series above is alternating, with terms up to ~e^x/√(2πx) summing to a value
// near 0 at a zero, so it keeps only ~16 − x/2.3 digits (j_{0,3} = 8.65… came out 10 ulps off).
// The answer is Newton-refined from the double zero in BigDecimal at digits + x/2.3 + guard.

/** Largest zero refined in BigDecimal: the series cancels x/2.3 digits and needs ~x/2 terms. */
const MAX_BIG_ZERO = 400;
/** Digits carried past the ones asked for. */
const BIG_GUARD = 15;
/** The double series (≈16 − x/2.3 digits) seeds Newton reliably up to here. */
const SERIES_SEED_LIMIT = 30;
const BIG_MAX_TERMS = 4000;
const BIG_MAX_NEWTON = 12;

/** J_ν(x) and J_ν'(x) = (ν/x) J_ν(x) − J_{ν+1}(x) by the term-ratio series at the working
 * precision; undefined if the series has not settled within `BIG_MAX_TERMS`. */
function besselJBigAndDeriv(
  nu: BigDecimal,
  lnGammaNu1: BigDecimal,
  x: BigDecimal,
  working: number,
): { j: BigDecimal; jp: BigDecimal } | undefined {
  const half = x.div(2);
  const q = half.mul(half).neg();
  let tNu = half.pow(nu).div(lnGammaNu1.exp()); // (x/2)^ν / Γ(ν+1)
  let tNext = tNu.mul(half).div(nu.add(1)); // (x/2)^{ν+1} / Γ(ν+2)
  let sumNu = tNu;
  let sumNext = tNext;
  const floor = new BigDecimal(10).pow(-working);
  let largest = tNu.abs();
  for (let m = 1; m < BIG_MAX_TERMS; m++) {
    tNu = tNu.mul(q).div(nu.add(m).mul(m));
    tNext = tNext.mul(q).div(nu.add(m + 1).mul(m));
    sumNu = sumNu.add(tNu);
    sumNext = sumNext.add(tNext);
    const size = tNu.abs().gt(tNext.abs()) ? tNu.abs() : tNext.abs();
    if (size.gt(largest)) largest = size;
    if (m > x.toNumber() / 2 && size.lt(largest.mul(floor))) {
      return { j: sumNu, jp: nu.mul(sumNu).div(x).sub(sumNext) };
    }
  }
  return undefined;
}

/**
 * The k-th positive zero of J_ν to `digits` significant digits, or undefined if it cannot be
 * vouched for (past `MAX_BIG_ZERO`, or Newton fails to settle). The double zero seeds Newton,
 * which at a simple zero (J_ν' ≠ 0) roughly doubles the digits each step.
 */
export function besselJZeroBig(nu: BigDecimal, k: number, digits: number): BigDecimal | undefined {
  const nuD = nu.toNumber();
  // The double series is fine to x ≈ SERIES_SEED_LIMIT; beyond it the zero comes from McMahon's
  // expansion, trusted only once k ≥ ν (it is poor for a large order and few zeros).
  let seed = besselJZero(nuD, k);
  if (seed > SERIES_SEED_LIMIT) {
    if (k < nuD) return undefined;
    seed = mcmahonZero(nuD, k);
  }
  if (!Number.isFinite(seed) || seed > MAX_BIG_ZERO) return undefined;
  const working = digits + BIG_GUARD + Math.ceil(seed / 2.3);
  return atDigits(working, () => {
    const lnGammaNu1 = logGammaBig(bigCx(nu.add(1)), working).re;
    let x = new BigDecimal(seed);
    const tolerance = new BigDecimal(10).pow(-(digits + 3));
    for (let i = 0; i < BIG_MAX_NEWTON; i++) {
      const f = besselJBigAndDeriv(nu, lnGammaNu1, x, working);
      if (f === undefined || f.jp.isZero()) return undefined;
      const step = f.j.div(f.jp);
      x = x.sub(step);
      if (step.abs().lt(tolerance.mul(x))) return x.toPrecision(digits);
    }
    return undefined;
  });
}

export function declareBesselJZero(ce: ComputeEngine): void {
  ce.declare("BesselJZero", {
    signature: "(number, integer) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [nu, k] = ops;
      if (nu === undefined || k === undefined) return undefined;
      if (!isFiniteNum(nu) || nu.im !== 0 || nu.re <= -1) return undefined;
      if (k.im !== 0 || !Number.isInteger(k.re) || k.re < 1) return undefined;
      if (!wantsNumber(ops, options)) return undefined;
      // A double asked for stays one, correctly rounded; more digits come from the BigDecimal refinement.
      const asked = Math.max(ce.precision, DOUBLE_DIGITS);
      const nuBig = asked > DOUBLE_DIGITS ? (nu.bignumRe ?? ce.bignum(nu.re)) : ce.bignum(nu.re);
      const zero = besselJZeroBig(nuBig, k.re, asked > DOUBLE_DIGITS ? asked : 30);
      if (zero === undefined) return undefined;
      return ce.number(ce.precision > DOUBLE_DIGITS ? zero.toPrecision(ce.precision) : zero.toNumber());
    },
  });
}

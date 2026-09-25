import { BigDecimal } from "@cortex-js/compute-engine";
import { add, cexp, clog, cosPi, cx, type Cx, div, mul, scale, sinPi, sub } from "./complex.ts";
import { bernoulliNumber, bernoulliRational } from "./bernoulli.ts";
import {
  add as badd,
  atDigits,
  bigCx,
  type BigCx,
  div as bdiv,
  log as blog,
  mul as bmul,
  scale as bscale,
} from "./bigzeta.ts";

// Log-gamma lnΓ(z) for complex z, as the analytic continuation Wolfram's `LogGamma`
// uses (branch cut on (−∞, 0]; NOT the principal log of Γ(z), which jumps by 2πi
// across the zero set of Im Γ).
//
// compute-engine 0.128 has Gamma (complex) but no LogGamma head; this supplies both
// the head and the kernel the Barnes G recurrence needs.
//
// Four regimes, chosen so the common case never subtracts two O(SHIFT_TO)-sized
// quantities to get an O(1) answer (the old shift-to-Stirling recurrence did exactly
// that for small Re(z) — lnΓ(0.6) ≈ 0.40 from lnΓ(18.6) ≈ 35.23 minus a shift sum ≈
// 34.83 — costing a couple of digits to cancellation, ~5e-15 relative error, though
// still fine for every caller of the plain `logGamma` below):
//  - Re(z) ≥ SHIFT_TO: Stirling's asymptotic series directly, no shift needed — already
//    accurate and fast (complex-plot-3d per pixel, riemann-siegel, hypergeometric,
//    polygamma, barnes-g, beta-continuation, rising-factorial, … mostly land here or below).
//  - ½ ≤ Re(z) < SHIFT_TO, |Im(z)| ≤ LANCZOS_IM_LIMIT: the Lanczos approximation (g=7,
//    n=9) — a short rational sum plus one log, no shift/cancellation at all, and
//    cheaper than the old shift loop (which ran up to SHIFT_TO−½ ≈ 17.5 iterations of
//    `clog` here). This is the regime the cancellation above actually lives in — once
//    |Im(z)| grows, lnΓ(z) itself grows with it (Stirling's leading term is ~z ln z),
//    so the old recurrence isn't subtracting down to a small answer any more and never
//    had a real cancellation problem there. Lanczos, on the other hand, was fit at real
//    z and its own truncation error grows with |Im(z)| (empirically past ~1e-13 by
//    |Im(z)| ≈ 15 near Re(z) = ½) — worse than the old recurrence out there — so past
//    `LANCZOS_IM_LIMIT` this defers to the old recurrence instead, which is exactly
//    where hurwitz-zeta's functional equation calls this at |Im| in the hundreds.
//  - ½ ≤ Re(z) < SHIFT_TO, |Im(z)| > LANCZOS_IM_LIMIT: `shiftStirling`, the original
//    shift-to-Stirling recurrence — unneeded for accuracy here (see above) but left in
//    exactly as it was rather than extending Lanczos to cover it too.
//  - Re(z) < ½: reflection, lnΓ(z) = ln π − ln sin(πz) − lnΓ(1−z), recursing once into
//    one of the regimes above (Re(1−z) > ½ always). See `reflect` for the branch
//    correction that keeps this the same continuous function as the other regimes.
// `logGammaBig` is the BigDecimal twin for the one caller that needs a few ulps
// instead: MeijerG's own outer sum (meijer-g-big.ts) has a *second*, independent
// cancellation across its Slater-sum terms that a double Γ-prefactor alone can't fix,
// so the whole reduction runs in BigDecimal there and only rounds to a double once, at
// the very end. It keeps the original shift-to-Stirling recurrence: BigDecimal's extra
// digits absorb the cancellation, so there's no accuracy reason to change it, and no
// speed reason either (it's not in a hot path).

/** Stirling coefficients B₂ₖ / (2k (2k−1)). */
const STIRLING: number[] = (() => {
  const c: number[] = [0];
  for (let k = 1; k <= 14; k++) c[k] = bernoulliNumber(2 * k) / (2 * k * (2 * k - 1));
  return c;
})();

const HALF_LN_2PI = 0.5 * Math.log(2 * Math.PI);

/** Stirling's series for lnΓ(z), valid (to double precision) for Re(z) ≳ 18. */
function stirling(z: Cx): Cx {
  // (z − ½) ln z − z + ½ ln 2π + Σ cₖ z^{1−2k}
  const lz = clog(z);
  let r = add(sub(mul(sub(z, cx(0.5)), lz), z), cx(HALF_LN_2PI));
  const inv = cexp(scale(lz, -1)); // 1/z
  const inv2 = mul(inv, inv);
  let p = inv; // z^{-(2k-1)}
  for (let k = 1; k < STIRLING.length; k++) {
    r = add(r, scale(p, STIRLING[k]));
    p = mul(p, inv2);
  }
  return r;
}

const SHIFT_TO = 18;

/** The original shift-to-Stirling recurrence: lnΓ(z) = lnΓ(z+n) − Σ ln(z+k). Kept as the
 * fallback for Re(z) ≥ ½ where Lanczos's own error grows too large (see module doc) —
 * it doesn't have a cancellation problem there, so there's nothing to fix. */
function shiftStirling(z: Cx): Cx {
  const n = Math.max(0, Math.ceil(SHIFT_TO - z.re));
  let shift = cx(0, 0);
  for (let k = 0; k < n; k++) shift = add(shift, clog(cx(z.re + k, z.im)));
  return sub(stirling(cx(z.re + n, z.im)), shift);
}

// Lanczos g=7, n=9 — the well-known coefficient set (e.g. Wikipedia's "Lanczos
// approximation"), refit here from mpmath.loggamma at 60 digits (exact interpolation
// at z = 1..9) to confirm the digits rather than copy them: max relative error ~4e-15
// for Re(z) ∈ [½, 18), Im(z) ∈ [−20, 20] against mpmath — pushing past n=9 (more terms,
// larger g) makes the correction sum's own cancellation *worse*, not better, so this is
// the sweet spot for a double. That headline number is a relative one, though: the
// absolute error grows with |Im(z)| (Lanczos was fit at real z), which is what
// `LANCZOS_IM_LIMIT` guards against — see module doc.
const LANCZOS_G = 7;
const LANCZOS_P: readonly number[] = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** Past this |Im(z)|, Lanczos's own truncation error outgrows the old shift-Stirling
 * recurrence's (empirically, at Re(z) = ½, the worst case): 3 keeps a healthy margin
 * below where they cross (~5), and covers every real-axis-adjacent case the shift
 * recurrence's cancellation actually bit on. */
const LANCZOS_IM_LIMIT = 3;

/** lnΓ(z) via Lanczos, valid for Re(z) ≥ ½. No shift: just the rational sum and one `clog`. */
function lanczos(z: Cx): Cx {
  const zm1 = sub(z, cx(1));
  let x = cx(LANCZOS_P[0]);
  for (let i = 1; i < LANCZOS_P.length; i++) x = add(x, div(cx(LANCZOS_P[i]), add(zm1, cx(i))));
  const t = add(zm1, cx(LANCZOS_G + 0.5));
  const r = sub(mul(sub(z, cx(0.5)), clog(t)), t);
  return add(add(r, cx(HALF_LN_2PI)), clog(x));
}

/**
 * Reflection for Re(z) < ½: lnΓ(z) = ln π − ln sin(πz) − lnΓ(1−z), recursing into the
 * Lanczos/Stirling regime for lnΓ(1−z) (Re(1−z) > ½ always, so this never recurses twice).
 *
 * ln sin(πz)'s own principal branch jumps by 2πi every time Re(z) crosses an odd
 * half-integer (…, −2.5, −0.5, 1.5, …, where sin(πz) crosses the negative real axis) —
 * an artifact of this decomposition, not of lnΓ itself, which is smooth there off the
 * real axis. `k` cancels it, keeping the sum the same continuous function as `lanczos`
 * and `stirling`: verified against mpmath.loggamma across Re(z) ∈ [−15, ½), Im(z) ∈
 * [−20, 20], including exactly on every such crossing.
 *
 * On the real axis (Im z = 0) that crossing coincides with lnΓ's actual branch cut, so
 * it's handled directly instead: Im lnΓ(x) = π⌊x⌋ for non-integer x < 0 (Wolfram's
 * continuous-from-above convention — the −0.5, −2.5, −7.5 golden cases pin this).
 */
function reflect(z: Cx): Cx {
  const lgw = logGamma(cx(1 - z.re, -z.im));
  const s = cx(sinPi(z.re) * Math.cosh(Math.PI * z.im), cosPi(z.re) * Math.sinh(Math.PI * z.im));
  const ls = clog(s);
  const re = Math.log(Math.PI) - ls.re - lgw.re;
  if (z.im === 0) return cx(re, z.re < 0 ? Math.PI * Math.floor(z.re) : 0);
  const k = Math.sign(z.im) * Math.floor((z.re + 0.5) / 2);
  return cx(re, -ls.im - lgw.im + 2 * Math.PI * k);
}

/** lnΓ(z), analytically continued (Wolfram `LogGamma`). Non-finite at the poles 0, −1, −2, …. */
export function logGamma(z: Cx): Cx {
  if (z.im === 0 && z.re <= 0 && Number.isInteger(z.re)) return cx(Number.NaN, Number.NaN);
  if (z.re >= SHIFT_TO) return stirling(z);
  if (z.re >= 0.5) return Math.abs(z.im) <= LANCZOS_IM_LIMIT ? lanczos(z) : shiftStirling(z);
  return reflect(z);
}

/** Real lnΓ(x); for x < 0 the real part of the continuation (ln|Γ(x)|). */
export const logGammaReal = (x: number): number => logGamma(cx(x)).re;

// --- BigDecimal path, for callers that need a few ulps instead of a double's ~1e-13-16 ---

/** Digits carried past the ones asked for, so the shift recurrence's cancellation has room to
 * eat digits and still land a correctly-rounded answer. z + n always sits in
 * [SHIFT_TO, SHIFT_TO+1) so `stirlingBig` itself only needs enough working precision to clear
 * its own truncation — this budget is for the subtraction, not the series. */
const GUARD_DIGITS = 34;

const bneg = (x: BigCx): BigCx => ({ re: x.re.neg(), im: x.im.neg() });
const bsub = (x: BigCx, y: BigCx): BigCx => badd(x, bneg(y));

let stirlingCoeffCache: BigDecimal[] = [];
let stirlingCoeffDigits = 0;

/** BigDecimal Stirling coefficient cₖ = B₂ₖ/(2k(2k−1)), exact from the rational Bernoulli
 * number, cached per working precision. */
function stirlingCoeffBig(k: number): BigDecimal {
  const digits = BigDecimal.precision;
  if (digits !== stirlingCoeffDigits) {
    stirlingCoeffCache = [];
    stirlingCoeffDigits = digits;
  }
  let c = stirlingCoeffCache[k];
  if (c === undefined) {
    const [num, den] = bernoulliRational(2 * k);
    c = new BigDecimal(num.toString()).div(new BigDecimal(den.toString())).div(2 * k * (2 * k - 1));
    stirlingCoeffCache[k] = c;
  }
  return c;
}

/** `stirling`, in BigDecimal — same formula, same coefficient count, at the working
 * precision. */
function stirlingBig(z: BigCx): BigCx {
  const lz = blog(z);
  let r = bsub(bmul(bsub(z, bigCx(0.5)), lz), z);
  r = badd(r, bigCx(BigDecimal.PI.mul(2).ln().div(2)));
  const inv = bdiv(bigCx(1), z);
  const inv2 = bmul(inv, inv);
  let p = inv;
  for (let k = 1; k < STIRLING.length; k++) {
    r = badd(r, bscale(p, stirlingCoeffBig(k)));
    p = bmul(p, inv2);
  }
  return r;
}

/**
 * lnΓ(z) in BigDecimal, correct to `digits` significant digits (guard included internally —
 * the caller doesn't need to pad `digits` itself). Used only by `meijer-g-big.ts`, which needs
 * more than a double's accuracy from its own Γ-prefactors; every other caller wants the fast
 * plain `logGamma` above.
 */
export function logGammaBig(z: BigCx, digits: number): BigCx {
  const n = Math.max(0, Math.ceil(SHIFT_TO - z.re.toNumber()));
  if (n === 0) return atDigits(digits, () => stirlingBig(z));
  return atDigits(digits + GUARD_DIGITS, () => {
    let shift: BigCx = bigCx(0);
    for (let k = 0; k < n; k++) shift = badd(shift, blog(badd(z, bigCx(k))));
    return bsub(stirlingBig(badd(z, bigCx(n))), shift);
  });
}

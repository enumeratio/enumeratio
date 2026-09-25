import { BigDecimal } from "@cortex-js/compute-engine";
import { add, cexp, clog, cx, type Cx, mul, scale, sub } from "./complex.ts";
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
// across the zero set of Im Γ). Stirling's series for Re(z) large, reached by the
// recurrence lnΓ(z) = lnΓ(z + n) − Σ ln(z + k) taken with principal logs — for
// Im(z) ≠ 0 none of the z + k crosses the negative axis, so the sum is continuous and
// IS the continuation. On the negative real axis it takes the limit from above (the
// principal-log convention), matching Wolfram.
//
// compute-engine 0.128 has Gamma (complex) but no LogGamma head; this supplies both
// the head and the kernel the Barnes G recurrence needs.
//
// The recurrence subtracts two O(SHIFT_TO)-sized quantities — lnΓ(z+n) and the shift
// sum — costing a few digits to cancellation whenever the true answer is much smaller
// than SHIFT_TO (e.g. lnΓ(0.6) ≈ 0.40 from lnΓ(18.6) ≈ 35.23 minus a shift sum ≈
// 34.83): a double still keeps ~13-14 good digits there, plenty for every caller of
// the plain `logGamma` below (complex-plot-3d per pixel, riemann-siegel, hypergeometric,
// polygamma, barnes-g, beta-continuation, rising-factorial, …), so it stays a fast,
// unconditional double computation. `logGammaBig` is the BigDecimal twin for the one
// caller that needs a few ulps instead: MeijerG's own outer sum (meijer-g-big.ts) has a
// *second*, independent cancellation across its Slater-sum terms that a double
// Γ-prefactor alone can't fix, so the whole reduction runs in BigDecimal there and only
// rounds to a double once, at the very end.

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

/** lnΓ(z), analytically continued (Wolfram `LogGamma`). Non-finite at the poles 0, −1, −2, …. */
export function logGamma(z: Cx): Cx {
  if (z.im === 0 && z.re <= 0 && Number.isInteger(z.re)) return cx(Number.NaN, Number.NaN);
  const n = Math.max(0, Math.ceil(SHIFT_TO - z.re));
  let shift = cx(0, 0);
  for (let k = 0; k < n; k++) shift = add(shift, clog(cx(z.re + k, z.im)));
  return sub(stirling(cx(z.re + n, z.im)), shift);
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

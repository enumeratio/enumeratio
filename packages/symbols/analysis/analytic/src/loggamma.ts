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
// sum — to land an answer that can be much smaller (Γ(0.6) needs lnΓ(18.6) ≈ 35.23
// minus a shift sum ≈ 34.83 to get lnΓ(0.6) ≈ 0.40): catastrophic cancellation in
// double, costing most of its 16 digits right where MeijerG's Γ-prefactors live
// (enumeratio/enumeratio#186 landed MeijerG accurate to only ~1e-13 relative because
// of exactly this). When a shift is needed the whole recurrence instead runs in
// BigDecimal with guard digits (`logGammaBig`), and only the final answer rounds back
// to a double (`logGamma`) — the cancellation still happens, but there are digits to
// spare. Re(z) ≥ SHIFT_TO already needs no shift and stays on the plain double
// `stirling` path.

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
 * the caller doesn't need to pad `digits` itself). Shared by the double `logGamma` below and
 * by any caller that wants to keep a Γ-prefactor in BigDecimal for longer (MeijerG's outer
 * Slater sum: see `meijer-g-big.ts`), so the cancellation between *its* terms — a second,
 * independent source of precision loss from this recurrence's — has guard digits to draw on
 * too.
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

/** lnΓ(z), analytically continued (Wolfram `LogGamma`). Non-finite at the poles 0, −1, −2, …. */
export function logGamma(z: Cx): Cx {
  if (z.im === 0 && z.re <= 0 && Number.isInteger(z.re)) return cx(Number.NaN, Number.NaN);
  const n = Math.max(0, Math.ceil(SHIFT_TO - z.re));
  if (n === 0) return stirling(z);
  const r = logGammaBig(bigCx(z.re, z.im), 17);
  return cx(r.re.toNumber(), r.im.toNumber());
}

/** Real lnΓ(x); for x < 0 the real part of the continuation (ln|Γ(x)|). */
export const logGammaReal = (x: number): number => logGamma(cx(x)).re;

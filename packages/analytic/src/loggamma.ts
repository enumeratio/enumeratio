import { add, cexp, clog, cx, type Cx, mul, scale, sub } from "./complex.ts";
import { bernoulliNumber } from "./bernoulli.ts";

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

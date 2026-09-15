import { add, cexp, clog, cx, type Cx, mul, scale, sub } from "./complex.ts";
import { bernoulliNumber } from "./bernoulli.ts";
import { logGamma } from "./loggamma.ts";

// Barnes G-function: G(z + 1) = Γ(z) G(z), G(1) = 1, so G(n) = Π_{k<n−1} k! (the
// superfactorial) at positive integers and G has zeros at 0, −1, −2, …. Numerically
// via its logarithm: the asymptotic series for ln G(z + 1) once Re(z) is large, reached
// by the recurrence ln G(z) = ln G(z + n) − Σ lnΓ(z + k) — with the LogGamma
// continuation, which makes this the continuation Wolfram's `LogBarnesG` uses (its
// imaginary part jumps by 2π·k on the negative axis rather than staying principal).
// `BarnesG` itself is exp of that, so the branch drops out.

/** Asymptotic coefficients B₂ₖ₊₂ / (4k (k+1)). */
const COEFF: number[] = (() => {
  const c: number[] = [0];
  for (let k = 1; k <= 12; k++) c[k] = bernoulliNumber(2 * k + 2) / (4 * k * (k + 1));
  return c;
})();

/** ζ′(−1) = 1/12 − ln A (A = Glaisher's constant). */
const ZETA_PRIME_MINUS_1 = -0.16542114370045094;
const HALF_LN_2PI = 0.5 * Math.log(2 * Math.PI);

/**
 * ln G(z + 1) ~ (z²/2 − 1/12) ln z − 3z²/4 + (z/2) ln 2π + ζ′(−1) + Σ B₂ₖ₊₂/(4k(k+1) z^{2k}),
 * accurate to double precision for Re(z) ≳ 20.
 */
function asymptotic(z: Cx): Cx {
  const lz = clog(z);
  const z2 = mul(z, z);
  let r = mul(sub(scale(z2, 0.5), cx(1 / 12)), lz);
  r = sub(r, scale(z2, 0.75));
  r = add(r, scale(z, HALF_LN_2PI));
  r = add(r, cx(ZETA_PRIME_MINUS_1));
  const inv2 = cexp(scale(lz, -2)); // z^{-2}
  let p = inv2;
  for (let k = 1; k < COEFF.length; k++) {
    r = add(r, scale(p, COEFF[k]));
    p = mul(p, inv2);
  }
  return r;
}

const SHIFT_TO = 20;

/** ln G(z), analytically continued (Wolfram `LogBarnesG`). Non-finite at the zeros 0, −1, …. */
export function logBarnesG(z: Cx): Cx {
  if (z.im === 0 && z.re <= 0 && Number.isInteger(z.re)) return cx(Number.NaN, Number.NaN);
  const n = Math.max(0, Math.ceil(SHIFT_TO - z.re));
  let shift = cx(0, 0);
  for (let k = 0; k < n; k++) shift = add(shift, logGamma(cx(z.re + k, z.im)));
  return sub(asymptotic(cx(z.re + n - 1, z.im)), shift); // ln G((z+n−1) + 1)
}

/** G(z) = exp(ln G(z)); exactly 0 at the nonpositive integers. Overflows past |z| ≈ 60 in double. */
export function barnesG(z: Cx): Cx {
  if (z.im === 0 && z.re <= 0 && Number.isInteger(z.re)) return cx(0);
  return cexp(logBarnesG(z));
}

export const barnesGReal = (x: number): number => barnesG(cx(x)).re;
export const logBarnesGReal = (x: number): number => logBarnesG(cx(x)).re;

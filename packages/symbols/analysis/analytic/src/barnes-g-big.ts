import { BigDecimal } from "@cortex-js/compute-engine";
import { atDigits, bigCx, hurwitzZetaBig } from "./bigzeta.ts";

// G(x), Barnes' G-function, for real x in compute-engine's BigDecimal, to any number of digits
// -- the arbitrary-precision twin of barnes-g.ts, whose asymptotic series is good only to a
// double. Here both G and Γ come from their Taylor series about 1, whose coefficients are ζ(k):
//   ln Γ(1+z) = −γz + Σ_{k≥2} (−1)^k ζ(k) z^k / k,
//   ln G(1+z) = (z/2) ln 2π − (z + (1+γ) z²)/2 + Σ_{k≥2} (−1)^k ζ(k) z^{k+1} / (k+1),
// for |z| < 1. Splitting ζ(k) = 1 + (ζ(k) − 1) sums the 1s in closed form,
//   Σ_{k≥2} (−1)^k z^k / k = z − ln(1+z),   Σ_{k≥2} (−1)^k z^{k+1} / (k+1) = ln(1+z) − z + z²/2,
// and leaves terms that shrink like (|z|/2)^k, ζ(k) − 1 being about 2^{−k}. x is brought to
// 1 + z with |z| ≤ ½ by the recurrence G(w+1) = Γ(w) G(w), each Γ along the way one
// multiplication from the last: Γ(w+1) = w Γ(w).

/** Digits carried past the ones asked for. */
const GUARD_DIGITS = 10;

/** Past this many steps of the recurrence, the double kernel's reach is the better trade. */
const MAX_SHIFT = 60;

// ζ(k) − 1 = ζ(k, 2), held at the most digits any call has wanted and rounded down to the
// rest: Ziv's loop (correctly-rounded.ts) asks for the same values at two precisions.
let zetaCache: BigDecimal[] = [];
let zetaCacheDigits = 0;

/** ζ(k) − 1 at the working precision. */
function zetaMinusOne(k: number): BigDecimal {
  const digits = BigDecimal.precision;
  if (digits > zetaCacheDigits) {
    zetaCache = [];
    zetaCacheDigits = digits;
  }
  zetaCache[k] ??= hurwitzZetaBig(bigCx(k), bigCx(2), zetaCacheDigits)!.re;
  return zetaCache[k].toPrecision(digits);
}

/** G(x) to `digits` significant digits, or undefined at the zeros (0, −1, −2, …) and more than
 * `MAX_SHIFT` from 1. */
export function barnesGBig(x: BigDecimal, digits: number): BigDecimal | undefined {
  if (x.isInteger() && !x.isPositive()) return undefined;
  const m = Math.round(x.toNumber() - 1);
  if (Math.abs(m) > MAX_SHIFT) return undefined;
  // G(1+z) and Γ(1+z) for |z| ≤ ½ are near 1; the recurrence multiplies up to MAX_SHIFT
  // factors, each rounded once.
  return atDigits(digits + GUARD_DIGITS + Math.ceil(Math.log10(Math.abs(m) + 1)), () => {
    const working = BigDecimal.precision;
    const round = (v: BigDecimal): BigDecimal => v.toPrecision(working);
    const z = x.sub(m + 1);
    const gamma = BigDecimal.EULER_GAMMA;
    const ln1pz = z.add(1).ln();
    let lnGamma = round(gamma.neg().mul(z).add(z).sub(ln1pz));
    let lnG = round(
      z
        .mul(BigDecimal.PI.mul(2).ln())
        .div(2)
        .sub(z.add(gamma.add(1).mul(z).mul(z)).div(2))
        .add(ln1pz.sub(z).add(z.mul(z).div(2))),
    );
    const threshold = -working - 1;
    let zPower = round(z.mul(z)); // z^k, from k = 2
    for (let k = 2; ; k++) {
      const c = round(zPower.mul(zetaMinusOne(k)));
      const signed = k % 2 === 0 ? c : c.neg();
      lnGamma = round(lnGamma.add(signed.div(k)));
      lnG = round(lnG.add(signed.mul(z).div(k + 1)));
      if (c.isZero() || Math.log10(Math.abs(c.toNumber())) < threshold) break;
      zPower = round(zPower.mul(z));
    }
    let g = lnG.exp();
    let gammaW = lnGamma.exp(); // Γ(w + 1) with w = z, then walked with G
    if (m > 0) {
      // G(w + 2) = Γ(w + 1) G(w + 1), from w + 1 = 1 + z up to x.
      for (let j = 0; j < m; j++) {
        g = round(g.mul(gammaW));
        gammaW = round(gammaW.mul(z.add(j + 1)));
      }
    } else {
      // G(w) = G(w + 1) / Γ(w), Γ(w) = Γ(w + 1) / w, from w + 1 = 1 + z down to x.
      for (let j = 0; j < -m; j++) {
        const w = z.sub(j);
        gammaW = round(gammaW.div(w));
        g = round(g.div(gammaW));
      }
    }
    return g.toPrecision(digits + GUARD_DIGITS);
  });
}

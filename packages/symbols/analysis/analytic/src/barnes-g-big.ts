import { BigDecimal } from "@cortex-js/compute-engine";
import {
  type Ball,
  add,
  certain,
  certify,
  div,
  exact,
  exp,
  ln,
  magnitude,
  mul,
  neg,
  powInt,
  sub,
  upper,
} from "./ball.ts";
import { atDigits } from "./bigzeta.ts";
import { hurwitzZetaBall } from "./hurwitz-ball.ts";
import { stieltjesGammaBall } from "./stieltjes-big.ts";

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
//
// The whole is taken in ball arithmetic (ball.ts), and the series' tail is bounded:
// ζ(k) − 1 = Σ_{n≥2} n^{−k} ≤ 2^{−k} + ∫_2^∞ t^{−k} dt = 2^{−k}(1 + 2/(k−1)), so past the Kth
// term both series' terms are at most (1 + 2/K)(|z|/2)^k/(K+1), and their tails at most
//   (1 + 2/K) (|z|/2)^{K+1} / ((K+1)(1 − |z|/2)).
// The constants are certified too: ζ(k) − 1 = ζ(k, 2) by hurwitz-ball.ts, γ = γ₀(1) by
// stieltjes-big.ts, and π from BigDecimal's literal of its published digits.

/** Digits carried past the ones asked for. */
const GUARD_DIGITS = 10;

/** Past this many steps of the recurrence, the double kernel's reach is the better trade. */
const MAX_SHIFT = 60;

/** The digits of π BigDecimal holds (its `PI_DIGITS` literal, less a margin). */
const PI_DIGITS = 1090;

// ζ(k) − 1 and γ, held at the most digits any call has wanted and rounded down to the rest:
// Ziv's loop (correctly-rounded.ts) asks for the same values at two precisions.
let zetaCache: Ball[] = [];
let gammaCache: Ball | undefined;
let cacheDigits = 0;

/** A ball held at more digits than the working precision, rounded to it -- the rounding's
 * error is added to the radius. */
const rounded = (x: Ball): Ball => add(x, exact(0));

function refreshCache(): void {
  const digits = BigDecimal.precision;
  if (digits <= cacheDigits) return;
  zetaCache = [];
  gammaCache = undefined;
  cacheDigits = digits;
}

/** ζ(k) − 1 at the working precision. */
function zetaMinusOne(k: number): Ball {
  refreshCache();
  const zeta = (zetaCache[k] ??= certain(
    atDigits(cacheDigits, () => hurwitzZetaBall(exact(k), exact(2), cacheDigits)),
  ));
  return rounded(zeta);
}

/** Euler's γ at the working precision. */
function eulerGamma(): Ball {
  refreshCache();
  gammaCache ??= certain(atDigits(cacheDigits, () => stieltjesGammaBall(0, exact(1), cacheDigits)));
  return rounded(gammaCache);
}

/** π at the working precision: BigDecimal's literal, rounded, so within a unit of its last
 * digit. */
export function pi(): Ball {
  const digits = BigDecimal.precision;
  return { mid: BigDecimal.PI, rad: new BigDecimal(`1e-${digits - 1}`) };
}

/** G(x) to `digits` significant digits, or undefined at the zeros (0, −1, −2, …) and more than
 * `MAX_SHIFT` from 1. */
export function barnesGBig(x: BigDecimal, digits: number): BigDecimal | undefined {
  return barnesGBall(exact(x), digits)?.mid;
}

/** A ball holding G(x) for every x in its ball, about `digits` significant digits wide, or
 * undefined where `barnesGBig` is. */
export function barnesGBall(x: Ball, digits: number): Ball | undefined {
  if (x.rad.isZero() && x.mid.isInteger() && !x.mid.isPositive()) return undefined;
  const m = Math.round(x.mid.toNumber() - 1);
  if (Math.abs(m) > MAX_SHIFT) return undefined;
  // G(1+z) and Γ(1+z) for |z| ≤ ½ are near 1; the recurrence multiplies up to MAX_SHIFT
  // factors, each rounded once.
  const working = digits + GUARD_DIGITS + Math.ceil(Math.log10(Math.abs(m) + 1));
  if (working > PI_DIGITS) return undefined;
  return atDigits(working, () => certify(() => series(x, m)));
}

function series(x: Ball, m: number): Ball {
  const working = BigDecimal.precision;
  const z = sub(x, exact(m + 1));
  const gamma = eulerGamma();
  const ln1pz = ln(add(z, exact(1)));
  const zz = mul(z, z);
  let lnGamma = sub(sub(z, mul(gamma, z)), ln1pz); // −γz + z − ln(1+z)
  let lnG = add(
    sub(
      div(mul(z, ln(mul(pi(), exact(2)))), exact(2)), // (z/2) ln 2π
      div(add(z, mul(add(gamma, exact(1)), zz)), exact(2)), // (z + (1+γ)z²)/2
    ),
    add(sub(ln1pz, z), div(zz, exact(2))), // ln(1+z) − z + z²/2
  );
  const threshold = new BigDecimal(`1e-${working + 1}`);
  let zPower = zz; // z^k, from k = 2
  for (let k = 2; ; k++) {
    const c = mul(zPower, zetaMinusOne(k));
    const signed = k % 2 === 0 ? c : neg(c);
    lnGamma = add(lnGamma, div(signed, exact(k)));
    lnG = add(lnG, div(mul(signed, z), exact(k + 1)));
    if (magnitude(c).lt(threshold)) {
      const tail = tailBound(z, k);
      lnGamma = { mid: lnGamma.mid, rad: lnGamma.rad.add(tail) };
      lnG = { mid: lnG.mid, rad: lnG.rad.add(tail) };
      break;
    }
    zPower = mul(zPower, z);
  }
  let g = exp(lnG);
  let gammaW = exp(lnGamma); // Γ(w + 1) with w = z, then walked with G
  if (m > 0) {
    // G(w + 2) = Γ(w + 1) G(w + 1), from w + 1 = 1 + z up to x.
    for (let j = 0; j < m; j++) {
      g = mul(g, gammaW);
      gammaW = mul(gammaW, add(z, exact(j + 1)));
    }
  } else {
    // G(w) = G(w + 1) / Γ(w), Γ(w) = Γ(w + 1) / w, from w + 1 = 1 + z down to x.
    for (let j = 0; j < -m; j++) {
      gammaW = div(gammaW, sub(z, exact(j)));
      g = div(g, gammaW);
    }
  }
  return g;
}

/** (1 + 2/K)(|z|/2)^{K+1} / ((K+1)(1 − |z|/2)): both series' tails past the Kth term (see
 * the header), rounded up. */
function tailBound(z: Ball, K: number): BigDecimal {
  return atDigits(20, () => {
    const half = div(exact(magnitude(z)), exact(2)); // |z|/2 ≤ ¼
    const power = powInt(half, K + 1);
    const factor = div(exact(K + 2), exact(K * (K + 1))); // (1 + 2/K)/(K+1)
    return upper(div(mul(factor, power), sub(exact(1), half)));
  });
}

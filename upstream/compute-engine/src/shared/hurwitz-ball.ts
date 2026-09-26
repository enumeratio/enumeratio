import { BigDecimal } from "@cortex-js/compute-engine";
import { type Ball, add, certify, div, exact, lower, magnitude, mul, neg, pow, rational, sub, upper } from "./ball.ts";
import { bernoulliRational } from "./bernoulli.ts";
import { atDigits, type Plan, plan } from "./bigzeta.ts";

// ζ(s, a) for real s ≠ 1 and a > 0 in ball arithmetic -- the certified, real twin of
// bigzeta.ts's `hurwitzZetaBig`, by the same Euler–Maclaurin sum and the same plan for N
// (direct terms) and M (Bernoulli pairs), z = N + a:
//   ζ(s, a) = Σ_{k<N} (k+a)^{−s} + z^{1−s}/(s−1) + ½z^{−s} + Σ_{j=1}^{M} B₂ⱼ/(2j)! (s)₂ⱼ₋₁ z^{−s−2j+1} + R.
// Where the point kernel drops R, this one bounds it. R = ∫_N^∞ B̃₂ₘ(t)/(2M)! · (s)₂ₘ (t+a)^{−s−2M} dt,
// the periodic Bernoulli function never exceeds |B₂ₘ| < 4(2M)!/(2π)^{2M}, and the integral of
// the power is elementary, so for s + 2M − 1 > 0
//   |R| ≤ 4 |(s)₂ₘ| / (2π)^{2M} · z^{1−s−2M} / (s + 2M − 1)
// (Johansson, "Rigorous high-precision computation of the Hurwitz zeta function and its
// derivatives", 2015, Theorem 1). The bound is added to the sum's radius.

/** Digits carried past the ones asked for. */
const GUARD_DIGITS = 8;

/** Past this many working digits the cancellation left of the strip is too costly to carry. */
const MAX_WORKING_DIGITS = 1200;

/** A decimal below 2π, so dividing by its powers overstates the remainder, never under. */
const TWO_PI_BELOW = new BigDecimal("6.283");

/** A ball holding ζ(s, a) for every s and a in theirs, about `digits` significant digits wide,
 * or undefined for a ≤ 0, s at the pole, or where it would cost more working precision than
 * it is worth (far left of the strip). */
export function hurwitzZetaBall(s: Ball, a: Ball, digits: number): Ball | undefined {
  if (!lower(a).isPositive()) return undefined;
  const sd = { re: s.mid.toNumber(), im: 0 };
  const ad = { re: a.mid.toNumber(), im: 0 };
  // Plan for `digits` absolute; a value smaller than 1 then has fewer significant digits than
  // asked for, so once its size is known, go again with those added.
  let absolute = digits + GUARD_DIGITS;
  for (let attempt = 0; attempt < 2; attempt++) {
    const p = plan(sd, ad, absolute);
    const working = absolute + Math.max(0, Math.ceil(p.largest)) + 4;
    if (working > MAX_WORKING_DIGITS) return undefined;
    const r = atDigits(working, () => certify(() => eulerMaclaurin(s, a, p)));
    if (r === undefined) return undefined;
    const short = r.mid.isZero() ? 0 : Math.ceil(-Math.log10(Math.abs(r.mid.toNumber())));
    if (attempt > 0 || !(short > GUARD_DIGITS / 2)) return r;
    absolute += Math.min(short, 2 * digits);
  }
  return undefined; // unreachable
}

/** The sum for a plan, with at least one Bernoulli pair: a plan that needs none (a large s,
 * whose direct terms fall fast) still gets one, so the remainder has the form bounded above. */
function eulerMaclaurin(s: Ball, a: Ball, { terms, pairs: planned }: Plan): Ball | undefined {
  const pairs = Math.max(1, planned);
  const negS = neg(s);
  let sum = exact(0);
  for (let k = 0; k < terms; k++) sum = add(sum, pow(add(a, exact(k)), negS));
  const z = add(a, exact(terms));
  const zNegS = pow(z, negS);
  sum = add(sum, div(mul(zNegS, z), sub(s, exact(1)))); // z^{1−s}/(s−1)
  sum = add(sum, mul(zNegS, exact(0.5))); // ½ z^{−s}
  const zInv2 = div(exact(1), mul(z, z));
  let zPower = div(zNegS, z); // z^{−s−2j+1}, from j = 1
  let poch = s; // (s)₂ⱼ₋₁
  let pochEven = exact(1); // (s)₂ⱼ₋₂, and after the last pair (s)₂ₘ
  for (let j = 1; j <= pairs; j++) {
    sum = add(sum, mul(mul(poch, zPower), bernoulliCoefficient(j)));
    pochEven = mul(poch, add(s, exact(2 * j - 1))); // (s)₂ⱼ
    poch = mul(pochEven, add(s, exact(2 * j))); // (s)₂ⱼ₊₁
    zPower = mul(zPower, zInv2);
  }
  const bound = remainderBound(s, z, pochEven, pairs);
  return bound === undefined ? undefined : { mid: sum.mid, rad: sum.rad.add(bound) };
}

/** 4|(s)₂ₘ|/(2π)^{2M} · z^{1−s−2M}/(s + 2M − 1), at the ball's worst s and z, or undefined
 * when s + 2M − 1 can reach 0, where the remainder's integral diverges. */
function remainderBound(s: Ball, z: Ball, poch: Ball, pairs: number): BigDecimal | undefined {
  const exponent = 2 * pairs;
  const denominator = lower(s).add(exponent - 1); // the least s + 2M − 1
  if (!denominator.isPositive()) return undefined;
  return atDigits(20, () => {
    const power = pow(z, sub(exact(1 - exponent), s)); // z^{1−s−2M}
    const numerator = mul(exact(magnitude(poch).mul(4)), exact(magnitude(power)));
    return upper(div(numerator, exact(TWO_PI_BELOW.pow(exponent).mul(denominator))));
  });
}

// B₂ⱼ/(2j)! as an exact fraction, kept by j.
const coefficients: [bigint, bigint][] = [];

/** B₂ⱼ/(2j)! at the working precision. */
function bernoulliCoefficient(j: number): Ball {
  if (coefficients[j] === undefined) {
    let factorial = 1n;
    for (let i = 2n; i <= BigInt(2 * j); i++) factorial *= i;
    const [n, d] = bernoulliRational(2 * j);
    coefficients[j] = [n, d * factorial];
  }
  const [n, d] = coefficients[j]!;
  return rational(n, d);
}

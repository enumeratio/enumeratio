// unstable: BigDecimal, the class compute-engine's boxed numbers hold; no /numerics subpath yet
import { BigDecimal } from "@enumeratio/engine/unstable";
import { atDigits } from "@enumeratio/ce-patches";
import { inverseGamma } from "./hypergeometric-big.ts";

// [n]_q! for a real (non-integer) n, through the q-Gamma function: [n]_q! = Γ_q(n+1) and, for
// 0 < q < 1, Γ_q(x) = (q; q)_∞ / (q^x; q)_∞ · (1−q)^(1−x), so
//   [n]_q! = (q; q)_∞ / ((q^(n+1); q)_∞ (1−q)ⁿ).
// For q > 1 the reflection [n]_q! = q^(n(n−1)/2) [n]_(1/q)! brings it back inside; q = 1 is Γ(n+1).

const GUARD = 20;
const MAX_TERMS = 5_000;
/** A factor 1 − a·rᵏ this close to 0 has cancelled away more digits than the guard holds. */
const MIN_FACTOR = 1e-6;

const big = (x: number): BigDecimal => new BigDecimal(x);

/**
 * (a; r)_∞ = ∏ₖ (1 − a rᵏ) for 0 < r < 1, at the caller's working precision. Stops when the tail,
 * bounded by |a rᵏ|/(1−r), is below the digits; undefined when that takes more than `MAX_TERMS`
 * factors or a factor cancels (a rᵏ ≈ 1, a pole of the q-Gamma function nearby).
 */
function infinitePochhammer(a: BigDecimal, r: BigDecimal): BigDecimal | undefined {
  const tol = big(10)
    .pow(-(BigDecimal.precision - 2))
    .mul(big(1).sub(r));
  let product = big(1);
  let term = a;
  for (let k = 0; k < MAX_TERMS; k++) {
    const factor = big(1).sub(term);
    if (factor.abs().lt(MIN_FACTOR)) return undefined;
    product = product.mul(factor).toPrecision(BigDecimal.precision);
    term = term.mul(r);
    if (term.abs().lt(tol)) return product;
  }
  return undefined;
}

/**
 * [n]_q! for real n (not a negative integer, where it has a pole) and real q > 0, to `digits`
 * digits; undefined where the product doesn't settle. q ≤ 0 declines: qⁿ is not real.
 */
export function qFactorialBig(n: BigDecimal, q: BigDecimal, digits: number): BigDecimal | undefined {
  if (!n.isFinite() || !q.isFinite() || !q.isPositive()) return undefined;
  if (n.isInteger() && n.isNegative()) return undefined;
  const working = digits + GUARD;
  const value = atDigits(working, (): BigDecimal | undefined => {
    if (q.eq(1)) return big(1).div(inverseGamma(n.add(1), working));
    const reflected = q.gt(1);
    const r = reflected ? big(1).div(q) : q;
    const numerator = infinitePochhammer(r, r);
    const denominator = infinitePochhammer(r.ln().mul(n.add(1)).exp(), r);
    if (numerator === undefined || denominator === undefined) return undefined;
    const inside = numerator.div(denominator.mul(big(1).sub(r).ln().mul(n).exp()));
    return reflected ? inside.mul(q.ln().mul(n).mul(n.sub(1)).div(2).exp()) : inside;
  });
  return value?.toPrecision(digits);
}

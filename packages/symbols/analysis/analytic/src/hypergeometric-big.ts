// unstable: BigDecimal, the class compute-engine's boxed numbers hold; no /numerics subpath yet
import { BigDecimal } from "@enumeratio/engine/unstable";
import { atDigits, bernoulliRational, bigCx } from "@enumeratio/ce-patches";

// The BigDecimal twin of `pfqRegularizedSeries` (hypergeometric.ts) for one lower parameter and
// real operands: Σ_k ∏(aᵢ)_k zᵏ/k! · 1/Γ(b+k), for `N(Hypergeometric0F1Regularized(b, z), d)` and
// `N(Hypergeometric1F1Regularized(a, b, z), d)` past a double's digits. The terms can be far
// larger than their sum (z < 0), so it re-runs once with the digits that cancellation costs.

const MAX_TERMS = 20_000;
const GUARD = 15;
/** Past this many digits lost to cancellation the answer is not worth carrying. */
const MAX_LOST_DIGITS = 400;

const big = (x: number): BigDecimal => bigCx(x).re;
const log10 = (x: BigDecimal): number => x.abs().ln().toNumber() / Math.LN10;

interface Series {
  readonly sum: BigDecimal;
  /** The largest term, which sets how many digits the sum lost to cancellation. */
  readonly peak: BigDecimal;
}

function series(upper: readonly BigDecimal[], b: BigDecimal, z: BigDecimal, working: number): Series | undefined {
  return atDigits(working, () => {
    // At b = −n every 1/Γ(b+k) up to k = n is zero, and from k = n+1 it is 1/(k−n−1)!.
    const first = b.isInteger() && b.lte(0) ? 1 - b.toNumber() : 0;
    const tol = big(10).pow(-(working - 2));
    let invGamma = first > 0 ? big(0) : inverseGamma(b, working);
    let core = big(1); // ∏(aᵢ)_k zᵏ/k!, the part regularizing doesn't change
    let sum = big(0);
    let peak = big(0);
    let previous: BigDecimal | undefined;
    for (let k = 0; k < MAX_TERMS; k++) {
      const term = core.mul(invGamma);
      sum = sum.add(term).toPrecision(working);
      if (term.abs().gt(peak)) peak = term.abs();
      if (core.isZero()) return { sum, peak }; // terminated (a polynomial case)
      if (k >= first && previous !== undefined && term.abs().lt(previous) && term.abs().lt(tol.mul(sum.abs())))
        return { sum, peak };
      if (k >= first) previous = term.abs();
      let next = z;
      for (const a of upper) next = next.mul(a.add(k));
      core = core
        .mul(next)
        .div(k + 1)
        .toPrecision(working);
      if (k + 1 === first) invGamma = big(1);
      else if (k >= first) invGamma = invGamma.div(b.add(k)).toPrecision(working);
    }
    return undefined; // did not converge inside the term budget
  });
}

/**
 * 1/Γ(b) for real b off the poles, to `digits` digits: Γ(b) = Γ(b+n)/∏_{k<n}(b+k) with n chosen
 * so that b+n is large enough for Stirling's series to run out of terms before its own
 * truncation matters. (`logGammaBig` stops short of that: its series length is fixed for a
 * double's worth of digits, so it is good to ~30 and no further.)
 */
export function inverseGamma(b: BigDecimal, digits: number): BigDecimal {
  const x0 = Math.ceil(0.6 * digits) + 10;
  const n = Math.max(0, x0 - Math.floor(b.toNumber()));
  let shift = big(1);
  for (let k = 0; k < n; k++) shift = shift.mul(b.add(k)).toPrecision(digits);
  const x = b.add(n);
  const inv = big(1).div(x);
  const inv2 = inv.mul(inv);
  const tol = big(10).pow(-(digits + 2));
  let lnGamma = x.sub(0.5).mul(x.ln()).sub(x).add(BigDecimal.PI.mul(2).ln().div(2));
  let power = inv;
  for (let k = 1; k < 2 * digits; k++) {
    const [num, den] = bernoulliRational(2 * k);
    const term = new BigDecimal(num.toString())
      .div(new BigDecimal(den.toString()))
      .div(2 * k * (2 * k - 1))
      .mul(power);
    lnGamma = lnGamma.add(term);
    if (term.abs().lt(tol)) break;
    power = power.mul(inv2).toPrecision(digits);
  }
  return shift.mul(lnGamma.neg().exp()).toPrecision(digits);
}

/**
 * pFq(upper; b; z)/Γ(b) to `digits` significant digits, or undefined when it can't be vouched
 * for (no convergence, or more cancellation than `MAX_LOST_DIGITS`).
 */
export function pfqRegularizedBig(
  upper: readonly BigDecimal[],
  b: BigDecimal,
  z: BigDecimal,
  digits: number,
): BigDecimal | undefined {
  let working = digits + GUARD;
  for (let pass = 0; pass < 2; pass++) {
    const r = series(upper, b, z, working);
    if (r === undefined) return undefined;
    if (r.peak.isZero()) return r.sum;
    if (r.sum.isZero()) return undefined; // cancelled to nothing at this precision
    const lost = Math.max(0, log10(r.peak) - log10(r.sum));
    if (!Number.isFinite(lost) || lost > MAX_LOST_DIGITS) return undefined;
    if (pass === 1 || lost <= GUARD / 2) return r.sum.toPrecision(digits);
    working = digits + GUARD + Math.ceil(lost);
  }
  return undefined;
}

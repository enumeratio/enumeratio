// unstable: BigDecimal, the class compute-engine's boxed numbers hold; no /numerics subpath yet
import { BigDecimal } from "@enumeratio/engine/unstable";
import { atDigits, bernoulliRational, bigCx } from "@enumeratio/ce-patches";

// The BigDecimal twin of `pfqRegularizedSeries` (hypergeometric.ts) for real operands:
// Σ_k ∏(aᵢ)_k zᵏ/k! · ∏ⱼ 1/Γ(bⱼ+k), for `N(Hypergeometric0F1Regularized(b, z), d)`,
// `N(Hypergeometric1F1Regularized(a, b, z), d)` and the like past a double's digits. The terms can
// be far larger than their sum (z < 0), so it re-runs once with the digits that cancellation costs.

const MAX_TERMS = 20_000;
const GUARD = 15;
/** Consecutive shrinking terms, with a geometric tail bound under the tolerance, before a sum settles. */
const SETTLED_RUN = 3;
/** Past this many digits lost to cancellation the answer is not worth carrying. */
const MAX_LOST_DIGITS = 400;

const big = (x: number): BigDecimal => bigCx(x).re;
const log10 = (x: BigDecimal): number => x.abs().ln().toNumber() / Math.LN10;

interface Series {
  readonly sum: BigDecimal;
  /** The largest term, which sets how many digits the sum lost to cancellation. */
  readonly peak: BigDecimal;
}

function series(
  upper: readonly BigDecimal[],
  lower: readonly BigDecimal[],
  z: BigDecimal,
  working: number,
): Series | undefined {
  return atDigits(working, () => {
    // At bⱼ = −n every 1/Γ(bⱼ+k) up to k = n is zero, and from k = n+1 it is 1/(k−n−1)!; the
    // product is zero until every lower parameter has cleared its last pole.
    const firsts = lower.map((b) => (b.isInteger() && b.lte(0) ? 1 - b.toNumber() : 0));
    const first = Math.max(0, ...firsts);
    const tol = big(10).pow(-(working - 2));
    const invGammas = lower.map((b, j) => (firsts[j]! > 0 ? big(0) : inverseGamma(b, working)));
    let core = big(1); // ∏(aᵢ)_k zᵏ/k!, the part regularizing doesn't change
    let sum = big(0);
    let peak = big(0);
    let previous: BigDecimal | undefined;
    let run = 0; // consecutive shrinking terms
    let worstRatio = big(0);
    const risingRatio = upper.length === lower.length + 1; // p = q + 1: the ratio tends to z
    const zSize = z.abs();
    for (let k = 0; k < MAX_TERMS; k++) {
      const term = invGammas.reduce((t, g) => t.mul(g), core);
      sum = sum.add(term).toPrecision(working);
      if (term.abs().gt(peak)) peak = term.abs();
      if (core.isZero()) return { sum, peak }; // terminated (a polynomial case)
      if (k >= first) {
        const size = term.abs();
        if (previous !== undefined && size.lt(previous)) {
          run += 1;
          const ratio = size.div(previous);
          if (run === 1 || ratio.gt(worstRatio)) worstRatio = ratio;
          // A p = q + 1 series' ratio rises toward |z| (DLMF 16.2), so the run's largest ratio alone
          // understates the tail.
          const bound = risingRatio && zSize.gt(worstRatio) ? zSize : worstRatio;
          if (run >= SETTLED_RUN && bound.lt(1)) {
            const tail = size.mul(bound).div(big(1).sub(bound));
            if (tail.lte(tol.mul(sum.abs()))) return { sum, peak };
          }
        } else {
          run = 0;
        }
        previous = size;
      }
      let next = z;
      for (const a of upper) next = next.mul(a.add(k));
      core = core
        .mul(next)
        .div(k + 1)
        .toPrecision(working);
      lower.forEach((b, j) => {
        if (k + 1 === firsts[j]) invGammas[j] = big(1);
        else if (k >= firsts[j]!) invGammas[j] = invGammas[j]!.div(b.add(k)).toPrecision(working);
      });
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
 * pFq(upper; lower; z)/∏Γ(lower) to `digits` significant digits, or undefined when it can't be
 * vouched for (no convergence, or more cancellation than `MAX_LOST_DIGITS`).
 */
export function pfqRegularizedBig(
  upper: readonly BigDecimal[],
  lower: readonly BigDecimal[],
  z: BigDecimal,
  digits: number,
): BigDecimal | undefined {
  let working = digits + GUARD;
  for (let pass = 0; pass < 2; pass++) {
    const r = series(upper, lower, z, working);
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

/**
 * pFq(upper; b; z) itself: the regularized sum times Γ(b), so a pole of Γ (b a non-positive
 * integer, where pFq is undefined) declines.
 */
export function pfqBig(
  upper: readonly BigDecimal[],
  b: BigDecimal,
  z: BigDecimal,
  digits: number,
): BigDecimal | undefined {
  if (b.isInteger() && b.lte(0)) return undefined;
  const working = digits + GUARD;
  const regularized = pfqRegularizedBig(upper, [b], z, working);
  if (regularized === undefined) return undefined;
  return atDigits(working, () => regularized.div(inverseGamma(b, working)).toPrecision(digits));
}

/** Are x and y equal to `digits` digits, relative to 1 + |x| + |y|? */
const agrees = (x: BigDecimal, y: BigDecimal, digits: number): boolean =>
  x
    .sub(y)
    .abs()
    .lte(big(1).add(x.abs()).add(y.abs()).mul(big(10).pow(-digits)));

/**
 * 1F1(a; b; z)/Γ(b) to `digits` digits. At b = a − 1 and b = a the closed forms e^z(1 + z/(a−1))/Γ(a−1)
 * and e^z/Γ(a) answer where the series can't: a sum that cancels to 0 never settles its tail.
 */
export function hypergeometric1F1RegularizedBig(
  a: BigDecimal,
  b: BigDecimal,
  z: BigDecimal,
  digits: number,
): BigDecimal | undefined {
  const working = digits + GUARD;
  const shift = a.sub(1);
  const shiftIsPole = shift.isInteger() && shift.lte(0);
  if (!shiftIsPole && agrees(b, shift, working)) {
    return atDigits(working, () =>
      z
        .exp()
        .mul(big(1).add(z.div(shift)))
        .mul(inverseGamma(shift, working))
        .toPrecision(digits),
    );
  }
  if (!(a.isInteger() && a.lte(0)) && agrees(b, a, working)) {
    return atDigits(working, () => z.exp().mul(inverseGamma(a, working)).toPrecision(digits));
  }
  return pfqRegularizedBig([a], [b], z, digits);
}

/** Below this z the Pfaff map z/(z−1) lands nearer 0 than z does by enough to be worth taking. */
const PFAFF_BELOW = -0.5;

/**
 * 2F1(a, b; c; z)/Γ(c) for real z < 1, to `digits` digits. The series settles at the rate |z|ᵏ, so
 * a z below `PFAFF_BELOW` is brought into (0, 1) by Pfaff's transformation (DLMF 15.8.1; both
 * sides stay entire in c, so it holds at the poles of Γ(c) too):
 *   2F1(a, b; c; z)/Γ(c) = (1−z)⁻ᵃ · 2F1(a, c−b; c; z/(z−1))/Γ(c).
 * z ≥ 1 is on or past the branch point and declines, as does a series that doesn't settle.
 */
export function hypergeometric2F1RegularizedBig(
  a: BigDecimal,
  b: BigDecimal,
  c: BigDecimal,
  z: BigDecimal,
  digits: number,
): BigDecimal | undefined {
  if (!z.isFinite() || !z.lt(1)) return undefined;
  if (z.gte(PFAFF_BELOW)) return pfqRegularizedBig([a, b], [c], z, digits);
  const working = digits + GUARD;
  return atDigits(working, () => {
    const w = z.div(z.sub(1));
    const core = pfqRegularizedBig([a, c.sub(b)], [c], w, working);
    if (core === undefined) return undefined;
    return core.mul(a.mul(big(1).sub(z).ln()).neg().exp()).toPrecision(digits);
  });
}

/**
 * 3F2(a₁, a₂, a₃; b₁, b₂; z)/(Γ(b₁)Γ(b₂)) for real z in (−1, 1), to `digits` digits. The series
 * settles at the rate |z|ᵏ; z = ±1 and past it decline (at z = 1 the terms fall only like a power
 * of k, so even where the series converges it can't settle to `digits` in the term budget).
 */
export function hypergeometric3F2RegularizedBig(
  upper: readonly [BigDecimal, BigDecimal, BigDecimal],
  lower: readonly [BigDecimal, BigDecimal],
  z: BigDecimal,
  digits: number,
): BigDecimal | undefined {
  if (!z.isFinite() || !z.abs().lt(1)) return undefined;
  return pfqRegularizedBig(upper, lower, z, digits);
}

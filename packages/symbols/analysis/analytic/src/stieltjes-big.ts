import { BigDecimal } from "@cortex-js/compute-engine";
import { bernoulliRational } from "./bernoulli.ts";
import { atDigits } from "./bigzeta.ts";

// γ_n(a) for an integer n ≥ 0 and real a > 0 in compute-engine's BigDecimal, to any number of
// digits -- the arbitrary-precision twin of stieltjes.ts, by the same Euler–Maclaurin sum on
// f(x) = lnⁿ(x)/x:
//   γ_n(a) = Σ_{k<N} f(k+a) + ½ f(N+a) − ln^{n+1}(N+a)/(n+1) − Σ_j B₂ⱼ/(2j)! f^{(2j−1)}(N+a).
//
// A double caps the tail point x = N + a near 6, which caps the digits. Here x grows with the
// digits asked for: the Bernoulli terms shrink until j ≈ πx, where they reach about e^{−2πx},
// so x ≈ 0.37·digits reaches any precision. The derivatives' coefficients (see stieltjes.ts)
// are integers and are kept exact, as bigints.

/** Digits carried past the ones asked for. */
const GUARD_DIGITS = 10;

/** The tail point, as a multiple of the working digits: e^{−2πx} < 10^{−digits} past 0.37. */
const TAIL_PER_DIGIT = 0.4;

/** γ_n(a) to `digits` significant digits, or undefined for a ≤ 0 or a negative or non-integer n. */
export function stieltjesGammaBig(
  n: number,
  a: BigDecimal,
  digits: number,
): BigDecimal | undefined {
  if (!Number.isInteger(n) || n < 0 || !a.isPositive()) return undefined;
  const ad = a.toNumber();
  const target = digits + GUARD_DIGITS;
  const terms = Math.max(1, Math.ceil(TAIL_PER_DIGIT * target + n / 2 - ad));
  const xd = terms + ad;
  // The partial sum and the subtracted log power are each ~ln^{n+1}(x)/(n+1), and cancel.
  const cancelled = Math.max(0, (n + 1) * Math.log10(Math.log(xd)) - Math.log10(n + 1));
  return atDigits(target + Math.ceil(cancelled), () => {
    const working = BigDecimal.precision;
    const round = (v: BigDecimal): BigDecimal => v.toPrecision(working);
    const lnPower = (L: BigDecimal, k: number): BigDecimal => {
      let r = BigDecimal.ONE;
      for (let i = 0; i < k; i++) r = round(r.mul(L));
      return r;
    };
    let sum = BigDecimal.ZERO;
    for (let k = 0; k < terms; k++) {
      const x = a.add(k);
      sum = round(sum.add(lnPower(x.ln(), n).div(x)));
    }
    const x = a.add(terms);
    const L = x.ln();
    sum = round(sum.add(lnPower(L, n).div(x).div(2)));
    sum = round(sum.sub(lnPower(L, n + 1).div(n + 1)));
    // L^{n−i} for i = 0 … n, and n!/(n−i)!.
    const powers = Array.from({ length: n + 1 }, (_, i) => lnPower(L, n - i));
    const falling: bigint[] = [1n];
    for (let i = 1; i <= n; i++) falling.push(falling[i - 1]! * BigInt(n - i + 1));
    const xInv2 = BigDecimal.ONE.div(x.mul(x));
    let xPower = BigDecimal.ONE.div(x.mul(x)); // x^{−1−m}, from m = 1
    let poly: bigint[] = [-1n, 1n]; // Π_{j=1}^{m} (t − j), lowest degree first, from m = 1
    let factorial = 1n; // (2j)!
    let previous = Infinity;
    const threshold = log10Abs(sum) - working;
    for (let j = 1; ; j++) {
      factorial *= BigInt((2 * j - 1) * 2 * j);
      let derivative = BigDecimal.ZERO;
      for (let i = 0; i <= Math.min(2 * j - 1, n); i++) {
        const c = poly[i]! * falling[i]!;
        if (c !== 0n) derivative = round(derivative.add(powers[i]!.mul(new BigDecimal(c))));
      }
      const [bn, bd] = bernoulliRational(2 * j);
      const term = round(
        derivative
          .mul(xPower)
          .mul(new BigDecimal(bn))
          .div(new BigDecimal(bd * factorial)),
      );
      const size = log10Abs(term);
      if (size > previous) return undefined; // past the smallest term, short of the target
      sum = round(sum.sub(term));
      if (size < threshold) return sum.toPrecision(digits + GUARD_DIGITS);
      previous = size;
      // m → m + 2: multiply by (t − (m+1))(t − (m+2)), and x^{−1−m} by x^{−2}.
      const m = 2 * j - 1;
      poly = times(times(poly, BigInt(m + 1)), BigInt(m + 2));
      xPower = round(xPower.mul(xInv2));
    }
  });
}

/** `p(t)·(t − c)`, coefficients lowest degree first. */
const times = (p: readonly bigint[], c: bigint): bigint[] =>
  Array.from({ length: p.length + 1 }, (_, i) => (p[i - 1] ?? 0n) - c * (p[i] ?? 0n));

/** log10 |x|, or −∞ for 0. */
const log10Abs = (x: BigDecimal): number =>
  x.isZero() ? -Infinity : Math.log10(Math.abs(x.toNumber()));

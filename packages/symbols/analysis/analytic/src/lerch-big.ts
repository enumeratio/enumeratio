import { BigDecimal } from "@cortex-js/compute-engine";
import { atDigits } from "./bigzeta.ts";

// Φ(z, s, a) = Σ_{n≥0} zⁿ (n+a)^(−s) for real z, s, a in compute-engine's BigDecimal, to any
// number of digits -- the arbitrary-precision twin of lerch.ts's double series, for the same
// disk |z| < 1 and a > 0, where every term is real. PolyLog rides on it: Liₛ(z) = z·Φ(z, s, 1).
//
// The series is summed until its tail is provably below the digits asked for. The ratio of
// one term to the one before, |z|·((n+a)/(n+1+a))^s, tends to |z| -- from below for s ≥ 0, so
// |z| bounds every ratio; from above for s < 0, so once the current ratio r is below 1 it
// bounds every later one. With R that bound, the tail after a term t is at most |t|·R/(1−R):
// a bound, not an estimate.

/** Digits carried past the ones asked for. */
const GUARD_DIGITS = 10;

/** Past this many terms (|z| close to 1) the series is too slow to be worth it. */
const MAX_TERMS = 20_000;

/** Φ(z, s, a) to `digits` significant digits, or undefined outside 0 < |z| < 1, a > 0, or
 * when the series would take more than `MAX_TERMS` terms. */
export function lerchPhiBig(
  z: BigDecimal,
  s: BigDecimal,
  a: BigDecimal,
  digits: number,
): BigDecimal | undefined {
  if (z.isZero() || z.abs().gte(1) || !a.isPositive()) return undefined;
  const zd = Math.abs(z.toNumber());
  const sd = s.toNumber();
  const ad = a.toNumber();
  // Enough terms, estimated in doubles, to size the loop's cap before paying for any of them.
  const needed = ((digits + GUARD_DIGITS) * Math.LN10) / -Math.log(zd);
  if (needed + Math.max(0, -sd) * 10 > MAX_TERMS) return undefined;

  let working = digits + GUARD_DIGITS;
  for (let attempt = 0; attempt < 2; attempt++) {
    const summed = atDigits(working, () => series(z, s, a, zd, sd, ad, working));
    if (summed === undefined) return undefined;
    // Terms larger than the sum cancel (z < 0): if that ate into the guard, go again with
    // the digits it ate added.
    const lost = Math.ceil(summed.largest - log10Abs(summed.sum));
    if (attempt > 0 || lost <= GUARD_DIGITS / 2) return summed.sum;
    working += lost;
  }
  return undefined; // unreachable
}

/** log10 |x|, or −∞ for 0. */
const log10Abs = (x: BigDecimal): number =>
  x.isZero() ? -Infinity : Math.log10(Math.abs(x.toNumber()));

/** The series at the working precision, with log10 of its largest term. */
function series(
  z: BigDecimal,
  s: BigDecimal,
  a: BigDecimal,
  zd: number,
  sd: number,
  ad: number,
  working: number,
): { readonly sum: BigDecimal; readonly largest: number } | undefined {
  const round = (x: BigDecimal): BigDecimal => x.toPrecision(working);
  const negS = s.neg();
  let sum = BigDecimal.ZERO;
  let largest = -Infinity;
  let zPower = BigDecimal.ONE; // zⁿ
  for (let n = 0; n < MAX_TERMS; n++) {
    const base = a.add(n);
    const term = round(zPower.mul(round(base.ln().mul(negS)).exp()));
    sum = round(sum.add(term));
    largest = Math.max(largest, log10Abs(term));
    // R bounds the ratio of every later term to the one before (see the header).
    const R = sd >= 0 ? zd : zd * ((n + ad) / (n + 1 + ad)) ** sd;
    if (R < 1) {
      const tail = Math.abs(term.toNumber()) * (R / (1 - R));
      if (tail === 0 || Math.log10(tail) < log10Abs(sum) - working) return { sum, largest };
    }
    zPower = round(zPower.mul(z));
  }
  return undefined;
}

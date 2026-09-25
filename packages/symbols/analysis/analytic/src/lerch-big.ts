import { BigDecimal } from "@cortex-js/compute-engine";
import {
  type Ball,
  add,
  certify,
  div,
  exact,
  exp,
  lower,
  magnitude,
  mul,
  neg,
  pow,
  upper,
} from "./ball.ts";
import { atDigits } from "./bigzeta.ts";

// Φ(z, s, a) = Σ_{n≥0} zⁿ (n+a)^(−s) for real z, s, a in compute-engine's BigDecimal, to any
// number of digits -- the arbitrary-precision twin of lerch.ts's double series, for the same
// disk |z| < 1 and a > 0, where every term is real. PolyLog rides on it: Liₛ(z) = z·Φ(z, s, 1).
//
// The series is summed in ball arithmetic (ball.ts) until its tail is provably below the
// digits asked for, and the tail's bound is added to the sum's radius: the answer is a ball
// that contains Φ. The ratio of one term to the one before is |z|·((n+a)/(n+1+a))^s. For
// s ≥ 0 that is at most |z|; for s < 0 it is |z|·(1 + 1/(n+a))^{|s|} ≤ |z|·e^{|s|/(n+a)},
// which falls as n grows -- so R = |z|·e^{max(0, −s)/(n+a)}, taken at the ball's worst z, s
// and a, bounds every later ratio, and once R < 1 the tail after a term t is at most
// |t|·R/(1−R).

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
  return lerchPhiBall(exact(z), exact(s), exact(a), digits)?.mid;
}

/** A ball holding Φ(z, s, a) for every z, s and a in theirs, about `digits` significant
 * digits wide, or undefined where `lerchPhiBig` is. */
export function lerchPhiBall(z: Ball, s: Ball, a: Ball, digits: number): Ball | undefined {
  if (z.mid.isZero() || !magnitude(z).lt(1) || !lower(a).isPositive()) return undefined;
  const zd = Math.abs(z.mid.toNumber());
  const sd = s.mid.toNumber();
  const ad = a.mid.toNumber();
  // Enough terms, estimated in doubles, to size the loop's cap before paying for any of them.
  const needed = ((digits + GUARD_DIGITS) * Math.LN10) / -Math.log(zd);
  if (needed + Math.max(0, -sd) * 10 > MAX_TERMS) return undefined;

  let working = digits + GUARD_DIGITS;
  for (let attempt = 0; attempt < 2; attempt++) {
    const summed = atDigits(working, () => certify(() => series(z, s, a, zd, sd, ad, working)));
    if (summed === undefined) return undefined;
    // Terms larger than the sum cancel (z < 0): if that ate into the guard, go again with
    // the digits it ate added.
    const lost = Math.ceil(summed.largest - log10Abs(summed.sum.mid));
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
  z: Ball,
  s: Ball,
  a: Ball,
  zd: number,
  sd: number,
  ad: number,
  working: number,
): { readonly sum: Ball; readonly largest: number } | undefined {
  const negS = neg(s);
  // max(0, −s) at the ball's most negative s, for the ratio bound.
  const growth = BigDecimal.ZERO.gt(lower(s)) ? lower(s).neg() : BigDecimal.ZERO;
  let sum = exact(0);
  let largest = -Infinity;
  let zPower = exact(1); // zⁿ
  for (let n = 0; n < MAX_TERMS; n++) {
    const base = add(a, exact(n));
    const term = mul(zPower, pow(base, negS));
    sum = add(sum, term);
    largest = Math.max(largest, log10Abs(term.mid));
    // Estimate the tail in doubles first, and pay for its bound only once the estimate says
    // it is small enough.
    const estimate = sd >= 0 ? zd : zd * ((n + ad) / (n + 1 + ad)) ** sd;
    if (estimate < 1) {
      const tail = Math.abs(term.mid.toNumber()) * (estimate / (1 - estimate));
      if (tail === 0 || Math.log10(tail) < log10Abs(sum.mid) - working) {
        const bound = tailBound(term, z, growth, lower(a).add(n));
        if (bound !== undefined && bound.lt(magnitude(sum).mul(new BigDecimal(`1e-${working}`)))) {
          return { sum: { mid: sum.mid, rad: sum.rad.add(bound) }, largest };
        }
      }
    }
    zPower = mul(zPower, z);
  }
  return undefined;
}

/** |t|·R/(1−R) with R = |z|·e^{growth/base} (see the header), rounded up, or undefined when
 * R is not yet below 1. */
function tailBound(
  term: Ball,
  z: Ball,
  growth: BigDecimal,
  base: BigDecimal,
): BigDecimal | undefined {
  return atDigits(20, () => {
    const ratio = upper(mul(exact(magnitude(z)), exp(div(exact(growth), exact(base)))));
    if (!ratio.lt(1)) return undefined;
    return upper(div(mul(exact(magnitude(term)), exact(ratio)), exact(BigDecimal.ONE.sub(ratio))));
  });
}

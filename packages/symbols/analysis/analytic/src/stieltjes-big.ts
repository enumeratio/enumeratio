import { BigDecimal } from "@cortex-js/compute-engine";
import {
  type Ball,
  add,
  certify,
  div,
  exact,
  ln,
  lower,
  mul,
  powInt,
  rational,
  sub,
  upper,
} from "./ball.ts";
import { bernoulliRational } from "./bernoulli.ts";
import { atDigits } from "./bigzeta.ts";

// γ_n(a) for an integer n ≥ 0 and real a > 0 in compute-engine's BigDecimal, to any number of
// digits -- the arbitrary-precision twin of stieltjes.ts, by the same Euler–Maclaurin sum on
// f(x) = lnⁿ(x)/x:
//   γ_n(a) = Σ_{k<N} f(k+a) + ½ f(N+a) − ln^{n+1}(N+a)/(n+1) − Σ_{j≤M} B₂ⱼ/(2j)! f^{(2j−1)}(N+a) + R.
//
// A double caps the tail point x = N + a near 6, which caps the digits. Here x grows with the
// digits asked for: the Bernoulli terms shrink until j ≈ πx, where they reach about e^{−2πx},
// so x ≈ 0.37·digits reaches any precision. The derivatives are f^{(m)}(x) = x^{−1−m}·Pₘ(ln x)
// for a polynomial Pₘ of degree n whose integer coefficients (see stieltjes.ts) are kept exact,
// as bigints.
//
// The sum is taken in ball arithmetic (ball.ts), and R is bounded, not dropped. The periodic
// Bernoulli function never exceeds |B₂ₘ| < 4(2M)!/(2π)^{2M}, so
//   |R| ≤ 4/(2π)^{2M} · ∫_x^∞ |f^{(2M)}(t)| dt.
// The usual shortcut -- that integral is |f^{(2M−1)}(x)|, the next term's size -- needs
// f^{(2M)} to keep one sign past x, and it doesn't here: P₂ₘ has a root near ln x ≈ n·H₂ₘ,
// beyond the tail point for n ≥ 1. So each |cᵢ| lnⁿ⁻ⁱ(t) of |P₂ₘ| is integrated on its own,
//   ∫_x^∞ t^{−1−p} lnᵏ(t) dt = x^{−p} Σ_{r≤k} (k!/r!) lnʳ(x) / p^{k−r+1},  p = 2M,
// the incomplete gamma at an integer order, which is a finite sum.

/** Digits carried past the ones asked for. */
const GUARD_DIGITS = 10;

/** The tail point, as a multiple of the working digits: e^{−2πx} < 10^{−digits} past 0.37. */
const TAIL_PER_DIGIT = 0.4;

/** Tail points tried, each half again past the last, before the kernel declines. */
const TAIL_ATTEMPTS = 3;

/** A decimal below 2π, so dividing by its powers overstates the remainder, never under. */
const TWO_PI_BELOW = new BigDecimal("6.283");

/** γ_n(a) to `digits` significant digits, or undefined for a ≤ 0 or a negative or non-integer n. */
export function stieltjesGammaBig(
  n: number,
  a: BigDecimal,
  digits: number,
): BigDecimal | undefined {
  return stieltjesGammaBall(n, exact(a), digits)?.mid;
}

/** A ball holding γ_n(a) for every a in its ball, about `digits` significant digits wide, or
 * undefined where `stieltjesGammaBig` is. */
export function stieltjesGammaBall(n: number, a: Ball, digits: number): Ball | undefined {
  if (!Number.isInteger(n) || n < 0 || !lower(a).isPositive()) return undefined;
  const ad = a.mid.toNumber();
  const target = digits + GUARD_DIGITS;
  let terms = Math.max(1, Math.ceil(TAIL_PER_DIGIT * target + n / 2 - ad));
  for (let attempt = 0; attempt < TAIL_ATTEMPTS; attempt++) {
    const xd = terms + ad;
    // The partial sum and the subtracted log power are each ~ln^{n+1}(x)/(n+1), and cancel.
    const cancelled = Math.max(0, (n + 1) * Math.log10(Math.log(xd)) - Math.log10(n + 1));
    const r = atDigits(target + Math.ceil(cancelled), () =>
      certify(() => eulerMaclaurin(n, a, terms)),
    );
    if (r !== undefined) return r;
    // The Bernoulli terms turned before reaching the digits the cancellation and a small
    // γ_n(a) call for: move the tail point out.
    terms = Math.ceil(terms * 1.5);
  }
  return undefined;
}

function eulerMaclaurin(n: number, a: Ball, terms: number): Ball | undefined {
  const working = BigDecimal.precision;
  let sum = exact(0);
  for (let k = 0; k < terms; k++) {
    const x = add(a, exact(k));
    sum = add(sum, div(powInt(ln(x), n), x));
  }
  const x = add(a, exact(terms));
  const L = ln(x);
  sum = add(sum, div(powInt(L, n), mul(x, exact(2))));
  sum = sub(sum, div(powInt(L, n + 1), exact(n + 1)));
  // L^{n−i} for i = 0 … n, and n!/(n−i)!.
  const powers = Array.from({ length: n + 1 }, (_, i) => powInt(L, n - i));
  const falling: bigint[] = [1n];
  for (let i = 1; i <= n; i++) falling.push(falling[i - 1]! * BigInt(n - i + 1));
  const xInv2 = div(exact(1), mul(x, x));
  let xPower = xInv2; // x^{−1−m}, from m = 1
  let poly: bigint[] = [-1n, 1n]; // Π_{j=1}^{m} (t − j), lowest degree first, from m = 1
  let factorial = 1n; // (2j)!
  let previous = Infinity;
  const threshold = log10Abs(sum.mid) - working;
  for (let j = 1; ; j++) {
    factorial *= BigInt((2 * j - 1) * 2 * j);
    let derivative = exact(0);
    for (let i = 0; i <= Math.min(2 * j - 1, n); i++) {
      const c = poly[i]! * falling[i]!;
      if (c !== 0n) derivative = add(derivative, mul(powers[i]!, exact(new BigDecimal(c))));
    }
    const [bn, bd] = bernoulliRational(2 * j);
    const term = mul(mul(derivative, xPower), rational(bn, bd * factorial));
    const size = log10Abs(term.mid);
    if (size > previous) return undefined; // past the smallest term, short of the target
    sum = sub(sum, term);
    // m → m + 1: P₂ⱼ's polynomial, for the remainder after j pairs.
    const even = times(poly, BigInt(2 * j));
    if (size < threshold) {
      const bound = remainderBound(n, x, L, even, falling, 2 * j);
      return { mid: sum.mid, rad: sum.rad.add(bound) };
    }
    previous = size;
    // m → m + 2: multiply by (t − (m+1))(t − (m+2)), and x^{−1−m} by x^{−2}.
    poly = times(even, BigInt(2 * j + 1));
    xPower = mul(xPower, xInv2);
  }
}

/** 4/(2π)^p · Σᵢ |cᵢ| ∫_x^∞ t^{−1−p} lnⁿ⁻ⁱ(t) dt, cᵢ = poly[i]·n!/(n−i)! the coefficients of
 * P_p (see the header), rounded up. x > 1, so ln t > 0 throughout. */
function remainderBound(
  n: number,
  x: Ball,
  L: Ball,
  poly: readonly bigint[],
  falling: readonly bigint[],
  p: number,
): BigDecimal {
  return atDigits(20, () => {
    const xp = div(exact(1), powInt(x, p)); // x^{−p}
    let total = exact(0);
    for (let i = 0; i <= Math.min(p, n); i++) {
      const c = poly[i]! * falling[i]!;
      if (c === 0n) continue;
      // ∫_x^∞ t^{−1−p} lnᵏ(t) dt = x^{−p} Σ_{r≤k} (k!/r!) Lʳ / p^{k−r+1}.
      const k = n - i;
      let integral = exact(0);
      let ratio = 1n; // k!/r!, from r = k down
      for (let r = k; r >= 0; r--) {
        if (r < k) ratio *= BigInt(r + 1);
        const denominator = BigInt(p) ** BigInt(k - r + 1);
        integral = add(integral, mul(powInt(L, r), rational(ratio, denominator)));
      }
      total = add(total, mul(exact(new BigDecimal(c < 0n ? -c : c)), integral));
    }
    const scale = exact(new BigDecimal(4).divToward(TWO_PI_BELOW.pow(p), "ceiling"));
    return upper(mul(mul(scale, xp), total));
  });
}

/** `p(t)·(t − c)`, coefficients lowest degree first. */
const times = (p: readonly bigint[], c: bigint): bigint[] =>
  Array.from({ length: p.length + 1 }, (_, i) => (p[i - 1] ?? 0n) - c * (p[i] ?? 0n));

/** log10 |x|, or −∞ for 0. */
const log10Abs = (x: BigDecimal): number =>
  x.isZero() ? -Infinity : Math.log10(Math.abs(x.toNumber()));

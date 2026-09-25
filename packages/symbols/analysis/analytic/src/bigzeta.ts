import { BigDecimal } from "@cortex-js/compute-engine";
import { bernoulliRational } from "./bernoulli.ts";
import type { Cx } from "./complex.ts";

// ζ(s, a) for complex s and a in compute-engine's BigDecimal, to any number of digits.
//
// The double kernel (hurwitz-zeta.ts) runs on Math.log/exp/sin/cos, whose last ulp differs
// between JS engines, so its answer does too. BigDecimal arithmetic is bigint arithmetic and
// the same everywhere: computed with guard digits and rounded once, a double result is
// correctly rounded and engine-independent.
//
// Same Euler–Maclaurin as the double kernel,
//   ζ(s, a) = Σ_{k<N} (k+a)^{-s} + z^{1-s}/(s-1) + ½z^{-s} + Σ_{j=1}^{M} B₂ⱼ/(2j)! (s)₂ⱼ₋₁ z^{-s-2j+1},
// z = N + a, with N and M planned in doubles from the size of each term. Left of Re(s) = 0
// the direct terms grow like N^(−Re s) and cancel; rather than reflect, the working
// precision is raised by the digits that cancellation eats.

/** A complex number as a pair of BigDecimals. */
export interface BigCx {
  re: BigDecimal;
  im: BigDecimal;
}

/** Digits carried past the ones asked for, so a final rounding is (almost always) correct. */
const GUARD_DIGITS = 8;

/** Past this many working digits the cancellation left of the strip is too costly to carry. */
const MAX_WORKING_DIGITS = 1200;

const LN10 = Math.LN10;
const LN_2PI = Math.log(2 * Math.PI);

// BigDecimal's `add`, `sub` and `mul` are exact, so a loop that doesn't round grows its
// significands every step. Every op below rounds to the working precision.
export const round = (x: BigDecimal): BigDecimal => x.toPrecision(BigDecimal.precision);

export const add = (x: BigCx, y: BigCx): BigCx => ({
  re: round(x.re.add(y.re)),
  im: round(x.im.add(y.im)),
});

export const mul = (x: BigCx, y: BigCx): BigCx => ({
  re: round(x.re.mul(y.re).sub(x.im.mul(y.im))),
  im: round(x.re.mul(y.im).add(x.im.mul(y.re))),
});

export const div = (x: BigCx, y: BigCx): BigCx => {
  const d = y.re.mul(y.re).add(y.im.mul(y.im));
  return {
    re: x.re.mul(y.re).add(x.im.mul(y.im)).div(d),
    im: x.im.mul(y.re).sub(x.re.mul(y.im)).div(d),
  };
};

export const scale = (x: BigCx, k: BigDecimal): BigCx => ({
  re: round(x.re.mul(k)),
  im: round(x.im.mul(k)),
});

export const exp = (z: BigCx): BigCx => {
  const m = z.re.exp();
  if (z.im.isZero()) return { re: m, im: BigDecimal.ZERO };
  return { re: round(m.mul(z.im.cos())), im: round(m.mul(z.im.sin())) };
};

/** Principal log, branch cut on (−∞, 0]. */
export const log = (z: BigCx): BigCx => ({
  re: z.re.mul(z.re).add(z.im.mul(z.im)).ln().div(2),
  im: BigDecimal.atan2(z.im, z.re),
});

/**
 * Principal z^w. A positive real base with a real exponent stays real, and so does a negative
 * one with an integer exponent — e^(iπw) would leave rounding noise in the imaginary part.
 */
export const pow = (z: BigCx, w: BigCx): BigCx => {
  if (!z.im.isZero() || z.re.isZero()) return exp(mul(w, log(z)));
  if (z.re.isNegative()) {
    if (!w.im.isZero() || !w.re.isInteger()) return exp(mul(w, log(z)));
    const r = pow({ re: z.re.neg(), im: z.im }, w);
    return w.re.toBigInt() % 2n === 0n ? r : { re: r.re.neg(), im: r.im };
  }
  const ln = z.re.ln();
  return exp({ re: round(w.re.mul(ln)), im: round(w.im.mul(ln)) });
};

const big = (x: number | BigDecimal): BigDecimal => (typeof x === "number" ? new BigDecimal(x) : x);

/** A BigCx from doubles (each taken at its shortest decimal, as compute-engine reads floats). */
export const bigCx = (re: number | BigDecimal, im: number | BigDecimal = 0): BigCx => ({
  re: big(re),
  im: big(im),
});

/** Run `fn` with BigDecimal working at `digits`, restoring the engine's precision after. */
export function atDigits<T>(digits: number, fn: () => T): T {
  const saved = BigDecimal.precision;
  BigDecimal.precision = digits;
  try {
    return fn();
  } finally {
    BigDecimal.precision = saved;
  }
}

// B₂ⱼ/(2j)!, held at the most digits any call has wanted and rounded down to the rest.
let coeffs: BigDecimal[] = [];
let coeffDigits = 0;
function emCoeff(j: number): BigDecimal {
  const p = BigDecimal.precision;
  if (p > coeffDigits) {
    coeffs = [];
    coeffDigits = p;
  }
  if (coeffs[j] === undefined) {
    let fact = 1n;
    for (let i = 2n; i <= BigInt(2 * j); i++) fact *= i;
    const [n, d] = bernoulliRational(2 * j);
    coeffs[j] = atDigits(coeffDigits, () => new BigDecimal(n).div(new BigDecimal(d * fact)));
  }
  return p === coeffDigits ? coeffs[j] : coeffs[j].toPrecision(p);
}

interface Plan {
  terms: number;
  pairs: number;
  /** log10 of the largest single term, which sets how many digits the sum cancels. */
  largest: number;
}

/** ln |w^(−s)| for complex w, s, from doubles. */
const lnAbsPow = (wr: number, wi: number, s: Cx): number =>
  -s.re * 0.5 * Math.log(wr * wr + wi * wi) + s.im * Math.atan2(wi, wr);

/**
 * Choose N (direct terms) and M (Bernoulli pairs) so the first omitted tail term is below
 * 10^(−digits). A direct term costs a log, an exp and a sin/cos; a pair costs a few
 * multiplies — so of the N that work, take the one that minimises N + M/8.
 */
function plan(s: Cx, a: Cx, digits: number): Plan {
  const target = -digits * LN10 - LN10;
  const n0 = Math.max(0, Math.ceil(1 - a.re)); // Re z ≥ 1
  const maxPairs = 4 * digits + 50;
  let best: Plan | undefined;
  let bestCost = Infinity;
  let firstN = -1;
  for (let n = n0; firstN < 0 || n <= 2 * firstN + 8; n += Math.max(1, Math.ceil((n - n0) / 16))) {
    if (n > n0 + 1e6) break;
    const zr = a.re + n;
    const zi = a.im;
    const lnZ = 0.5 * Math.log(zr * zr + zi * zi);
    const lnZs = lnAbsPow(zr, zi, s); // ln |z^(−s)|
    let lnPoch = 0; // ln |(s)₂ⱼ₋₁|, starting from (s)₁ = s
    lnPoch += 0.5 * Math.log(s.re * s.re + s.im * s.im);
    let largest = lnZs + lnZ - 0.5 * Math.log((s.re - 1) ** 2 + s.im ** 2); // z^{1−s}/(s−1)
    let prev = Infinity;
    let pairs = -1;
    for (let j = 1; j <= maxPairs; j++) {
      // |B₂ⱼ/(2j)!| ≈ 2/(2π)^{2j}; z^{−s−2j+1} = z^{−s}·z^{1−2j}
      const t = Math.LN2 - 2 * j * LN_2PI + lnPoch + lnZs - (2 * j - 1) * lnZ;
      if (t === -Infinity || t < target) {
        pairs = j - 1;
        break;
      }
      if (t > prev) break; // past the smallest term: this N can't get there
      largest = Math.max(largest, t);
      prev = t;
      // (s)₂ⱼ₊₁ = (s)₂ⱼ₋₁ (s+2j−1)(s+2j)
      lnPoch += 0.5 * Math.log((s.re + 2 * j - 1) ** 2 + s.im ** 2);
      lnPoch += 0.5 * Math.log((s.re + 2 * j) ** 2 + s.im ** 2);
    }
    if (pairs < 0) continue;
    if (firstN < 0) firstN = n;
    for (let k = 0; k < n; k++) {
      const wr = a.re + k;
      if (wr === 0 && a.im === 0) continue;
      largest = Math.max(largest, lnAbsPow(wr, a.im, s));
    }
    const cost = n + pairs / 8;
    if (cost < bestCost) {
      bestCost = cost;
      best = { terms: n, pairs, largest: largest / LN10 };
    }
  }
  if (!best) throw new Error("bigzeta: no Euler–Maclaurin truncation found");
  return best;
}

/** Euler–Maclaurin at the working precision, for a plan made for it. */
function eulerMaclaurin(s: BigCx, a: BigCx, { terms, pairs }: Plan): BigCx {
  const negS: BigCx = { re: s.re.neg(), im: s.im.neg() };
  let sum: BigCx = { re: BigDecimal.ZERO, im: BigDecimal.ZERO };
  for (let k = 0; k < terms; k++) {
    const w: BigCx = { re: a.re.add(k), im: a.im };
    if (w.re.isZero() && w.im.isZero()) continue; // Wolfram's HurwitzZeta drops (k+a) = 0
    sum = add(sum, pow(w, negS));
  }
  const z: BigCx = { re: a.re.add(terms), im: a.im };
  const zNegS = pow(z, negS);
  sum = add(sum, div(mul(zNegS, z), { re: s.re.sub(1), im: s.im })); // z^{1−s}/(s−1)
  sum = add(sum, scale(zNegS, BigDecimal.HALF)); // ½ z^{−s}
  const zInv2 = div(bigCx(1), mul(z, z));
  let zPow = div(zNegS, z); // z^{−s−2j+1}, from j = 1
  let poch = s; // (s)₂ⱼ₋₁
  for (let j = 1; j <= pairs; j++) {
    sum = add(sum, scale(mul(poch, zPow), emCoeff(j)));
    const u: BigCx = { re: s.re.add(2 * j - 1), im: s.im };
    const v: BigCx = { re: s.re.add(2 * j), im: s.im };
    poch = mul(poch, mul(u, v));
    zPow = mul(zPow, zInv2);
  }
  return sum;
}

/** log10 |x|, or +∞ for an exact zero, which has no digits to lose. */
const log10Abs = (x: BigDecimal): number => (x.isZero() ? Infinity : Math.log10(Math.abs(x.toNumber())));

/**
 * ζ(s, a) to `digits` significant digits in each nonzero part, or undefined where it would
 * cost more working precision than it is worth (far left of the strip). The s = 1 pole gives
 * undefined as well; the caller has the exact answer there.
 *
 * Terms where k + a = 0 (a a nonpositive integer) are dropped, as in `hurwitzZeta`.
 */
export function hurwitzZetaBig(s: BigCx, a: BigCx, digits: number): BigCx | undefined {
  if (s.re.eq(1) && s.im.isZero()) return undefined;
  const sd: Cx = { re: s.re.toNumber(), im: s.im.toNumber() };
  const ad: Cx = { re: a.re.toNumber(), im: a.im.toNumber() };

  // Plan for `digits` absolute. A part smaller than 1 then has fewer correct significant
  // digits than asked for; once its size is known, go again if that ate half the guard.
  let absolute = digits + GUARD_DIGITS;
  for (let attempt = 0; attempt < 2; attempt++) {
    const p = plan(sd, ad, absolute);
    const working = absolute + Math.max(0, Math.ceil(p.largest)) + 4;
    if (working > MAX_WORKING_DIGITS) return undefined;
    const r = atDigits(working, () => eulerMaclaurin(s, a, p));
    const smallest = Math.min(log10Abs(r.re), log10Abs(r.im));
    const short = Math.ceil(-smallest);
    if (attempt > 0 || !(short > GUARD_DIGITS / 2)) return r;
    absolute += Math.min(short, 2 * digits);
  }
  return undefined; // unreachable
}

/**
 * Wolfram's generalized ζ(s, a) (see `zetaGeneralized`): the terms with Re(k+a) < 0 as
 * ((k+a)²)^(−s/2), then ζ(s, ·) from the first k with Re(k+a) ≥ 0, a zero there dropped.
 */
export function zetaGeneralizedBig(s: BigCx, a: BigCx, digits: number): BigCx | undefined {
  const front: BigCx[] = [];
  let rest = a;
  while (rest.re.isNegative()) {
    front.push(rest);
    rest = { re: rest.re.add(1), im: rest.im };
  }
  if (rest.re.isZero() && rest.im.isZero()) rest = bigCx(1);
  const tail = hurwitzZetaBig(s, rest, digits);
  if (tail === undefined || front.length === 0) return tail;
  return atDigits(digits + GUARD_DIGITS + 10, () => {
    const negHalfS: BigCx = { re: s.re.div(-2), im: s.im.div(-2) };
    return front.reduce((acc, w) => add(acc, pow(mul(w, w), negHalfS)), tail);
  });
}

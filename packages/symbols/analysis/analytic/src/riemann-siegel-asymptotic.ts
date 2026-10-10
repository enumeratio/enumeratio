// unstable: BigDecimal, the class compute-engine's boxed numbers hold; no /numerics subpath yet
import { BigDecimal } from "@enumeratio/engine/unstable";
import { bernoulliRational, bigCx, bigRound, type BigCx } from "@enumeratio/ce-patches";

// The Riemann–Siegel formula with Gabcke's remainder, continued to complex t, in BigDecimal.
//
//   Z(t) = 2 Σ_{n ≤ N} n^{-1/2} cos(ϑ(t) − t ln n) + (−1)^{N−1} (2π/t)^{1/4} Σ_{k ≥ 0} C_k(p) (2π/t)^{k/2}
//
// with N = ⌊Re √(t/2π)⌋ and p = √(t/2π) − N. The main sum has √t terms where the zeta kernels'
// Euler–Maclaurin has t, and the remainder is a short series in ν = (2π/t)^{1/2}: asymptotic, so
// it is accurate to about ν^K and no further. Callers say how many digits they want and this
// declines when t is too small to give them. It is all BigDecimal because ϑ − t ln n is as large as
// t ln t, which costs a double that many digits of phase (a relative 10⁻⁹ at t = 10⁶).
//
// The remainder is Gabcke's (Göttingen dissertation, 1979; Edwards, "Riemann's Zeta Function", §7.5),
// C_k(p) = Σ_m c(k, m) π^{−(k+m)/2} Φ^{(m)}(p), where Φ(z) = cos(2π(z² − z − 1/16)) / cos(2πz) is entire
// (each zero of the denominator is a zero of the numerator); the tests pin C_1..C_4. The coefficients
// to C_30 come from the recurrence below, which is the one mpmath's rszeta runs for the same
// correction in another normalization (Arias de Reyna, "High precision computation of Riemann's zeta
// function by the Riemann–Siegel formula", I and II §3.17). Here it was matched, as exact rationals,
// against fits of the remainder of Z at 200 digits (mpmath), which they reproduce through k = 21 to
// the accuracy of the fits.

/** Remainder terms available (C_0..C_MAX_TERMS). */
export const MAX_TERMS = 30;

// --- exact coefficients ------------------------------------------------------------------

type Frac = readonly [bigint, bigint];

const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};
const frac = (n: bigint, d: bigint): Frac => {
  if (d < 0n) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1n;
  return [n / g, d / g];
};
const fmul = (a: Frac, b: Frac): Frac => frac(a[0] * b[0], a[1] * b[1]);
const fadd = (a: Frac, b: Frac): Frac => frac(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);

/** |E_0|, |E_2|, … (1, 1, 5, 61, 1385, …): the secant numbers, from the zigzag (boustrophedon) triangle. */
function secantNumbers(count: number): bigint[] {
  let row = [1n];
  const zigzag = [1n];
  for (let n = 1; n <= 2 * count; n++) {
    const next = [0n];
    for (let i = row.length - 1; i >= 0; i--) next.push(next[next.length - 1]! + row[i]!);
    row = next;
    zigzag.push(row[row.length - 1]!);
  }
  return Array.from({ length: count + 1 }, (_, s) => zigzag[2 * s]!);
}

/**
 * c(k, m) by derivative order m, so that C_k = Σ_m c(k, m) π^{−(k+m)/2} Φ^{(m)}. For m ≥ 1,
 *   c(k, m) = −(m+1)/2 · c(k−1, m+1) − c(k−1, m−3) / (32 m).
 * The m = 0 coefficients are the free constants of that recurrence. They are the ν^k coefficients of
 * exp(Σ_s |E_{2s}| ν^{4s} / (s 2^{4s+3})), E_{2s} the Euler numbers (1/128 at k = 4, 5/4096 +
 * 1/(2·128²) at k = 8, …): a rule found in the fits, and held by them through k = 21.
 */
const coefficients: Map<number, Frac>[] = (() => {
  const secant = secantNumbers(Math.floor(MAX_TERMS / 4));
  // k h_k = Σ_j j σ_j h_{k−j}, σ_{4s} = |E_{2s}| / (s 2^{4s+3})
  const h: Frac[] = [frac(1n, 1n)];
  for (let k = 1; k <= MAX_TERMS; k++) {
    let sum: Frac = frac(0n, 1n);
    for (let j = 4; j <= k; j += 4) {
      const sigma = frac(secant[j / 4]!, BigInt(j / 4) * 2n ** BigInt(j + 3));
      sum = fadd(sum, fmul(frac(BigInt(j), 1n), fmul(sigma, h[k - j]!)));
    }
    h.push(fmul(sum, frac(1n, BigInt(k))));
  }
  const c: Map<number, Frac>[] = [new Map([[0, frac(1n, 1n)]])];
  for (let k = 1; k <= MAX_TERMS; k++) {
    const row = new Map<number, Frac>();
    const prev = c[k - 1]!;
    for (let m = 1; m <= 3 * k; m++) {
      let value: Frac = frac(0n, 1n);
      const up = prev.get(m + 1);
      if (up !== undefined) value = fadd(value, fmul(frac(-BigInt(m + 1), 2n), up));
      const down = prev.get(m - 3);
      if (down !== undefined) value = fadd(value, fmul(frac(-1n, 32n * BigInt(m)), down));
      if (value[0] !== 0n) row.set(m, value);
    }
    if (h[k]![0] !== 0n) row.set(0, h[k]!);
    c.push(row);
  }
  return c;
})();

/** The coefficients c(k, m) of C_k, as [m, rational] (read by the tests). */
export const remainderCoefficients = (k: number): ReadonlyArray<readonly [number, Frac]> => [
  ...coefficients[k]!.entries(),
];

/** c(k, m) π^{−(k+m)/2} to the caller's precision, held at the most digits any call has wanted. */
let scaledCache: { digits: number; table: ReadonlyArray<ReadonlyArray<readonly [number, BigDecimal]>> } = {
  digits: 0,
  table: [],
};

function scaledCoefficients(): ReadonlyArray<ReadonlyArray<readonly [number, BigDecimal]>> {
  const digits = BigDecimal.precision;
  if (scaledCache.digits >= digits) return scaledCache.table;
  const dig = Math.max(digits, 40);
  const table = withPrecision(dig, () => {
    // (k+m)/4 is a whole number for every m with c(k, m) ≠ 0
    const u = BigDecimal.ONE.div(BigDecimal.PI.mul(BigDecimal.PI));
    const powers = [BigDecimal.ONE];
    for (let i = 1; i <= MAX_TERMS; i++) powers.push(bigRound(powers[i - 1]!.mul(u)));
    return coefficients.map((row, k) =>
      [...row].map(
        ([m, [num, den]]) =>
          [m, bigRound(new BigDecimal(num).div(new BigDecimal(den)).mul(powers[(k + m) / 4]!))] as const,
      ),
    );
  });
  scaledCache = { digits: dig, table };
  return table;
}

function withPrecision<T>(digits: number, fn: () => T): T {
  const saved = BigDecimal.precision;
  BigDecimal.precision = digits;
  try {
    return fn();
  } finally {
    BigDecimal.precision = saved;
  }
}

// --- Φ's derivatives -----------------------------------------------------------------------
//
// Fixed point in BigInt (x·2^bits), not BigDecimal: the Taylor coefficients of Φ about 0 come
// from a series division and fall like (34/k)^{k/2} while Φ^{(k)}(0) = k! times them rises, so
// every step wants an absolute precision a hundred or more digits past the answer, which is
// cheap in integers and costs a rounding of BigDecimal's per operation.

/** x·2^bits, rounded, for a BigDecimal x. */
function toFixed(x: BigDecimal, bits: number): bigint {
  // precision enough to hold the product's integer part exactly
  return withPrecision(Math.ceil(bits / BITS_PER_DIGIT) + 30, () =>
    x
      .mul(new BigDecimal(1n << BigInt(bits)))
      .round()
      .toBigInt(),
  );
}

const BITS_PER_DIGIT = Math.log2(10);

/** Φ^{(j)}(0)·2^bits for j < values.length. */
let phiCache: { bits: number; values: bigint[] } = { bits: 0, values: [] };

function phiAtZero(count: number, bits: number): { bits: number; values: bigint[] } {
  if (phiCache.bits >= bits && phiCache.values.length >= count) return phiCache;
  // headroom, so a call a little larger doesn't redo the table
  const n = Math.max(count, Math.ceil(1.5 * phiCache.values.length), 64);
  const B = Math.max(bits, phiCache.bits);
  const one = 1n << BigInt(B);
  const [pi, c8, s8] = withPrecision(Math.ceil(B / BITS_PER_DIGIT) + 20, () => {
    const eighth = BigDecimal.PI.div(8);
    return [toFixed(BigDecimal.PI, B), toFixed(eighth.cos(), B), toFixed(eighth.sin(), B)] as const;
  });
  // e^{iδ}, δ = 2π(h² − h): (k) e_k = i(−2π e_{k−1} + 4π e_{k−2})
  const re: bigint[] = [one];
  const im: bigint[] = [0n];
  for (let k = 1; k < n; k++) {
    const [r1, i1] = [re[k - 1]!, im[k - 1]!];
    const [r2, i2] = k >= 2 ? [re[k - 2]!, im[k - 2]!] : [0n, 0n];
    const divisor = BigInt(k) << BigInt(B);
    re.push((pi * (2n * i1 - 4n * i2)) / divisor);
    im.push((pi * (4n * r2 - 2n * r1)) / divisor);
  }
  // cos(2πh) = Σ (−1)^j (2π)^{2j} h^{2j} / (2j)!
  const sq = (4n * pi * pi) >> BigInt(B);
  const den: bigint[] = [one];
  for (let j = 1; 2 * j < n; j++) den.push(-((den[j - 1]! * sq) >> BigInt(B)) / BigInt((2 * j - 1) * (2 * j)));
  const q: bigint[] = [];
  const values: bigint[] = [];
  let factorial = 1n;
  for (let k = 0; k < n; k++) {
    let cancel = 0n;
    for (let j = 1; 2 * j <= k; j++) cancel += den[j]! * q[k - 2 * j]!;
    q.push((c8 * re[k]! + s8 * im[k]! - cancel) >> BigInt(B));
    if (k > 0) factorial *= BigInt(k);
    values.push(q[k]! * factorial);
  }
  phiCache = { bits: B, values };
  return phiCache;
}

/**
 * Φ^{(m)}(z) for 0 ≤ m ≤ top, z = h or 1 − h with Re h ∈ [0, ½] (Φ(1 − z) = Φ(z), so
 * odd derivatives change sign across the reflection). The Taylor series about 0 of the
 * m-th derivative, Σ_k Φ^{(m+k)}(0) h^k / k!, converges like (4πe h²/k)^{k/2}.
 */
function phiDerivatives(p: BigCx, top: number): BigCx[] {
  const reflect = p.re.gt(0.5);
  const h: BigCx = reflect ? { re: BigDecimal.ONE.sub(p.re), im: p.im.neg() } : p;
  const digits = BigDecimal.precision;
  const mag = Math.hypot(h.re.toNumber(), h.im.toNumber());
  // terms past k ≈ j where (34 mag² / j)^{j/2} < 10^−digits
  let length = 8;
  while (length < 2000 && (length / 2) * Math.log10(length / (34 * mag * mag + 1e-300)) < digits + 4) length += 2;
  const n = top + length;
  // Φ^{(n)}(0) is ~(n/2)! (4π)^{n/2}, and the series' terms are not to be swamped by their own rounding
  const { bits, values } = phiAtZero(n, Math.ceil(digits * BITS_PER_DIGIT) + 8 * n + 64);
  const B = BigInt(bits);
  const [hr, hi] = [toFixed(h.re, bits), toFixed(h.im, bits)];
  const hp: Array<readonly [bigint, bigint]> = [[1n << B, 0n]];
  for (let k = 1; k < length; k++) {
    const [r, i] = hp[k - 1]!;
    hp.push([((r * hr - i * hi) >> B) / BigInt(k), ((r * hi + i * hr) >> B) / BigInt(k)]);
  }
  const scale = new BigDecimal(1n << (2n * B));
  const out: BigCx[] = [];
  for (let m = 0; m <= top; m++) {
    let re = 0n;
    let im = 0n;
    for (let k = 0; k < length; k++) {
      re += values[m + k]! * hp[k]![0];
      im += values[m + k]! * hp[k]![1];
    }
    const sign = reflect && m % 2 === 1;
    const [a, b] = [new BigDecimal(re).div(scale), new BigDecimal(im).div(scale)];
    out.push({ re: sign ? a.neg() : a, im: sign ? b.neg() : b });
  }
  return out;
}

// --- the pieces of Z -----------------------------------------------------------------------

/** √z for Re z > 0, at the working precision. */
function csqrt(z: BigCx): BigCx {
  const r = z.re.mul(z.re).add(z.im.mul(z.im)).sqrt();
  const u = r.add(z.re).div(2).sqrt();
  return { re: u, im: z.im.div(u.mul(2)) };
}

const cmul = (a: BigCx, b: BigCx): BigCx => ({
  re: bigRound(a.re.mul(b.re).sub(a.im.mul(b.im))),
  im: bigRound(a.re.mul(b.im).add(a.im.mul(b.re))),
});

const cinv = (a: BigCx): BigCx => {
  const d = a.re.mul(a.re).add(a.im.mul(a.im));
  return { re: a.re.div(d), im: a.im.neg().div(d) };
};

function clog(z: BigCx): BigCx {
  return { re: z.re.mul(z.re).add(z.im.mul(z.im)).ln().div(2), im: BigDecimal.atan2(z.im, z.re) };
}

/**
 * ϑ(t) for Re t large: (t/2) ln(t/2π) − t/2 − π/8 + Σ_k (−1)^{k−1} (1 − 2^{1−2k}) B_{2k} / (4k(2k−1) t^{2k−1}),
 * the Stirling series of the log-gamma pair behind it (1/48t + 7/5760t³ + 31/80640t⁵ + …).
 */
function theta(t: BigCx): BigCx {
  const pi = BigDecimal.PI;
  const lg = clog({ re: t.re.div(pi.mul(2)), im: t.im.div(pi.mul(2)) });
  const half: BigCx = { re: t.re.div(2), im: t.im.div(2) };
  const lead = cmul(half, lg);
  let re = lead.re.sub(half.re).sub(pi.div(8));
  let im = lead.im.sub(half.im);
  const inv = cinv(t);
  const inv2 = cmul(inv, inv);
  let power = inv;
  const tol = new BigDecimal(10).pow(-(BigDecimal.precision + 2));
  for (let k = 1; k < 2000; k++) {
    const [bn, bd] = bernoulliRational(2 * k);
    const sign = k % 2 === 1 ? 1n : -1n;
    const c = new BigDecimal(sign * bn * (2n ** BigInt(2 * k) - 2n)).div(
      new BigDecimal(bd * 2n ** BigInt(2 * k) * BigInt(4 * k * (2 * k - 1))),
    );
    const [tr, ti] = [c.mul(power.re), c.mul(power.im)];
    re = re.add(tr);
    im = im.add(ti);
    if (tr.abs().lt(tol) && ti.abs().lt(tol)) break;
    power = cmul(power, inv2);
  }
  return { re: bigRound(re), im: bigRound(im) };
}

/** ln n for n ≤ count, summing prime logs. */
function logs(count: number): BigDecimal[] {
  const out: BigDecimal[] = [BigDecimal.ZERO, BigDecimal.ZERO];
  const smallest = new Int32Array(count + 1);
  for (let n = 2; n <= count; n++) {
    if (smallest[n] === 0) {
      for (let m = n; m <= count; m += n) if (smallest[m] === 0) smallest[m] = n;
    }
  }
  for (let n = 2; n <= count; n++) {
    const p = smallest[n]!;
    out[n] = p === n ? new BigDecimal(n).ln() : out[p]!.add(out[n / p]!);
  }
  return out;
}

/** 2 Σ_{n ≤ N} n^{-1/2} cos(ϑ − t ln n). */
function mainSum(t: BigCx, th: BigCx, N: number): BigCx {
  const ln = logs(N);
  let re = BigDecimal.ZERO;
  let im = BigDecimal.ZERO;
  for (let n = 1; n <= N; n++) {
    const alpha = th.re.sub(t.re.mul(ln[n]!));
    const beta = th.im.sub(t.im.mul(ln[n]!));
    const w = new BigDecimal(n).sqrt().inv();
    // cos(α + iβ) = cos α cosh β − i sin α sinh β
    const grow = beta.exp();
    const shrink = grow.inv();
    const cosh = grow.add(shrink).div(2);
    const sinh = grow.sub(shrink).div(2);
    re = re.add(w.mul(alpha.cos()).mul(cosh));
    im = im.sub(w.mul(alpha.sin()).mul(sinh));
  }
  return { re: bigRound(re.mul(2)), im: bigRound(im.mul(2)) };
}

/** (2π/t)^{1/4} Σ_{k ≤ terms} ν^k C_k(p), ν = (2π/t)^{1/2} = 1/a. */
function remainder(p: BigCx, a: BigCx, terms: number): BigCx {
  // C_k sums terms of both signs; the larger k are the more cancelling, a digit per couple of orders.
  return withPrecision(BigDecimal.precision + 4 + Math.ceil(terms / 2), () => {
    const nu = cinv(a);
    const phi = phiDerivatives(p, 3 * terms);
    const table = scaledCoefficients();
    let sum: BigCx = bigCx(0);
    let nuK: BigCx = bigCx(1);
    for (let k = 0; k <= terms; k++) {
      let re = BigDecimal.ZERO;
      let im = BigDecimal.ZERO;
      for (const [m, scale] of table[k]!) {
        re = re.add(scale.mul(phi[m]!.re));
        im = im.add(scale.mul(phi[m]!.im));
      }
      const term = cmul(nuK, { re, im });
      sum = { re: sum.re.add(term.re), im: sum.im.add(term.im) };
      nuK = cmul(nuK, nu);
    }
    return cmul(csqrt(nu), sum);
  });
}

/**
 * sup |C_k(p)| over p in [0, 1] + i[−0.1, 0.1], taken over 42 sample points at 500 digits and rounded
 * up by a factor of 3 or more, for k = 0..MAX_TERMS + 1. They shrink slowly, so the first term dropped
 * sizes the truncation; checked against mpmath's Z, which it has stayed under by a factor of 10 or more.
 */
const TERM_BOUND = [
  3, 0.2, 0.02, 0.002, 0.002, 4e-4, 2e-4, 6e-5, 1e-5, 1e-5, 2e-6, 3e-6, 1e-6, 1e-6, 4e-7, 3e-7, 2e-7, 1e-7, 6e-8, 3e-8,
  3e-8, 1e-8, 1e-8, 1e-8, 1e-8, 1e-8, 1e-8, 1e-8, 1e-8, 1e-8, 1e-8, 1e-8,
];

/** Absolute truncation error of Z after the terms C_0..C_K at ν = |2π/t|^{1/2}. */
export function truncationError(modulus: number, terms: number): number {
  const nu = Math.sqrt((2 * Math.PI) / modulus);
  return 2 * Math.sqrt(nu) * TERM_BOUND[terms + 1]! * nu ** (terms + 1);
}

/** Whether the terms in hand bring the truncation error of Z at Re t = `modulus` under 10^−accuracy. */
export const reaches = (modulus: number, accuracy: number): boolean =>
  modulus >= SMALLEST_ARGUMENT && truncationError(modulus, MAX_TERMS) <= 10 ** -accuracy;

/** Largest |Im t| in proportion to √|Re t|: it keeps |Im p| ≤ 0.1, where TERM_BOUND holds. */
const MAX_IMAGINARY = 0.5;

/** The main sum is √(t/2π) terms, ~0.7 s at 10¹⁰; past this the formula declines. */
export const LARGEST_ARGUMENT = 1e10;

/** Below this ν = (2π/t)^{1/2} is past 0.25 and the series is no longer one to truncate by its first omitted term. */
const SMALLEST_ARGUMENT = 100;

export interface Asymptotic {
  value: BigCx;
  /** An estimate of the absolute error of the truncated series. */
  error: number;
}

/**
 * Z(x + iy) at the caller's working precision, by the Riemann–Siegel formula with as many remainder
 * terms as give an absolute truncation error of 10^−accuracy. Undefined when t is too small for
 * that, or |y| too large for the continuation to hold.
 */
export function riemannSiegelZAsymptotic(x: BigDecimal, y: BigDecimal, accuracy: number): Asymptotic | undefined {
  if (x.isNegative()) return riemannSiegelZAsymptotic(x.neg(), y.neg(), accuracy); // Z is even
  const xn = x.toNumber();
  const yn = y.toNumber();
  if (!(xn >= SMALLEST_ARGUMENT) || xn > LARGEST_ARGUMENT || Math.abs(yn) > MAX_IMAGINARY * Math.sqrt(xn))
    return undefined;
  let terms = 0;
  while (terms <= MAX_TERMS && truncationError(xn, terms) > 10 ** -accuracy) terms++;
  if (terms > MAX_TERMS) return undefined;
  const t: BigCx = { re: x, im: y };
  const twoPi = BigDecimal.PI.mul(2);
  const a = csqrt({ re: x.div(twoPi), im: y.div(twoPi) });
  const N = Math.floor(a.re.toNumber());
  const main = mainSum(t, theta(t), N);
  const rem = remainder({ re: a.re.sub(N), im: a.im }, a, terms);
  const sign = N % 2 === 1; // (−1)^{N−1}
  return {
    value: {
      re: bigRound(sign ? main.re.add(rem.re) : main.re.sub(rem.re)),
      im: bigRound(sign ? main.im.add(rem.im) : main.im.sub(rem.im)),
    },
    error: truncationError(xn, terms),
  };
}

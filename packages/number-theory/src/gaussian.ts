// The Gaussian integers ℤ[i], with Wolfram's conventions, over bigints.
//
// ℤ[i] is a Euclidean domain under the norm N(a + bi) = a² + b², with division by rounding:
// the quotient of z by m is z/m rounded to the nearest lattice point. Wolfram rounds each part
// half to EVEN, so `Quotient[5 + 5I, 2] = 2 + 2I` and `Mod[z, m] = z − m·Quotient[z, m]` —
// a representative in the box around 0, not in [0, m) as for integers.
//
// Everything canonical — a gcd, a prime, a divisor — is the associate in the first quadrant:
// Re > 0 and Im ≥ 0. There is exactly one among the four z, iz, −z, −iz for z ≠ 0.

import { factorInteger, isPrime } from "./primes.ts";
import { powerModRoots } from "./roots.ts";

export type Gaussian = readonly [re: bigint, im: bigint];

export const ZERO: Gaussian = [0n, 0n];
export const ONE: Gaussian = [1n, 0n];
export const I: Gaussian = [0n, 1n];
export const UNITS: readonly Gaussian[] = [ONE, I, [-1n, 0n], [0n, -1n]];

export const add = (a: Gaussian, b: Gaussian): Gaussian => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Gaussian, b: Gaussian): Gaussian => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: Gaussian, b: Gaussian): Gaussian => [
  a[0] * b[0] - a[1] * b[1],
  a[0] * b[1] + a[1] * b[0],
];
export const conj = (a: Gaussian): Gaussian => [a[0], -a[1]];
export const norm = (a: Gaussian): bigint => a[0] * a[0] + a[1] * a[1];
export const equal = (a: Gaussian, b: Gaussian): boolean => a[0] === b[0] && a[1] === b[1];
export const isZero = (a: Gaussian): boolean => a[0] === 0n && a[1] === 0n;
export const isUnit = (a: Gaussian): boolean => norm(a) === 1n;
export const isReal = (a: Gaussian): boolean => a[1] === 0n;

/** Wolfram's order on complex numbers: by real part, then imaginary. */
export const compare = (a: Gaussian, b: Gaussian): number =>
  a[0] !== b[0] ? (a[0] < b[0] ? -1 : 1) : a[1] !== b[1] ? (a[1] < b[1] ? -1 : 1) : 0;

/** num/den rounded to the nearest integer, ties to even; den > 0. */
function roundHalfEven(num: bigint, den: bigint): bigint {
  let q = num / den;
  let r = num - q * den;
  if (r < 0n) {
    q -= 1n;
    r += den;
  }
  const twice = 2n * r;
  if (twice > den || (twice === den && q % 2n !== 0n)) q += 1n;
  return q;
}

/** Exact z/m, or undefined when m does not divide z. */
export function divideExact(z: Gaussian, m: Gaussian): Gaussian | undefined {
  const n = norm(m);
  if (n === 0n) return undefined;
  const [re, im] = mul(z, conj(m));
  return re % n === 0n && im % n === 0n ? [re / n, im / n] : undefined;
}

/** Wolfram's `Quotient[z, m]`: z/m rounded half-even in each part. */
export function quotient(z: Gaussian, m: Gaussian): Gaussian | undefined {
  const n = norm(m);
  if (n === 0n) return undefined;
  const [re, im] = mul(z, conj(m));
  return [roundHalfEven(re, n), roundHalfEven(im, n)];
}

/** Wolfram's `Mod[z, m]`: z − m·Quotient[z, m], the remainder in the box around 0. */
export function mod(z: Gaussian, m: Gaussian): Gaussian | undefined {
  const q = quotient(z, m);
  return q === undefined ? undefined : sub(z, mul(m, q));
}

/** The first-quadrant associate of z, and the unit u with z·u equal to it. */
export function normalize(z: Gaussian): [Gaussian, Gaussian] {
  if (isZero(z)) return [ZERO, ONE];
  for (const u of UNITS) {
    const w = mul(z, u);
    if (w[0] > 0n && w[1] >= 0n) return [w, u];
  }
  return [z, ONE]; // unreachable
}

export const gcd = (a: Gaussian, b: Gaussian): Gaussian => {
  let [x, y] = [a, b];
  while (!isZero(y)) [x, y] = [y, mod(x, y)!];
  return normalize(x)[0];
};

export function lcm(a: Gaussian, b: Gaussian): Gaussian {
  if (isZero(a) || isZero(b)) return ZERO;
  return normalize(divideExact(mul(a, b), gcd(a, b))!)[0];
}

/**
 * Wolfram's `ExtendedGCD[a, b]` over ℤ[i]: [g, s, t] with s·a + t·b = g, g normalised. The
 * coefficients are not unique, so the algorithm is Wolfram's: Euclid with the rounded quotient,
 * run from the argument of larger norm, and the unit that normalises g applied to s and t too.
 */
export function extendedGcd(a: Gaussian, b: Gaussian): [Gaussian, Gaussian, Gaussian] {
  const swap = norm(a) < norm(b);
  let [r0, r1] = swap ? [b, a] : [a, b];
  let [s0, s1]: [Gaussian, Gaussian] = [ONE, ZERO];
  let [t0, t1]: [Gaussian, Gaussian] = [ZERO, ONE];
  while (!isZero(r1)) {
    const q = quotient(r0, r1)!;
    [r0, r1] = [r1, sub(r0, mul(q, r1))];
    [s0, s1] = [s1, sub(s0, mul(q, s1))];
    [t0, t1] = [t1, sub(t0, mul(q, t1))];
  }
  const [g, u] = normalize(r0);
  const [s, t] = [mul(s0, u), mul(t0, u)];
  return swap ? [g, t, s] : [g, s, t];
}

/**
 * Wolfram's `ModularInverse[a, m]` over ℤ[i]; undefined when a is not a unit mod m. Wolfram
 * reduces the answer differently from `Mod`: for a positive rational-integer m, each part into
 * [0, m); otherwise into the box around 0.
 */
export function inverseMod(a: Gaussian, m: Gaussian): Gaussian | undefined {
  if (isZero(m)) return undefined;
  const [g, s] = extendedGcd(a, m);
  if (!equal(g, ONE)) return undefined;
  if (!isReal(m) || m[0] < 0n) return mod(s, m);
  const part = (x: bigint): bigint => ((x % m[0]) + m[0]) % m[0];
  return [part(s[0]), part(s[1])];
}

/** zᵉ mod m, e ≥ 0, by repeated squaring, each step reduced as `mod` reduces. */
export function powerModRaw(z: Gaussian, e: bigint, m: Gaussian): Gaussian {
  let result = mod(ONE, m)!;
  let base = mod(z, m)!;
  for (let k = e; k > 0n; k >>= 1n) {
    if (k & 1n) result = mod(mul(result, base), m)!;
    base = mod(mul(base, base), m)!;
  }
  return result;
}

/**
 * Wolfram's `PowerMod[z, e, m]` over ℤ[i]; a negative e inverts first. As in Wolfram, a
 * rational-integer modulus must be positive, and a result that comes out real is then reported
 * in [0, m) like an integer's.
 */
export function powerMod(z: Gaussian, e: bigint, m: Gaussian): Gaussian | undefined {
  if (isZero(m) || (isReal(m) && m[0] < 0n)) return undefined;
  const base = e < 0n ? inverseMod(z, m) : z;
  if (base === undefined) return undefined;
  const result = powerModRaw(base, e < 0n ? -e : e, m);
  return isReal(m) && isReal(result) ? [((result[0] % m[0]) + m[0]) % m[0], 0n] : result;
}

/**
 * Whether z is a Gaussian prime: a rational prime ≡ 3 (mod 4) or its associate, or an element
 * whose norm is a rational prime (1 + i above 2, and the split primes above p ≡ 1 (mod 4)).
 */
export function isGaussianPrime(z: Gaussian): boolean {
  if (z[0] === 0n || z[1] === 0n) {
    const n = z[0] === 0n ? (z[1] < 0n ? -z[1] : z[1]) : z[0] < 0n ? -z[0] : z[0];
    return n % 4n === 3n && isPrime(n);
  }
  return isPrime(norm(z));
}

/** The first-quadrant prime above p ≡ 1 (mod 4): gcd(p, t + i) for t² ≡ −1. */
function splitPrime(p: bigint): Gaussian {
  const [t] = powerModRoots(p - 1n, 2n, p)!;
  return gcd([p, 0n], [t!, 1n]);
}

/**
 * Wolfram's `FactorInteger[z, GaussianIntegers -> True]`: first-quadrant primes with their
 * exponents, sorted by real part then imaginary, preceded by the unit when it is not 1.
 * Undefined when the norm cannot be factored within budget.
 */
export function factorGaussian(z: Gaussian): [Gaussian, number][] | undefined {
  if (isZero(z)) return undefined;
  if (isUnit(z)) return [[z, 1]];
  const normFactors = factorInteger(norm(z));
  if (normFactors === undefined) return undefined;
  const primes: [Gaussian, number][] = [];
  let rest = z;
  const strip = (pi: Gaussian): number => {
    let e = 0;
    for (let q = divideExact(rest, pi); q !== undefined; q = divideExact(rest, pi)) {
      rest = q;
      e++;
    }
    return e;
  };
  for (const [p] of normFactors) {
    const candidates: Gaussian[] =
      p === 2n
        ? [[1n, 1n]]
        : p % 4n === 3n
          ? [[p, 0n]]
          : (() => {
              const pi = splitPrime(p);
              return [pi, normalize(conj(pi))[0]];
            })();
    for (const pi of candidates) {
      const e = strip(pi);
      if (e > 0) primes.push([pi, e]);
    }
  }
  primes.sort(([a], [b]) => compare(a, b));
  return equal(rest, ONE) ? primes : [[rest, 1], ...primes];
}

/** Wolfram's `Divisors[z, GaussianIntegers -> True]`: first-quadrant divisors, sorted. */
export function divisorsGaussian(z: Gaussian): Gaussian[] | undefined {
  const factors = factorGaussian(z);
  if (factors === undefined) return undefined;
  let divisors: Gaussian[] = [ONE];
  for (const [pi, e] of factors) {
    if (isUnit(pi)) continue;
    const next: Gaussian[] = [];
    for (const d of divisors) {
      let power = d;
      for (let k = 0; k <= e; k++, power = mul(power, pi)) next.push(power);
    }
    divisors = next;
  }
  return divisors.map((d) => normalize(d)[0]).sort(compare);
}

import { gcd } from "@enumeratio/number-theory";

// Exact rationals over bigints: [numerator, denominator], denominator positive, reduced.

export type Q = readonly [bigint, bigint];

export const ZERO: Q = [0n, 1n];
export const ONE: Q = [1n, 1n];

export function q(num: bigint, den = 1n): Q {
  if (den === 0n) throw new RangeError("zero denominator");
  if (den < 0n) [num, den] = [-num, -den];
  const g = gcd(num, den);
  return g === 1n ? [num, den] : [num / g, den / g];
}

export const isZero = (x: Q): boolean => x[0] === 0n;
export const isInteger = (x: Q): boolean => x[1] === 1n;
export const sign = (x: Q): number => (x[0] > 0n ? 1 : x[0] < 0n ? -1 : 0);
export const abs = (x: Q): Q => (x[0] < 0n ? [-x[0], x[1]] : x);
export const neg = (x: Q): Q => [-x[0], x[1]];
export const equal = (x: Q, y: Q): boolean => x[0] === y[0] && x[1] === y[1];

export const add = (x: Q, y: Q): Q => q(x[0] * y[1] + y[0] * x[1], x[1] * y[1]);
export const sub = (x: Q, y: Q): Q => add(x, neg(y));
export const mul = (x: Q, y: Q): Q => q(x[0] * y[0], x[1] * y[1]);
export const div = (x: Q, y: Q): Q => q(x[0] * y[1], x[1] * y[0]);

/** ⌊x⌋. */
export function floor(x: Q): bigint {
  const [n, d] = x;
  const t = n / d;
  return n % d !== 0n && n < 0n ? t - 1n : t;
}

/** The generator of the fractional ideal xℤ + yℤ: gcd(a/b, c/d) = gcd(ad, cb)/(bd). */
export const gcdQ = (x: Q, y: Q): Q => q(gcd(x[0] * y[1], y[0] * x[1]), x[1] * y[1]);

export const lcm = (a: bigint, b: bigint): bigint =>
  a === 0n || b === 0n ? 0n : (a / gcd(a, b)) * b;

/** The exponent of the prime p in x (x ≠ 0). */
export function valuationQ(x: Q, p: bigint): number {
  let v = 0;
  let [n, d] = x;
  while (n % p === 0n) [n, v] = [n / p, v + 1];
  while (d % p === 0n) [d, v] = [d / p, v - 1];
  return v;
}

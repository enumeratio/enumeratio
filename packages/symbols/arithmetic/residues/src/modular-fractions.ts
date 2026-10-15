// Rational functions in several variables over a field (ℚ, or ℤ/p for a prime p) in lowest
// terms: the kernel under `Numerator(expr, Over -> QuotientRing(Integers, p))`. Pure bigint
// arithmetic; the boxed-expression side is in numerator-declare.ts.
//
// A polynomial is a map from a monomial (its exponents over a fixed variable list, comma-joined)
// to a nonzero coefficient. Variable 0 is the most significant in the lexicographic order.

import { gcd as integerGcd, invMod, mod } from "./arith.ts";

export interface Field<T> {
  readonly zero: T;
  readonly one: T;
  isZero(a: T): boolean;
  add(a: T, b: T): T;
  negate(a: T): T;
  multiply(a: T, b: T): T;
  /** a⁻¹, for a ≠ 0. */
  inverse(a: T): T;
}

/** A rational number, `[numerator, denominator]`, in lowest terms with denominator > 0. */
export type Rational = readonly [bigint, bigint];

export const rational = (n: bigint, d: bigint): Rational => {
  const g = integerGcd(n < 0n ? -n : n, d < 0n ? -d : d);
  if (g === 0n) return [0n, 1n];
  return d < 0n ? [-n / g, -d / g] : [n / g, d / g];
};

export const rationals: Field<Rational> = {
  zero: [0n, 1n],
  one: [1n, 1n],
  isZero: (a) => a[0] === 0n,
  add: (a, b) => rational(a[0] * b[1] + b[0] * a[1], a[1] * b[1]),
  negate: (a) => [-a[0], a[1]],
  multiply: (a, b) => rational(a[0] * b[0], a[1] * b[1]),
  inverse: (a) => rational(a[1], a[0]),
};

/** ℤ/p, p prime, as residues in [0, p). */
export const integersModulo = (p: bigint): Field<bigint> => ({
  zero: 0n,
  one: 1n,
  isZero: (a) => a === 0n,
  add: (a, b) => mod(a + b, p),
  negate: (a) => mod(-a, p),
  multiply: (a, b) => mod(a * b, p),
  inverse: (a) => invMod(a, p)!,
});

export type Poly<T> = Map<string, T>;

export const monomialKey = (exponents: readonly number[]): string => exponents.join(",");
export const exponentsOf = (monomial: string): number[] => monomial.split(",").map(Number);

export const constant = <T>(F: Field<T>, c: T, n: number): Poly<T> =>
  F.isZero(c) ? new Map() : new Map([[monomialKey(Array.from({ length: n }, () => 0)), c]]);

export const isZero = <T>(a: Poly<T>): boolean => a.size === 0;

const lexCompare = (a: readonly number[], b: readonly number[]): number => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return 0;
};

/** The lexicographically largest monomial and its coefficient. */
export function leading<T>(a: Poly<T>): [number[], T] {
  let best: number[] | undefined;
  let coefficient: T | undefined;
  for (const [m, c] of a) {
    const e = exponentsOf(m);
    if (best === undefined || lexCompare(e, best) > 0) [best, coefficient] = [e, c];
  }
  return [best!, coefficient!];
}

export function add<T>(F: Field<T>, a: Poly<T>, b: Poly<T>): Poly<T> {
  const sum = new Map(a);
  for (const [m, c] of b) {
    const value = F.add(sum.get(m) ?? F.zero, c);
    if (F.isZero(value)) sum.delete(m);
    else sum.set(m, value);
  }
  return sum;
}

export const negate = <T>(F: Field<T>, a: Poly<T>): Poly<T> => new Map([...a].map(([m, c]) => [m, F.negate(c)]));

export const subtract = <T>(F: Field<T>, a: Poly<T>, b: Poly<T>): Poly<T> => add(F, a, negate(F, b));

export function multiply<T>(F: Field<T>, a: Poly<T>, b: Poly<T>): Poly<T> {
  const product: Poly<T> = new Map();
  for (const [ma, ca] of a) {
    const ea = exponentsOf(ma);
    for (const [mb, cb] of b) {
      const m = monomialKey(exponentsOf(mb).map((e, i) => e + ea[i]!));
      const value = F.add(product.get(m) ?? F.zero, F.multiply(ca, cb));
      if (F.isZero(value)) product.delete(m);
      else product.set(m, value);
    }
  }
  return product;
}

/** Every coefficient times `c`. */
export const scale = <T>(F: Field<T>, a: Poly<T>, c: T): Poly<T> => {
  const out: Poly<T> = new Map();
  for (const [m, x] of a) {
    const value = F.multiply(x, c);
    if (!F.isZero(value)) out.set(m, value);
  }
  return out;
};

/** a / b when b divides a, else `undefined`. */
export function divideExactly<T>(F: Field<T>, a: Poly<T>, b: Poly<T>): Poly<T> | undefined {
  const [leadB, coefficientB] = leading(b);
  const unit = F.inverse(coefficientB);
  const quotient: Poly<T> = new Map();
  let remainder = a;
  while (!isZero(remainder)) {
    const [lead, coefficient] = leading(remainder);
    const shift = lead.map((e, i) => e - leadB[i]!);
    if (shift.some((e) => e < 0)) return undefined;
    const term: Poly<T> = new Map([[monomialKey(shift), F.multiply(coefficient, unit)]]);
    quotient.set(monomialKey(shift), term.get(monomialKey(shift))!);
    remainder = subtract(F, remainder, multiply(F, term, b));
  }
  return quotient;
}

/** The degree of `a` in variable `k`. */
const degree = <T>(a: Poly<T>, k: number): number => {
  let d = 0;
  for (const m of a.keys()) d = Math.max(d, exponentsOf(m)[k]!);
  return d;
};

/** The coefficient of x_k^d, a polynomial free of x_k. */
const coefficientAt = <T>(a: Poly<T>, k: number, d: number): Poly<T> => {
  const part: Poly<T> = new Map();
  for (const [m, c] of a) {
    const e = exponentsOf(m);
    if (e[k] === d) part.set(monomialKey(e.map((x, i) => (i === k ? 0 : x))), c);
  }
  return part;
};

const raise = <T>(a: Poly<T>, k: number, by: number): Poly<T> =>
  new Map([...a].map(([m, c]) => [monomialKey(exponentsOf(m).map((e, i) => (i === k ? e + by : e))), c]));

/** The greatest common divisor of `a` and `b` as polynomials in variables k.. (up to a unit). */
function gcdFrom<T>(F: Field<T>, a: Poly<T>, b: Poly<T>, k: number, n: number): Poly<T> {
  if (isZero(a)) return b;
  if (isZero(b)) return a;
  if (k === n) return constant(F, F.one, n);

  const content = (f: Poly<T>): Poly<T> => {
    let g: Poly<T> = new Map();
    for (let d = degree(f, k); d >= 0; d--) g = gcdFrom(F, g, coefficientAt(f, k, d), k + 1, n);
    return g;
  };
  const contentA = content(a);
  const contentB = content(b);
  const common = gcdFrom(F, contentA, contentB, k + 1, n);
  let [u, v] = [divideExactly(F, a, contentA)!, divideExactly(F, b, contentB)!];
  if (degree(u, k) < degree(v, k)) [u, v] = [v, u];
  // Euclid on the primitive parts, with pseudo-remainders (no division by a non-unit).
  while (!isZero(v)) {
    const dv = degree(v, k);
    const lead = coefficientAt(v, k, dv);
    let r = u;
    while (!isZero(r) && degree(r, k) >= dv) {
      const dr = degree(r, k);
      r = subtract(F, multiply(F, lead, r), multiply(F, coefficientAt(r, k, dr), raise(v, k, dr - dv)));
    }
    u = v;
    v = isZero(r) ? r : divideExactly(F, r, content(r))!;
  }
  return multiply(F, common, u);
}

/** The monic greatest common divisor of two nonzero polynomials in `n` variables. */
export function gcd<T>(F: Field<T>, a: Poly<T>, b: Poly<T>, n: number): Poly<T> {
  const g = gcdFrom(F, a, b, 0, n);
  return scale(F, g, F.inverse(leading(g)[1]));
}

/** A quotient of polynomials; `denominator` is never zero. */
export interface Fraction<T> {
  readonly numerator: Poly<T>;
  readonly denominator: Poly<T>;
}

/** `numerator / denominator` with the common factor (taken monic) divided out. */
export function lowestTerms<T>(F: Field<T>, numerator: Poly<T>, denominator: Poly<T>, n: number): Fraction<T> {
  if (isZero(numerator)) return { numerator, denominator: constant(F, F.one, n) };
  const g = gcd(F, numerator, denominator, n);
  return { numerator: divideExactly(F, numerator, g)!, denominator: divideExactly(F, denominator, g)! };
}

/** `a + b` of two fractions, in lowest terms. */
export function addFractions<T>(F: Field<T>, a: Fraction<T>, b: Fraction<T>, n: number): Fraction<T> {
  return lowestTerms(
    F,
    add(F, multiply(F, a.numerator, b.denominator), multiply(F, b.numerator, a.denominator)),
    multiply(F, a.denominator, b.denominator),
    n,
  );
}

/** `a * b` of two fractions, in lowest terms. */
export const multiplyFractions = <T>(F: Field<T>, a: Fraction<T>, b: Fraction<T>, n: number): Fraction<T> =>
  lowestTerms(F, multiply(F, a.numerator, b.numerator), multiply(F, a.denominator, b.denominator), n);

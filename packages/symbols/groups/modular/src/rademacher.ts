// Dedekind sums, the Rademacher function, and the linking number of a modular knot.
//
// This is the arithmetic half of the modular flow, and the reason the package is worth
// having. A hyperbolic class in PSL(2,Z) is a closed geodesic on the modular surface; the
// unit tangent bundle of that surface is the complement of the TREFOIL in the 3-sphere,
// so each closed geodesic is a knot sitting in that complement — a modular knot. Ghys's
// theorem says its linking number with the trefoil is the RADEMACHER SYMBOL of the class.
//
// The symbol has two completely different descriptions, and they agreeing is the whole
// test suite of this file:
//
//   combinatorial   Ψ = (number of R's) − (number of L's) in the class's LR word. Trivial
//                   to compute, obviously conjugation-invariant (rotating a word does not
//                   change its letter counts).
//   arithmetic      Ψ = Φ(M) − 3·sign(c(a+d)), where Φ is Rademacher's function, built out
//                   of DEDEKIND SUMS — the same s(h,k) that appear in the transformation
//                   law of the Dedekind eta function and in the exact formula for the
//                   partition numbers.
//
// Nothing about either description suggests the other. That they agree, on every matrix,
// is the content.

import { type Matrix, isModular, positiveWord, trace, type Word, wordToMatrix } from "./psl2z.ts";

/** An exact rational, as a reduced [numerator, denominator] with denominator > 0. */
export type Rational = readonly [number, number];

const greatestCommonDivisor = (a: number, b: number): number => {
  let [x, y] = [Math.abs(a), Math.abs(b)];
  while (y !== 0) [x, y] = [y, x % y];
  return x;
};

export function rational(numerator: number, denominator: number): Rational | undefined {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) return undefined;
  if (denominator === 0) return undefined;
  const sign = denominator < 0 ? -1 : 1;
  const divisor = greatestCommonDivisor(numerator, denominator) || 1;
  const reduced = (sign * numerator) / divisor;
  return [reduced === 0 ? 0 : reduced, (sign * denominator) / divisor]; // never a negative zero
}

/**
 * The Dedekind sum s(h, k) = Σ_{j=1}^{k−1} ((j/k))·((hj/k)), where ((x)) is the sawtooth
 * x − ⌊x⌋ − ½ (and 0 at integers), returned exactly.
 *
 * Everything is kept over the common denominator 4k² so the sum is integer arithmetic
 * throughout: ((j/k)) is (2j − k)/2k, and ((hj/k)) is (2r − k)/2k for r = hj mod k.
 */
export function dedekindSum(h: number, k: number): Rational | undefined {
  if (!Number.isSafeInteger(h) || !Number.isSafeInteger(k) || k <= 0) return undefined;
  if (greatestCommonDivisor(h, k) !== 1) return undefined;
  if (k > 100_000) return undefined;
  let total = 0;
  for (let j = 1; j < k; j++) {
    const r = (((h * j) % k) + k) % k;
    if (r === 0) continue;
    total += (2 * j - k) * (2 * r - k);
  }
  return rational(total, 4 * k * k);
}

/**
 * Rademacher's Φ function: Φ(M) = (a+d)/c − 12·sign(c)·s(d, |c|) for c ≠ 0, and b/d for
 * c = 0. It is integer-valued on SL(2,Z), and it is the term that makes log η transform
 * correctly under the modular group — it is NOT conjugation-invariant on its own.
 */
export function rademacherPhi(m: Matrix): number | undefined {
  if (!isModular(m)) return undefined;
  const [a, b, c, d] = m;
  if (c === 0) return b * d; // d = ±1 here, so b/d is b·d
  const magnitude = Math.abs(c);
  const sign = c < 0 ? -1 : 1;
  const sum = dedekindSum(d, magnitude);
  if (sum === undefined) return undefined;
  // Φ·(denominator) stays integral: (a+d)/c is σ(a+d)/|c|, and 12·s has denominator 4|c|².
  const [numerator, denominator] = sum;
  const scale = magnitude * denominator;
  const value = (sign * (a + d) * denominator - 12 * sign * numerator * magnitude) / scale;
  return Number.isSafeInteger(value) ? value : undefined;
}

/**
 * The Rademacher symbol Ψ(M) = Φ(M) − 3·sign(c(a+d)), defined for hyperbolic M. Unlike Φ
 * it IS a class function, and by Ghys's theorem it is the linking number of the modular
 * knot of M with the trefoil.
 */
export function rademacherSymbol(m: Matrix): number | undefined {
  if (!isModular(m) || Math.abs(trace(m)) <= 2) return undefined;
  const phi = rademacherPhi(m);
  if (phi === undefined) return undefined;
  const [a, , c, d] = m;
  return phi - 3 * Math.sign(c * (a + d));
}

/** The same symbol read straight off an LR word: the R's minus the L's. */
export function wordSymbol(word: Word): number | undefined {
  if (!/^[LR]*$/.test(word) || word.length === 0) return undefined;
  let total = 0;
  for (const letter of word) total += letter === "R" ? 1 : -1;
  return total;
}

/**
 * The linking number of a modular knot with the trefoil — the same number as the
 * Rademacher symbol, named for what it measures. Takes either the matrix or its word.
 */
export const linkingWithTrefoil = (m: Matrix): number | undefined => rademacherSymbol(m);

/**
 * The LR word length of a class, which is its period under the modular flow in the
 * symbolic sense: the number of times the geodesic crosses the fundamental domain.
 */
export const wordLength = (word: Word): number | undefined =>
  /^[LR]+$/.test(word) ? word.length : undefined;

/**
 * The trace of the matrix a positive word builds. For a hyperbolic class this determines
 * the LENGTH of the closed geodesic: ℓ = 2·arccosh(|trace|/2), so the trace is the
 * geometric weight that the word length only approximates.
 */
export function wordTrace(word: Word): number | undefined {
  const m = /^[LR]+$/.test(word) ? wordToMatrix(word) : undefined;
  return m === undefined ? undefined : trace(m);
}

/** Round-trip helper for tests and heads: a word's matrix, then back to the word. */
export const normaliseWord = (word: Word): Word | undefined => {
  const m = /^[LR]+$/.test(word) ? wordToMatrix(word) : undefined;
  return m === undefined ? undefined : positiveWord(m);
};

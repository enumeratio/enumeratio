// Braid groups, and the knots their closures make.
//
// B_n is Artin's group on generators σ₁ … σ_{n−1} — σ_i crosses strand i over strand i+1 —
// with exactly two families of relations:
//
//     σ_i σ_j = σ_j σ_i            for |i − j| ≥ 2   (far apart, so they do not interact)
//     σ_i σ_{i+1} σ_i = σ_{i+1} σ_i σ_{i+1}          (the braid relation)
//
// Drop the first relation's counterpart σ_i² = 1 and you have the symmetric group instead,
// which is why B_n surjects onto S_n: forget which strand went over.
//
// The reason braids belong in this catalogue is the CLOSURE. Join the top of a braid to
// its bottom and you get a link, and by Alexander's theorem every link arises this way. So
// a braid word is a finite, combinatorial name for a knot — and the invariants of that knot
// become computations on the word. Two are implemented here:
//
//   the permutation   B_n → S_n, whose cycles are the link's components.
//   the Burau matrix  B_n → GL(Z[t,t⁻¹]), from which the ALEXANDER POLYNOMIAL falls out.
//
// The Alexander polynomial is what makes the package testable against something outside
// itself: torus knots have a closed-form Alexander polynomial that mentions no braids at
// all, and the two must agree.

import {
  add,
  constant,
  determinant,
  divide,
  identityMatrix,
  type Laurent,
  type LaurentMatrix,
  monomial,
  multiply as multiplyLaurent,
  multiplyMatrices,
  normalise,
  subtractMatrices,
} from "./laurent.ts";

/**
 * A braid: a strand count, and a word whose letters are ±i for σ_i^{±1}. The word is the
 * only data — two different words can be the same braid, which is the whole difficulty of
 * the group and the reason invariants are needed.
 */
export interface Braid {
  readonly strands: number;
  readonly word: readonly number[];
}

const isInt = (x: number): boolean => Number.isSafeInteger(x);

export function braid(strands: number, word: readonly number[]): Braid | undefined {
  if (!isInt(strands) || strands < 1 || strands > 64) return undefined;
  if (!word.every((k) => isInt(k) && k !== 0 && Math.abs(k) < strands)) return undefined;
  return { strands, word: [...word] };
}

export const compose = (a: Braid, b: Braid): Braid | undefined =>
  a.strands === b.strands ? { strands: a.strands, word: [...a.word, ...b.word] } : undefined;

export const invert = (b: Braid): Braid => ({
  strands: b.strands,
  word: [...b.word].reverse().map((k) => -k),
});

export function braidPower(b: Braid, k: number): Braid | undefined {
  if (!isInt(k)) return undefined;
  if (k < 0) return braidPower(invert(b), -k);
  const word: number[] = [];
  for (let i = 0; i < k; i++) word.push(...b.word);
  return { strands: b.strands, word };
}

/** Cancel adjacent σ_i σ_i⁻¹ pairs. This is free reduction, NOT a solution to the word problem. */
export function freeReduce(b: Braid): Braid {
  const word: number[] = [];
  for (const letter of b.word) {
    if (word.length > 0 && word[word.length - 1] === -letter) word.pop();
    else word.push(letter);
  }
  return { strands: b.strands, word };
}

/** The exponent sum — the abelianisation B_n → Z, and the writhe of the closed diagram. */
export const writhe = (b: Braid): number => b.word.reduce((sum, k) => sum + Math.sign(k), 0);

export const crossings = (b: Braid): number => b.word.length;

export const isPositive = (b: Braid): boolean => b.word.every((k) => k > 0);

// ── the permutation, and the closure ────────────────────────────────────────────

/** The image in S_n, as an array where entry i is where strand i ends up (0-based). */
export function permutationOf(b: Braid): number[] {
  const image = Array.from({ length: b.strands }, (_, i) => i);
  for (const letter of b.word) {
    const i = Math.abs(letter) - 1;
    [image[i], image[i + 1]] = [image[i + 1] as number, image[i] as number];
  }
  return image;
}

/** The cycles of a permutation — for a closure, its link components. */
export function cyclesOf(permutation: readonly number[]): number[][] {
  const seen = new Set<number>();
  const cycles: number[][] = [];
  for (let start = 0; start < permutation.length; start++) {
    if (seen.has(start)) continue;
    const cycle: number[] = [];
    for (let i = start; !seen.has(i); i = permutation[i] as number) {
      seen.add(i);
      cycle.push(i);
    }
    cycles.push(cycle);
  }
  return cycles;
}

/** How many components the closure has. One means the closure is a knot. */
export const components = (b: Braid): number => cyclesOf(permutationOf(b)).length;

export const isKnot = (b: Braid): boolean => components(b) === 1;

/** The number of inversions of a permutation — the length of its reduced word. */
export function inversions(permutation: readonly number[]): number {
  let count = 0;
  for (let i = 0; i < permutation.length; i++) {
    for (let j = i + 1; j < permutation.length; j++) {
      if ((permutation[i] as number) > (permutation[j] as number)) count++;
    }
  }
  return count;
}

/**
 * The positive permutation braid of π: the unique positive braid realising π in which no
 * two strands cross more than once. It is a reduced word for π in the symmetric group,
 * lifted letter for letter — bubble sort produces one, and its length is the inversion
 * count, which is what "no pair crosses twice" means.
 */
export function positivePermutationBraid(permutation: readonly number[]): Braid | undefined {
  const n = permutation.length;
  const sorted = [...permutation].sort((a, b) => a - b);
  if (!sorted.every((x, i) => x === i)) return undefined;
  const working = [...permutation];
  const word: number[] = [];
  // Bubble sort backwards: each swap undoes one inversion, and reading the swaps in reverse
  // builds the braid whose permutation is π rather than π⁻¹.
  for (let pass = 0; pass < n; pass++) {
    for (let i = 0; i + 1 < n; i++) {
      if ((working[i] as number) > (working[i + 1] as number)) {
        [working[i], working[i + 1]] = [working[i + 1] as number, working[i] as number];
        word.push(i + 1);
      }
    }
  }
  return braid(n, word.reverse());
}

/** The torus braid (σ₁ ⋯ σ_{p−1})^q in B_p, whose closure is the torus link T(p, q). */
export function torusBraid(p: number, q: number): Braid | undefined {
  if (!isInt(p) || !isInt(q) || p < 2 || q < 0 || p > 32 || q > 32) return undefined;
  const round = Array.from({ length: p - 1 }, (_, i) => i + 1);
  const word: number[] = [];
  for (let i = 0; i < q; i++) word.push(...round);
  return braid(p, word);
}

/**
 * The Seifert genus of the closure of a POSITIVE braid, by Bennequin's theorem: Seifert's
 * algorithm on a positive braid diagram is already minimal, so g = (c − s + 1)/2 for c
 * crossings on s strands. Only valid for a positive braid whose closure is a knot.
 */
export function positiveBraidGenus(b: Braid): number | undefined {
  if (!isPositive(b) || !isKnot(b)) return undefined;
  const twice = crossings(b) - b.strands + 1;
  return twice >= 0 && twice % 2 === 0 ? twice / 2 : undefined;
}

// ── the Burau representation, and the Alexander polynomial ──────────────────────

/**
 * The reduced Burau matrix of σ_i, size (n−1). Columns are images of basis vectors:
 * e_{i−1} ↦ e_{i−1} + t·e_i, e_i ↦ −t·e_i, e_{i+1} ↦ e_i + e_{i+1}, everything else fixed.
 */
function burauGenerator(strands: number, i: number): LaurentMatrix | undefined {
  const size = strands - 1;
  if (size < 1 || i < 1 || i > size) return undefined;
  const m = identityMatrix(size).map((row) => [...row]);
  const t = monomial(1, 1);
  const set = (row: number, column: number, value: Laurent): void => {
    if (row >= 1 && row <= size && column >= 1 && column <= size) {
      (m[row - 1] as Laurent[])[column - 1] = value;
    }
  };
  // Column i is the only one that changes wholesale; the neighbours gain one entry each.
  set(i, i, monomial(-1, 1));
  set(i, i - 1, t);
  set(i, i + 1, constant(1));
  return m;
}

/** The reduced Burau matrix of a whole braid word. */
export function burau(b: Braid): LaurentMatrix | undefined {
  const size = b.strands - 1;
  if (size < 1) return undefined;
  let product = identityMatrix(size);
  for (const letter of b.word) {
    const generator = burauGenerator(b.strands, Math.abs(letter));
    if (generator === undefined) return undefined;
    const step = letter > 0 ? generator : invertBurauGenerator(b.strands, Math.abs(letter));
    if (step === undefined) return undefined;
    const next = multiplyMatrices(product, step);
    if (next === undefined) return undefined;
    product = next;
  }
  return product;
}

/** σ_i⁻¹: the same shape with t replaced by t⁻¹ in the right places. */
function invertBurauGenerator(strands: number, i: number): LaurentMatrix | undefined {
  const size = strands - 1;
  if (size < 1 || i < 1 || i > size) return undefined;
  const m = identityMatrix(size).map((row) => [...row]);
  const inverseT = monomial(1, -1);
  const set = (row: number, column: number, value: Laurent): void => {
    if (row >= 1 && row <= size && column >= 1 && column <= size) {
      (m[row - 1] as Laurent[])[column - 1] = value;
    }
  };
  set(i, i, monomial(-1, -1));
  set(i, i - 1, constant(1));
  set(i, i + 1, inverseT);
  return m;
}

/**
 * The Alexander polynomial of the closure, by Burau's formula
 *
 *     Δ(t) ≐ det(ψ(β) − I) · (1 − t) / (1 − tⁿ)
 *
 * where ψ is the reduced Burau representation and n the strand count. It is returned
 * normalised — lowest term at t⁰ with a positive coefficient — because Δ is only defined
 * up to ±tᵏ and there is no canonical representative.
 */
export function alexanderPolynomial(b: Braid): Laurent | undefined {
  const size = b.strands - 1;
  if (size < 1) return b.strands === 1 ? constant(1) : undefined;
  const matrix = burau(b);
  if (matrix === undefined) return undefined;
  const value = determinant(subtractMatrices(matrix, identityMatrix(size)));
  if (value === undefined) return undefined;
  const numerator = multiplyLaurent(value, add(constant(1), monomial(-1, 1)));
  const denominator = add(constant(1), monomial(-1, b.strands));
  const quotient = divide(numerator, denominator);
  return quotient === undefined ? undefined : normalise(quotient);
}

/**
 * The closed-form Alexander polynomial of the torus knot T(p, q), for coprime p and q:
 *
 *     Δ(t) = (t^{pq} − 1)(t − 1) / ((t^p − 1)(t^q − 1)).
 *
 * It mentions no braid at all, which is exactly why it is worth having: it is the oracle
 * the Burau computation is checked against.
 */
export function torusAlexander(p: number, q: number): Laurent | undefined {
  if (!isInt(p) || !isInt(q) || p < 2 || q < 2 || p > 24 || q > 24) return undefined;
  const cyclotomicLike = (k: number): Laurent => add(monomial(1, k), constant(-1));
  const numerator = multiplyLaurent(cyclotomicLike(p * q), cyclotomicLike(1));
  const denominator = multiplyLaurent(cyclotomicLike(p), cyclotomicLike(q));
  const quotient = divide(numerator, denominator);
  return quotient === undefined ? undefined : normalise(quotient);
}

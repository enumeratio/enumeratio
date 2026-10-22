// Exact bigint counts for the families a linear recurrence or a short sum counts: lattice paths,
// compositions from a set of parts, Stirling numbers and what they add up to, and the two tableaux
// families whose count is a sum over shapes. Like exact-counts.ts they are a family's `fast.count`
// or `fastCount`, answering past 2^53 where the interpreter takes seconds; Epsil stays the meaning,
// and tests/fast-kernels.test.ts holds each of these to it.
//
// Every counter bounds its own work from its params before it starts, and answers undefined past
// the bound (the interpreter then has the question, as before). Counts of at least 2^131072 are out.

import { binomialExact, powerProduct } from "./exact-counts.ts";

/** The most bits an answer takes (16 KB): the recurrences' cost grows with their size squared. */
export const RECURRENCE_BITS_LIMIT = 131_072;
/** The longest recurrence run, under 100 ms at the worst (Fine, Schröder: 2 to 2.6 bits a step). */
export const RECURRENCE_TOP = 10_000;
/** The most 64-bit words a table's cells may touch in all, about 0.1 s at the worst. */
export const WORK_LIMIT = 7e7;

/** The same for a sum of products of big numbers, in word-multiplications (about 0.1 s). */
const SUM_WORK_LIMIT = 2e8;

const natural = (x: number): boolean => Number.isSafeInteger(x) && x >= 0;
/** The longest composition table kept whole: n² / 8 bytes or so. */
const COMPOSITION_TOP = 10_000;
/** A length the recurrences run to. */
const ok = (n: number): boolean => natural(n) && n <= RECURRENCE_TOP;

// ─── linear recurrences, O(n) steps ───────────────────────────────────────────────────────────

/** c(m) for c(0) = 1, c(m) = c(m − 1) + … + c(m − width), run to `steps`; the caller bounds `steps`. */
function windowSums(steps: number, width: number): bigint {
  const window: bigint[] = [1n];
  let total = 1n;
  for (let m = 1; m <= steps; m++) {
    const next = total;
    window.push(next);
    total += next;
    if (window.length > width) total -= window.shift()!;
  }
  return window[window.length - 1];
}

/** c(0) = 1, c(m) = c(m − 1) + … + c(m − width): the compositions of m into parts of at most `width`. */
export const windowSumsExact = (n: number, width: number): bigint | undefined =>
  ok(n) ? windowSums(n, width) : undefined;

/** Compositions of n into parts of size at most k: the k-nacci count, with no part at all (so none for n > 0) at k = 0. */
export const partSizeBoundedExact = (n: number, k: number): bigint | undefined =>
  !ok(n) || !natural(k) ? undefined : k === 0 ? (n === 0 ? 1n : 0n) : windowSums(n, Math.min(k, n));

/** F(n), F(0) = 0 and F(1) = 1. */
export function fibonacciExact(n: number): bigint | undefined {
  if (!ok(n)) return undefined;
  let [a, b] = [0n, 1n];
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}

/** The binary words of length n with no two 1s in a row: F(n + 2). */
export const fibonacciWordsExact = (n: number): bigint | undefined => (ok(n) ? windowSums(n + 1, 2) : undefined);
/** The binary words of length n with no three 1s in a row. */
export const triStringsExact = (n: number): bigint | undefined => (ok(n) ? windowSums(n + 1, 3) : undefined);
/** Compositions of n into odd parts: F(n) for n ≥ 1. */
export const oddCompositionsExact = (n: number): bigint | undefined =>
  !ok(n) ? undefined : n === 0 ? 1n : fibonacciExact(n);
/** Compositions of n into parts of at least 2: F(n − 1) for n ≥ 2. */
export const properCompositionsExact = (n: number): bigint | undefined =>
  !ok(n) ? undefined : n === 0 ? 1n : n === 1 ? 0n : fibonacciExact(n - 1);

/** Motzkin numbers: (m + 2) M(m) = (2m + 1) M(m − 1) + 3 (m − 1) M(m − 2). */
export function motzkinExact(n: number): bigint | undefined {
  if (!ok(n)) return undefined;
  let [a, b] = [1n, 1n];
  if (n < 2) return 1n;
  for (let m = 2; m <= n; m++) [a, b] = [b, (BigInt(2 * m + 1) * b + BigInt(3 * (m - 1)) * a) / BigInt(m + 2)];
  return b;
}

/** Large Schröder numbers: (m + 1) S(m) = 3 (2m − 1) S(m − 1) − (m − 2) S(m − 2). */
export function schroederExact(n: number): bigint | undefined {
  if (!ok(n)) return undefined;
  let [a, b] = [1n, 2n];
  if (n < 1) return 1n;
  for (let m = 2; m <= n; m++) [a, b] = [b, (BigInt(3 * (2 * m - 1)) * b - BigInt(m - 2) * a) / BigInt(m + 1)];
  return b;
}

/** Riordan numbers: (m + 1) R(m) = (m − 1) (2 R(m − 1) + 3 R(m − 2)). */
export function riordanExact(n: number): bigint | undefined {
  if (!ok(n)) return undefined;
  let [a, b] = [1n, 0n];
  if (n < 1) return 1n;
  for (let m = 2; m <= n; m++) [a, b] = [b, (BigInt(m - 1) * (2n * b + 3n * a)) / BigInt(m + 1)];
  return b;
}

/** Fine numbers, by C(m) = 2 F(m) + F(m − 1), the Catalan numbers by C(m) = C(m − 1) · 2(2m − 1)/(m + 1). */
export function fineExact(n: number): bigint | undefined {
  if (!ok(n)) return undefined;
  let [catalan, previous, fine] = [1n, 0n, 1n];
  for (let m = 1; m <= n; m++) {
    catalan = (catalan * BigInt(2 * (2 * m - 1))) / BigInt(m + 1);
    previous = fine;
    fine = (catalan - previous) / 2n;
  }
  return fine;
}

/** Boolean permutations, Av(321, 3412): T(m) = 3 T(m − 1) − T(m − 2), T(0) = T(1) = 1. */
export function booleanPermutationsExact(n: number): bigint | undefined {
  if (!ok(n)) return undefined;
  let [a, b] = [1n, 1n];
  for (let m = 2; m <= n; m++) [a, b] = [b, 3n * b - a];
  return b;
}

/**
 * Vexillary permutations, Av(2143): the same count as Av(1234) (A005802). The recurrence
 * (m + 4)² u(m + 2) = (10m² + 42m + 41) u(m + 1) − 9 (m + 1)² u(m), u(0) = u(1) = 1, was fitted to the
 * series of Gessel's Bessel determinant (collections/tests/av1234.ts), not taken from a source, and is
 * held to it in tests (a wrong one would truncate the division silently). About 9^n, 3.2 bits a step.
 */
export function vexillaryExact(n: number): bigint | undefined {
  if (!ok(n)) return undefined;
  let [a, b] = [1n, 1n];
  for (let m = 0; m + 2 <= n; m++) {
    const k = BigInt(m);
    [a, b] = [b, ((10n * k * k + 42n * k + 41n) * b - 9n * (k + 1n) ** 2n * a) / (k + 4n) ** 2n];
  }
  return b;
}

// ─── compositions from a set of parts ─────────────────────────────────────────────────────────

/** Compositions of n with every part in `parts` (ascending, positive): c(0) = 1, c(m) = Σ c(m − p). */
export function partsInSetExact(n: number, parts: readonly number[]): bigint | undefined {
  // Compositions of m are at most 2^(m − 1) and the table is kept whole, so n stays modest.
  if (!natural(n) || n > COMPOSITION_TOP) return undefined;
  const usable = parts.filter((p) => p <= n);
  if (n * usable.length * (n / 64 + 1) > WORK_LIMIT) return undefined;
  const c: bigint[] = [1n];
  for (let m = 1; m <= n; m++) {
    let total = 0n;
    for (const p of usable) {
      if (p > m) break;
      total += c[m - p];
    }
    c.push(total);
  }
  return c[n];
}

const upTo = (n: number, keep: (p: number) => boolean): number[] =>
  Array.from({ length: n }, (_, i) => i + 1).filter(keep);
const isPrime = (p: number): boolean => {
  if (p < 2) return false;
  for (let d = 2; d * d <= p; d++) if (p % d === 0) return false;
  return true;
};
const isTriangular = (p: number): boolean => {
  const root = Math.round((Math.sqrt(8 * p + 1) - 1) / 2);
  return (root * (root + 1)) / 2 === p;
};

/** Parts 1, 2, 4, 8, …. */
export const dyadicCompositionsExact = (n: number): bigint | undefined =>
  natural(n) && n <= COMPOSITION_TOP
    ? partsInSetExact(
        n,
        upTo(n, (p) => (p & (p - 1)) === 0),
      )
    : undefined;
/** Parts 1, 3, 6, 10, …. */
export const triangularCompositionsExact = (n: number): bigint | undefined =>
  natural(n) && n <= COMPOSITION_TOP ? partsInSetExact(n, upTo(n, isTriangular)) : undefined;
/** Parts 2, 3, 5, 7, …. */
export const primeCompositionsExact = (n: number): bigint | undefined =>
  natural(n) && n <= COMPOSITION_TOP ? partsInSetExact(n, upTo(n, isPrime)) : undefined;

// ─── Dyck paths by height ─────────────────────────────────────────────────────────────────────

/** Dyck paths of semilength n whose greatest height is exactly h: those never above h, less those never above h − 1. */
export function dyckPathsByHeightExact(n: number, h: number): bigint | undefined {
  if (!natural(n) || !natural(h)) return undefined;
  if (h > n) return 0n;
  if (n > RECURRENCE_TOP || 2 * n * (h + 1) * (n / 32 + 1) > WORK_LIMIT) return undefined;
  const under = (ceiling: number): bigint => {
    if (ceiling < 0) return 0n;
    let row: bigint[] = Array<bigint>(ceiling + 1).fill(0n);
    row[0] = 1n;
    for (let step = 0; step < 2 * n; step++) {
      const next: bigint[] = Array<bigint>(ceiling + 1).fill(0n);
      // Only heights of the step's parity, and within reach of height 0 by the last step, can matter.
      for (let y = step & 1; y <= Math.min(ceiling, step, 2 * n - step); y += 2) {
        const here = row[y];
        if (here === 0n) continue;
        if (y < ceiling) next[y + 1] += here;
        if (y > 0) next[y - 1] += here;
      }
      row = next;
    }
    return row[0];
  };
  return under(h) - under(h - 1);
}

// ─── Stirling numbers of the second kind and their sums ───────────────────────────────────────

/**
 * The row S(n, 0 … k) of Stirling numbers of the second kind, as far as it goes (min(n, k) + 1
 * entries), or undefined past the work limit. S(m, j) = j S(m − 1, j) + S(m − 1, j − 1) runs down one
 * row in place; with `only` set, the one entry S(n, k) is wanted, and the corner of the triangle
 * that cannot reach it is skipped.
 */
function stirlingRow(n: number, k: number, only: boolean): bigint[] | undefined {
  const top = Math.min(n, k);
  // S(m, j) ≤ j^m, m log2 j bits, and the rows are `top` wide.
  const bits = n * Math.log2(Math.max(top, 2));
  if (n * (top + 1) * (bits / 64 + 1) > WORK_LIMIT || bits > RECURRENCE_BITS_LIMIT) return undefined;
  const row: bigint[] = Array<bigint>(top + 1).fill(0n);
  row[0] = 1n;
  for (let m = 1; m <= n; m++) {
    const lowest = only ? Math.max(1, k - (n - m)) : 1;
    for (let j = Math.min(m, top); j >= lowest; j--) row[j] = BigInt(j) * row[j] + row[j - 1];
    row[0] = 0n;
  }
  return row;
}

/** S(n, k): the set partitions of n into k blocks. */
export function stirlingSecondExact(n: number, k: number): bigint | undefined {
  if (!natural(n) || !natural(k)) return undefined;
  if (n === 0 || k === 0) return n === 0 && k === 0 ? 1n : 0n;
  if (k > n) return 0n;
  return stirlingRow(n, k, true)?.[k];
}

/** Bell numbers: the set partitions of n. */
export function bellExact(n: number): bigint | undefined {
  if (!natural(n)) return undefined;
  const row = stirlingRow(n, n, false);
  return row === undefined ? undefined : n === 0 ? 1n : row.reduce((sum, x) => sum + x, 0n);
}

/** Fubini numbers: the ordered set partitions of n, Σ k! S(n, k). */
export function fubiniExact(n: number): bigint | undefined {
  if (!natural(n)) return undefined;
  const row = stirlingRow(n, n, false);
  if (row === undefined) return undefined;
  if (n === 0) return 1n;
  let [sum, factorial] = [0n, 1n];
  for (let k = 1; k < row.length; k++) sum += (factorial *= BigInt(k)) * row[k];
  return sum;
}

/** The surjections of n onto k, k! S(n, k). */
export function surjectionsExact(n: number, k: number): bigint | undefined {
  const stirling = stirlingSecondExact(n, k);
  // None where k > n, before any loop over k; past that k ≤ n, and the Stirling row passed its work limit.
  if (stirling === undefined) return undefined;
  if (stirling === 0n) return 0n;
  let factorial = 1n;
  for (let i = 2; i <= k; i++) factorial *= BigInt(i);
  return factorial * stirling;
}

// ─── tableaux counted by a sum over shapes ────────────────────────────────────────────────────

/**
 * The semistandard tableaux of n cells with entries 1 … k, every shape together: the sum of the
 * hook-content counts s_λ(1^k) is the coefficient of t^n in (1 − t)^−k (1 − t²)^−C(k, 2), the
 * generating function Σ s_λ = Π (1 − x_i)^−1 Π_{i<j} (1 − x_i x_j)^−1 at x = (t, …, t). So the count is
 * Σ_j C(C(k, 2) + j − 1, j) C(n − 2j + k − 1, k − 1), each term a multiplicative step from the last.
 */
export function semistandardTableauxExact(n: number, k: number): bigint | undefined {
  if (!natural(n) || !natural(k)) return undefined;
  if (n === 0) return 1n;
  if (k === 0) return 0n;
  // The answer is at most k^n, and each of n/2 steps multiplies numbers about that size (Karatsuba).
  const bits = n * Math.log2(Math.max(k, 2));
  if ((n / 2 + 1) * (bits / 64 + 1) ** 1.6 > SUM_WORK_LIMIT || bits > RECURRENCE_BITS_LIMIT) return undefined;
  const pairs = (k * (k - 1)) / 2;
  let rows = binomialExact(n + k - 1, k - 1);
  if (rows === undefined) return undefined;
  let [sum, multisets] = [0n, 1n];
  for (let j = 0, left = n; left >= 0; j++, left -= 2) {
    sum += multisets * rows;
    // The next C(pairs + j, j + 1), and C(left − 2 + k − 1, k − 1) from C(left + k − 1, k − 1).
    multisets = (multisets * BigInt(pairs + j)) / BigInt(j + 1);
    if (left >= 2) rows = (rows * BigInt(left) * BigInt(left - 1)) / (BigInt(left + k - 1) * BigInt(left + k - 2));
  }
  return sum;
}

/** The most strict partitions summed over (about 7 µs each), so n up to 61. */
const STRICT_LIMIT = 12_000;

/** How many strict partitions n has. */
function strictPartitionCount(n: number): number {
  const ways = new Float64Array(n + 1);
  ways[0] = 1;
  for (let part = 1; part <= n; part++) for (let total = n; total >= part; total--) ways[total] += ways[total - part];
  return ways[n];
}

/**
 * The shifted standard tableaux of n cells, every strict shape together, each by Thrall's formula
 * n!/Π λ_i! · Π_{i<j} (λ_i − λ_j)/(λ_i + λ_j), a product of prime powers (`powerProduct`).
 */
export function shiftedStandardTableauxExact(n: number): bigint | undefined {
  if (!natural(n) || n > 1_000 || strictPartitionCount(n) > STRICT_LIMIT) return undefined;
  const parts: number[] = [];
  let sum = 0n;
  let failed = false;
  const shape = (): void => {
    const weights = new Float64Array(n + 1);
    for (let m = 2; m <= n; m++) weights[m] += 1;
    for (let i = 0; i < parts.length; i++) {
      for (let m = 2; m <= parts[i]; m++) weights[m] -= 1;
      for (let j = i + 1; j < parts.length; j++) {
        weights[parts[i] - parts[j]] += 1;
        weights[parts[i] + parts[j]] -= 1;
      }
    }
    const tableaux = powerProduct(weights);
    if (tableaux === undefined) failed = true;
    else sum += tableaux;
  };
  // Parts descending, each below the one before: `left` still to place, none above `most`.
  const walk = (left: number, most: number): void => {
    if (failed) return;
    if (left === 0) return shape();
    for (let part = Math.min(left, most); part >= 1; part--) {
      parts.push(part);
      walk(left - part, part - 1);
      parts.pop();
    }
  };
  walk(n, n);
  return failed ? undefined : sum;
}

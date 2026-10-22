// Exact bigint counts, past 2^53, for the partition, composition, word and tree families that a
// table, a Möbius sum or a closed form counts. Like exact-counts.ts they are a family's `fast.count`,
// `fastCount` or `exactCount`; Epsil stays the meaning, and tests/fast-kernels.test.ts holds each of
// these to it. Every counter bounds its own work from its params and answers undefined past the
// bound, where the family keeps declining as before.

import { EXACT_BITS_LIMIT, EXACT_TOP_LIMIT } from "./exact-counts.ts";

const natural = (x: number): boolean => Number.isSafeInteger(x) && x >= 0;

/** A count a double kernel gave as it is where it is a safe integer (so exact), else the exact one;
 *  past the bound of the exact one, the rounded double, which reads as past 2^53. */
export const orExact = (rough: number, exact: () => bigint | undefined): number | bigint =>
  Number.isSafeInteger(rough) || Number.isNaN(rough) || !Number.isFinite(rough) ? rough : (exact() ?? rough);

/** The longest side of a table of bigints kept whole (about 0.3 s). */
const TABLE_SIDE = 2_000;

/** The most bigint additions a partition table makes (about 0.5 s). */
const TABLE_WORK = 6e6;

// ─── partitions ───────────────────────────────────────────────────────────────────────────────

/** Partitions of n into parts of at most `most` that `inSet` allows (a coin-change table). */
export function partitionsExact(
  n: number,
  most: number,
  inSet: (part: number) => boolean = () => true,
): bigint | undefined {
  if (!natural(n) || !natural(most)) return undefined;
  const parts: number[] = [];
  for (let part = 1; part <= Math.min(n, most); part++) if (inSet(part)) parts.push(part);
  if (n * parts.length > TABLE_WORK) return undefined;
  const ways: bigint[] = Array<bigint>(n + 1).fill(0n);
  ways[0] = 1n;
  for (const part of parts) for (let total = part; total <= n; total++) ways[total] += ways[total - part];
  return ways[n];
}

/** p(n) by Euler's pentagonal recurrence, p(n) = Σ ±p(n − g), O(n^1.5) steps. */
export function integerPartitionsExact(n: number): bigint | undefined {
  if (!natural(n) || n > 20_000) return undefined;
  const p: bigint[] = [1n];
  for (let m = 1; m <= n; m++) {
    let total = 0n;
    for (let k = 1, g = 1; g <= m; k++, g = (k * (3 * k - 1)) / 2) {
      const sign = k % 2 === 1 ? 1n : -1n;
      total += sign * p[m - g];
      const h = (k * (3 * k + 1)) / 2;
      if (h <= m) total += sign * p[m - h];
    }
    p.push(total);
  }
  return p[n];
}

/** Partitions of n into distinct parts. */
export function distinctPartitionsExact(n: number): bigint | undefined {
  if (!natural(n) || (n * n) / 2 > TABLE_WORK) return undefined;
  const ways: bigint[] = Array<bigint>(n + 1).fill(0n);
  ways[0] = 1n;
  for (let part = 1; part <= n; part++) for (let total = n; total >= part; total--) ways[total] += ways[total - part];
  return ways[n];
}

/** Partitions of n into exactly k parts: take one from each, leaving n − k into parts of at most k. */
export const partitionsIntoPartsExact = (n: number, k: number): bigint | undefined =>
  !natural(n) || !natural(k) ? undefined : k === 0 ? (n === 0 ? 1n : 0n) : n < k ? 0n : partitionsExact(n - k, k);

/** Partitions of n whose largest part is exactly m: take m off, leaving n − m into parts of at most m. */
export const largestPartPartitionsExact = (n: number, m: number): bigint | undefined =>
  !natural(n) || !natural(m) ? undefined : m === 0 ? (n === 0 ? 1n : 0n) : n < m ? 0n : partitionsExact(n - m, m);

/** The plane partitions of n, by MacMahon's n·pp(n) = Σ σ₂(k) pp(n − k). */
export function planePartitionsExact(n: number): bigint | undefined {
  if (!natural(n) || n > TABLE_SIDE) return undefined;
  const sigma = new Array<bigint>(n + 1).fill(0n);
  for (let d = 1; d <= n; d++) for (let m = d; m <= n; m += d) sigma[m] += BigInt(d) * BigInt(d);
  const pp: bigint[] = [1n];
  for (let m = 1; m <= n; m++) {
    let total = 0n;
    for (let k = 1; k <= m; k++) total += sigma[k] * pp[m - k];
    pp.push(total / BigInt(m));
  }
  return pp[n];
}

// ─── compositions ─────────────────────────────────────────────────────────────────────────────

/** Compositions of n into at most k parts: Σ_{j ≤ k} C(n − 1, j − 1), and 1 for the empty one. */
export function partCountBoundedExact(n: number, k: number): bigint | undefined {
  if (!natural(n) || !natural(k) || n > 20_000) return undefined;
  if (n === 0) return 1n;
  let [sum, row] = [0n, 1n];
  for (let j = 1; j <= Math.min(k, n); j++) {
    sum += row;
    row = (row * BigInt(n - j)) / BigInt(j);
  }
  return sum;
}

/** Carlitz compositions of n (no two adjacent parts equal): c(n) = Σ s(m) c(n − m), where the series
 *  s(m) = Σ_{j | m} (−1)^(j+1) is Σ_k x^k/(1 + x^k), and 1/(1 − s) the generating function. */
export function carlitzExact(n: number): bigint | undefined {
  if (!natural(n) || n > TABLE_SIDE) return undefined;
  const s = new Array<bigint>(n + 1).fill(0n);
  for (let j = 1; j <= n; j++) for (let m = j; m <= n; m += j) s[m] += j % 2 === 1 ? 1n : -1n;
  const c: bigint[] = [1n];
  for (let m = 1; m <= n; m++) {
    let total = 0n;
    for (let part = 1; part <= m; part++) total += s[part] * c[m - part];
    c.push(total);
  }
  return c[n];
}

/** Zigzag compositions of n (parts alternately rising and falling, either way first: A025047). With
 *  `up[r][p]` the completions of r cells after a part p that the next must exceed, and `down[r][p]` those
 *  after a part the next must stay under, each a suffix or prefix sum of the other at a smaller r. */
export function zigzagCompositionsExact(n: number): bigint | undefined {
  if (!natural(n) || n > 800) return undefined;
  if (n === 0) return 1n;
  const zero = (): bigint[] => new Array<bigint>(n + 2).fill(0n);
  const [up, down]: bigint[][][] = [[], []];
  // No cells left: any part before completes, in one way.
  up[0] = new Array<bigint>(n + 2).fill(1n);
  down[0] = new Array<bigint>(n + 2).fill(1n);
  for (let r = 1; r <= n; r++) {
    const [rising, falling] = [zero(), zero()];
    // rising[p] = Σ_{q = p+1 … r} down[r − q][q]; falling[p] = Σ_{q = 1 … min(p − 1, r)} up[r − q][q].
    for (let p = Math.min(r - 1, n); p >= 1; p--) rising[p] = rising[p + 1] + down[r - (p + 1)][p + 1];
    for (let p = 2; p <= n; p++) falling[p] = falling[p - 1] + (p - 1 <= r ? up[r - (p - 1)][p - 1] : 0n);
    up[r] = rising;
    down[r] = falling;
  }
  let total = 0n;
  for (let p = 1; p <= n; p++) total += p === n ? 1n : up[n - p][p] + down[n - p][p];
  return total;
}

// ─── words ────────────────────────────────────────────────────────────────────────────────────

/** Σ_{d | n} μ(d) k^(n/d), over the squarefree divisors of n; undefined past the limits. */
function mobiusSum(n: number, k: number): bigint | undefined {
  if (n > EXACT_TOP_LIMIT || n * Math.log2(Math.max(k, 2)) > EXACT_BITS_LIMIT) return undefined;
  const primes: number[] = [];
  for (let rest = n, p = 2; rest > 1; p++) {
    if (p * p > rest) {
      primes.push(rest);
      break;
    }
    if (rest % p === 0) {
      primes.push(p);
      while (rest % p === 0) rest /= p;
    }
  }
  let sum = 0n;
  for (let subset = 0; subset < 1 << primes.length; subset++) {
    let [d, sign] = [1, 1n];
    primes.forEach((p, i) => {
      if (subset & (1 << i)) [d, sign] = [d * p, -sign];
    });
    sum += sign * BigInt(k) ** BigInt(n / d);
  }
  return sum;
}

/** The Lyndon words of length n over k letters, (1/n) Σ μ(d) k^(n/d) (Witt); none of length 0. */
export function lyndonWordCountExact(n: number, k: number): bigint | undefined {
  if (!natural(n) || !natural(k)) return undefined;
  if (n === 0) return 0n;
  const sum = mobiusSum(n, k);
  return sum === undefined ? undefined : sum / BigInt(n);
}

/** The aperiodic words of length n over k letters, Σ μ(d) k^(n/d): every rotation of a Lyndon word. */
export function primitiveWordsExact(n: number, k: number): bigint | undefined {
  if (!natural(n) || !natural(k)) return undefined;
  return n === 0 ? 0n : mobiusSum(n, k);
}

// ─── permutation classes ──────────────────────────────────────────────────────────────────────

/** The Baxter permutations of n: Σ_k C(n+1, k−1) C(n+1, k) C(n+1, k+1) / (C(n+1, 1) C(n+1, 2)). */
export function baxterExact(n: number): bigint | undefined {
  if (!natural(n) || n > 3_000) return undefined;
  if (n === 0) return 1n;
  const row: bigint[] = [1n];
  for (let k = 1; k <= n + 1; k++) row.push((row[k - 1] * BigInt(n + 2 - k)) / BigInt(k));
  let sum = 0n;
  for (let k = 1; k <= n; k++) sum += row[k - 1] * row[k] * row[k + 1];
  return sum / (row[1] * row[2]);
}

// ─── trees ────────────────────────────────────────────────────────────────────────────────────

/** The rooted unlabeled trees of 1 … n nodes (index 0 unused; A000081): a(m + 1) = (1/m) Σ_k (Σ_{d | k} d a(d)) a(m − k + 1). */
function rootedTrees(n: number): bigint[] {
  const a: bigint[] = [0n, 1n];
  const divisorSums: bigint[] = [0n];
  for (let m = 1; m < n; m++) {
    // Σ_{d | m} d a(d), the weight of the trees of m nodes in the Euler transform.
    let weight = 0n;
    for (let d = 1; d <= m; d++) if (m % d === 0) weight += BigInt(d) * a[d];
    divisorSums.push(weight);
    let total = 0n;
    for (let k = 1; k <= m; k++) total += divisorSums[k] * a[m - k + 1];
    a.push(total / BigInt(m));
  }
  return a;
}

/** The rooted unlabeled trees of n nodes: none for n < 1. */
export function rootedUnlabeledTreesExact(n: number): bigint | undefined {
  if (!natural(n) || n > TABLE_SIDE) return undefined;
  return n < 1 ? 0n : rootedTrees(n)[n];
}

/** The free unlabeled trees of n nodes by Otter's formula, t(n) = a(n) − Σ_{i ≤ n/2} a(i) a(n − i) +
 *  [n even] a(n/2)(a(n/2) + 1)/2, from the rooted counts a. None for n < 1. */
export function unlabeledFreeTreesExact(n: number): bigint | undefined {
  if (!natural(n) || n > TABLE_SIDE) return undefined;
  if (n < 1) return 0n;
  const a = rootedTrees(n);
  let total = a[n];
  for (let i = 1; i <= Math.floor(n / 2); i++) total -= a[i] * a[n - i];
  if (n % 2 === 0) total += (a[n / 2] * (a[n / 2] + 1n)) / 2n;
  return total;
}

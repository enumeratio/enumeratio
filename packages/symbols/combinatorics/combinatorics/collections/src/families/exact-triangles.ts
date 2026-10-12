// Exact bigint counts read off a triangle or a series (Stirling, Eulerian, Euler zigzag, telephone, Motzkin by
// peaks, a weighted Kreweras series), for families whose Epsil count is a table the interpreter takes
// seconds to minutes over past 2^53. Each is the `count` of a `fastCount` (see `exactUpTo`), held to
// Epsil by tests/fast-kernels.test.ts and to a second route in tests/exact-triangles.test.ts. Each is
// bounded to a size where it answers in about 0.1 s; past it the question is left unanswered rather
// than hung on.

import type { EpsilFamily, FastKernel } from "./epsil.ts";

const factorials: bigint[] = [1n];
function factorialsTo(n: number): bigint[] {
  for (let i = factorials.length; i <= n; i++) factorials.push(factorials[i - 1] * BigInt(i));
  return factorials;
}

/** The unsigned Stirling number of the first kind c(n, k), the permutations of n with k cycles: row by
 *  row, c(m, j) = c(m − 1, j − 1) + (m − 1) c(m − 1, j). */
export function stirlingFirstExact(n: number, k: number): bigint {
  if (k > n) return 0n;
  let row = [1n];
  for (let m = 1; m <= n; m++) {
    const next = [0n];
    for (let j = 1; j <= Math.min(k, m); j++) next.push((row[j - 1] ?? 0n) + BigInt(m - 1) * (row[j] ?? 0n));
    row = next;
  }
  return row[k] ?? 0n;
}

/** The Eulerian number A(n, k), the permutations of n with k descents: A(m, j) = (j + 1) A(m − 1, j) +
 *  (m − j) A(m − 1, j − 1), read at the nearer end (A(n, k) = A(n, n − 1 − k)). */
export function eulerianExact(n: number, k: number): bigint {
  if (n === 0) return k === 0 ? 1n : 0n;
  if (k >= n) return 0n;
  const near = Math.min(k, n - 1 - k);
  let row = [1n];
  for (let m = 2; m <= n; m++) {
    const next: bigint[] = [];
    for (let j = 0; j <= Math.min(near, m - 1); j++)
      next.push(BigInt(j + 1) * (row[j] ?? 0n) + (j === 0 ? 0n : BigInt(m - j) * row[j - 1]));
    row = next;
  }
  return row[near];
}

/** The Euler zigzag number E(n), the up-down permutations of n, by Seidel's boustrophedon: each row is
 *  the running sum of the one before it read backwards. */
export function zigzagExact(n: number): bigint {
  let row = [1n];
  for (let m = 1; m <= n; m++) {
    const next = [0n];
    for (let j = 1; j <= m; j++) next.push(next[j - 1] + row[m - j]);
    row = next;
  }
  return row[n];
}

/**
 * The Motzkin paths of length n with k peaks (an up-step straight before a down-step): m up-steps and
 * m down-steps make a Dyck path with j peaks (Narayana, N(m, j) = C(m, j) C(m, j − 1) / m), and the
 * n − 2m level steps go into its 2m + 1 gaps. k of its j peak gaps stay empty (C(j, k) choices), the
 * other j − k peak gaps take one step at least, and the rest of the 2m + 1 − k gaps take any number.
 */
export function motzkinByPeaksExact(n: number, k: number): bigint {
  const fact = factorialsTo(n);
  const binomial = (a: number, b: number): bigint => (b < 0 || b > a ? 0n : fact[a] / (fact[b] * fact[a - b]));
  let total = k === 0 ? 1n : 0n; // m = 0: level steps alone
  for (let m = Math.max(k, 1); 2 * m <= n; m++) {
    const level = n - 2 * m;
    const gaps = 2 * m + 1 - k;
    for (let j = Math.max(k, 1); j <= m && j - k <= level; j++)
      total +=
        ((binomial(m, j) * binomial(m, j - 1)) / BigInt(m)) *
        binomial(j, k) *
        binomial(level - (j - k) + gaps - 1, gaps - 1);
  }
  return total;
}

/**
 * Σ over the non-crossing partitions of n of Π (|B| − 1)!: the permutations whose cycles sit on the
 * blocks of one. The block of 1 splits the rest into |B| runs, so F = 1 + Σ (k − 1)! (xF)ᵏ, and Lagrange
 * inversion gives n · [xⁿ]F = Σₖ k! [uⁿ⁻ᵏ] Sⁿ, S = 1 + Σ (k − 1)! uᵏ. Sⁿ's coefficients come from
 * m Pₘ = Σⱼ (j n − (m − j)) sⱼ Pₘ₋ⱼ, each division exact.
 */
export function nonCrossingCycleSupportExact(n: number): bigint {
  if (n === 0) return 1n;
  const fact = factorialsTo(n);
  const power = [1n];
  for (let m = 1; m < n; m++) {
    let sum = 0n;
    for (let j = 1; j <= m; j++) sum += BigInt(j * n - (m - j)) * fact[j - 1] * power[m - j];
    power.push(sum / BigInt(m));
  }
  let total = 0n;
  for (let k = 1; k <= n; k++) total += fact[k] * power[n - k];
  return total / BigInt(n);
}

const isPermutationOf = (x: unknown, n: number): x is number[] => {
  if (!Array.isArray(x) || x.length !== n) return false;
  const seen = new Uint8Array(n + 1);
  for (const v of x) {
    if (!Number.isSafeInteger(v) || v < 1 || v > n || seen[v] === 1) return false;
    seen[v] = 1;
  }
  return true;
};

/** Membership of the permutations of n with k cycles, in O(n): the lex-restriction's table reads it
 *  off a table of n² entries that doubles overflow from n = 171. */
export function isKCyclePermutation(x: unknown, [n, k]: number[]): boolean {
  if (!isPermutationOf(x, n)) return false;
  const visited = new Uint8Array(n + 1);
  let cycles = 0;
  for (let start = 1; start <= n; start++) {
    if (visited[start] === 1) continue;
    cycles++;
    for (let at = start; visited[at] !== 1; at = x[at - 1]) visited[at] = 1;
  }
  return cycles === k;
}

/** The permutations of n with k descents. */
export function isKDescentPermutation(x: unknown, [n, k]: number[]): boolean {
  if (!isPermutationOf(x, n)) return false;
  let descents = 0;
  for (let i = 0; i + 1 < n; i++) if (x[i] > x[i + 1]) descents++;
  return descents === k;
}

/** The up-down permutations of n: p₁ < p₂ > p₃ < … */
export function isAlternatingPermutation(x: unknown, [n]: number[]): boolean {
  if (!isPermutationOf(x, n)) return false;
  for (let i = 0; i + 1 < n; i++) if (i % 2 === 0 ? x[i] > x[i + 1] : x[i] < x[i + 1]) return false;
  return true;
}

/** The permutations of n whose cycles, as sets, form a non-crossing partition: scanning 1 … n, a block
 *  already open must be the innermost one open, and a block closes at its last element. */
export function isNonCrossingCycleSupport(x: unknown, [n]: number[]): boolean {
  if (!isPermutationOf(x, n)) return false;
  const block = new Int32Array(n + 1);
  const left: number[] = [];
  for (let start = 1; start <= n; start++) {
    if (block[start] !== 0) continue;
    const id = left.length + 1;
    let size = 0;
    for (let at = start; block[at] === 0; at = x[at - 1]) {
      block[at] = id;
      size++;
    }
    left.push(size);
  }
  const open: number[] = [];
  const isOpen = new Uint8Array(left.length + 1);
  for (let i = 1; i <= n; i++) {
    const id = block[i];
    if (isOpen[id] === 0) {
      isOpen[id] = 1;
      open.push(id);
    } else if (open[open.length - 1] !== id) return false;
    if (--left[id - 1] === 0) {
      open.pop();
      isOpen[id] = 0;
    }
  }
  return true;
}

/** The telephone number T(n), the involutions of n: T(i) = T(i − 1) + (i − 1) T(i − 2). */
export function telephoneExact(n: number): bigint {
  let previous = 1n;
  let current = 1n;
  for (let i = 2; i <= n; i++) [previous, current] = [current, current + BigInt(i - 1) * previous];
  return current;
}

/** The self-inverse permutations of n. */
export function isInvolutionPermutation(x: unknown, [n]: number[]): boolean {
  return isPermutationOf(x, n) && x.every((image, i) => x[image - 1] === i + 1);
}

/**
 * `family` with an exact `count` while its first param is at most `limit`, and none past it: a count a
 * double can't hold is `count`'s to give, not Epsil's, whose interpreter takes minutes. `trivial` answers
 * the fibers that are 0 or 1 whatever the size, so they are answered past `limit` too, and `only` is the
 * member of a fiber `trivial` counts as 1, for `unrank`. `valid` is a direct membership test, for a
 * family whose Epsil one builds a table that overflows doubles. Where the family has a `fast` kernel its
 * count (and `valid` and `only` where given) replace its own; unrank and rank otherwise decline past
 * 2^53 (and past `limit`) at once, and are Epsil's below.
 */
export const exactUpTo = (
  family: EpsilFamily,
  limit: number,
  count: (p: number[]) => bigint,
  options: {
    trivial?: (p: number[]) => bigint | undefined;
    valid?: (element: unknown, p: number[]) => boolean;
    only?: (p: number[]) => number[] | undefined;
  } = {},
): EpsilFamily => {
  const { trivial = () => undefined, valid, only } = options;
  const exact = (p: number[]): bigint | undefined => trivial(p) ?? (p[0] > limit ? undefined : count(p));
  // Undefined leaves a question to Epsil.
  const base: FastKernel = family.fast ?? {
    count: exact,
    unrank: () => undefined,
    rank: () => undefined,
    valid: () => undefined,
  };
  const kernel =
    family.fast === undefined && valid === undefined && only === undefined
      ? { fastCount: exact }
      : {
          fast: {
            ...base,
            count: exact,
            unrank: (p: number[], r: number) =>
              r === 0 && only !== undefined && trivial(p) === 1n ? only(p) : base.unrank(p, r),
            valid: valid ?? base.valid,
          },
        };
  return {
    ...family,
    ...kernel,
    declinePastDoubles: "count",
    // Past the exact counter's bound, for params it reads as written (the count declines at once).
    early: {
      ...family.early,
      pastDoubles: (p) => Number.isSafeInteger(p[0]) && p[0] > limit && trivial([...p]) === undefined,
    },
  };
};

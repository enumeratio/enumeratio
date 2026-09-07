// pack-i.ts — pure-TS rank/unrank kernels for two combinatorial collections:
// GrandDyckPaths(n) and BalancedBinaryStrings(n). Self-contained: no imports,
// no I/O, plain JS numbers/arrays. Both reduce to unranking an n-subset of a
// 2n-set via the combinatorial number system (colex order) — see the shared
// kSubsetUnrank/kSubsetRank helpers below. See .scratch/pack-i-selfcert.mts
// for the exhaustive rank(unrank(p,r),p)===r certification over n=0..7.

export type PackEntry = {
  head: string; // PascalCase MathJSON head, e.g. "GrandDyckPaths"
  paramCount: 1 | 2; // number of integer parameters
  kind: "ints" | "blocks"; // element shape: flat int list, OR a list of int lists
  count: (p: number[]) => number; // p = [n] or [n,k]; closed-form or DP count
  unrank: (p: number[], r: number) => number[] | number[][]; // 0-based
  rank: (e: any, p: number[]) => number; // exact 0-based inverse of unrank
  valid: (e: any, p: number[]) => boolean; // is e a member of this collection at params p
};

// ---- shared helpers ---------------------------------------------------------

// Exact binomial coefficient. The multiply-before-divide order keeps every
// intermediate `result` an integer (result after i steps === C(n, i+1)), so
// this is exact for the small n we deal with here; Math.round is just a
// float-noise safety net.
function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0) return 1;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1);
  return Math.round(result);
}

// Colex (combinatorial number system) unrank of a k-subset of {0,...,N-1}.
// Standard combinadic decomposition: find the subset {c_k>...>c_1} such that
// r = C(c_k,k)+C(c_{k-1},k-1)+...+C(c_1,1), by greedily taking the largest
// candidate at each digit whose binomial coefficient still fits under the
// remaining rank. Returns the subset sorted ascending.
function kSubsetUnrank(N: number, k: number, r: number): number[] {
  const descending: number[] = [];
  let rem = r;
  let upperBound = N - 1; // largest value still eligible (must stay < previous pick)
  for (let kk = k; kk >= 1; kk--) {
    let c = upperBound;
    while (binomial(c, kk) > rem) c--;
    descending.push(c);
    rem -= binomial(c, kk);
    upperBound = c - 1;
  }
  return descending.reverse();
}

// Exact inverse of kSubsetUnrank: given a subset sorted ascending, recover
// its colex rank as sum_j C(e[j], j+1) (the same combinadic sum, read off
// an ascending array instead of descending).
function kSubsetRank(ascending: number[]): number {
  let rank = 0;
  for (let j = 0; j < ascending.length; j++) rank += binomial(ascending[j], j + 1);
  return rank;
}

// ---- GrandDyckPaths(n) ------------------------------------------------------
// Free lattice paths of 2n steps over {+1,-1}, starting and ending at height
// 0, with NO non-negativity constraint (allowed below zero) — i.e. any
// sequence of n up-steps and n down-steps in any order. Count = C(2n,n):
// choose which n of the 2n positions are up-steps. unrank/rank delegate
// straight to kSubsetUnrank/kSubsetRank on the up-step positions.

function grandDyckPathsCount(p: number[]): number {
  const n = p[0];
  return binomial(2 * n, n);
}

function grandDyckPathsUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const N = 2 * n;
  const ups = kSubsetUnrank(N, n, r);
  const path = new Array(N).fill(-1);
  for (const pos of ups) path[pos] = 1;
  return path;
}

function grandDyckPathsRank(e: number[], p: number[]): number {
  const positions: number[] = [];
  for (let i = 0; i < e.length; i++) if (e[i] === 1) positions.push(i);
  return kSubsetRank(positions);
}

function grandDyckPathsValid(e: any, p: number[]): boolean {
  const n = p[0];
  const N = 2 * n;
  if (!Array.isArray(e) || e.length !== N) return false;
  let sum = 0;
  for (const v of e) {
    if (v !== 1 && v !== -1) return false;
    sum += v;
  }
  return sum === 0;
}

// ---- BalancedBinaryStrings(n) ------------------------------------------------
// 0/1 strings of length 2n with exactly n ones and n zeros. Count = C(2n,n):
// choose which n of the 2n positions hold a 1. Same kSubsetUnrank/kSubsetRank
// delegation as GrandDyckPaths, just over {0,1} instead of {-1,+1}.

function balancedBinaryStringsCount(p: number[]): number {
  const n = p[0];
  return binomial(2 * n, n);
}

function balancedBinaryStringsUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const N = 2 * n;
  const ones = kSubsetUnrank(N, n, r);
  const s = new Array(N).fill(0);
  for (const pos of ones) s[pos] = 1;
  return s;
}

function balancedBinaryStringsRank(e: number[], p: number[]): number {
  const positions: number[] = [];
  for (let i = 0; i < e.length; i++) if (e[i] === 1) positions.push(i);
  return kSubsetRank(positions);
}

function balancedBinaryStringsValid(e: any, p: number[]): boolean {
  const n = p[0];
  const N = 2 * n;
  if (!Array.isArray(e) || e.length !== N) return false;
  let ones = 0;
  for (const v of e) {
    if (v !== 0 && v !== 1) return false;
    if (v === 1) ones++;
  }
  return ones === n;
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "GrandDyckPaths",
    paramCount: 1,
    kind: "ints",
    count: grandDyckPathsCount,
    unrank: grandDyckPathsUnrank,
    rank: grandDyckPathsRank,
    valid: grandDyckPathsValid,
  },
  {
    head: "BalancedBinaryStrings",
    paramCount: 1,
    kind: "ints",
    count: balancedBinaryStringsCount,
    unrank: balancedBinaryStringsUnrank,
    rank: balancedBinaryStringsRank,
    valid: balancedBinaryStringsValid,
  },
];

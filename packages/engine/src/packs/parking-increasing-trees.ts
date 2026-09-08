// pack-a.ts — pure-TS rank/unrank kernels for two combinatorial collections:
// ParkingFunctions(n) and IncreasingTrees(n). Self-contained: no imports, no
// I/O, plain JS numbers/arrays. See .scratch/pack-a-selfcert.mts for the
// exhaustive rank(unrank(p,r),p)===r certification over n=0..8.

import type { PackEntry } from "./types.js";

import { factorial } from "./_shared.js";

// ---- IncreasingTrees(n) -----------------------------------------------------
// Rooted labeled trees on nodes [1..n] where every root-to-leaf path has
// strictly increasing labels — equivalently, parent[i] < i for every
// non-root node i ("increasing Cayley trees" / recursive trees).
// Count = (n-1)! for n>=1 (n=0/1 -> 1: the empty tree / single root).
//
// Element: parent array of length n, 0-indexed by (node-1). parent[0] = 0
// is a fixed sentinel (node 1 is the root). For node i (2<=i<=n),
// parent[i-1] ranges over {1,...,i-1} — (i-1) choices — so the whole tree
// is one digit of a mixed-radix number: node n is the least-significant
// digit (base n-1), node 2 is the most-significant digit (base 1). unrank
// and rank walk the same digit order with the same place values, so they
// are exact inverses by construction.

function increasingTreesCount(p: number[]): number {
  const n = p[0];
  return n <= 1 ? 1 : factorial(n - 1);
}

function increasingTreesUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const parent = new Array(n).fill(0);
  let rem = r;
  for (let i = n; i >= 2; i--) {
    const base = i - 1;
    const d = rem % base;
    rem = Math.floor(rem / base);
    parent[i - 1] = d + 1;
  }
  return parent;
}

function increasingTreesRank(e: number[], p: number[]): number {
  const n = p[0];
  let rank = 0;
  let placeValue = 1;
  for (let i = n; i >= 2; i--) {
    const base = i - 1;
    const d = e[i - 1] - 1;
    rank += d * placeValue;
    placeValue *= base;
  }
  return rank;
}

function increasingTreesValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e) || e.length !== n) return false;
  if (n === 0) return true;
  if (e[0] !== 0) return false;
  for (let i = 2; i <= n; i++) {
    const v = e[i - 1];
    if (!Number.isInteger(v) || v < 1 || v > i - 1) return false;
  }
  return true;
}

// ---- ParkingFunctions(n) ----------------------------------------------------
// Sequences (a_1..a_n), a_i in {1,...,n}, such that the sorted sequence b
// satisfies b_i <= i (1-indexed) — cars park at their preferred spot or the
// next free one, and every spot fills. Count = (n+1)^(n-1); the formula
// gives 1^(-1)=1 for n=0 for free (the empty sequence).
//
// unrank/rank via digit-DP: build a_1..a_n left to right. The number of
// valid completions from position i+1..n depends only on the running
// "at-most-k" counts M[k] = #{j<=i : a_j<=k} for k=1..n (choosing a_i=v
// bumps M[k] for every k>=v — the final-feasibility check is M[k]>=k for
// all k). completions(i,M) is memoized per top-level call; unrank and rank
// walk the exact same decision tree in the same v=1..n order (standard
// combinatorial-number-system duality), so rank(unrank(p,r),p)===r.

function pfCompletions(n: number, i: number, M: number[], memo: Map<string, number>): number {
  if (i === n) {
    for (let k = 1; k <= n; k++) if (M[k] < k) return 0;
    return 1;
  }
  const key = i + "|" + M.slice(1, n + 1).join(",");
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  let total = 0;
  for (let v = 1; v <= n; v++) {
    const newM = M.slice();
    for (let k = v; k <= n; k++) newM[k]++;
    total += pfCompletions(n, i + 1, newM, memo);
  }
  memo.set(key, total);
  return total;
}

function parkingFunctionsCount(p: number[]): number {
  const n = p[0];
  return Math.pow(n + 1, n - 1);
}

function parkingFunctionsUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const M = new Array(n + 1).fill(0);
  const memo = new Map<string, number>();
  const result: number[] = [];
  let rem = r;
  for (let i = 0; i < n; i++) {
    for (let v = 1; v <= n; v++) {
      const newM = M.slice();
      for (let k = v; k <= n; k++) newM[k]++;
      const c = pfCompletions(n, i + 1, newM, memo);
      if (rem < c) {
        result.push(v);
        for (let k = v; k <= n; k++) M[k]++;
        break;
      }
      rem -= c;
    }
  }
  return result;
}

function parkingFunctionsRank(e: number[], p: number[]): number {
  const n = p[0];
  const M = new Array(n + 1).fill(0);
  const memo = new Map<string, number>();
  let rank = 0;
  for (let i = 0; i < n; i++) {
    const a = e[i];
    for (let v = 1; v < a; v++) {
      const newM = M.slice();
      for (let k = v; k <= n; k++) newM[k]++;
      rank += pfCompletions(n, i + 1, newM, memo);
    }
    for (let k = a; k <= n; k++) M[k]++;
  }
  return rank;
}

function parkingFunctionsValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e) || e.length !== n) return false;
  for (const x of e) if (!Number.isInteger(x) || x < 1 || x > n) return false;
  const b = e.slice().sort((x: number, y: number) => x - y);
  for (let i = 0; i < n; i++) if (b[i] > i + 1) return false;
  return true;
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "ParkingFunctions",
    paramCount: 1,
    kind: "ints",
    count: parkingFunctionsCount,
    unrank: parkingFunctionsUnrank,
    rank: parkingFunctionsRank,
    valid: parkingFunctionsValid,
  },
  {
    head: "IncreasingTrees",
    paramCount: 1,
    kind: "ints",
    count: increasingTreesCount,
    unrank: increasingTreesUnrank,
    rank: increasingTreesRank,
    valid: increasingTreesValid,
  },
];

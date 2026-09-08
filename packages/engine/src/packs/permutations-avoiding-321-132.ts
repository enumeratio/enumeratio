// pack-h.ts — pure-TS rank/unrank kernels for two Catalan-counted
// pattern-avoiding permutation families: Permutations321Avoiding(n) and
// Permutations132Avoiding(n). Self-contained: no imports, no I/O, plain JS
// numbers/arrays. See .scratch/pack-h-selfcert.mts for the exhaustive
// rank(unrank(p,r),p)===r certification over n=0..8, plus a brute-force
// filter-by-valid cross-check against ALL n! permutations for n<=7.

import type { PackEntry } from "./types.js";

// ---- shared helpers ---------------------------------------------------------

// Catalan(n) table [C(0),...,C(n)] via plain DP, recomputed per call — n
// stays small in practice, and this avoids any module-level mutable cache.
function catalanTable(n: number): number[] {
  const c: number[] = [1];
  for (let i = 1; i <= n; i++) {
    let s = 0;
    for (let k = 0; k < i; k++) s += c[k] * c[i - 1 - k];
    c.push(s);
  }
  return c;
}

function isPermutationOf1ToN(e: any, n: number): e is number[] {
  if (!Array.isArray(e) || e.length !== n) return false;
  const seen = new Array(n + 1).fill(false);
  for (const v of e) {
    if (!Number.isInteger(v) || v < 1 || v > n || seen[v]) return false;
    seen[v] = true;
  }
  return true;
}

// Direct O(n^3) pattern checks — used only by `valid`, kept independent of
// the rank/unrank machinery below so the self-cert brute-force filter is a
// genuine cross-check, not a restatement of the same logic.

function has321(e: number[]): boolean {
  const n = e.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (e[j] >= e[i]) continue;
      for (let k = j + 1; k < n; k++) {
        if (e[k] < e[j]) return true;
      }
    }
  }
  return false;
}

function has132(e: number[]): boolean {
  const n = e.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (e[j] <= e[i]) continue;
      for (let k = j + 1; k < n; k++) {
        if (e[k] > e[i] && e[k] < e[j]) return true;
      }
    }
  }
  return false;
}

// ---- Permutations132Avoiding(n) --------------------------------------------
// Permutations of [n] (one-line) avoiding pattern 132 (no i<j<k with
// e[i]<e[k]<e[j]). Count = Catalan(n).
//
// Recursive split on the position of the maximum value n: if n sits at
// (1-indexed) position m, every value left of m must exceed every value
// right of m (else the triple (left-value, n, right-value) with
// left<right<n would itself be a 132 pattern via n as the "3"), and each
// side must independently avoid 132. So the left block is the top (m-1)
// remaining values, the right block the bottom (n-m), each recursively
// 132-avoiding — the standard Catalan convolution C(n)=sum C(m-1)C(n-m).
//
// Both sub-ranges are always CONTIGUOUS integer intervals by construction,
// so recursion is parameterized by (offset, size) instead of an explicit
// value array — mapping a relative rank i (1..size) to its actual value is
// just offset+i, no lookup needed.

function unrank132Range(offset: number, size: number, r: number, cat: number[]): number[] {
  if (size === 0) return [];
  let rem = r;
  for (let m = 1; m <= size; m++) {
    const leftSize = m - 1;
    const rightSize = size - m;
    const block = cat[leftSize] * cat[rightSize];
    if (rem < block) {
      const leftRank = Math.floor(rem / cat[rightSize]);
      const rightRank = rem % cat[rightSize];
      const left = unrank132Range(offset + rightSize, leftSize, leftRank, cat);
      const right = unrank132Range(offset, rightSize, rightRank, cat);
      return [...left, offset + size, ...right];
    }
    rem -= block;
  }
  throw new Error("Permutations132Avoiding unrank: r out of range");
}

function rank132Range(e: number[], offset: number, size: number, cat: number[]): number {
  if (size === 0) return 0;
  const maxVal = offset + size;
  const idx = e.indexOf(maxVal);
  const m = idx + 1;
  const leftSize = m - 1;
  const rightSize = size - m;
  let preceding = 0;
  for (let mp = 1; mp < m; mp++) preceding += cat[mp - 1] * cat[size - mp];
  const leftRank = rank132Range(e.slice(0, idx), offset + rightSize, leftSize, cat);
  const rightRank = rank132Range(e.slice(idx + 1), offset, rightSize, cat);
  return preceding + leftRank * cat[rightSize] + rightRank;
}

function permutations132AvoidingCount(p: number[]): number {
  const n = p[0];
  return catalanTable(n)[n];
}

function permutations132AvoidingUnrank(p: number[], r: number): number[] {
  const n = p[0];
  return unrank132Range(0, n, r, catalanTable(n));
}

function permutations132AvoidingRank(e: any, p: number[]): number {
  const n = p[0];
  return rank132Range(e as number[], 0, n, catalanTable(n));
}

function permutations132AvoidingValid(e: any, p: number[]): boolean {
  const n = p[0];
  return isPermutationOf1ToN(e, n) && !has132(e);
}

// ---- Permutations321Avoiding(n) --------------------------------------------
// Permutations of [n] (one-line) avoiding pattern 321 (no i<j<k with
// e[i]>e[j]>e[k]). Count = Catalan(n).
//
// Unlike 132-avoidance, splitting on the position of the extreme value does
// NOT decompose into two independent recursive blocks here — a decreasing
// pair anywhere in the permutation can combine with any later smaller value
// to form a violation, regardless of block boundaries. Instead we build the
// permutation left to right, tracking just two scalars:
//   M = the running maximum of values placed so far (0 if none yet)
//   T = the running maximum, over every inversion (i<j, e[i]>e[j]) seen so
//       far, of the inversion's *bottom* value e[j] (0 if no inversion yet)
// A candidate next value v is legal iff v > T (otherwise v together with
// whichever earlier pair achieved T completes a 321 pattern). Placing v
// updates: if v > M it's a new record (M:=v, T unchanged, since a record
// creates no inversion); otherwise it creates inversion(s) bottoming at v
// (T := max(T, v)). This rule is necessary (shown above) and sufficient
// (applying it at every step recursively forbids every decreasing triple,
// since any triple's "bottom" k is checked against the max inversion-bottom
// accumulated by position k). count()/rank()/unrank() all share this walk;
// `valid` above re-derives 321-avoidance from the raw pattern definition
// instead, so the self-cert brute-force comparison is a real cross-check.
//
// count() is a plain recursive sum over legal next values, memoized per
// call on (remaining set, M, T) — remaining sets stay small in practice.

function count321(remaining: number[], M: number, T: number, memo: Map<string, number>): number {
  if (remaining.length === 0) return 1;
  const key = remaining.join(",") + "|" + M + "|" + T;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  let total = 0;
  for (const v of remaining) {
    if (v <= T) continue;
    const rest = remaining.filter((x) => x !== v);
    const nm = v > M ? v : M;
    const nt = v > M ? T : Math.max(T, v);
    total += count321(rest, nm, nt, memo);
  }
  memo.set(key, total);
  return total;
}

function permutations321AvoidingCount(p: number[]): number {
  const n = p[0];
  const remaining = Array.from({ length: n }, (_, i) => i + 1);
  return count321(remaining, 0, 0, new Map());
}

function permutations321AvoidingUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const memo = new Map<string, number>();
  let remaining = Array.from({ length: n }, (_, i) => i + 1);
  let M = 0;
  let T = 0;
  let rem = r;
  const result: number[] = [];
  for (let pos = 0; pos < n; pos++) {
    let chosen = -1;
    for (const v of remaining) {
      if (v <= T) continue;
      const rest = remaining.filter((x) => x !== v);
      const nm = v > M ? v : M;
      const nt = v > M ? T : Math.max(T, v);
      const c = count321(rest, nm, nt, memo);
      if (rem < c) {
        chosen = v;
        break;
      }
      rem -= c;
    }
    if (chosen === -1) throw new Error("Permutations321Avoiding unrank: r out of range");
    result.push(chosen);
    remaining = remaining.filter((x) => x !== chosen);
    if (chosen > M) M = chosen;
    else T = Math.max(T, chosen);
  }
  return result;
}

function permutations321AvoidingRank(e: any, p: number[]): number {
  const n = p[0];
  const perm = e as number[];
  const memo = new Map<string, number>();
  let remaining = Array.from({ length: n }, (_, i) => i + 1);
  let M = 0;
  let T = 0;
  let total = 0;
  for (let pos = 0; pos < n; pos++) {
    const v = perm[pos];
    for (const cand of remaining) {
      if (cand === v) break; // remaining stays sorted ascending: this is the canonical cutoff
      if (cand <= T) continue;
      const rest = remaining.filter((x) => x !== cand);
      const nm = cand > M ? cand : M;
      const nt = cand > M ? T : Math.max(T, cand);
      total += count321(rest, nm, nt, memo);
    }
    remaining = remaining.filter((x) => x !== v);
    if (v > M) M = v;
    else T = Math.max(T, v);
  }
  return total;
}

function permutations321AvoidingValid(e: any, p: number[]): boolean {
  const n = p[0];
  return isPermutationOf1ToN(e, n) && !has321(e);
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "Permutations321Avoiding",
    paramCount: 1,
    kind: "ints",
    count: permutations321AvoidingCount,
    unrank: permutations321AvoidingUnrank,
    rank: permutations321AvoidingRank,
    valid: permutations321AvoidingValid,
  },
  {
    head: "Permutations132Avoiding",
    paramCount: 1,
    kind: "ints",
    count: permutations132AvoidingCount,
    unrank: permutations132AvoidingUnrank,
    rank: permutations132AvoidingRank,
    valid: permutations132AvoidingValid,
  },
];

// Permutation-carrier families that were catalogued (packages/catalog/src/catalog-data.ts) but never
// wired to a kernel. Kept in its own file (rather than folded into core.ts) so parallel batches of this
// same roadmap item don't collide on one file. Reuses ./kernels.ts (Factorial/PermutationUnrank/
// PermutationRank/IsPermutationOf/LehmerCode/Inversions) and ./kernels-extra.ts (KPermutation*) wherever
// the element representation already matches; only genuinely new combinatorics get new code here.
import { binomial, catalanNumber } from "./shared.ts";
import {
  Factorial,
  Inversions,
  IsPermutationOf,
  LehmerCode,
  PermutationRank,
  PermutationUnrank,
} from "./kernels.ts";
import {
  IsKPermutationOf,
  KPermutationCount,
  KPermutationRank,
  KPermutationUnrank,
  KSubsetRank,
  KSubsetUnrank,
} from "./kernels-extra.ts";
import type { FamilyKernel } from "./types.ts";

// helper to cut boilerplate for the flat (number[]) shape; mirrors core.ts's private `ints`.
const ints = (
  head: string,
  paramCount: 1 | 2,
  count: (p: number[]) => number,
  unrank: (p: number[], r: number) => number[],
  valid: (e: number[], p: number[]) => boolean,
  rank: (e: number[], p: number[]) => number,
): FamilyKernel => ({
  head,
  paramCount,
  kind: "ints",
  count,
  unrank,
  valid: (e, p) => valid(e as number[], p),
  rank: (e, p) => rank(e as number[], p),
});

// ─── EvenPermutations(n): the alternating group Aₙ, one-line words. ────────────────────────────────
// Lex-rank pairs (2m, 2m+1) always differ by swapping the trailing two entries (the factorial-base
// digit at that place has weight 1 and only two values), so they have opposite parity — exactly one of
// each pair is even. That makes "the r-th even permutation" just "whichever half of pair r is even".
function evenPermutationCount(n: number): number {
  return n <= 1 ? 1 : Factorial(n) / 2;
}
function evenPermutationUnrank(n: number, r: number): number[] {
  if (n <= 1) return PermutationUnrank(n, 0);
  const total = evenPermutationCount(n);
  const rr = total > 0 ? ((Math.trunc(r) % total) + total) % total : 0;
  const base = PermutationUnrank(n, 2 * rr);
  return Inversions(base) % 2 === 0 ? base : PermutationUnrank(n, 2 * rr + 1);
}
function isEvenPermutation(perm: number[], n: number): boolean {
  return IsPermutationOf(perm, n) && Inversions(perm) % 2 === 0;
}

// ─── LehmerCodes(n): the inversion table, order-isomorphic to Permutations. Element = LehmerCode(perm) ──
// (length n−1, trailing implied 0 dropped, same convention ./kernels.ts already uses).
function permutationFromLehmerCode(code: number[], n: number): number[] {
  const L = [...code, 0];
  const avail = Array.from({ length: n }, (_, i) => i + 1);
  const res: number[] = [];
  for (let i = 0; i < n; i++) {
    const idx = L[i];
    res.push(avail[idx]);
    avail.splice(idx, 1);
  }
  return res;
}
function isValidLehmerCode(code: number[], n: number): boolean {
  if (!Array.isArray(code) || code.length !== Math.max(n - 1, 0)) return false;
  for (let i = 0; i < code.length; i++) {
    const v = code[i];
    if (!Number.isInteger(v) || v < 0 || v > n - 1 - i) return false;
  }
  return true;
}

// ─── SubexcedantSeqs(n): words (a₀,…,aₙ₋₁) with 0 ≤ aᵢ ≤ i (0-indexed) — its own factorial-base ────
// odometer, a sibling of lehmer_codes with a different bound (aᵢ ≤ i here, vs the Lehmer code's aᵢ ≤ n−1−i).
function subexcedantBlockSize(n: number, i: number): number {
  return Factorial(n) / Factorial(i + 1); // completions after position i
}
function subexcedantUnrank(n: number, r: number): number[] {
  const total = Factorial(n);
  let x = total > 0 ? ((Math.trunc(r) % total) + total) % total : 0;
  const terms: number[] = [];
  for (let i = 0; i < n; i++) {
    const bs = subexcedantBlockSize(n, i);
    const d = Math.floor(x / bs);
    terms.push(d);
    x -= d * bs;
  }
  return terms;
}
function subexcedantRank(terms: number[], n: number): number {
  let r = 0;
  for (let i = 0; i < n; i++) r += terms[i] * subexcedantBlockSize(n, i);
  return r;
}
function isSubexcedant(terms: number[], n: number): boolean {
  if (!Array.isArray(terms) || terms.length !== n) return false;
  for (let i = 0; i < n; i++) {
    const v = terms[i];
    if (!Number.isInteger(v) || v < 0 || v > i) return false;
  }
  return true;
}

// ─── AlternatingPermutations(n): a₁<a₂>a₃<… (Euler zigzag / Entringer numbers, A000111). ──────────
// The max value n can only sit at a position i whose required relation to i+1 is "descend" (n can't be
// less than what follows) — that's exactly the ODD 0-indexed positions (an "i = n−1, no next" slot turns
// out to coincide with this: the last position only admits n when n−1 itself is odd). Split the other
// n−1 values into a left block of size i and a right block of size n−1−i, freely (any subset — the
// pattern only constrains ADJACENT pairs, so left/right values don't need to interleave by magnitude,
// unlike the 231 decomposition); each block is independently alternating on its relative values.
const alternatingCache = new Map<number, number>();
function alternatingCount(n: number): number {
  if (n <= 1) return 1;
  const cached = alternatingCache.get(n);
  if (cached !== undefined) return cached;
  let total = 0;
  for (let i = 1; i < n; i += 2)
    total += binomial(n - 1, i) * alternatingCount(i) * alternatingCount(n - 1 - i);
  alternatingCache.set(n, total);
  return total;
}
function isAlternating(perm: readonly number[], n: number): boolean {
  if (!IsPermutationOf(perm as number[], n)) return false;
  for (let i = 0; i + 1 < n; i++) {
    const needAscent = i % 2 === 0;
    if (needAscent ? !(perm[i] < perm[i + 1]) : !(perm[i] > perm[i + 1])) return false;
  }
  return true;
}
function alternatingUnrank(n: number, r: number): number[] {
  if (n <= 1) return n === 1 ? [1] : [];
  let rr = r;
  for (let i = 1; i < n; i += 2) {
    const leftCount = alternatingCount(i);
    const rightCount = alternatingCount(n - 1 - i);
    const subsetCount = binomial(n - 1, i);
    const block = subsetCount * leftCount * rightCount;
    if (rr < block) {
      const perBlock = leftCount * rightCount;
      const subsetIndex = Math.floor(rr / perBlock);
      const within = rr % perBlock;
      const li = Math.floor(within / rightCount);
      const ri = within % rightCount;
      // KSubsetUnrank(n-1, i, subsetIndex): the left block's VALUES (a subset of {1,…,n−1}); its
      // complement (ascending) is the right block's values. Each block's own alternating arrangement
      // is computed on RELATIVE ranks 1..size, then relabeled onto its chosen actual values.
      const leftValues = KSubsetUnrank(n - 1, i, subsetIndex);
      const leftValueSet = new Set(leftValues);
      const rightValues = Array.from({ length: n - 1 }, (_, k) => k + 1).filter(
        (v) => !leftValueSet.has(v),
      );
      const leftArrangement = alternatingUnrank(i, li).map((v) => leftValues[v - 1]);
      const rightArrangement = alternatingUnrank(n - 1 - i, ri).map((v) => rightValues[v - 1]);
      return [...leftArrangement, n, ...rightArrangement];
    }
    rr -= block;
  }
  throw new Error(`alternatingUnrank: rank out of range for n=${n}`);
}
function alternatingRank(perm: readonly number[]): number {
  const n = perm.length;
  if (n <= 1) return 0;
  const i = perm.indexOf(n);
  const leftValues = perm.slice(0, i);
  const rightValues = perm.slice(i + 1);
  const rightCount = alternatingCount(n - 1 - i);
  const perBlock = alternatingCount(i) * rightCount;
  let rank = 0;
  for (let ii = 1; ii < i; ii += 2)
    rank += binomial(n - 1, ii) * alternatingCount(ii) * alternatingCount(n - 1 - ii);
  const subsetIndex = KSubsetRank(leftValues.slice().sort((a, b) => a - b));
  const leftRankOf = new Map(
    leftValues
      .slice()
      .sort((a, b) => a - b)
      .map((v, idx) => [v, idx + 1]),
  );
  const rightRankOf = new Map(
    rightValues
      .slice()
      .sort((a, b) => a - b)
      .map((v, idx) => [v, idx + 1]),
  );
  const li = alternatingRank(leftValues.map((v) => leftRankOf.get(v) as number));
  const ri = alternatingRank(rightValues.map((v) => rightRankOf.get(v) as number));
  return rank + subsetIndex * perBlock + li * rightCount + ri;
}

// ─── ConnectedPermutations(n): indecomposable — no proper prefix's values are exactly {1,…,j} (A003319) ─
// Insert values 1,2,…,n in increasing order (each newly-inserted value is the current max, so it either
// starts a new "record" or fills a gap below the current running max). Track only e = runningMax −
// position — how far the max is ahead of where it "should" be for a decomposition to occur right there
// (e=0 mid-sequence IS a decomposition point, so every intermediate step must keep e ≥ 1). At each step,
// from (remaining count m, excess e): either extend the run by choosing how far above the old max to
// jump (m−e ways, each landing on a distinct new e′ ≥ e — always safe), or drop into one of the e
// still-open "gap" values below the running max (e ways, e′ = e−1 — safe only if e ≥ 2, or if this is
// the very last placement). f(m, e) counts completions from that state; f(n, 0) is the top-level count
// (its own m>1,e=0,t=1 branch — "place the new value BELOW itself", impossible — is excluded, which is
// exactly what rules out an immediate decomposition at the very first position).
const connectedF = new Map<string, number>();
function connectedFCompletions(m: number, e: number): number {
  if (m === 0) return 1;
  const key = `${m},${e}`;
  const cached = connectedF.get(key);
  if (cached !== undefined) return cached;
  let total = 0;
  const maxT = m - e;
  for (let t = 1; t <= maxT; t++) {
    if (e === 0 && m > 1 && t === 1) continue; // would decompose right here
    total += connectedFCompletions(m - 1, e + (t - 1));
  }
  if (e >= 2 || m === 1) total += e * connectedFCompletions(m - 1, e - 1);
  connectedF.set(key, total);
  return total;
}
function connectedCount(n: number): number {
  return connectedFCompletions(n, 0);
}
function isConnected(perm: readonly number[], n: number): boolean {
  if (!IsPermutationOf(perm as number[], n)) return false;
  let runningMax = 0;
  for (let j = 1; j < n; j++) {
    runningMax = Math.max(runningMax, perm[j - 1]);
    if (runningMax === j) return false;
  }
  return true;
}
function connectedUnrank(n: number, r: number): number[] {
  if (n === 0) return [];
  let j = 0;
  let e = 0;
  let m = n;
  let rr = r;
  let smallPool: number[] = [];
  const result: number[] = [];
  while (m > 0) {
    let placed = false;
    const maxT = m - e;
    for (let t = 1; t <= maxT && !placed; t++) {
      if (e === 0 && m > 1 && t === 1) continue;
      const newE = e + (t - 1);
      const c = connectedFCompletions(m - 1, newE);
      if (rr < c) {
        const v = j + e + t;
        result.push(v);
        for (let s = j + e + 1; s <= j + e + t - 1; s++) smallPool.push(s);
        smallPool.sort((a, b) => a - b);
        e = newE;
        j++;
        m--;
        placed = true;
        break;
      }
      rr -= c;
    }
    if (placed) continue;
    const c1 = connectedFCompletions(m - 1, e - 1);
    const idx = Math.floor(rr / c1);
    rr %= c1;
    result.push(smallPool[idx]);
    smallPool.splice(idx, 1);
    e--;
    j++;
    m--;
  }
  return result;
}
function connectedRank(perm: readonly number[]): number {
  const n = perm.length;
  if (n <= 1) return 0;
  let e = 0;
  let m = n;
  let runningMax = 0;
  let smallPool: number[] = [];
  let rank = 0;
  for (const v of perm) {
    if (v > runningMax) {
      const t = v - runningMax;
      for (let tp = 1; tp < t; tp++) {
        if (e === 0 && m > 1 && tp === 1) continue;
        rank += connectedFCompletions(m - 1, e + (tp - 1));
      }
      for (let s = runningMax + 1; s < v; s++) smallPool.push(s);
      smallPool.sort((a, b) => a - b);
      e = e + (t - 1);
      runningMax = v;
    } else {
      const maxT = m - e;
      for (let tp = 1; tp <= maxT; tp++) {
        if (e === 0 && m > 1 && tp === 1) continue;
        rank += connectedFCompletions(m - 1, e + (tp - 1));
      }
      const idx = smallPool.indexOf(v);
      rank += idx * connectedFCompletions(m - 1, e - 1);
      smallPool.splice(idx, 1);
      e--;
    }
    m--;
  }
  return rank;
}

// ─── PermutationsAvoiding{123,132,213,231,312,321}(n): classical length-3 pattern classes, all ────────
// Catalan-counted (Knuth). `containsPattern` (an O(n³) triple check, parameterized by the pattern) is
// what `valid()` uses for every one of the six — cheap at any n, and the only check needed for
// membership. Rank/unrank need to be efficient though (these get `at()`-ed from docs), so instead of
// searching we reuse ONE genuinely recursive decomposition (231, split on the position of n: everything
// before it must be the block {1,…,m}, everything after {m+1,…,n−1}, each in turn 231-avoiding — the
// standard Catalan convolution) and reach the other three "quadrant" patterns via the classical
// reverse/complement/inverse symmetries of pattern classes (reverse∘231=132, complement∘231=213,
// inverse∘231=312). 123 and 321 don't decompose that way (n can't play a role in the *ascending*
// pattern's extremal position without extra bookkeeping); 321 instead uses the standard "insert values
// 1..n in increasing order, tracking only the length of the current increasing suffix" DP — a genuine
// insertion bijection, not a search — and 123 is its complement (complement∘321=123).
const PATTERNS: Record<string, readonly [number, number, number]> = {
  PermutationsAvoiding123: [1, 2, 3],
  PermutationsAvoiding132: [1, 3, 2],
  PermutationsAvoiding213: [2, 1, 3],
  PermutationsAvoiding231: [2, 3, 1],
  PermutationsAvoiding312: [3, 1, 2],
  PermutationsAvoiding321: [3, 2, 1],
};

function patternOf(a: number, b: number, c: number): readonly [number, number, number] {
  const sorted = [a, b, c].slice().sort((x, y) => x - y);
  return [sorted.indexOf(a) + 1, sorted.indexOf(b) + 1, sorted.indexOf(c) + 1];
}
function containsPattern(
  perm: readonly number[],
  pattern: readonly [number, number, number],
): boolean {
  const n = perm.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++) {
        const p = patternOf(perm[i], perm[j], perm[k]);
        if (p[0] === pattern[0] && p[1] === pattern[1] && p[2] === pattern[2]) return true;
      }
  return false;
}

function permutationInverse(perm: readonly number[]): number[] {
  const n = perm.length;
  const inv: number[] = Array.from({ length: n });
  for (let i = 0; i < n; i++) inv[perm[i] - 1] = i + 1;
  return inv;
}
function permutationComplement(perm: readonly number[]): number[] {
  const n = perm.length;
  return perm.map((v) => n + 1 - v);
}

// Av(231): position m of n splits into a {1,…,m} block (231-avoiding) then n then a {m+1,…,n−1} block
// (231-avoiding) — any before/after pair with before > after would itself be a 231 with n as the "3", so
// avoidance forces the blocks apart like this. Count is the Catalan convolution by construction.
function av231Unrank(n: number, r: number): number[] {
  if (n === 0) return [];
  let rr = r;
  for (let m = 0; m < n; m++) {
    const rightCount = catalanNumber(n - 1 - m);
    const block = catalanNumber(m) * rightCount;
    if (rr < block) {
      const left = av231Unrank(m, Math.floor(rr / rightCount));
      const right = av231Unrank(n - 1 - m, rr % rightCount).map((v) => v + m);
      return [...left, n, ...right];
    }
    rr -= block;
  }
  throw new Error(`av231Unrank: rank out of range for n=${n}`);
}
function av231Rank(perm: readonly number[]): number {
  const n = perm.length;
  if (n === 0) return 0;
  const m = perm.indexOf(n);
  let rank = 0;
  for (let mm = 0; mm < m; mm++) rank += catalanNumber(mm) * catalanNumber(n - 1 - mm);
  const rightCount = catalanNumber(n - 1 - m);
  const left = perm.slice(0, m);
  const right = perm.slice(m + 1).map((v) => v - m);
  return rank + av231Rank(left) * rightCount + av231Rank(right);
}

// Av(321): insert values 1,2,…,n in increasing order. Each new value is the current max, so it can only
// violate 321 by sitting before a still-later descent; valid gaps are exactly "within the current
// trailing increasing run", (s+1) of them where s is that run's length — and the run's length after
// inserting is all the DP needs to remember (not the whole arrangement). f(remaining, s) = completions
// from state s with `remaining` insertions left to place.
const f321Cache = new Map<string, number>();
function f321(remaining: number, s: number): number {
  if (remaining === 0) return 1;
  const key = `${remaining},${s}`;
  const cached = f321Cache.get(key);
  if (cached !== undefined) return cached;
  let total = 0;
  for (let g = 0; g <= s; g++) total += f321(remaining - 1, g === s ? s + 1 : s - g);
  f321Cache.set(key, total);
  return total;
}
function trailingIncreasingLength(arr: readonly number[]): number {
  const m = arr.length;
  if (m === 0) return 0;
  let len = 1;
  for (let i = m - 1; i > 0 && arr[i - 1] < arr[i]; i--) len++;
  return len;
}
function av321Unrank(n: number, r: number): number[] {
  if (n === 0) return [];
  const arrangement = [1];
  let s = 1;
  let rr = r;
  for (let v = 2; v <= n; v++) {
    const remainingAfter = n - v;
    let g = 0;
    for (; g <= s; g++) {
      const sp = g === s ? s + 1 : s - g;
      const c = f321(remainingAfter, sp);
      if (rr < c) break;
      rr -= c;
    }
    arrangement.splice(v - 1 - s + g, 0, v);
    s = g === s ? s + 1 : s - g;
  }
  return arrangement;
}
function av321Rank(perm: readonly number[]): number {
  const n = perm.length;
  if (n <= 1) return 0;
  let arr = perm.slice();
  let rank = 0;
  for (let v = n; v >= 2; v--) {
    const p = arr.indexOf(v);
    const rest = [...arr.slice(0, p), ...arr.slice(p + 1)];
    const s = trailingIncreasingLength(rest);
    const k = arr.length - 1 - p; // elements after v's position
    const g = s - k;
    const remainingAfter = n - v;
    for (let gp = 0; gp < g; gp++) rank += f321(remainingAfter, gp === s ? s + 1 : s - gp);
    arr = rest;
  }
  return rank;
}

// The remaining four are these two under the classical symmetries of pattern classes: reverse maps
// Av(231)→Av(132), complement maps Av(231)→Av(213) and Av(321)→Av(123), inverse maps Av(231)→Av(312).
const AVOIDERS: Record<
  string,
  {
    readonly unrank: (n: number, r: number) => number[];
    readonly rank: (perm: readonly number[]) => number;
  }
> = {
  PermutationsAvoiding231: { unrank: av231Unrank, rank: av231Rank },
  PermutationsAvoiding132: {
    unrank: (n, r) => av231Unrank(n, r).slice().reverse(),
    rank: (perm) => av231Rank(perm.slice().reverse()),
  },
  PermutationsAvoiding213: {
    unrank: (n, r) => permutationComplement(av231Unrank(n, r)),
    rank: (perm) => av231Rank(permutationComplement(perm)),
  },
  PermutationsAvoiding312: {
    unrank: (n, r) => permutationInverse(av231Unrank(n, r)),
    rank: (perm) => av231Rank(permutationInverse(perm)),
  },
  PermutationsAvoiding321: { unrank: av321Unrank, rank: av321Rank },
  PermutationsAvoiding123: {
    unrank: (n, r) => permutationComplement(av321Unrank(n, r)),
    rank: (perm) => av321Rank(permutationComplement(perm)),
  },
};

// ─── KCyclePermutations(n,k): exactly k cycles — the unsigned Stirling-1 triangle. ─────────────────
// Built by the standard insertion bijection: c(n,k) = c(n−1,k−1) + (n−1)·c(n−1,k) — element n either
// starts a new (singleton) cycle, or is spliced in right after one of the n−1 existing elements, in
// "successor function" terms (which is exactly one-line notation: image[i] = successor of i).
const stirling1Cache = new Map<string, number>();
function stirling1(n: number, k: number): number {
  if (n < 0 || k < 0 || k > n) return 0;
  if (n === 0) return k === 0 ? 1 : 0;
  const key = `${n},${k}`;
  const cached = stirling1Cache.get(key);
  if (cached !== undefined) return cached;
  const v = stirling1(n - 1, k - 1) + (n - 1) * stirling1(n - 1, k);
  stirling1Cache.set(key, v);
  return v;
}
function kCycleUnrank(n: number, k: number, r: number): number[] {
  if (n === 0) return [];
  const base = stirling1(n - 1, k - 1);
  if (r < base) return [...kCycleUnrank(n - 1, k - 1, r), n];
  const r2 = r - base;
  const subIndex = Math.floor(r2 / (n - 1));
  const x = (r2 % (n - 1)) + 1; // splice n in right after element x
  const sub = kCycleUnrank(n - 1, k, subIndex);
  const next = sub.slice();
  next.push(sub[x - 1]);
  next[x - 1] = n;
  return next;
}
function kCycleRank(perm: number[], k: number): number {
  const n = perm.length;
  if (n === 0) return 0;
  const x = perm.indexOf(n) + 1;
  if (x === n) return kCycleRank(perm.slice(0, n - 1), k - 1);
  const sub = perm.slice(0, n - 1);
  sub[x - 1] = perm[n - 1];
  const subIndex = kCycleRank(sub, k);
  return stirling1(n - 1, k - 1) + subIndex * (n - 1) + (x - 1);
}
function cycleCount(perm: number[]): number {
  const n = perm.length;
  const seen: boolean[] = Array.from({ length: n + 1 }, () => false);
  let count = 0;
  for (let start = 1; start <= n; start++) {
    if (seen[start]) continue;
    count++;
    let cur = start;
    while (!seen[cur]) {
      seen[cur] = true;
      cur = perm[cur - 1];
    }
  }
  return count;
}

// ─── KDescentPermutations(n,k): exactly k descents — the Eulerian triangle. ────────────────────────
// Insertion bijection: A(n,k) = (k+1)·A(n−1,k) + (n−k)·A(n−1,k−1). Inserting the max value n into a
// permutation of [n−1]: the (k+1) gaps that leave the descent count at k are "after the last element"
// plus "right at each of its k existing descents"; the (n−k) gaps that raise it from k−1 to k are
// "before the first element" plus "right at each of its ascents".
const eulerianCache = new Map<string, number>();
function eulerianA(n: number, k: number): number {
  if (n === 0) return k === 0 ? 1 : 0;
  if (k < 0 || k > n - 1) return 0;
  const key = `${n},${k}`;
  const cached = eulerianCache.get(key);
  if (cached !== undefined) return cached;
  const v = (k + 1) * eulerianA(n - 1, k) + (n - k) * eulerianA(n - 1, k - 1);
  eulerianCache.set(key, v);
  return v;
}
function descentPositions(perm: readonly number[]): number[] {
  const res: number[] = [];
  for (let i = 0; i + 1 < perm.length; i++) if (perm[i] > perm[i + 1]) res.push(i);
  return res;
}
function ascentPositions(perm: readonly number[]): number[] {
  const res: number[] = [];
  for (let i = 0; i + 1 < perm.length; i++) if (perm[i] < perm[i + 1]) res.push(i);
  return res;
}
function insertAt(sub: number[], pos: number, value: number): number[] {
  return [...sub.slice(0, pos + 1), value, ...sub.slice(pos + 1)];
}
function kDescentUnrank(n: number, k: number, r: number): number[] {
  if (n === 0) return [];
  if (n === 1) return [1];
  const same = (k + 1) * eulerianA(n - 1, k);
  if (r < same) {
    const subIndex = Math.floor(r / (k + 1));
    const gap = r % (k + 1);
    const sub = kDescentUnrank(n - 1, k, subIndex);
    if (gap === 0) return [...sub, n];
    return insertAt(sub, descentPositions(sub)[gap - 1], n);
  }
  const r2 = r - same;
  const denom = n - k;
  const subIndex = Math.floor(r2 / denom);
  const gap = r2 % denom;
  const sub = kDescentUnrank(n - 1, k - 1, subIndex);
  if (gap === 0) return [n, ...sub];
  return insertAt(sub, ascentPositions(sub)[gap - 1], n);
}
function kDescentRank(perm: number[], k: number): number {
  const n = perm.length;
  if (n <= 1) return 0;
  const idx = perm.indexOf(n);
  if (idx === n - 1) return kDescentRank(perm.slice(0, n - 1), k) * (k + 1);
  if (idx === 0) {
    const subIndex = kDescentRank(perm.slice(1), k - 1);
    return (k + 1) * eulerianA(n - 1, k) + subIndex * (n - k);
  }
  const L = perm[idx - 1];
  const R = perm[idx + 1];
  const sub = [...perm.slice(0, idx), ...perm.slice(idx + 1)];
  if (L > R) {
    const subIndex = kDescentRank(sub, k);
    const gap = descentPositions(sub).indexOf(idx - 1) + 1;
    return subIndex * (k + 1) + gap;
  }
  const subIndex = kDescentRank(sub, k - 1);
  const gap = ascentPositions(sub).indexOf(idx - 1) + 1;
  return (k + 1) * eulerianA(n - 1, k) + subIndex * (n - k) + gap;
}

// ─── KInversionPermutations(n,k): exactly k inversions — the Mahonian triangle. ────────────────────
// k = the LehmerCode digit sum; digit i (0-indexed) ranges over [0, n−1−i], so counting/ranking is a
// bounded-digit-sum mixed-radix problem — coefficients of ∏ᵢ(1+q+…+qⁱ), i.e. the q-factorial [n]_q!.
const mahonianCache = new Map<number, number[][]>();
function mahonianTable(n: number): number[][] {
  let table = mahonianCache.get(n);
  if (table) return table;
  table = Array.from({ length: n + 1 });
  table[n] = [1];
  for (let pos = n - 1; pos >= 0; pos--) {
    const maxDigit = n - 1 - pos;
    const prev = table[pos + 1];
    const poly: number[] = Array.from({ length: prev.length - 1 + maxDigit + 1 }, () => 0);
    for (let d = 0; d <= maxDigit; d++)
      for (let s = 0; s < prev.length; s++) poly[d + s] += prev[s];
    table[pos] = poly;
  }
  mahonianCache.set(n, table);
  return table;
}
function mahonianCount(n: number, k: number): number {
  if (n === 0) return k === 0 ? 1 : 0;
  const poly = mahonianTable(n)[0];
  return k >= 0 && k < poly.length ? poly[k] : 0;
}
function kInversionUnrank(n: number, k: number, r: number): number[] {
  if (n === 0) return [];
  const table = mahonianTable(n);
  let remaining = k;
  let rr = r;
  const code: number[] = [];
  for (let pos = 0; pos < n - 1; pos++) {
    const maxDigit = n - 1 - pos;
    const restPoly = table[pos + 1];
    let d = 0;
    for (; d <= maxDigit; d++) {
      const need = remaining - d;
      const c = need >= 0 && need < restPoly.length ? restPoly[need] : 0;
      if (rr < c) break;
      rr -= c;
    }
    code.push(d);
    remaining -= d;
  }
  return permutationFromLehmerCode(code, n);
}
function kInversionRank(perm: number[], n: number): number {
  const code = LehmerCode(perm);
  const table = mahonianTable(n);
  let remaining = code.reduce((a, b) => a + b, 0);
  let rank = 0;
  for (let pos = 0; pos < code.length; pos++) {
    const d = code[pos];
    const restPoly = table[pos + 1];
    for (let dd = 0; dd < d; dd++) {
      const need = remaining - dd;
      rank += need >= 0 && need < restPoly.length ? restPoly[need] : 0;
    }
    remaining -= d;
  }
  return rank;
}

export const entries: FamilyKernel[] = [
  ints(
    "EvenPermutations",
    1,
    ([n]) => evenPermutationCount(n),
    ([n], r) => evenPermutationUnrank(n, r),
    (a, [n]) => isEvenPermutation(a, n),
    (a) => Math.floor(PermutationRank(a) / 2),
  ),
  ints(
    "Arrangements",
    2,
    ([n, k]) => KPermutationCount(n, k),
    ([n, k], r) => KPermutationUnrank(n, k, r),
    (a, [n, k]) => IsKPermutationOf(a, n, k),
    (a, [n]) => KPermutationRank(a, n),
  ),
  ints(
    "LehmerCodes",
    1,
    ([n]) => Factorial(n),
    ([n], r) => LehmerCode(PermutationUnrank(n, r)),
    (a, [n]) => isValidLehmerCode(a, n),
    (a, [n]) => PermutationRank(permutationFromLehmerCode(a, n)),
  ),
  ints(
    "SubexcedantSeqs",
    1,
    ([n]) => Factorial(n),
    ([n], r) => subexcedantUnrank(n, r),
    (a, [n]) => isSubexcedant(a, n),
    (a, [n]) => subexcedantRank(a, n),
  ),
  ints(
    "AlternatingPermutations",
    1,
    ([n]) => alternatingCount(n),
    ([n], r) => alternatingUnrank(n, r),
    (a, [n]) => isAlternating(a, n),
    (a) => alternatingRank(a),
  ),
  ints(
    "ConnectedPermutations",
    1,
    ([n]) => connectedCount(n),
    ([n], r) => connectedUnrank(n, r),
    (a, [n]) => isConnected(a, n),
    (a) => connectedRank(a),
  ),
  ints(
    "KCyclePermutations",
    2,
    ([n, k]) => stirling1(n, k),
    ([n, k], r) => kCycleUnrank(n, k, r),
    (a, [n, k]) => IsPermutationOf(a, n) && cycleCount(a) === k,
    (a, [, k]) => kCycleRank(a, k),
  ),
  ints(
    "KDescentPermutations",
    2,
    ([n, k]) => eulerianA(n, k),
    ([n, k], r) => kDescentUnrank(n, k, r),
    (a, [n, k]) => IsPermutationOf(a, n) && descentPositions(a).length === k,
    (a, [, k]) => kDescentRank(a, k),
  ),
  ints(
    "KInversionPermutations",
    2,
    ([n, k]) => mahonianCount(n, k),
    ([n, k], r) => kInversionUnrank(n, k, r),
    (a, [n, k]) => IsPermutationOf(a, n) && Inversions(a) === k,
    (a, [n]) => kInversionRank(a, n),
  ),
  ...Object.entries(PATTERNS).map(([head, pattern]) =>
    ints(
      head,
      1,
      ([n]) => catalanNumber(n),
      ([n], r) => AVOIDERS[head].unrank(n, r),
      (a, [n]) => IsPermutationOf(a, n) && !containsPattern(a, pattern),
      (a) => AVOIDERS[head].rank(a),
    ),
  ),
];

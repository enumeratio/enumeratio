// pack-m.ts — pure-TS rank/unrank kernels for two combinatorial collections:
// PalindromicCompositions(n) and CompositionsIntoDistinctParts(n). Self-contained:
// no imports, no I/O, plain JS numbers/arrays. See .scratch/pack-m-selfcert.mts for
// the exhaustive rank(unrank(p,r),p)===r certification plus an independent
// brute-force (generate-all-compositions-and-filter) cross-check of count()/valid().

export type PackEntry = {
  head: string; // PascalCase MathJSON head, e.g. "PalindromicCompositions"
  paramCount: 1 | 2; // number of integer parameters
  kind: "ints" | "blocks"; // element shape: flat int list, OR a list of int lists
  count: (p: number[]) => number; // p = [n]; closed recurrence
  unrank: (p: number[], r: number) => number[] | number[][]; // 0-based
  rank: (e: any, p: number[]) => number; // exact 0-based inverse of unrank
  valid: (e: any, p: number[]) => boolean; // is e a member of this collection at params p
};

const normRank = (r: number, total: number): number =>
  total > 0 ? (((Math.trunc(r) % total) + total) % total) : 0;

// ─── PalindromicCompositions(n): compositions of n (order matters) that read the same forwards and
// backwards. A palindromic composition of n>=1 is either the single part (n) itself, OR has outer parts
// a_1 = a_k = a for some a in {1,...,floor(n/2)} whose interior (a_2,...,a_{k-1}) is — by exactly the same
// mirror condition one layer in — itself a palindromic composition of n-2a (empty when a=n/2, i.e. k=2).
// That gives the recurrence c[0]=1 (empty composition), c[m] = 1 + sum_{a=1}^{floor(m/2)} c[m-2a] for m>=1,
// which also has the closed form c[n] = 2^floor(n/2) (provable by induction on the recurrence) — but the
// table is built directly from the recurrence so unrank/rank walk exactly the sum it counts, not a formula
// that would need a separate consistency argument. unrank peels the single-part case at r=0, then walks
// a=1,2,... consuming c[m-2a]-sized blocks and recursing into the middle; rank replays the same walk. ────

function palindromicCompositionsTable(n: number): number[] {
  const c = new Array(Math.max(n, 0) + 1).fill(0);
  c[0] = 1;
  for (let m = 1; m <= n; m++) {
    let total = 1; // the single-part composition (m)
    for (let a = 1; a <= Math.floor(m / 2); a++) total += c[m - 2 * a];
    c[m] = total;
  }
  return c;
}

function palindromicCompositionsCount(p: number[]): number {
  const n = p[0];
  if (n < 0) return 0;
  return palindromicCompositionsTable(n)[n];
}

function unrankPalindromic(n: number, r: number, c: number[]): number[] {
  if (n === 0) return [];
  if (r === 0) return [n];
  let rr = r - 1;
  for (let a = 1; a <= Math.floor(n / 2); a++) {
    const block = c[n - 2 * a];
    if (rr < block) {
      const middle = unrankPalindromic(n - 2 * a, rr, c);
      return [a, ...middle, a];
    }
    rr -= block;
  }
  throw new Error(`PalindromicCompositions: rank out of range for n=${n}`);
}

function rankPalindromic(e: number[], n: number, c: number[]): number {
  if (e.length === 0) return 0; // n === 0
  if (e.length === 1) return 0; // the single-part case (n), always first
  const a = e[0];
  const middle = e.slice(1, -1);
  let rank = 1;
  for (let aa = 1; aa < a; aa++) rank += c[n - 2 * aa];
  return rank + rankPalindromic(middle, n - 2 * a, c);
}

function palindromicCompositionsUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const c = palindromicCompositionsTable(n);
  const total = c[n] ?? 0;
  return unrankPalindromic(n, normRank(r, total), c);
}

function palindromicCompositionsRank(e: any, p: number[]): number {
  const n = p[0];
  const c = palindromicCompositionsTable(n);
  return rankPalindromic(e as number[], n, c);
}

function palindromicCompositionsValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  if (e.length === 0) return n === 0;
  let sum = 0;
  for (const x of e) {
    if (typeof x !== "number" || !Number.isInteger(x) || x < 1) return false;
    sum += x;
  }
  if (sum !== n) return false;
  for (let i = 0; i < e.length; i++) if (e[i] !== e[e.length - 1 - i]) return false;
  return true;
}

// ─── CompositionsIntoDistinctParts(n): compositions of n (order matters) whose parts are pairwise
// distinct. Every such composition is a permutation of exactly one partition of n into distinct parts
// (OEIS A000009, "distinctParts" below), so count(n) = sum over distinct partitions p of n of |p|!, and
// the collection factors as (canonical enumeration of distinct partitions) × (permutations of a fixed
// partition, in factorial-number-system order): rank = (sum of |p_j|! for partitions before this one) +
// permIndex-within-partition. distinctParts/*Unrank/*Rank below mirror kernels-extra.ts's
// DistinctPartitionCount/Unrank/Rank recurrence verbatim (re-derived here to keep this file import-free):
// distinctParts(m,maxp) = # partitions of m into distinct parts each <= maxp, via
// distinctParts(m,maxp-1) [maxp unused] + distinctParts(m-maxp,maxp-1) [maxp used]. ─────────────────────

const _distinctPartsMemo = new Map<string, number>();
function distinctParts(m: number, maxp: number): number {
  if (m === 0) return 1;
  if (m < 0 || maxp <= 0) return 0;
  const key = `${m},${maxp}`;
  let v = _distinctPartsMemo.get(key);
  if (v === undefined) {
    v = distinctParts(m, maxp - 1) + distinctParts(m - maxp, maxp - 1);
    _distinctPartsMemo.set(key, v);
  }
  return v;
}

function distinctPartitionCount(n: number): number {
  return n < 0 ? 0 : distinctParts(n, n);
}

// Descending-part-first enumeration order (largest available part chosen greedily against the rank).
function distinctPartitionUnrank(n: number, idx: number): number[] {
  const total = distinctPartitionCount(n);
  let r = normRank(idx, total);
  const out: number[] = [];
  let m = n, upper = n;
  while (m > 0) {
    for (let part = Math.min(m, upper); part >= 1; part--) {
      const cnt = distinctParts(m - part, part - 1);
      if (r < cnt) { out.push(part); m -= part; upper = part - 1; break; }
      r -= cnt;
    }
  }
  return out;
}

// Exact inverse of distinctPartitionUnrank; expects parts in descending order.
function distinctPartitionRank(partsDesc: number[], n: number): number {
  let r = 0, m = n, upper = n;
  for (const part of partsDesc) {
    for (let v = Math.min(m, upper); v > part; v--) r += distinctParts(m - v, v - 1);
    m -= part; upper = part - 1;
  }
  return r;
}

function factorial(k: number): number {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return f;
}

// Standard factorial-number-system (Lehmer code) permutation of a fixed, ascending-sorted base list.
function permUnrank(sortedAsc: number[], idx: number): number[] {
  const avail = [...sortedAsc];
  const k = avail.length;
  const out: number[] = [];
  let r = idx;
  for (let i = k; i >= 1; i--) {
    const f = factorial(i - 1);
    const pos = Math.floor(r / f);
    r -= pos * f;
    out.push(avail[pos]);
    avail.splice(pos, 1);
  }
  return out;
}

function permRank(perm: number[], sortedAsc: number[]): number {
  const avail = [...sortedAsc];
  const k = perm.length;
  let r = 0;
  for (let i = 0; i < k; i++) {
    const pos = avail.indexOf(perm[i]);
    r += pos * factorial(k - 1 - i);
    avail.splice(pos, 1);
  }
  return r;
}

function compositionsIntoDistinctPartsCount(p: number[]): number {
  const n = p[0];
  if (n < 0) return 0;
  const qc = distinctPartitionCount(n);
  let total = 0;
  for (let j = 0; j < qc; j++) total += factorial(distinctPartitionUnrank(n, j).length);
  return total;
}

function compositionsIntoDistinctPartsUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const total = compositionsIntoDistinctPartsCount(p);
  let rr = normRank(r, total);
  const qc = distinctPartitionCount(n);
  for (let j = 0; j < qc; j++) {
    const partsDesc = distinctPartitionUnrank(n, j);
    const block = factorial(partsDesc.length);
    if (rr < block) {
      const sortedAsc = [...partsDesc].sort((a, b) => a - b);
      return permUnrank(sortedAsc, rr);
    }
    rr -= block;
  }
  throw new Error(`CompositionsIntoDistinctParts: rank out of range for n=${n}`);
}

function compositionsIntoDistinctPartsRank(e: any, p: number[]): number {
  const n = p[0];
  const parts: number[] = e;
  const sortedAsc = [...parts].sort((a, b) => a - b);
  const partsDesc = [...sortedAsc].sort((a, b) => b - a);
  const j = distinctPartitionRank(partsDesc, n);
  let offset = 0;
  for (let jj = 0; jj < j; jj++) offset += factorial(distinctPartitionUnrank(n, jj).length);
  return offset + permRank(parts, sortedAsc);
}

function compositionsIntoDistinctPartsValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  const seen = new Set<number>();
  let sum = 0;
  for (const x of e) {
    if (typeof x !== "number" || !Number.isInteger(x) || x < 1 || seen.has(x)) return false;
    seen.add(x);
    sum += x;
  }
  return sum === n;
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "PalindromicCompositions",
    paramCount: 1,
    kind: "ints",
    count: palindromicCompositionsCount,
    unrank: palindromicCompositionsUnrank,
    rank: palindromicCompositionsRank,
    valid: palindromicCompositionsValid,
  },
  {
    head: "CompositionsIntoDistinctParts",
    paramCount: 1,
    kind: "ints",
    count: compositionsIntoDistinctPartsCount,
    unrank: compositionsIntoDistinctPartsUnrank,
    rank: compositionsIntoDistinctPartsRank,
    valid: compositionsIntoDistinctPartsValid,
  },
];

// Compositions — ordered sequences of positive-integer parts summing to n, across every part-set
// restriction the catalog carries (fixed alphabets, parity, boundedness, distinctness, coloring,
// palindromy) plus the two adjacent-part-avoiding word families (Carlitz, Smirnov) that share their
// combinatorics. Pure-TS rank/unrank kernels: no I/O, plain JS numbers/arrays. Consolidated from
// eight parallel-authored packs; every kernel's rank(unrank(p,r),p)===r certification lives in
// test/selfcert.test.ts.

import type { PackEntry } from "./types.js";
import { factorial } from "./_shared.js";

const normRank = (r: number, total: number): number =>
  total > 0 ? (((Math.trunc(r) % total) + total) % total) : 0;

// ─── CarlitzCompositions(n): compositions of n (ordered sequences of positive integers summing to
// n) with no two ADJACENT parts equal, counted by A003242 (1,1,1,3,4,7,14,23,39,71,... for
// n=0,1,2,...). c(rem,last) = # Carlitz compositions of `rem` whose first part != `last` (last=0 is
// the "no constraint" sentinel used at the top level, since real parts are always >=1): c(0,last)=1
// (the empty completion) for every last; c(rem,last) = sum over v=1..rem, v!=last, of
// c(rem-v, v) — place v as the next part (excluded only from equaling the immediately-preceding
// part), then require the REST to avoid equaling v. count(n) = c(n,0). unrank walks that same split
// — v=1..remSum in order (each a same-size c(remSum-v,v) block, skipping v===last) — to locate r;
// rank replays the identical split to relocate a given composition. ───────────────────────────────

function carlitzTable(n: number): number[][] {
  // c[rem][last], rem=0..n, last=0..n (last=0 used only as the top-level sentinel).
  const c: number[][] = [];
  for (let rem = 0; rem <= n; rem++) c.push(new Array(n + 1).fill(0));
  for (let last = 0; last <= n; last++) c[0][last] = 1; // nothing left: exactly one (empty) completion
  for (let rem = 1; rem <= n; rem++) {
    for (let last = 0; last <= n; last++) {
      let sum = 0;
      for (let v = 1; v <= rem; v++) {
        if (v === last) continue;
        sum += c[rem - v][v];
      }
      c[rem][last] = sum;
    }
  }
  return c;
}

function carlitzCompositionsCount(p: number[]): number {
  const n = p[0];
  if (n < 0) return 0;
  return carlitzTable(n)[n][0];
}

function carlitzCompositionsUnrank(p: number[], r: number): number[] {
  const n = p[0];
  if (n <= 0) return [];
  const table = carlitzTable(n);
  const total = table[n][0];
  let rem = normRank(r, total);
  const parts: number[] = [];
  let remSum = n;
  let last = 0;
  while (remSum > 0) {
    let chosen = -1;
    for (let v = 1; v <= remSum; v++) {
      if (v === last) continue;
      const block = table[remSum - v][v];
      if (rem < block) { chosen = v; break; }
      rem -= block;
    }
    parts.push(chosen);
    remSum -= chosen;
    last = chosen;
  }
  return parts;
}

function carlitzCompositionsRank(e: any, p: number[]): number {
  const n = p[0];
  if (n <= 0) return 0;
  const table = carlitzTable(n);
  const parts = e as number[];
  let rank = 0;
  let remSum = n;
  let last = 0;
  for (const v of parts) {
    for (let u = 1; u < v; u++) {
      if (u === last) continue;
      rank += table[remSum - u][u];
    }
    remSum -= v;
    last = v;
  }
  return rank;
}

function carlitzCompositionsValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  if (e.length === 0) return n === 0;
  let sum = 0;
  for (let i = 0; i < e.length; i++) {
    const v = e[i];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1) return false;
    sum += v;
    if (i > 0 && e[i] === e[i - 1]) return false;
  }
  return sum === n;
}

// ─── SmirnovWords(n,k): length-n words over the alphabet {1..k} with no two equal ADJACENT
// letters, counted by n===0 ? 1 : k*(k-1)^(n-1) (the first letter is free among k, every later
// letter is free among the k-1 letters != the previous one). unrank/rank use a clean MIXED-RADIX
// decomposition: position 0 has radix k with place value (k-1)^(n-1); each position i>=1 has radix
// (k-1) with place value (k-1)^(n-1-i). A digit d at a position with exclusion `prev` (0 = no
// exclusion, used only at position 0) selects the d-th smallest letter of {1..k}\{prev}; the
// inverse counts how many valid letters are below a given one. ────────────────────────────────────

function nthValidLetter(k: number, prev: number, d: number): number {
  let count = 0;
  for (let v = 1; v <= k; v++) {
    if (v === prev) continue;
    if (count === d) return v;
    count++;
  }
  return -1; // unreachable for a well-formed (k, prev, d)
}

function letterDigit(prev: number, v: number): number {
  let d = 0;
  for (let u = 1; u < v; u++) {
    if (u === prev) continue;
    d++;
  }
  return d;
}

function smirnovWordsCount(p: number[]): number {
  const n = p[0];
  const k = p[1];
  if (n < 0 || k < 0) return 0;
  if (n === 0) return 1;
  return k * Math.pow(k - 1, n - 1);
}

function smirnovWordsUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const k = p[1];
  if (n <= 0) return [];
  const total = smirnovWordsCount(p);
  let rem = normRank(r, total);
  const w: number[] = [];
  let place = Math.pow(k - 1, n - 1);
  let d = place > 0 ? Math.floor(rem / place) : 0;
  if (place > 0) rem -= d * place;
  let prev = nthValidLetter(k, 0, d);
  w.push(prev);
  for (let i = 1; i < n; i++) {
    place = Math.pow(k - 1, n - 1 - i);
    d = place > 0 ? Math.floor(rem / place) : 0;
    if (place > 0) rem -= d * place;
    const v = nthValidLetter(k, prev, d);
    w.push(v);
    prev = v;
  }
  return w;
}

function smirnovWordsRank(e: any, p: number[]): number {
  const n = p[0];
  const k = p[1];
  if (n <= 0) return 0;
  const w = e as number[];
  let rank = 0;
  let place = Math.pow(k - 1, n - 1);
  rank += letterDigit(0, w[0]) * place;
  let prev = w[0];
  for (let i = 1; i < n; i++) {
    place = Math.pow(k - 1, n - 1 - i);
    rank += letterDigit(prev, w[i]) * place;
    prev = w[i];
  }
  return rank;
}

function smirnovWordsValid(e: any, p: number[]): boolean {
  const n = p[0];
  const k = p[1];
  if (!Array.isArray(e) || e.length !== n) return false;
  for (let i = 0; i < n; i++) {
    const v = e[i];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > k) return false;
    if (i > 0 && e[i] === e[i - 1]) return false;
  }
  return true;
}

// ─── KColoredCompositions(n,k): compositions of n (ordered lists of parts >=1 summing to n) where each
// part additionally carries one of k colors (0..k-1). Element = list of [part,color] pairs. c(rem) =
// colored compositions of rem: c(0)=1 (the empty composition); for rem>=1, the first part is some
// v=1..rem painted one of k colors, followed by a colored composition of the rem-v left over, so
// c(rem) = k * sum_{v=1..rem} c(rem-v). (This DP telescopes to the closed form k*(k+1)^(n-1) for n>=1 —
// confirmed in selfcert against an independent brute-force enumeration, not assumed up front.) unrank
// walks the same split: try v=1..rem in order (a k*c(rem-v)-sized block each), then the color 0..k-1
// within that block (a c(rem-v)-sized sub-block each); rank replays the identical walk. ─────────────────

function kColoredTable(n: number, k: number): number[] {
  const c = new Array(n + 1).fill(0);
  c[0] = 1;
  for (let rem = 1; rem <= n; rem++) {
    let sum = 0;
    for (let v = 1; v <= rem; v++) sum += c[rem - v];
    c[rem] = k * sum;
  }
  return c;
}

function kColoredCompositionsCount(p: number[]): number {
  const n = p[0], k = p[1];
  if (n < 0 || k < 0) return 0;
  if (n === 0) return 1;
  return kColoredTable(n, k)[n];
}

function kColoredCompositionsUnrank(p: number[], r: number): number[][] {
  const n = p[0], k = p[1];
  if (n <= 0) return [];
  const c = kColoredTable(n, k);
  const total = c[n];
  if (total <= 0) return []; // k=0 (or otherwise no colorings): no members to unrank
  let rem = normRank(r, total);
  let left = n;
  const out: number[][] = [];
  while (left > 0) {
    for (let v = 1; v <= left; v++) {
      const sub = c[left - v];
      const block = k * sub;
      if (rem < block) {
        const color = Math.floor(rem / sub);
        rem -= color * sub;
        out.push([v, color]);
        left -= v;
        break;
      }
      rem -= block;
    }
  }
  return out;
}

function kColoredCompositionsRank(e: any, p: number[]): number {
  const n = p[0], k = p[1];
  if (n <= 0) return 0;
  const c = kColoredTable(n, k);
  const pairs = e as number[][];
  let left = n;
  let rank = 0;
  for (const pair of pairs) {
    const v = pair[0], color = pair[1];
    for (let vv = 1; vv < v; vv++) rank += k * c[left - vv];
    rank += color * c[left - v];
    left -= v;
  }
  return rank;
}

function kColoredCompositionsValid(e: any, p: number[]): boolean {
  const n = p[0], k = p[1];
  if (!Array.isArray(e)) return false;
  let sum = 0;
  for (const pair of e) {
    if (!Array.isArray(pair) || pair.length !== 2) return false;
    const v = pair[0], color = pair[1];
    if (!Number.isInteger(v) || v < 1) return false;
    if (!Number.isInteger(color) || color < 0 || color >= k) return false;
    sum += v;
  }
  return sum === n;
}

// ─── CompositionsIntoParts12345(n): compositions of n into parts drawn from {1,2,3,4,5} (order matters,
// parts may repeat). c(0)=1 (empty composition); for rem>=1, the first part is v=1..min(rem,5), so
// c(rem) = sum_{v=1..min(rem,5)} c(rem-v) — a pentanacci-style recurrence (1,1,2,4,8,16,31,61,120,236,...
// once rem>=5 there are always exactly 5 terms in the sum). unrank walks first-part choices v=1..
// min(left,5) in order (each a c(left-v)-sized block); rank replays the identical walk. ─────────────────

function parts12345Table(n: number): number[] {
  const c = new Array(n + 1).fill(0);
  c[0] = 1;
  for (let rem = 1; rem <= n; rem++) {
    let sum = 0;
    for (let v = 1; v <= Math.min(rem, 5); v++) sum += c[rem - v];
    c[rem] = sum;
  }
  return c;
}

function parts12345Count(p: number[]): number {
  const n = p[0];
  if (n < 0) return 0;
  return parts12345Table(n)[n];
}

function parts12345Unrank(p: number[], r: number): number[] {
  const n = p[0];
  if (n <= 0) return [];
  const c = parts12345Table(n);
  const total = c[n];
  let rem = normRank(r, total);
  let left = n;
  const out: number[] = [];
  while (left > 0) {
    for (let v = 1; v <= Math.min(left, 5); v++) {
      const block = c[left - v];
      if (rem < block) {
        out.push(v);
        left -= v;
        break;
      }
      rem -= block;
    }
  }
  return out;
}

function parts12345Rank(e: any, p: number[]): number {
  const n = p[0];
  if (n <= 0) return 0;
  const c = parts12345Table(n);
  const parts = e as number[];
  let left = n;
  let rank = 0;
  for (const v of parts) {
    for (let vv = 1; vv < v; vv++) rank += c[left - vv];
    left -= v;
  }
  return rank;
}

function parts12345Valid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  let sum = 0;
  for (const v of e) {
    if (!Number.isInteger(v) || v < 1 || v > 5) return false;
    sum += v;
  }
  return sum === n;
}

// ---- CompositionsIntoParts1234(n) ------------------------------------------
// Compositions (ordered sequences) of n with every part in {1,2,3,4}.
// Count is the tetranacci-style recurrence c(n) = c(n-1)+c(n-2)+c(n-3)+c(n-4)
// for n>0, c(0)=1, c(negative)=0 (n=0..: 1,1,2,4,8,15,29,56,108,208,401,773,
// 1490,2872,5536,...).
//
// unrank/rank via digit-DP over the choice of first part v in {1,...,4}
// (only v<=n are legal): the number of completions after choosing v is
// c(n-v), so v is found by walking v=1,2,3,4 and subtracting block sizes
// c(n-v) from the running rank until it lands in the right block — the
// standard combinatorial-number-system pattern; rank walks the same blocks
// in the same order, so it is the exact inverse.

const compCountMemo = new Map<number, number>();

function compCount(n: number): number {
  if (n < 0) return 0;
  if (n === 0) return 1;
  const cached = compCountMemo.get(n);
  if (cached !== undefined) return cached;
  let total = 0;
  for (let v = 1; v <= 4; v++) total += compCount(n - v);
  compCountMemo.set(n, total);
  return total;
}

function compositionsIntoParts1234Count(p: number[]): number {
  return compCount(p[0]);
}

function compositionsIntoParts1234Unrank(p: number[], r: number): number[] {
  const n = p[0];
  const result: number[] = [];
  let rem = n;
  let rr = r;
  while (rem > 0) {
    let v = 1;
    for (; v <= Math.min(4, rem); v++) {
      const block = compCount(rem - v);
      if (rr < block) break;
      rr -= block;
    }
    result.push(v);
    rem -= v;
  }
  return result;
}

function compositionsIntoParts1234Rank(e: number[], p: number[]): number {
  let rem = p[0];
  let r = 0;
  for (const v of e) {
    for (let vv = 1; vv < v; vv++) r += compCount(rem - vv);
    rem -= v;
  }
  return r;
}

function compositionsIntoParts1234Valid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  let sum = 0;
  for (const v of e) {
    if (!Number.isInteger(v) || v < 1 || v > 4) return false;
    sum += v;
  }
  return sum === n;
}

// ---- CompositionsIntoParts123(n) -------------------------------------------
// Compositions of n (ordered sequences of positive-integer parts summing to
// n) with every part restricted to {1,2,3}. c(0)=1 (the empty composition);
// c(n)=c(n-1)+c(n-2)+c(n-3) for n>=1 (treating c(negative)=0) — the last part
// is 1, 2, or 3, and the rest is any composition of the remainder. This is
// the tribonacci sequence: 1,1,2,4,7,13,24,...
//
// Elements are the flat list of parts, e.g. n=3 -> [1,1,1],[1,2],[2,1],[3] in
// that lex order (smallest first part first). unrank/rank both build the
// table c(0..n) once, then walk parts front-to-back: for a given remaining
// sum `rem`, trying first-part v=1,2,3 in turn, each choice accounting for a
// block of size c(rem-v) completions.

function compositions123CountTable(n: number): number[] {
  const c = new Array(n + 1).fill(0);
  c[0] = 1;
  for (let i = 1; i <= n; i++) {
    c[i] = (i >= 1 ? c[i - 1] : 0) + (i >= 2 ? c[i - 2] : 0) + (i >= 3 ? c[i - 3] : 0);
  }
  return c;
}

function compositions123Count(p: number[]): number {
  const n = p[0];
  return compositions123CountTable(n)[n];
}

function compositions123Unrank(p: number[], r: number): number[] {
  const n = p[0];
  const c = compositions123CountTable(n);
  const parts: number[] = [];
  let rem = n;
  let rr = r;
  while (rem > 0) {
    for (let v = 1; v <= Math.min(rem, 3); v++) {
      const block = c[rem - v];
      if (rr < block) {
        parts.push(v);
        rem -= v;
        break;
      }
      rr -= block;
    }
  }
  return parts;
}

function compositions123Rank(e: number[], p: number[]): number {
  const n = p[0];
  const c = compositions123CountTable(n);
  let rem = n;
  let rank = 0;
  for (const v of e) {
    for (let vv = 1; vv < v; vv++) rank += c[rem - vv];
    rem -= v;
  }
  return rank;
}

function compositions123Valid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  let sum = 0;
  for (const v of e) {
    if (v !== 1 && v !== 2 && v !== 3) return false;
    sum += v;
  }
  return sum === n;
}

// ---- CompositionsIntoParts1And2(n) -----------------------------------------
// Ordered compositions of n using only parts 1 and 2. Count = Fibonacci-style
// f(n): f(0)=1, f(1)=1, f(n)=f(n-1)+f(n-2) (f(2)=2, f(3)=3, f(4)=5, f(5)=8 —
// matches F(n+1) under the F(1)=F(2)=1 convention).
//
// unrank/rank via digit-DP on the FIRST part: from remaining sum `rem`,
// choosing part=1 leaves f(rem-1) completions; those ranks come first, then
// part=2's f(rem-2) completions. unrank and rank walk this same order, so
// they are exact inverses by construction.

function count12(n: number): number {
  if (n === 0) return 1;
  if (n === 1) return 1;
  let a = 1;
  let b = 1;
  for (let i = 2; i <= n; i++) {
    const c = a + b;
    a = b;
    b = c;
  }
  return b;
}

function compositions12Count(p: number[]): number {
  return count12(p[0]);
}

function compositions12Unrank(p: number[], r: number): number[] {
  let rem = p[0];
  let rr = r;
  const parts: number[] = [];
  while (rem > 0) {
    const c1 = count12(rem - 1);
    if (rr < c1) {
      parts.push(1);
      rem -= 1;
    } else {
      rr -= c1;
      parts.push(2);
      rem -= 2;
    }
  }
  return parts;
}

function compositions12Rank(e: number[], p: number[]): number {
  let rem = p[0];
  let rank = 0;
  for (const part of e) {
    const c1 = count12(rem - 1);
    if (part === 2) rank += c1;
    rem -= part;
  }
  return rank;
}

function compositions12Valid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  let sum = 0;
  for (const x of e) {
    if (x !== 1 && x !== 2) return false;
    sum += x;
  }
  return sum === n;
}

// ---- CompositionsIntoOddParts(n) -------------------------------------------
// Ordered compositions of n where every part is odd. Count g(n): g(0)=1
// (empty composition); g(n) for n>=1 = sum over odd k<=n of g(n-k). Matches
// Fibonacci F(n) under F(1)=F(2)=1 for n>=1 (g(1)=1,g(2)=1,g(3)=2,g(4)=3,
// g(5)=5,g(6)=8).
//
// unrank/rank via digit-DP on the FIRST part, trying odd k=1,3,5,... in
// increasing order — same completions-per-choice construction as above.

function countOdd(n: number, memo: Map<number, number>): number {
  if (n === 0) return 1;
  const cached = memo.get(n);
  if (cached !== undefined) return cached;
  let total = 0;
  for (let k = 1; k <= n; k += 2) total += countOdd(n - k, memo);
  memo.set(n, total);
  return total;
}

function compositionsOddCount(p: number[]): number {
  return countOdd(p[0], new Map());
}

function compositionsOddUnrank(p: number[], r: number): number[] {
  const memo = new Map<number, number>();
  let rem = p[0];
  let rr = r;
  const parts: number[] = [];
  while (rem > 0) {
    let chosen = -1;
    for (let k = 1; k <= rem; k += 2) {
      const c = countOdd(rem - k, memo);
      if (rr < c) {
        chosen = k;
        break;
      }
      rr -= c;
    }
    parts.push(chosen);
    rem -= chosen;
  }
  return parts;
}

function compositionsOddRank(e: number[], p: number[]): number {
  const memo = new Map<number, number>();
  let rem = p[0];
  let rank = 0;
  for (const part of e) {
    for (let k = 1; k < part; k += 2) rank += countOdd(rem - k, memo);
    rem -= part;
  }
  return rank;
}

function compositionsOddValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  let sum = 0;
  for (const x of e) {
    if (!Number.isInteger(x) || x < 1 || x % 2 === 0) return false;
    sum += x;
  }
  return sum === n;
}

// ─── CompositionsIntoPartsAtLeast2(n): compositions of n (order matters) with every part >= 2.
// Recurrence on the first part v (2 <= v <= n): the remaining n-v is any such composition of
// n-v, giving c(0)=1 (empty composition) and c(m) = sum_{v=2}^{m} c(m-v) for m>=1 (c(1)=0, the
// empty sum). This is Fibonacci F(n-1) in the F(1)=F(2)=1 convention (n=0,2,3,4,5,6,7 ->
// 1,1,1,2,3,5,8, matching the task's reference values). unrank walks v=2,3,... consuming
// c(rem-v)-sized blocks and recursing into the remainder; rank replays the same walk. ────────────

function compAtLeast2Table(n: number): number[] {
  const c = new Array(Math.max(n, 0) + 1).fill(0);
  c[0] = 1;
  for (let m = 1; m <= n; m++) {
    let total = 0;
    for (let v = 2; v <= m; v++) total += c[m - v];
    c[m] = total;
  }
  return c;
}

function compAtLeast2Count(p: number[]): number {
  const n = p[0];
  if (n < 0) return 0;
  return compAtLeast2Table(n)[n];
}

function unrankCompAtLeast2(n: number, r: number, c: number[]): number[] {
  if (n === 0) return [];
  let rr = r;
  for (let v = 2; v <= n; v++) {
    const block = c[n - v];
    if (rr < block) return [v, ...unrankCompAtLeast2(n - v, rr, c)];
    rr -= block;
  }
  throw new Error(`CompositionsIntoPartsAtLeast2: rank out of range for n=${n}`);
}

function rankCompAtLeast2(e: number[], n: number, c: number[]): number {
  if (n === 0) return 0; // e must be []
  const v = e[0];
  let offset = 0;
  for (let vv = 2; vv < v; vv++) offset += c[n - vv];
  return offset + rankCompAtLeast2(e.slice(1), n - v, c);
}

function compositionsIntoPartsAtLeast2Unrank(p: number[], r: number): number[] {
  const n = p[0];
  const c = compAtLeast2Table(n);
  const total = c[n] ?? 0;
  return unrankCompAtLeast2(n, normRank(r, total), c);
}

function compositionsIntoPartsAtLeast2Rank(e: any, p: number[]): number {
  const n = p[0];
  const c = compAtLeast2Table(n);
  return rankCompAtLeast2(e as number[], n, c);
}

function compositionsIntoPartsAtLeast2Valid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  let sum = 0;
  for (const x of e) {
    if (typeof x !== "number" || !Number.isInteger(x) || x < 2) return false;
    sum += x;
  }
  return sum === n;
}

// ---- PartitionsIntoParts1And2(n) -------------------------------------------
// Integer partitions of n with every part in {1,2}, i.e. weakly-decreasing
// lists of 2's then 1's. Fixing t = number of 2's (0 <= t <= floor(n/2))
// determines the partition uniquely: [2]*t ++ [1]*(n-2t). Count = floor(n/2)+1.
// unrank(r) sets t=r directly (r=0 is all 1's, r=floor(n/2) is max 2's, with
// at most one leftover 1 when n is odd); rank(e) reads t back off as the
// count of 2's in e — an exact inverse by construction.

function partitions12Count(p: number[]): number {
  const n = p[0];
  if (n < 0) return 0;
  return Math.floor(n / 2) + 1;
}

function partitions12Unrank(p: number[], r: number): number[] {
  const n = p[0];
  const t = r; // number of 2's
  const ones = n - 2 * t;
  const parts: number[] = [];
  for (let i = 0; i < t; i++) parts.push(2);
  for (let i = 0; i < ones; i++) parts.push(1);
  return parts;
}

function partitions12Rank(e: any, _p: number[]): number {
  const arr = e as number[];
  let t = 0;
  for (const v of arr) if (v === 2) t++;
  return t;
}

function partitions12Valid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  let sum = 0;
  for (let i = 0; i < e.length; i++) {
    const v = e[i];
    if (v !== 1 && v !== 2) return false;
    if (i > 0 && v > e[i - 1]) return false; // weakly decreasing (2's before 1's)
    sum += v;
  }
  return sum === n;
}

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
// DistinctPartitionCount/Unrank/Rank recurrence verbatim (re-derived here to keep this file import-free
// of anything but the shared factorial helper): distinctParts(m,maxp) = # partitions of m into distinct
// parts each <= maxp, via distinctParts(m,maxp-1) [maxp unused] + distinctParts(m-maxp,maxp-1) [maxp
// used]. ─────────────────────────────────────────────────────────────────────────────────────────────

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

// ---- CompositionsBoundedParts(n,m) -----------------------------------------
// Ordered compositions of n whose parts each lie in {1,...,m}. DP:
// c[0] = 1 (the empty composition); c[rem] = sum_{part=1}^{min(rem,m)} c[rem-part].
// c is indexed by remaining sum only (0..n) so the same table serves every
// step of both unrank and rank.
//
// unrank walks rem = n down to 0, at each step trying part = 1, 2, ... in
// order; block = c[rem-part] is the number of completions that start with
// that part. If r falls inside the block it is chosen (recurse into
// rem-part with the same r); otherwise r -= block and the next part is
// tried. rank replays the identical left-to-right, ascending-part
// enumeration order and sums the skipped blocks, so it is the exact inverse.

function compBoundedCountTable(n: number, m: number): number[] {
  const c = new Array(n + 1).fill(0);
  c[0] = 1;
  for (let rem = 1; rem <= n; rem++) {
    const upper = Math.min(rem, m);
    let total = 0;
    for (let part = 1; part <= upper; part++) total += c[rem - part];
    c[rem] = total;
  }
  return c;
}

function compositionsBoundedPartsCount(p: number[]): number {
  const [n, m] = p;
  if (n < 0) return 0;
  return compBoundedCountTable(n, m)[n];
}

function compositionsBoundedPartsUnrank(p: number[], r: number): number[] {
  const [n, m] = p;
  const c = compBoundedCountTable(n, m);
  const result: number[] = [];
  let rem = n;
  let rr = r;
  while (rem > 0) {
    const upper = Math.min(rem, m);
    let chosen = -1;
    for (let part = 1; part <= upper; part++) {
      const block = c[rem - part];
      if (rr < block) {
        chosen = part;
        break;
      }
      rr -= block;
    }
    result.push(chosen);
    rem -= chosen;
  }
  return result;
}

function compositionsBoundedPartsRank(e: any, p: number[]): number {
  const [n, m] = p;
  const c = compBoundedCountTable(n, m);
  let rem = n;
  let rank = 0;
  for (const part of e) {
    for (let v = 1; v < part; v++) rank += c[rem - v];
    rem -= part;
  }
  return rank;
}

function compositionsBoundedPartsValid(e: any, p: number[]): boolean {
  const [n, m] = p;
  if (!Array.isArray(e)) return false;
  let sum = 0;
  for (const x of e) {
    if (!Number.isInteger(x) || x < 1 || x > m) return false;
    sum += x;
  }
  return sum === n;
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "CarlitzCompositions",
    paramCount: 1,
    kind: "ints",
    count: carlitzCompositionsCount,
    unrank: carlitzCompositionsUnrank,
    rank: carlitzCompositionsRank,
    valid: carlitzCompositionsValid,
  },
  {
    head: "SmirnovWords",
    paramCount: 2,
    kind: "ints",
    count: smirnovWordsCount,
    unrank: smirnovWordsUnrank,
    rank: smirnovWordsRank,
    valid: smirnovWordsValid,
  },
  {
    head: "KColoredCompositions",
    paramCount: 2,
    kind: "blocks",
    count: kColoredCompositionsCount,
    unrank: kColoredCompositionsUnrank,
    rank: kColoredCompositionsRank,
    valid: kColoredCompositionsValid,
  },
  {
    head: "CompositionsIntoParts12345",
    paramCount: 1,
    kind: "ints",
    count: parts12345Count,
    unrank: parts12345Unrank,
    rank: parts12345Rank,
    valid: parts12345Valid,
  },
  {
    head: "CompositionsIntoParts1234",
    paramCount: 1,
    kind: "ints",
    count: compositionsIntoParts1234Count,
    unrank: compositionsIntoParts1234Unrank,
    rank: compositionsIntoParts1234Rank,
    valid: compositionsIntoParts1234Valid,
  },
  {
    head: "CompositionsIntoParts123",
    paramCount: 1,
    kind: "ints",
    count: compositions123Count,
    unrank: compositions123Unrank,
    rank: compositions123Rank,
    valid: compositions123Valid,
  },
  {
    head: "CompositionsIntoParts1And2",
    paramCount: 1,
    kind: "ints",
    count: compositions12Count,
    unrank: compositions12Unrank,
    rank: compositions12Rank,
    valid: compositions12Valid,
  },
  {
    head: "CompositionsIntoOddParts",
    paramCount: 1,
    kind: "ints",
    count: compositionsOddCount,
    unrank: compositionsOddUnrank,
    rank: compositionsOddRank,
    valid: compositionsOddValid,
  },
  {
    head: "CompositionsIntoPartsAtLeast2",
    paramCount: 1,
    kind: "ints",
    count: compAtLeast2Count,
    unrank: compositionsIntoPartsAtLeast2Unrank,
    rank: compositionsIntoPartsAtLeast2Rank,
    valid: compositionsIntoPartsAtLeast2Valid,
  },
  {
    head: "PartitionsIntoParts1And2",
    paramCount: 1,
    kind: "ints",
    count: partitions12Count,
    unrank: partitions12Unrank,
    rank: partitions12Rank,
    valid: partitions12Valid,
  },
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
  {
    head: "CompositionsBoundedParts",
    paramCount: 2,
    kind: "ints",
    count: compositionsBoundedPartsCount,
    unrank: compositionsBoundedPartsUnrank,
    rank: compositionsBoundedPartsRank,
    valid: compositionsBoundedPartsValid,
  },
];

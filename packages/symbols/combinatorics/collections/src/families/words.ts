// Words: binary/base-b word families catalogued but previously kernel-less — plain words, weight
// classes, Fibonacci/Lucas-restricted words, reflected Gray code, palindromes, and necklaces/Lyndon
// words (binary and k-ary). Pure rank/unrank kernels over plain JS numbers/arrays, same contract as
// every other family (types.ts). A few reuse kernels already certified elsewhere (BinaryStrings,
// FibonacciWords, Tuples, k-subsets); the rest (Lucas strings, Gray code, palindromes, necklaces,
// Lyndon words) are new, several adapted from the archived enumeratio.dev's compute-engine
// packs/words.ts (Necklaces/LyndonWords there are exactly KNecklaces/KLyndonWords here).
import { binomial } from "./shared.ts";
import { Binomial } from "./kernels-combinatorics.ts";
import {
  BinaryStringCount,
  BinaryStringUnrank,
  BinaryStringRank,
  IsBinaryString,
  TupleCount,
  TupleUnrank,
  TupleRank,
  IsTupleOf,
  FibonacciWordCount,
  FibonacciWordUnrank,
  FibonacciWordRank,
  IsFibonacciWord,
} from "./kernels-extra.ts";
import type { NumberKernel } from "./types.ts";

const normRank = (r: number, total: number): number => (total > 0 ? ((Math.trunc(r) % total) + total) % total : 0);

// ─── BinaryWordsByWeight(n, k): length-n binary words with exactly k ones, in lexicographic order
// (0 preferred over 1 at each position). Count = C(n,k). Standard combinatorial-number-system walk:
// at each position, placing 0 leaves a block of C(posLeft, onesLeft) completions that sorts first. ──
function byWeightCount(n: number, k: number): number {
  return Binomial(n, k);
}
function byWeightUnrank(n: number, k: number, r: number): number[] {
  const total = byWeightCount(n, k);
  let rem = normRank(r, total);
  const bits: number[] = [];
  let onesLeft = k;
  for (let i = 0; i < n; i++) {
    const posLeft = n - i - 1;
    if (onesLeft === 0) {
      bits.push(0);
      continue;
    }
    if (posLeft < onesLeft) {
      bits.push(1);
      onesLeft--;
      continue;
    }
    const zeroBlock = binomial(posLeft, onesLeft);
    if (rem < zeroBlock) {
      bits.push(0);
    } else {
      rem -= zeroBlock;
      bits.push(1);
      onesLeft--;
    }
  }
  return bits;
}
function byWeightRank(bits: number[], n: number, k: number): number {
  let rem = 0;
  let onesLeft = k;
  for (let i = 0; i < n; i++) {
    const posLeft = n - i - 1;
    if (onesLeft === 0) continue;
    if (posLeft < onesLeft) {
      onesLeft--;
      continue;
    }
    if (bits[i] === 1) {
      rem += binomial(posLeft, onesLeft);
      onesLeft--;
    }
  }
  return rem;
}
function byWeightValid(bits: unknown, n: number, k: number): boolean {
  if (!Array.isArray(bits) || bits.length !== n) return false;
  let ones = 0;
  for (const b of bits) {
    if (b !== 0 && b !== 1) return false;
    if (b === 1) ones++;
  }
  return ones === k;
}

// ─── LucasStrings(n): CIRCULAR binary words of length n with no two consecutive 1s, wrap edge
// (position n ↔ 1) included — the Lucas numbers (n=0 is the empty word, taken as count 1, not L(0)=2).
// Split by the first bit b: b=0 imposes no wrap constraint, so the remaining n-1 bits are a free
// FibonacciWords(n-1) suffix; b=1 forces bit 2 = 0 (linear adjacency) and bit n = 0 (wrap), so the
// n-3 bits between them are a free FibonacciWords(n-3) middle (n=2 collapses the two forced zeros
// into the single remaining bit). Lex order: the b=0 block sorts first. ─────────────────────────────
function lucasCount(n: number): number {
  if (n === 0) return 1;
  if (n === 1) return 1;
  return FibonacciWordCount(n - 1) + FibonacciWordCount(Math.max(n - 3, 0));
}
function lucasStringsUnrank(n: number, r: number): number[] {
  if (n === 0) return [];
  if (n === 1) return [0];
  const total = lucasCount(n);
  let rem = normRank(r, total);
  const sizeB0 = FibonacciWordCount(n - 1);
  if (rem < sizeB0) return [0, ...FibonacciWordUnrank(n - 1, rem)];
  rem -= sizeB0;
  if (n === 2) return [1, 0];
  const mid = FibonacciWordUnrank(n - 3, rem);
  return [1, 0, ...mid, 0];
}
function lucasStringsRank(bits: number[], n: number): number {
  if (n <= 1) return 0;
  if (bits[0] === 0) return FibonacciWordRank(bits.slice(1));
  const sizeB0 = FibonacciWordCount(n - 1);
  if (n === 2) return sizeB0;
  const mid = bits.slice(2, n - 1);
  return sizeB0 + FibonacciWordRank(mid);
}
function lucasStringsValid(bits: unknown, n: number): boolean {
  if (!Array.isArray(bits) || bits.length !== n) return false;
  for (const b of bits) if (b !== 0 && b !== 1) return false;
  if (n === 0) return true;
  for (let i = 0; i < n; i++) {
    if (bits[i] === 1 && bits[(i + 1) % n] === 1) return false; // cyclic adjacency, wraps at i = n-1
  }
  return true;
}

// ─── GrayCodes(n): binary words of length n in binary-reflected Gray-code order (A003188);
// consecutive words differ in exactly one bit. g(r) = r XOR (r >> 1), rendered MSB-first; rank is
// the standard inverse-Gray unshuffle. ──────────────────────────────────────────────────────────────
function grayCodeCount(n: number): number {
  return 2 ** n;
}
function grayCodeUnrank(n: number, r: number): number[] {
  const total = grayCodeCount(n);
  const rem = normRank(r, total);
  const g = rem ^ (rem >> 1);
  const bits: number[] = [];
  for (let i = 0; i < n; i++) bits.push((g >> (n - 1 - i)) & 1);
  return bits;
}
function grayCodeRank(bits: number[]): number {
  let g = 0;
  for (const b of bits) g = (g << 1) | b;
  let r = g;
  for (let shift = 1; shift < 31; shift <<= 1) r ^= r >> shift; // inverse Gray
  return r >>> 0;
}

// ─── BinaryPalindromes(n): binary words that read the same reversed. Count = 2^ceil(n/2). The free
// first half determines the rest by mirroring; unrank/rank read/pack it MSB-first. ──────────────────
function palindromeCount(n: number): number {
  return 2 ** Math.ceil(n / 2);
}
function palindromeUnrank(n: number, r: number): number[] {
  const half = Math.ceil(n / 2);
  const total = palindromeCount(n);
  const rem = normRank(r, total);
  const free: number[] = [];
  for (let i = 0; i < half; i++) free.push((rem >> (half - 1 - i)) & 1);
  return Array.from({ length: n }, (_, i) => (i < half ? free[i] : free[n - 1 - i]));
}
function palindromeRank(bits: number[], n: number): number {
  const half = Math.ceil(n / 2);
  let r = 0;
  for (let i = 0; i < half; i++) r = (r << 1) | (bits[i] & 1);
  return r >>> 0;
}
function palindromeValid(bits: unknown, n: number): boolean {
  if (!Array.isArray(bits) || bits.length !== n) return false;
  for (const b of bits) if (b !== 0 && b !== 1) return false;
  for (let i = 0; i < Math.floor(n / 2); i++) if (bits[i] !== bits[n - 1 - i]) return false;
  return true;
}

// ─── number theory: Möbius mu, Euler phi, divisors — the closed forms for necklace/Lyndon counts. ───
function divisorsOf(n: number): number[] {
  const out: number[] = [];
  for (let d = 1; d * d <= n; d++) {
    if (n % d === 0) {
      out.push(d);
      if (d !== n / d) out.push(n / d);
    }
  }
  return out.sort((a, b) => a - b);
}
function mobiusMu(n: number): number {
  if (n === 1) return 1;
  let m = n;
  let primeCount = 0;
  for (let p = 2; p * p <= m; p++) {
    if (m % p === 0) {
      m /= p;
      if (m % p === 0) return 0; // p^2 | n
      primeCount++;
    }
  }
  if (m > 1) primeCount++;
  return primeCount % 2 === 0 ? 1 : -1;
}
function eulerPhi(n: number): number {
  let result = n;
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    if (m % p === 0) {
      while (m % p === 0) m /= p;
      result -= result / p;
    }
  }
  if (m > 1) result -= result / m;
  return Math.round(result);
}
function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function compareArrays(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
function rotateLeft(w: number[], s: number): number[] {
  const n = w.length;
  return Array.from({ length: n }, (_, i) => w[(i + s) % n]);
}
function isPeriod(w: number[], d: number): boolean {
  for (let i = d; i < w.length; i++) if (w[i] !== w[i % d]) return false;
  return true;
}

// ─── FKM (Fredricksen–Kessler–Maiorana / Duval) algorithm: all Lyndon words of length <= n over the
// 0-indexed alphabet {0..k-1}, in lex order. Classical necklace/de Bruijn generation successor step:
// extend the current word periodically to length n, strip trailing (k-1)'s, bump the new last letter.
function fkmLyndonWordsUpTo(n: number, k: number): number[][] {
  const out: number[][] = [];
  if (n <= 0 || k <= 0) return out;
  let w: number[] = [0];
  while (w.length > 0) {
    out.push(w.slice());
    const m = w.length;
    while (w.length < n) w.push(w[w.length - m]);
    while (w.length > 0 && w[w.length - 1] === k - 1) w.pop();
    if (w.length > 0) w[w.length - 1] += 1;
  }
  return out;
}
/** Lyndon words of length EXACTLY n over alphabet {1..k}, lex order (1-indexed letters). */
const lyndonWordsExactCache = new Map<string, number[][]>();
function lyndonWordsExact(n: number, k: number): number[][] {
  if (n <= 0 || k <= 0) return [];
  const key = `${n},${k}`;
  const cached = lyndonWordsExactCache.get(key);
  if (cached) return cached;
  const words = fkmLyndonWordsUpTo(n, k)
    .filter((w) => w.length === n)
    .map((w) => w.map((x) => x + 1));
  lyndonWordsExactCache.set(key, words);
  return words;
}
/** |{Lyndon words of length n over a k-ary alphabet}| = (1/n) Σ_{d|n} μ(d)·k^(n/d). */
function lyndonCount(n: number, k: number): number {
  if (n <= 0 || k <= 0) return 0;
  let sum = 0;
  for (const d of divisorsOf(n)) sum += mobiusMu(d) * Math.pow(k, n / d);
  return Math.round(sum / n);
}

// ─── KNecklaces(n, k) / KLyndonWords(n, k): words over {1..k} up to rotation, represented by the
// lex-smallest rotation (necklaces) resp. the aperiodic subfamily (Lyndon words, strictly less than
// every nontrivial rotation). count(n,k) = (1/n) Σ_{d|n} φ(d)·k^(n/d) resp. μ(d) variant above.
// Necklaces unrank/rank use the classical Lyndon-word factorization of a necklace's minimal rotation
// (L^(n/d), d | n minimal period, L a length-d Lyndon word): walk divisors of n increasing, each a
// block of LyndonCount(d,k) necklaces (one per Lyndon word repeated n/d times). ─────────────────────
function necklacesCount(n: number, k: number): number {
  if (k <= 0) return 0;
  if (n === 0) return 1;
  if (n < 0) return 0;
  let sum = 0;
  for (const d of divisorsOf(n)) sum += eulerPhi(d) * Math.pow(k, n / d);
  return Math.round(sum / n);
}
function necklacesUnrank(n: number, k: number, r: number): number[] {
  if (n <= 0) return [];
  const total = necklacesCount(n, k);
  let rem = normRank(r, total);
  for (const d of divisorsOf(n)) {
    const block = lyndonCount(d, k);
    if (rem < block) {
      const L = lyndonWordsExact(d, k)[rem];
      const rep = n / d;
      const out: number[] = [];
      for (let i = 0; i < rep; i++) for (const x of L) out.push(x);
      return out;
    }
    rem -= block;
  }
  return []; // unreachable when 0 <= rem < total
}
function necklacesRank(w: number[], n: number, k: number): number {
  if (n <= 0) return 0;
  const divs = divisorsOf(n);
  let d = n;
  for (const cand of divs) {
    if (isPeriod(w, cand)) {
      d = cand;
      break;
    }
  }
  const L = w.slice(0, d);
  const idx = lyndonWordsExact(d, k).findIndex((x) => arraysEqual(x, L));
  let offset = 0;
  for (const dd of divs) {
    if (dd === d) break;
    offset += lyndonCount(dd, k);
  }
  return offset + idx;
}
function necklacesValid(w: unknown, n: number, k: number): boolean {
  if (!Array.isArray(w) || w.length !== n) return false;
  for (const v of w) if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > k) return false;
  if (n === 0) return true;
  for (let s = 1; s < n; s++) if (compareArrays(w, rotateLeft(w, s)) > 0) return false; // <= every rotation
  return true;
}
function lyndonWordsUnrank(n: number, k: number, r: number): number[] {
  if (n <= 0) return [];
  const total = lyndonCount(n, k);
  const idx = normRank(r, total);
  return lyndonWordsExact(n, k)[idx];
}
function lyndonWordsRank(w: number[], n: number, k: number): number {
  return lyndonWordsExact(n, k).findIndex((x) => arraysEqual(x, w));
}
function lyndonWordsValid(w: unknown, n: number, k: number): boolean {
  if (!Array.isArray(w) || w.length !== n) return false;
  for (const v of w) if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > k) return false;
  if (n === 0) return false; // no length-0 Lyndon word
  for (let s = 1; s < n; s++) if (compareArrays(w, rotateLeft(w, s)) >= 0) return false; // strictly <
  return true;
}

// helper to cut boilerplate for the flat (number[]) shape, matching core.ts's `ints`.
const ints = (
  head: string,
  paramCount: 1 | 2,
  count: (p: number[]) => number,
  unrank: (p: number[], r: number) => number[],
  valid: (e: number[], p: number[]) => boolean,
  rank: (e: number[], p: number[]) => number,
): NumberKernel => ({
  head,
  paramCount,
  kind: "ints",
  count,
  unrank,
  valid: (e, p) => valid(e as number[], p),
  rank: (e, p) => rank(e as number[], p),
});

export const entries: NumberKernel[] = [
  // BinaryWords(n): strings over {0,1}. Reuses the BinaryStrings kernel (same family, catalogued
  // under this name).
  ints(
    "BinaryWords",
    1,
    ([n]) => BinaryStringCount(n),
    ([n], r) => BinaryStringUnrank(n, r),
    (a, [n]) => IsBinaryString(a, n),
    (a) => BinaryStringRank(a),
  ),
  // BinaryWordsByWeight(n, k): length-n binary words of Hamming weight k.
  ints(
    "BinaryWordsByWeight",
    2,
    ([n, k]) => byWeightCount(n, k),
    ([n, k], r) => byWeightUnrank(n, k, r),
    (a, [n, k]) => byWeightValid(a, n, k),
    (a, [n, k]) => byWeightRank(a, n, k),
  ),
  // Words(size, base): strings over a size-b alphabet — Tuples(base, size) with the two grades
  // (size axis, base param) reordered to match the catalog's declared grade order.
  ints(
    "Words",
    2,
    ([size, base]) => TupleCount(base, size),
    ([size, base], r) => TupleUnrank(base, size, r),
    (a, [size, base]) => IsTupleOf(a, base, size),
    (a, [, base]) => TupleRank(a, base),
  ),
  // FibStrings(n): binary words with no two consecutive 1s — F(n+2). Same family as the already
  // declared FibonacciWords head; reuses its kernels under the catalogued name.
  ints(
    "FibStrings",
    1,
    ([n]) => FibonacciWordCount(n),
    ([n], r) => FibonacciWordUnrank(n, r),
    (a, [n]) => IsFibonacciWord(a, n),
    (a) => FibonacciWordRank(a),
  ),
  // LucasStrings(n): circular no-two-consecutive-1s binary words — the Lucas numbers.
  ints(
    "LucasStrings",
    1,
    ([n]) => lucasCount(n),
    ([n], r) => lucasStringsUnrank(n, r),
    (a, [n]) => lucasStringsValid(a, n),
    (a, [n]) => lucasStringsRank(a, n),
  ),
  // GrayCodes(n): binary words in reflected Gray-code order.
  ints(
    "GrayCodes",
    1,
    ([n]) => grayCodeCount(n),
    ([n], r) => grayCodeUnrank(n, r),
    (a, [n]) => a.length === n && a.every((b) => b === 0 || b === 1),
    (a) => grayCodeRank(a),
  ),
  // BinaryPalindromes(n): binary words that read the same reversed.
  ints(
    "BinaryPalindromes",
    1,
    ([n]) => palindromeCount(n),
    ([n], r) => palindromeUnrank(n, r),
    (a, [n]) => palindromeValid(a, n),
    (a, [n]) => palindromeRank(a, n),
  ),
  // BinaryNecklaces(n): binary words up to rotation (lex-least reps) — KNecklaces(n, 2), remapped
  // from 1-indexed {1,2} letters to {0,1}.
  ints(
    "BinaryNecklaces",
    1,
    ([n]) => necklacesCount(n, 2),
    ([n], r) => necklacesUnrank(n, 2, r).map((x) => x - 1),
    (a, [n]) =>
      necklacesValid(
        a.map((x) => x + 1),
        n,
        2,
      ),
    (a, [n]) =>
      necklacesRank(
        a.map((x) => x + 1),
        n,
        2,
      ),
  ),
  // LyndonWords(n): binary words strictly less than every rotation — KLyndonWords(n, 2), remapped
  // to {0,1}.
  ints(
    "LyndonWords",
    1,
    ([n]) => lyndonCount(n, 2),
    ([n], r) => lyndonWordsUnrank(n, 2, r).map((x) => x - 1),
    (a, [n]) =>
      lyndonWordsValid(
        a.map((x) => x + 1),
        n,
        2,
      ),
    (a, [n]) =>
      lyndonWordsRank(
        a.map((x) => x + 1),
        n,
        2,
      ),
  ),
  // KNecklaces(size, base): base-letter words up to rotation (lex-least reps).
  ints(
    "KNecklaces",
    2,
    ([n, k]) => necklacesCount(n, k),
    ([n, k], r) => necklacesUnrank(n, k, r),
    (a, [n, k]) => necklacesValid(a, n, k),
    (a, [n, k]) => necklacesRank(a, n, k),
  ),
  // KLyndonWords(size, base): aperiodic base-letter necklaces.
  ints(
    "KLyndonWords",
    2,
    ([n, k]) => lyndonCount(n, k),
    ([n, k], r) => lyndonWordsUnrank(n, k, r),
    (a, [n, k]) => lyndonWordsValid(a, n, k),
    (a, [n, k]) => lyndonWordsRank(a, n, k),
  ),
];

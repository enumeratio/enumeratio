// Words: binary/base-b word families catalogued but previously kernel-less — plain words, weight
// classes, Fibonacci/Lucas-restricted words, reflected Gray code, palindromes, and necklaces/Lyndon
// words (binary and k-ary). Pure rank/unrank kernels over plain JS numbers/arrays, same contract as
// every other family (types.ts). A few reuse kernels already certified elsewhere (BinaryStrings,
// FibonacciWords, Tuples, k-subsets); the rest (Lucas strings, Gray code, palindromes, necklaces,
// Lyndon words) are new, several adapted from the archived enumeratio repo's compute-engine
// packs/words.ts (Necklaces/LyndonWords there are exactly KNecklaces/KLyndonWords here).
import { modRank } from "../../../collections/src/families/kernels.ts";
import { binaryPalindromes, binaryStrings, grayCodes, words } from "../../../collections/src/families/closed-forms.ts";
import { necklaceCountExact } from "../../../collections/src/families/exact-counts.ts";
import { lyndonWordCountExact } from "../../../collections/src/families/exact-classes.ts";
import { binaryWordsByWeight, fibStrings, lucasStrings } from "./epsil.ts";
import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import type { Declared, NumberKernel } from "../../../collections/src/families/types.ts";

export const normRank = (r: number, total: number): number => (total > 0 ? modRank(Math.trunc(r), total) : 0);

// ─── BinaryWordsByWeight(n, k): length-n binary words with exactly k ones, in lexicographic order
// (0 preferred over 1 at each position). Count = C(n,k). Standard combinatorial-number-system walk:
// at each position, placing 0 leaves a block of C(posLeft, onesLeft) completions that sorts first. ──
// ─── LucasStrings(n): CIRCULAR binary words of length n with no two consecutive 1s, wrap edge
// (position n ↔ 1) included — the Lucas numbers (n=0 is the empty word, taken as count 1, not L(0)=2).
// Split by the first bit b: b=0 imposes no wrap constraint, so the remaining n-1 bits are a free
// FibonacciWords(n-1) suffix; b=1 forces bit 2 = 0 (linear adjacency) and bit n = 0 (wrap), so the
// n-3 bits between them are a free FibonacciWords(n-3) middle (n=2 collapses the two forced zeros
// into the single remaining bit). Lex order: the b=0 block sorts first. ─────────────────────────────
// ─── GrayCodes(n): binary words of length n in binary-reflected Gray-code order (A003188);
// consecutive words differ in exactly one bit. g(r) = r XOR (r >> 1), rendered MSB-first; rank is
// the standard inverse-Gray unshuffle. ──────────────────────────────────────────────────────────────
// ─── BinaryPalindromes(n): binary words that read the same reversed. Count = 2^ceil(n/2). The free
// first half determines the rest by mirroring; unrank/rank read/pack it MSB-first. ──────────────────
// ─── number theory: Möbius mu, Euler phi, divisors — the closed forms for necklace/Lyndon counts. ───
function divisorsOf(n: number): number[] {
  const out: number[] = [];
  for (let d = 1; d * d <= n; d++) {
    if (n % d === 0) {
      out.push(d);
      if (d !== n / d) out.push(n / d);
    }
  }
  out.sort((a, b) => a - b);
  return out;
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

// Necklaces and Lyndon words stay TS: they index the FKM-generated list of words (list accumulation); no ranking arithmetic.
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

/** Words up to rotation (or reflection): unrank and rank enumerate all base^size words. */
const wordClass = (carrier: string, base?: number): Declared => ({
  carrier,
  params:
    base === undefined
      ? [
          { name: "size", role: "axis", min: 0 },
          { name: "base", role: "param", min: 1 },
        ]
      : [{ name: "n", role: "axis", min: 0 }],
  cost: { count: "closed", unrank: "enumerative", rank: "enumerative", valid: "polynomial" },
  work: ([n, k]) => BigInt(base ?? (k as number)) ** BigInt(n as number),
});

// Closed-form families, defined in Epsil (collections/src/families/closed-forms.ts, ./epsil.ts).
// The TS kernels (byWeight*, lucas*, grayCode*, palindrome*, in tests/readings) are the independent
// reading their agreement tests check them against, not runtime paths.
const binaryWords = binaryStrings({
  head: "BinaryWords",
  params: ["_n"],
  carrier: "BinaryWord",
});
const wordsFamily = words({
  head: "Words",
  params: ["_size", "_base"],
  carrier: "Word",
});
const grayCodesFamily = grayCodes({
  head: "GrayCodes",
  params: ["_n"],
  carrier: "BinaryWord",
});
const binaryPalindromesFamily = binaryPalindromes({
  head: "BinaryPalindromes",
  params: ["_n"],
  carrier: "BinaryWord",
});

export const entries: (NumberKernel | EpsilFamily)[] = [
  binaryWords,
  binaryWordsByWeight,
  wordsFamily,
  // Same words as FibonacciWords, under the catalogued name.
  fibStrings,
  lucasStrings,
  grayCodesFamily,
  binaryPalindromesFamily,
  // BinaryNecklaces(n): binary words up to rotation (lex-least reps) — KNecklaces(n, 2), remapped
  // from 1-indexed {1,2} letters to {0,1}.
  {
    ...ints(
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
    exactCount: ([n]) => necklaceCountExact(n, 2),
    declared: wordClass("BinaryWord", 2),
    carrier: "BinaryWord",
  },
  // LyndonWords(n): binary words strictly less than every rotation — KLyndonWords(n, 2), remapped
  // to {0,1}.
  {
    ...ints(
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
    exactCount: ([n]) => lyndonWordCountExact(n, 2),
    declared: wordClass("BinaryWord", 2),
    carrier: "BinaryWord",
  },
  // KNecklaces(size, base): base-letter words up to rotation (lex-least reps).
  {
    ...ints(
      "KNecklaces",
      2,
      ([n, k]) => necklacesCount(n, k),
      ([n, k], r) => necklacesUnrank(n, k, r),
      (a, [n, k]) => necklacesValid(a, n, k),
      (a, [n, k]) => necklacesRank(a, n, k),
    ),
    exactCount: ([n, k]) => necklaceCountExact(n, k),
    declared: wordClass("Word"),
  },
  // KLyndonWords(size, base): aperiodic base-letter necklaces.
  {
    ...ints(
      "KLyndonWords",
      2,
      ([n, k]) => lyndonCount(n, k),
      ([n, k], r) => lyndonWordsUnrank(n, k, r),
      (a, [n, k]) => lyndonWordsValid(a, n, k),
      (a, [n, k]) => lyndonWordsRank(a, n, k),
    ),
    exactCount: ([n, k]) => lyndonWordCountExact(n, k),
    declared: wordClass("Word"),
  },
];

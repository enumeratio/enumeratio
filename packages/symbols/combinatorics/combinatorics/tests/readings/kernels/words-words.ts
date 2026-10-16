// Moved out of the runtime by BL-225: kernels only tests/readings and the agreement tests use.
import { Binomial } from "../../../collections/src/families/kernels-combinatorics.ts";
import { bitOf, highWord, joinWords, lowWord, wordsOfBits } from "../../../collections/src/families/kernels.ts";
import { normRank } from "../../../words/src/families/words.ts";
import { FibonacciWordCount, FibonacciWordRank, FibonacciWordUnrank } from "./collections-kernels-extra.ts";
import { grayWords, ungrayWords } from "./collections-kernels.ts";

export function lucasStringsValid(bits: unknown, n: number): boolean {
  if (!Array.isArray(bits) || bits.length !== n) return false;
  for (const b of bits) if (b !== 0 && b !== 1) return false;
  if (n === 0) return true;
  for (let i = 0; i < n; i++) {
    if (bits[i] === 1 && bits[(i + 1) % n] === 1) return false; // cyclic adjacency, wraps at i = n-1
  }
  return true;
}

export function lucasStringsRank(bits: number[], n: number): number {
  if (n <= 1) return 0;
  if (bits[0] === 0) return FibonacciWordRank(bits.slice(1));
  const sizeB0 = FibonacciWordCount(n - 1);
  if (n === 2) return sizeB0;
  const mid = bits.slice(2, n - 1);
  return sizeB0 + FibonacciWordRank(mid);
}

// ─── LucasStrings(n): CIRCULAR binary words of length n with no two consecutive 1s, wrap edge
// (position n ↔ 1) included — the Lucas numbers (n=0 is the empty word, taken as count 1, not L(0)=2).
// Split by the first bit b: b=0 imposes no wrap constraint, so the remaining n-1 bits are a free
// FibonacciWords(n-1) suffix; b=1 forces bit 2 = 0 (linear adjacency) and bit n = 0 (wrap), so the
// n-3 bits between them are a free FibonacciWords(n-3) middle (n=2 collapses the two forced zeros
// into the single remaining bit). Lex order: the b=0 block sorts first. ─────────────────────────────
export function lucasCount(n: number): number {
  if (n === 0) return 1;
  if (n === 1) return 1;
  return FibonacciWordCount(n - 1) + FibonacciWordCount(Math.max(n - 3, 0));
}

export function lucasStringsUnrank(n: number, r: number): number[] {
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

export function byWeightValid(bits: unknown, n: number, k: number): boolean {
  if (!Array.isArray(bits) || bits.length !== n) return false;
  let ones = 0;
  for (const b of bits) {
    if (b !== 0 && b !== 1) return false;
    if (b === 1) ones++;
  }
  return ones === k;
}

export function byWeightRank(bits: number[], n: number, k: number): number {
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
      rem += Binomial(posLeft, onesLeft);
      onesLeft--;
    }
  }
  return rem;
}

// ─── BinaryWordsByWeight(n, k): length-n binary words with exactly k ones, in lexicographic order
// (0 preferred over 1 at each position). Count = C(n,k). Standard combinatorial-number-system walk:
// at each position, placing 0 leaves a block of C(posLeft, onesLeft) completions that sorts first. ──
export function byWeightCount(n: number, k: number): number {
  return Binomial(n, k);
}

export function byWeightUnrank(n: number, k: number, r: number): number[] {
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
    const zeroBlock = Binomial(posLeft, onesLeft);
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

export function palindromeValid(bits: unknown, n: number): boolean {
  if (!Array.isArray(bits) || bits.length !== n) return false;
  for (const b of bits) if (b !== 0 && b !== 1) return false;
  for (let i = 0; i < Math.floor(n / 2); i++) if (bits[i] !== bits[n - 1 - i]) return false;
  return true;
}

export function palindromeRank(bits: number[], n: number): number {
  const half = Math.ceil(n / 2);
  const [lo, hi] = wordsOfBits(
    Array.from({ length: half }, (_, i) => i)
      .filter((i) => (bits[i] & 1) === 1)
      .map((i) => half - 1 - i),
  );
  return joinWords(lo, hi);
}

// ─── BinaryPalindromes(n): binary words that read the same reversed. Count = 2^ceil(n/2). The free
// first half determines the rest by mirroring; unrank/rank read/pack it MSB-first. ──────────────────
export function palindromeCount(n: number): number {
  return 2 ** Math.ceil(n / 2);
}

export function palindromeUnrank(n: number, r: number): number[] {
  const half = Math.ceil(n / 2);
  const total = palindromeCount(n);
  const rem = normRank(r, total);
  const hi = highWord(rem);
  const lo = lowWord(rem, hi);
  const free = Array.from({ length: half }, (_, i) => bitOf(lo, hi, half - 1 - i));
  return Array.from({ length: n }, (_, i) => (i < half ? free[i] : free[n - 1 - i]));
}

export function grayCodeRank(bits: number[]): number {
  const [gLo, gHi] = wordsOfBits(bits.flatMap((b, i) => (b === 1 ? [bits.length - 1 - i] : [])));
  const [lo, hi] = ungrayWords(gLo, gHi);
  return joinWords(lo, hi);
}

// ─── GrayCodes(n): binary words of length n in binary-reflected Gray-code order (A003188);
// consecutive words differ in exactly one bit. g(r) = r XOR (r >> 1), rendered MSB-first; rank is
// the standard inverse-Gray unshuffle. ──────────────────────────────────────────────────────────────
export function grayCodeCount(n: number): number {
  return 2 ** n;
}

export function grayCodeUnrank(n: number, r: number): number[] {
  const total = grayCodeCount(n);
  const rem = normRank(r, total);
  const hi = highWord(rem);
  const [gLo, gHi] = grayWords(lowWord(rem, hi), hi);
  return Array.from({ length: n }, (_, i) => bitOf(gLo, gHi, n - 1 - i));
}

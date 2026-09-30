// Binary/base-b word families catalogued but previously kernel-less: bracelets (rotation +
// reflection), tribonacci-restricted strings, primitive (aperiodic) binary strings, ternary
// reflected Gray code, and Stirling permutations. Self-contained — duplicates a little of
// words.ts's necklace/Lyndon/number-theory machinery locally rather than reaching into that
// module (only its `entries` export is public). Pure rank/unrank kernels over plain JS
// numbers/arrays, same contract as every other family (types.ts).
import type { NumberKernel } from "./types.ts";

const normRank = (r: number, total: number): number => (total > 0 ? ((Math.trunc(r) % total) + total) % total : 0);

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
  if (n === 0) return w.slice();
  return Array.from({ length: n }, (_, i) => w[(i + s) % n]);
}

// BinaryBracelets/KBracelets (and their own `reversed`/`eulerPhi` helpers) moved to
// words/src/families/binary-word-families.ts — §4 step 5, their `declared.carrier` ("BinaryWord"
// / "Word") is a words-area one. TernaryGrayCodes joined them there (wire-carriers lane A-91),
// now carrying "TernaryGrayCode". StirlingPermutations joined them too (wire-carriers lane
// A-92): it now carries "StirlingPermutation" (NOT "Permutation" — its values repeat).
// TriStrings/PrimitiveBinaryStrings below still declare no carrier and stay here per step 5
// rule 4.

// ─── number theory (mirrors words.ts's private copy — needed here too). ───────
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
// ─── TriStrings(n): binary words of length n with no 3 consecutive 1s — the tribonacci-like
// count A000073-shifted (T(n)=T(n-1)+T(n-2)+T(n-3), T(0)=1, T(1)=2, T(2)=4). comp(len, state) =
// number of valid length-`len` completions given `state` (0/1/2) trailing 1s already placed;
// unrank/rank walk positions left to right exactly like BinaryWordsByWeight's combinatorial-
// number-system walk, using comp() as the block-size function (0 sorts before 1 at each spot). ────
const triCompCache = new Map<string, number>();
function triComp(len: number, state: 0 | 1 | 2): number {
  if (len === 0) return 1;
  const key = `${len},${state}`;
  const cached = triCompCache.get(key);
  if (cached !== undefined) return cached;
  const withZero = triComp(len - 1, 0);
  const withOne = state < 2 ? triComp(len - 1, (state + 1) as 0 | 1 | 2) : 0;
  const total = withZero + withOne;
  triCompCache.set(key, total);
  return total;
}
function triCount(n: number): number {
  return triComp(n, 0);
}
function triUnrank(n: number, r: number): number[] {
  const total = triCount(n);
  let rem = normRank(r, total);
  let state: 0 | 1 | 2 = 0;
  const bits: number[] = [];
  for (let i = 0; i < n; i++) {
    const remaining = n - i - 1;
    const zeroBlock = triComp(remaining, 0);
    if (rem < zeroBlock) {
      bits.push(0);
      state = 0;
    } else {
      rem -= zeroBlock;
      bits.push(1);
      state = (state + 1) as 0 | 1 | 2;
    }
  }
  return bits;
}
function triRank(bits: number[], n: number): number {
  let rem = 0;
  let state: 0 | 1 | 2 = 0;
  for (let i = 0; i < n; i++) {
    const remaining = n - i - 1;
    const zeroBlock = triComp(remaining, 0);
    if (bits[i] === 1) {
      rem += zeroBlock;
      state = (state + 1) as 0 | 1 | 2;
    } else {
      state = 0;
    }
  }
  return rem;
}
function triValid(bits: unknown, n: number): boolean {
  if (!Array.isArray(bits) || bits.length !== n) return false;
  let run = 0;
  for (const b of bits) {
    if (b !== 0 && b !== 1) return false;
    run = b === 1 ? run + 1 : 0;
    if (run >= 3) return false;
  }
  return true;
}

// ─── PrimitiveBinaryStrings(n): aperiodic binary words (no proper period) — A027375. Every
// primitive word's set of n rotations is exactly the orbit of a length-n Lyndon word (rotations
// of a Lyndon word are pairwise distinct precisely because it's aperiodic), so the primitive
// words are the union, over each length-n Lyndon word, of its n rotations — count = Σ_{d|n}
// μ(d)·2^(n/d) (the un-normalized sum inside the Lyndon-word count formula). Built from a local
// Lyndon-word generator (FKM/Duval), same algorithm as words.ts's private one. ─────────────────────
function mobiusMu(n: number): number {
  if (n === 1) return 1;
  let m = n;
  let primeCount = 0;
  for (let p = 2; p * p <= m; p++) {
    if (m % p === 0) {
      m /= p;
      if (m % p === 0) return 0;
      primeCount++;
    }
  }
  if (m > 1) primeCount++;
  return primeCount % 2 === 0 ? 1 : -1;
}
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
function binaryLyndonWordsExact(n: number): number[][] {
  if (n <= 0) return [];
  return fkmLyndonWordsUpTo(n, 2).filter((w) => w.length === n);
}
function primitiveCount(n: number): number {
  if (n <= 0) return 0; // no length-0 primitive word — the empty word has no well-defined minimal period
  let sum = 0;
  for (const d of divisorsOf(n)) sum += mobiusMu(d) * Math.pow(2, n / d);
  return Math.round(sum);
}
const primitiveRepsCache = new Map<number, number[][]>();
function primitiveReps(n: number): number[][] {
  const cached = primitiveRepsCache.get(n);
  if (cached) return cached;
  const reps: number[][] = [];
  for (const L of binaryLyndonWordsExact(n)) {
    for (let s = 0; s < n; s++) reps.push(rotateLeft(L, s));
  }
  reps.sort(compareArrays);
  primitiveRepsCache.set(n, reps);
  return reps;
}
function primitiveUnrank(n: number, r: number): number[] {
  const reps = primitiveReps(n);
  return reps[normRank(r, reps.length)].slice();
}
function primitiveRank(w: number[], n: number): number {
  return primitiveReps(n).findIndex((x) => arraysEqual(x, w));
}
function isPeriod(w: number[], d: number): boolean {
  for (let i = d; i < w.length; i++) if (w[i] !== w[i % d]) return false;
  return true;
}
function primitiveValid(w: unknown, n: number): boolean {
  if (!Array.isArray(w) || w.length !== n || n === 0) return false;
  for (const b of w) if (b !== 0 && b !== 1) return false;
  for (const d of divisorsOf(n)) if (d < n && isPeriod(w, d)) return false;
  return true;
}

// helper to cut boilerplate for the flat (number[]) shape, matching words.ts's `ints`.
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
  // TriStrings(n): binary words with no 3 consecutive 1s.
  {
    ...ints(
      "TriStrings",
      1,
      ([n]) => triCount(n),
      ([n], r) => triUnrank(n, r),
      (a, [n]) => triValid(a, n),
      (a, [n]) => triRank(a, n),
    ),
    carrier: "BinaryWord",
  },
  // PrimitiveBinaryStrings(n): aperiodic binary words — A027375.
  {
    ...ints(
      "PrimitiveBinaryStrings",
      1,
      ([n]) => primitiveCount(n),
      ([n], r) => primitiveUnrank(n, r),
      (a, [n]) => primitiveValid(a, n),
      (a, [n]) => primitiveRank(a, n),
    ),
    carrier: "BinaryWord",
  },
];

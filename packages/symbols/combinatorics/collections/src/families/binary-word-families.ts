// Binary/base-b word families catalogued but previously kernel-less: bracelets (rotation +
// reflection), tribonacci-restricted strings, primitive (aperiodic) binary strings, ternary
// reflected Gray code, and Stirling permutations. Self-contained — duplicates a little of
// words.ts's necklace/Lyndon/number-theory machinery locally rather than reaching into that
// module (only its `entries` export is public). Pure rank/unrank kernels over plain JS
// numbers/arrays, same contract as every other family (types.ts).
import type { Declared, NumberKernel } from "./types.ts";

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
function reversed(w: number[]): number[] {
  return w.slice().reverse();
}

// ─── number theory (mirrors words.ts's private copy — needed here for KBracelets/Burnside). ───────
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

// ─── Bracelets(n, k): words over a k-letter alphabet up to rotation AND reflection (dihedral
// group D_n), represented by the lex-least word in the whole orbit (rotations ∪ reflected
// rotations). Count via Burnside's lemma over D_n (standard bracelet-counting formula — see e.g.
// OEIS A000029 for k=2): necklace part is the same rotation sum as KNecklaces; the reflection
// part counts words fixed by each of the n reflections, which splits on parity of n (odd: every
// axis passes through one vertex and the opposite edge-midpoint, k^ceil(n/2) fixed words each;
// even: n/2 axes through two vertices, k^(n/2+1) fixed each, and n/2 axes through two edges,
// k^(n/2) fixed each). Enumerate-then-index for unrank/rank — cheap for the small n this family
// is tested at, and there's no simpler closed-form unranking of a dihedral orbit. ──────────────────
function braceletCount(n: number, k: number): number {
  if (k <= 0) return 0;
  if (n === 0) return 1;
  if (n < 0) return 0;
  let rotationSum = 0;
  for (const d of divisorsOf(n)) rotationSum += eulerPhi(d) * Math.pow(k, n / d);
  let reflectionSum: number;
  if (n % 2 === 1) {
    reflectionSum = n * Math.pow(k, Math.ceil(n / 2));
  } else {
    reflectionSum = (n / 2) * Math.pow(k, n / 2 + 1) + (n / 2) * Math.pow(k, n / 2);
  }
  return Math.round((rotationSum + reflectionSum) / (2 * n));
}
function canonicalBracelet(w: number[]): number[] {
  const n = w.length;
  if (n === 0) return w.slice();
  const rev = reversed(w);
  let best = w;
  for (let s = 0; s < n; s++) {
    const rot = rotateLeft(w, s);
    if (compareArrays(rot, best) < 0) best = rot;
    const rrot = rotateLeft(rev, s);
    if (compareArrays(rrot, best) < 0) best = rrot;
  }
  return best;
}
// odometer over all k^n words, ascending lexicographically.
function* allWords(n: number, k: number): Generator<number[]> {
  if (n === 0) {
    yield [];
    return;
  }
  const w = Array.from<number>({ length: n }).fill(0);
  while (true) {
    yield w.slice();
    let i = n - 1;
    while (i >= 0 && w[i] === k - 1) {
      w[i] = 0;
      i--;
    }
    if (i < 0) return;
    w[i]++;
  }
}
const braceletRepsCache = new Map<string, number[][]>();
function braceletReps(n: number, k: number): number[][] {
  const key = `${n},${k}`;
  const cached = braceletRepsCache.get(key);
  if (cached) return cached;
  const seen = new Set<string>();
  const reps: number[][] = [];
  for (const w of allWords(n, k)) {
    const rep = canonicalBracelet(w);
    const rk = rep.join(",");
    if (!seen.has(rk)) {
      seen.add(rk);
      reps.push(rep);
    }
  }
  reps.sort(compareArrays);
  braceletRepsCache.set(key, reps);
  return reps;
}
function braceletUnrank(n: number, k: number, r: number): number[] {
  const reps = braceletReps(n, k);
  return reps[normRank(r, reps.length)].slice();
}
function braceletRank(w: number[], n: number, k: number): number {
  const rep = canonicalBracelet(w);
  return braceletReps(n, k).findIndex((x) => arraysEqual(x, rep));
}
function braceletValid(w: unknown, n: number, k: number): boolean {
  if (!Array.isArray(w) || w.length !== n) return false;
  for (const v of w) if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v >= k) return false;
  if (n === 0) return true;
  return arraysEqual(canonicalBracelet(w), w);
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

// ─── TernaryGrayCodes(n): base-3 reflected Gray code — length-n words over {0,1,2} where
// consecutive words differ by ±1 in exactly one digit. Standard b-ary reflection: prefix each of
// the b sub-blocks (one per leading digit j) with the previous level's list traversed forward
// (j even) or reversed (j odd); adjacent blocks then share their boundary suffix so only the new
// digit changes by 1 at every seam, and induction carries the property into each sub-block. Count
// is the closed form 3^n; unrank/rank enumerate-then-index off a cached list — cheap at the small
// n this family is tested at, and the recursive construction has no simpler unrank/rank. ───────────
const ternaryGrayCache = new Map<number, number[][]>();
function ternaryGrayList(n: number): number[][] {
  const cached = ternaryGrayCache.get(n);
  if (cached) return cached;
  let list: number[][];
  if (n === 0) {
    list = [[]];
  } else {
    const prev = ternaryGrayList(n - 1);
    list = [];
    for (let digit = 0; digit < 3; digit++) {
      const block = digit % 2 === 0 ? prev : prev.slice().reverse();
      for (const w of block) list.push([digit, ...w]);
    }
  }
  ternaryGrayCache.set(n, list);
  return list;
}
function ternaryGrayCount(n: number): number {
  return 3 ** n;
}
function ternaryGrayUnrank(n: number, r: number): number[] {
  const total = ternaryGrayCount(n);
  return ternaryGrayList(n)[normRank(r, total)].slice();
}
function ternaryGrayRank(w: number[], n: number): number {
  return ternaryGrayList(n).findIndex((x) => arraysEqual(x, w));
}
function ternaryGrayValid(w: unknown, n: number): boolean {
  if (!Array.isArray(w) || w.length !== n) return false;
  for (const b of w) if (b !== 0 && b !== 1 && b !== 2) return false;
  return true;
}

// ─── StirlingPermutations(n): permutations of the multiset {1,1,2,2,…,n,n} where everything
// between the two copies of i exceeds i — count (2n-1)!! (A001147). Built by inserting the pair
// (k,k), for k = 2..n in increasing order, adjacently into one of the 2(k-1)+1 gaps of a
// Stirling permutation of order k-1 (order 1 is just "1 1"); any gap is valid because a pair
// inserted later always carries a larger label, satisfying the betweenness constraint for every
// earlier-placed value. digit d_k (0-indexed gap, radix 2k-1) unranks/ranks via the standard
// mixed-radix Horner scheme. Ranking decodes top-down: the *last*-inserted label n is always
// still adjacent in the final word (nothing was inserted after it), so peeling off its two
// adjacent occurrences — whose left index is exactly the d_n that was chosen — and repeating for
// n-1, n-2, … recovers every digit. ──────────────────────────────────────────────────────────────
function stirlingCount(n: number): number {
  let c = 1;
  for (let k = 2; k <= n; k++) c *= 2 * k - 1;
  return c;
}
function stirlingUnrank(n: number, r: number): number[] {
  const total = stirlingCount(n);
  let rem = normRank(r, total);
  const digits: number[] = Array.from<number>({ length: n + 1 }).fill(0); // digits[k] for k=2..n
  for (let k = n; k >= 2; k--) {
    const radix = 2 * k - 1;
    digits[k] = rem % radix;
    rem = Math.floor(rem / radix);
  }
  let word: number[] = n >= 1 ? [1, 1] : [];
  for (let k = 2; k <= n; k++) {
    const gap = digits[k];
    word = [...word.slice(0, gap), k, k, ...word.slice(gap)];
  }
  return word;
}
function stirlingRank(word: number[], n: number): number {
  // Decode top-down (k=n downTo 2) to recover each digit d_k, but Horner-combine bottom-up
  // (k=2..n ascending) — d_2 is the most-significant digit, d_n the least, matching unrank's
  // extraction order (mod-then-divide from k=n down to k=2 peels off the LEAST significant
  // digit first).
  let w = word.slice();
  const digits: number[] = Array.from<number>({ length: n + 1 }).fill(0);
  for (let k = n; k >= 2; k--) {
    const gap = w.indexOf(k);
    digits[k] = gap;
    w = [...w.slice(0, gap), ...w.slice(gap + 2)];
  }
  let rank = 0;
  for (let k = 2; k <= n; k++) {
    const radix = 2 * k - 1;
    rank = rank * radix + digits[k];
  }
  return rank;
}
function stirlingValid(word: unknown, n: number): boolean {
  if (!Array.isArray(word) || word.length !== 2 * n) return false;
  const counts = Array.from<number>({ length: n + 1 }).fill(0);
  for (const v of word) {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > n) return false;
    counts[v]++;
  }
  for (let i = 1; i <= n; i++) if (counts[i] !== 2) return false;
  for (let i = 1; i <= n; i++) {
    const first = word.indexOf(i);
    const last = word.lastIndexOf(i);
    for (let j = first + 1; j < last; j++) if ((word[j] as number) <= i) return false;
  }
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

export const entries: NumberKernel[] = [
  // BinaryBracelets(n): binary words up to rotation and reflection — Bracelets(n, 2), A000029.
  {
    ...ints(
      "BinaryBracelets",
      1,
      ([n]) => braceletCount(n, 2),
      ([n], r) => braceletUnrank(n, 2, r),
      (a, [n]) => braceletValid(a, n, 2),
      (a, [n]) => braceletRank(a, n, 2),
    ),
    declared: wordClass("BinaryWords", 2),
  },
  // KBracelets(size, base): base-letter words up to rotation and reflection.
  {
    ...ints(
      "KBracelets",
      2,
      ([n, k]) => braceletCount(n, k),
      ([n, k], r) => braceletUnrank(n, k, r),
      (a, [n, k]) => braceletValid(a, n, k),
      (a, [n, k]) => braceletRank(a, n, k),
    ),
    declared: wordClass("Words"),
  },
  // TriStrings(n): binary words with no 3 consecutive 1s.
  ints(
    "TriStrings",
    1,
    ([n]) => triCount(n),
    ([n], r) => triUnrank(n, r),
    (a, [n]) => triValid(a, n),
    (a, [n]) => triRank(a, n),
  ),
  // PrimitiveBinaryStrings(n): aperiodic binary words — A027375.
  ints(
    "PrimitiveBinaryStrings",
    1,
    ([n]) => primitiveCount(n),
    ([n], r) => primitiveUnrank(n, r),
    (a, [n]) => primitiveValid(a, n),
    (a, [n]) => primitiveRank(a, n),
  ),
  // TernaryGrayCodes(n): base-3 reflected Gray code order.
  ints(
    "TernaryGrayCodes",
    1,
    ([n]) => ternaryGrayCount(n),
    ([n], r) => ternaryGrayUnrank(n, r),
    (a, [n]) => ternaryGrayValid(a, n),
    (a, [n]) => ternaryGrayRank(a, n),
  ),
  // StirlingPermutations(n): permutations of {1,1,2,2,...,n,n} with the betweenness property.
  ints(
    "StirlingPermutations",
    1,
    ([n]) => stirlingCount(n),
    ([n], r) => stirlingUnrank(n, r),
    (a, [n]) => stirlingValid(a, n),
    (a, [n]) => stirlingRank(a, n),
  ),
];

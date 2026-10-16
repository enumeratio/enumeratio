// Moved out of the runtime by BL-225: kernels only tests/readings and the agreement tests use.
import { floorDiv } from "../../../collections/src/families/kernels.ts";
import { normRank } from "../../../words/src/families/binary-word-families.ts";

export function stirlingValid(word: unknown, n: number): boolean {
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

export function stirlingRank(word: number[], n: number): number {
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
export function stirlingCount(n: number): number {
  let c = 1;
  for (let k = 2; k <= n; k++) c *= 2 * k - 1;
  return c;
}

export function stirlingUnrank(n: number, r: number): number[] {
  const total = stirlingCount(n);
  let rem = normRank(r, total);
  const digits: number[] = Array.from<number>({ length: n + 1 }).fill(0); // digits[k] for k=2..n
  for (let k = n; k >= 2; k--) {
    const radix = 2 * k - 1;
    digits[k] = rem % radix;
    rem = floorDiv(rem, radix);
  }
  let word: number[] = n >= 1 ? [1, 1] : [];
  for (let k = 2; k <= n; k++) {
    const gap = digits[k];
    word = [...word.slice(0, gap), k, k, ...word.slice(gap)];
  }
  return word;
}

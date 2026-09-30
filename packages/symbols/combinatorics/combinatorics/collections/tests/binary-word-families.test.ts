import { expect, test } from "vite-plus/test";
import { entries } from "../src/families/binary-word-families.ts";

// Self-cert every family: rank(unrank(p, r), p) === r across the whole family, unranked
// elements are valid members, and every element is distinct — same recipe as words.test.ts.
// BinaryBracelets/KBracelets moved to the words area (§4 step 5) with their tests.
// TernaryGrayCodes joined them there (wire-carriers lane A-91), now carrying "TernaryGrayCode".
// StirlingPermutations joined too (wire-carriers lane A-92), now carrying "StirlingPermutation".
const PARAMS: Record<string, number[][]> = {
  TriStrings: [[0], [1], [2], [3], [4], [5], [6], [7], [8], [9], [10]],
  PrimitiveBinaryStrings: [[1], [2], [3], [4], [5], [6], [7], [8]],
};

const byHead = new Map(entries.map((e) => [e.head, e]));

for (const [head, paramsList] of Object.entries(PARAMS)) {
  const entry = byHead.get(head);
  test(`${head} is declared`, () => {
    expect(entry).toBeDefined();
  });
  if (!entry) continue;
  for (const p of paramsList) {
    test(`${head}(${p.join(", ")}) round-trips`, () => {
      const total = entry.count(p);
      const seen = new Set<string>();
      for (let r = 0; r < total; r++) {
        const element = entry.unrank(p, r);
        expect(entry.valid(element, p)).toBe(true);
        expect(entry.rank(element, p)).toBe(r);
        const key = JSON.stringify(element);
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    });
  }
}

// ─── brute force: enumerate independently, filter by a predicate that shares no code with the
// kernels, compare as SETS (order need not match; count and membership must). ─────────────────────
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
function hasNoRunOfK(w: number[], k: number): boolean {
  let run = 0;
  for (const b of w) {
    run = b === 1 ? run + 1 : 0;
    if (run >= k) return false;
  }
  return true;
}
function isPrimitive(w: number[]): boolean {
  const n = w.length;
  for (let d = 1; d < n; d++) {
    if (n % d !== 0) continue;
    let periodic = true;
    for (let i = d; i < n; i++) if (w[i] !== w[i % d]) periodic = false;
    if (periodic) return false;
  }
  return true;
}
const asSet = (elements: number[][]) => new Set(elements.map((e) => JSON.stringify(e)));

for (let n = 0; n <= 8; n++) {
  test(`TriStrings(${n}) matches an independent brute-force predicate`, () => {
    const entry = byHead.get("TriStrings")!;
    const total = entry.count([n]);
    const kernelElements = Array.from({ length: total }, (_, r) => entry.unrank([n], r) as number[]);
    const all = Array.from(allWords(n, 2));
    expect(asSet(kernelElements)).toEqual(asSet(all.filter((w) => hasNoRunOfK(w, 3))));
    expect(kernelElements.length).toBe(total);
  });

  if (n >= 1) {
    test(`PrimitiveBinaryStrings(${n}) matches an independent brute-force predicate`, () => {
      const entry = byHead.get("PrimitiveBinaryStrings")!;
      const total = entry.count([n]);
      const kernelElements = Array.from({ length: total }, (_, r) => entry.unrank([n], r) as number[]);
      const all = Array.from(allWords(n, 2));
      expect(asSet(kernelElements)).toEqual(asSet(all.filter(isPrimitive)));
      expect(kernelElements.length).toBe(total);
    });
  }
}

// ─── OEIS counts, independent of the round-trip above ───────────────────────────────────────────
const countsOf = (head: string, ps: number[][]) => ps.map((p) => byHead.get(head)!.count(p));
const range = (n: number) => Array.from({ length: n }, (_, i) => [i]);

test("TriStrings count (tribonacci-like, A000073 shifted), n=0..10", () => {
  expect(countsOf("TriStrings", range(11))).toEqual([1, 2, 4, 7, 13, 24, 44, 81, 149, 274, 504]);
});

test("PrimitiveBinaryStrings count (A027375), n=1..10", () => {
  expect(countsOf("PrimitiveBinaryStrings", range(11).slice(1))).toEqual([2, 2, 6, 12, 30, 54, 126, 240, 504, 990]);
});

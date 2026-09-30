import { expect, test } from "vite-plus/test";
import { entries } from "../src/families/binary-word-families.ts";

// BinaryBracelets/KBracelets split out of collections/tests/binary-word-families.test.ts with the
// family (§4 step 5, https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible)
// -- same recipe: rank(unrank(p, r), p) === r, unranked elements are valid and distinct.
// TernaryGrayCodes joined them here (wire-carriers lane A-91), now carrying "TernaryGrayCode".
// StirlingPermutations joined too (wire-carriers lane A-92), now carrying "StirlingPermutation".
const PARAMS: Record<string, number[][]> = {
  BinaryBracelets: [[0], [1], [2], [3], [4], [5], [6], [7]],
  KBracelets: [
    [1, 3],
    [2, 3],
    [3, 3],
    [4, 3],
    [0, 4],
    [3, 4],
  ],
  TernaryGrayCodes: [[0], [1], [2], [3], [4]],
  StirlingPermutations: [[1], [2], [3], [4], [5]],
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
function rotations(w: number[]): number[][] {
  const n = w.length;
  return Array.from({ length: n }, (_, s) => Array.from({ length: n }, (_, i) => w[(i + s) % n]));
}
function orbitKeys(w: number[]): string[] {
  const rev = w.slice().toReversed();
  return [...rotations(w), ...rotations(rev)].map((x) => x.join(","));
}
const asSet = (elements: number[][]) => new Set(elements.map((e) => JSON.stringify(e)));

for (let n = 0; n <= 8; n++) {
  test(`BinaryBracelets(${n}) matches an independent brute-force predicate`, () => {
    const entry = byHead.get("BinaryBracelets")!;
    const total = entry.count([n]);
    const kernelElements = Array.from({ length: total }, (_, r) => entry.unrank([n], r) as number[]);
    const seenOrbits = new Set<string>();
    const canonical: number[][] = [];
    for (const w of allWords(n, 2)) {
      const keys = orbitKeys(w);
      if (keys.some((k) => seenOrbits.has(k))) continue;
      for (const k of keys) seenOrbits.add(k);
      canonical.push(w);
    }
    expect(asSet(kernelElements)).toEqual(asSet(canonical));
    expect(kernelElements.length).toBe(total);
  });
}

for (let n = 1; n <= 4; n++) {
  for (const k of [3, 4]) {
    test(`KBracelets(${n}, ${k}) matches an independent brute-force predicate`, () => {
      const entry = byHead.get("KBracelets")!;
      const total = entry.count([n, k]);
      const kernelElements = Array.from({ length: total }, (_, r) => entry.unrank([n, k], r) as number[]);
      const seenOrbits = new Set<string>();
      const canonical: number[][] = [];
      for (const w of allWords(n, k)) {
        const keys = orbitKeys(w);
        if (keys.some((key) => seenOrbits.has(key))) continue;
        for (const key of keys) seenOrbits.add(key);
        canonical.push(w);
      }
      expect(asSet(kernelElements)).toEqual(asSet(canonical));
      expect(kernelElements.length).toBe(total);
    });
  }
}

for (let n = 0; n <= 4; n++) {
  test(`TernaryGrayCodes(${n}) is a valid ternary Gray code (adjacent words differ by ±1 in one digit)`, () => {
    const entry = byHead.get("TernaryGrayCodes")!;
    const total = entry.count([n]);
    const seq = Array.from({ length: total }, (_, r) => entry.unrank([n], r) as number[]);
    const all = Array.from(allWords(n, 3));
    expect(asSet(seq)).toEqual(asSet(all)); // every word appears exactly once
    for (let i = 0; i + 1 < seq.length; i++) {
      const diffs = seq[i].map((d, j) => d - seq[i + 1][j]).filter((d) => d !== 0);
      expect(diffs.length).toBe(1);
      expect(Math.abs(diffs[0])).toBe(1);
    }
  });
}

function isStirlingPermutation(word: number[], n: number): boolean {
  if (word.length !== 2 * n) return false;
  const counts = Array.from<number>({ length: n + 1 }).fill(0);
  for (const v of word) {
    if (v < 1 || v > n) return false;
    counts[v]++;
  }
  for (let i = 1; i <= n; i++) if (counts[i] !== 2) return false;
  for (let i = 1; i <= n; i++) {
    const first = word.indexOf(i);
    const last = word.lastIndexOf(i);
    for (let j = first + 1; j < last; j++) if (word[j] <= i) return false;
  }
  return true;
}
function permutationsOfMultiset(n: number): number[][] {
  // small n only (n <= 4): generate all (2n)!/(2^n) distinct arrangements of {1,1,...,n,n} via
  // standard next-permutation over the sorted multiset.
  const base = Array.from({ length: 2 * n }, (_, i) => Math.floor(i / 2) + 1);
  const results: number[][] = [];
  const seen = new Set<string>();
  const perm = (arr: number[], k: number) => {
    if (k === arr.length) {
      const key = arr.join(",");
      if (!seen.has(key)) {
        seen.add(key);
        results.push(arr.slice());
      }
      return;
    }
    for (let i = k; i < arr.length; i++) {
      [arr[k], arr[i]] = [arr[i], arr[k]];
      perm(arr, k + 1);
      [arr[k], arr[i]] = [arr[i], arr[k]];
    }
  };
  perm(base, 0);
  return results;
}

for (let n = 1; n <= 4; n++) {
  test(`StirlingPermutations(${n}) matches an independent brute-force predicate`, () => {
    const entry = byHead.get("StirlingPermutations")!;
    const total = entry.count([n]);
    const kernelElements = Array.from({ length: total }, (_, r) => entry.unrank([n], r) as number[]);
    const all = permutationsOfMultiset(n);
    expect(asSet(kernelElements)).toEqual(asSet(all.filter((w) => isStirlingPermutation(w, n))));
    expect(kernelElements.length).toBe(total);
  });
}

// ─── OEIS counts, independent of the round-trip above ───────────────────────────────────────────
const countsOf = (head: string, ps: number[][]) => ps.map((p) => byHead.get(head)!.count(p));
const range = (n: number) => Array.from({ length: n }, (_, i) => [i]);

test("StirlingPermutations count = (2n-1)!! (A001147), n=1..7", () => {
  expect(countsOf("StirlingPermutations", range(8).slice(1))).toEqual([1, 3, 15, 105, 945, 10395, 135135]);
});

test("TernaryGrayCodes count = 3^n, n=0..6", () => {
  expect(countsOf("TernaryGrayCodes", range(7))).toEqual([1, 3, 9, 27, 81, 243, 729]);
});

test("BinaryBracelets count (A000029), n=0..12", () => {
  expect(countsOf("BinaryBracelets", range(13))).toEqual([1, 2, 3, 4, 6, 8, 13, 18, 30, 46, 78, 126, 224]);
});

test("KBracelets(n, 2) agrees with BinaryBracelets(n)", () => {
  const kBracelets = byHead.get("KBracelets")!;
  const binaryBracelets = byHead.get("BinaryBracelets")!;
  for (const n of [0, 1, 2, 3, 4, 5, 6, 7]) {
    expect(kBracelets.count([n, 2])).toBe(binaryBracelets.count([n]));
  }
});

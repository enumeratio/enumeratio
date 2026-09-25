import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, afterAll } from "vite-plus/test";
import { entries } from "../src/families/binary-word-families.ts";

// Self-cert every family: rank(unrank(p, r), p) === r across the whole family, unranked
// elements are valid members, and every element is distinct — same recipe as words.test.ts.
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
  TriStrings: [[0], [1], [2], [3], [4], [5], [6], [7], [8], [9], [10]],
  PrimitiveBinaryStrings: [[1], [2], [3], [4], [5], [6], [7], [8]],
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
  const rev = w.slice().reverse();
  return [...rotations(w), ...rotations(rev)].map((x) => x.join(","));
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
  // small n only (used for Stirling brute force, n <= 4): generate all (2n)!/(2^n) distinct
  // arrangements of {1,1,...,n,n} via standard next-permutation over the sorted multiset.
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

  if (n <= 4) {
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

test("BinaryBracelets count (A000029), n=0..12", () => {
  expect(countsOf("BinaryBracelets", range(13))).toEqual([1, 2, 3, 4, 6, 8, 13, 18, 30, 46, 78, 126, 224]);
});

test("TriStrings count (tribonacci-like, A000073 shifted), n=0..10", () => {
  expect(countsOf("TriStrings", range(11))).toEqual([1, 2, 4, 7, 13, 24, 44, 81, 149, 274, 504]);
});

test("PrimitiveBinaryStrings count (A027375), n=1..10", () => {
  expect(countsOf("PrimitiveBinaryStrings", range(11).slice(1))).toEqual([2, 2, 6, 12, 30, 54, 126, 240, 504, 990]);
});

test("TernaryGrayCodes count = 3^n, n=0..6", () => {
  expect(countsOf("TernaryGrayCodes", range(7))).toEqual([1, 3, 9, 27, 81, 243, 729]);
});

test("StirlingPermutations count = (2n-1)!! (A001147), n=1..7", () => {
  expect(countsOf("StirlingPermutations", range(8).slice(1))).toEqual([1, 3, 15, 105, 945, 10395, 135135]);
});

test("KBracelets(n, 2) agrees with BinaryBracelets(n)", () => {
  const kBracelets = byHead.get("KBracelets")!;
  const binaryBracelets = byHead.get("BinaryBracelets")!;
  for (const n of [0, 1, 2, 3, 4, 5, 6, 7]) {
    expect(kBracelets.count([n, 2])).toBe(binaryBracelets.count([n]));
  }
});

// Golden JSON (AGENTS.md); regenerate with `UPDATE_BINARY_WORD_FAMILIES_GOLDEN=1 vp test`.
const GOLDEN = fileURLToPath(new URL("./binary-word-families.golden.json", import.meta.url));
const updating = process.env.UPDATE_BINARY_WORD_FAMILIES_GOLDEN === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

const GOLDEN_CASES: Record<string, number[][]> = {
  BinaryBracelets: [[6]],
  KBracelets: [[4, 3]],
  TriStrings: [[6]],
  PrimitiveBinaryStrings: [[6]],
  TernaryGrayCodes: [[3]],
  StirlingPermutations: [[4]],
};

for (const [head, paramsList] of Object.entries(GOLDEN_CASES)) {
  for (const p of paramsList) {
    const key = `${head}(${p.join(",")})`;
    test(`golden: ${key}`, () => {
      const entry = byHead.get(head)!;
      const total = entry.count(p);
      const elements = Array.from({ length: total }, (_, r) => entry.unrank(p, r));
      if (updating) {
        fresh[key] = elements;
        return;
      }
      expect(elements).toEqual(golden[key]);
    });
  }
}

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});

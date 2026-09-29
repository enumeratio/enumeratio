import { expect, test } from "vite-plus/test";
import { entries } from "../src/families/words.ts";

// Self-cert every words.ts family, mirroring core.test.ts: for every rank r in [0, count),
// valid(unrank(p, r), p) === true AND rank(unrank(p, r), p) === r, over a few small parameter
// points per family (kept small so counts stay well under a few thousand).
const PARAMS: Record<string, number[][]> = {
  BinaryWords: [[0], [1], [4]],
  BinaryWordsByWeight: [
    [4, 0],
    [4, 2],
    [4, 4],
    [5, 2],
    [6, 3],
  ],
  Words: [
    [3, 2],
    [2, 3],
    [0, 4],
  ],
  FibStrings: [[0], [1], [3], [4], [6]],
  LucasStrings: [[0], [1], [2], [3], [4], [5], [6]],
  GrayCodes: [[0], [1], [3], [4]],
  BinaryPalindromes: [[0], [1], [2], [3], [4], [5], [6]],
  BinaryNecklaces: [[0], [1], [2], [3], [4], [5], [6]],
  LyndonWords: [[1], [2], [3], [4], [5], [6]],
  KNecklaces: [
    [1, 3],
    [4, 3],
    [6, 2],
  ],
  KLyndonWords: [
    [1, 3],
    [4, 3],
    [6, 2],
  ],
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

// Closed-form counts against OEIS, n = 0..8 (or the family's natural start).
test("BinaryWords count = 2^n (A000079)", () => {
  const entry = byHead.get("BinaryWords")!;
  expect([0, 1, 2, 3, 4, 5, 6].map((n) => entry.count([n]))).toEqual([1, 2, 4, 8, 16, 32, 64]);
});

test("FibStrings count = F(n+2) (A000045 shifted)", () => {
  const entry = byHead.get("FibStrings")!;
  expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => entry.count([n]))).toEqual([1, 2, 3, 5, 8, 13, 21, 34, 55]);
});

test("LucasStrings count = Lucas numbers, n=0 special-cased to 1 (A000032)", () => {
  const entry = byHead.get("LucasStrings")!;
  expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => entry.count([n]))).toEqual([1, 1, 3, 4, 7, 11, 18, 29, 47]);
});

test("GrayCodes count = 2^n", () => {
  const entry = byHead.get("GrayCodes")!;
  expect([0, 1, 2, 3, 4].map((n) => entry.count([n]))).toEqual([1, 2, 4, 8, 16]);
});

test("BinaryPalindromes count = 2^ceil(n/2)", () => {
  const entry = byHead.get("BinaryPalindromes")!;
  expect([0, 1, 2, 3, 4, 5, 6].map((n) => entry.count([n]))).toEqual([1, 2, 2, 4, 4, 8, 8]);
});

test("BinaryNecklaces count (A000031)", () => {
  const entry = byHead.get("BinaryNecklaces")!;
  expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => entry.count([n]))).toEqual([1, 2, 3, 4, 6, 8, 14, 20, 36]);
});

test("LyndonWords count (A001037), n=1..8", () => {
  const entry = byHead.get("LyndonWords")!;
  expect([1, 2, 3, 4, 5, 6, 7, 8].map((n) => entry.count([n]))).toEqual([2, 1, 2, 3, 6, 9, 18, 30]);
});

// KNecklaces/KLyndonWords with k=2 must agree exactly with BinaryNecklaces/LyndonWords — they share
// the same underlying necklace/Lyndon-count kernels, just without the {0,1} remap.
test("KNecklaces(n, 2) agrees with BinaryNecklaces(n)", () => {
  const kNecklaces = byHead.get("KNecklaces")!;
  const binaryNecklaces = byHead.get("BinaryNecklaces")!;
  for (const n of [0, 1, 2, 3, 4, 5, 6, 7]) {
    expect(kNecklaces.count([n, 2])).toBe(binaryNecklaces.count([n]));
  }
});

test("KLyndonWords(n, 2) agrees with LyndonWords(n)", () => {
  const kLyndon = byHead.get("KLyndonWords")!;
  const lyndon = byHead.get("LyndonWords")!;
  for (const n of [1, 2, 3, 4, 5, 6, 7]) {
    expect(kLyndon.count([n, 2])).toBe(lyndon.count([n]));
  }
});

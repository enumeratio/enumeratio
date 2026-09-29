import { expect, test } from "vite-plus/test";
import { entries } from "../src/families/tableaux-plane.ts";

// SkewPartitions split out of collections/tests/tableaux-plane.test.ts with the family (§4
// step 5, https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible)
// -- its carrier "SkewPartition" is a partitions-area one.
const byHead = new Map(entries.map((e) => [e.head, e]));

const PARAMS: Record<string, number[][]> = {
  SkewPartitions: [[0], [1], [2], [3], [4]],
};

for (const [head, paramSets] of Object.entries(PARAMS)) {
  const entry = byHead.get(head);
  test(`${head} is registered`, () => expect(entry).toBeDefined());
  if (!entry) continue;
  for (const p of paramSets) {
    test(`${head}(${p.join(", ")}) round-trips`, () => {
      const total = entry.count(p);
      for (let r = 0; r < total; r++) {
        const element = entry.unrank(p, r);
        expect(entry.valid(element, p)).toBe(true);
        expect(entry.rank(element, p)).toBe(r);
      }
    });
  }
}

// ═══ independent brute-force cross-check (deliberately not sharing code with the kernel) ═══

// SkewPartitions: brute-force every pair of partitions (lam, mu) with mu subseteq lam and |lam|-|mu|=n,
// bounded generously, filtered by an independent row/column-reduced predicate.
function isReducedSkew(lam: number[], mu: number[], n: number): boolean {
  if (mu.length > lam.length) return false;
  for (let i = 0; i < lam.length; i++) {
    if (i > 0 && lam[i] > lam[i - 1]) return false;
    const m = mu[i] ?? 0;
    if (i > 0 && m > (mu[i - 1] ?? 0)) return false;
    if (m >= lam[i]) return false;
  }
  if (lam.reduce((a, b) => a + b, 0) - mu.reduce((a, b) => a + b, 0) !== n) return false;
  const maxCol = lam[0] ?? 0;
  for (let col = 1; col <= maxCol; col++) {
    let covered = false;
    for (let i = 0; i < lam.length; i++) {
      const a = (mu[i] ?? 0) + 1;
      if (a <= col && col <= lam[i]) {
        covered = true;
        break;
      }
    }
    if (!covered) return false;
  }
  return true;
}
function brutePartitionsUpTo(maxParts: number, maxVal: number): number[][] {
  const out: number[][] = [[]];
  function rec(prefix: number[], remaining: number, cap: number): void {
    if (remaining === 0 || prefix.length === maxParts) return;
    for (let v = Math.min(cap, remaining); v >= 1; v--) {
      const next = [...prefix, v];
      out.push(next);
      rec(next, remaining - v, v);
    }
  }
  rec([], maxVal * maxParts, maxVal);
  return out;
}
test("SkewPartitions(n) anchors match the archived enumeratio checkout's hand-verified counts 1,1,3,9,28,87", () => {
  const entry = byHead.get("SkewPartitions")!;
  expect([0, 1, 2, 3, 4, 5].map((n) => entry.count([n]))).toEqual([1, 1, 3, 9, 28, 87]);
});
test("SkewPartitions(n) matches an independent brute-force filter, n<=3", () => {
  const entry = byHead.get("SkewPartitions")!;
  for (const n of [0, 1, 2, 3]) {
    const cands = brutePartitionsUpTo(n + 1, n + 1);
    const expected = new Set<string>();
    for (const lam of cands)
      for (const mu of cands) if (isReducedSkew(lam, mu, n)) expected.add(JSON.stringify([lam, mu]));
    const total = entry.count([n]);
    const got = new Set<string>();
    for (let r = 0; r < total; r++) got.add(JSON.stringify(entry.unrank([n], r)));
    expect(got).toEqual(expected);
    expect(total).toBe(expected.size);
  }
});

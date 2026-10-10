import { expect, test } from "vite-plus/test";
import { standardTableauPairsFast as fast } from "../src/families/standard-tableau-pairs.ts";

// Moved out of collections/tests/tableaux-plane.test.ts alongside the family (§4 step 5,
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible):
// StandardTableauPairs now carries "StandardTableauPair". These tests exercise the pure kernel
// (count/unrank/rank/valid over plain JS values) -- unaffected by the carrier wiring, which is
// declare.ts's concern (see tableaux/tests/carrier.test.ts or the collections declare tests for
// the CE-level typed-element check). The family is defined in Epsil, interpreted (a nested element
// has no compiled type): these read its TS kernel, the fast path, and ./rsk-pairs.test.ts holds the two together.
const byHead = new Map([
  [
    "StandardTableauPairs",
    {
      count: (p: number[]) => Number(fast.count(p)),
      unrank: (p: number[], r: number) => fast.unrank(p, r),
      rank: (e: unknown, p: number[]) => fast.rank(e as never, p),
      valid: (e: unknown, p: number[]) => fast.valid(e as never, p),
    },
  ],
]);

const PARAMS: Record<string, number[][]> = {
  StandardTableauPairs: [[0], [1], [2], [3], [4], [5]],
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

// StandardTableauPairs: RSK is a bijection with permutations, so |pairs(n)| = n!, and every pair must
// have equal-shape SYT halves — checked independently of the kernel's own IsStandardTableauOf reuse.
function isIndependentSyt(rows: number[][], n: number): boolean {
  const seen = Array.from({ length: n + 1 }, () => false);
  let total = 0;
  for (let r = 0; r < rows.length; r++) {
    if (r > 0 && rows[r - 1].length < rows[r].length) return false;
    for (let c = 0; c < rows[r].length; c++) {
      const v = rows[r][c];
      if (v < 1 || v > n || seen[v]) return false;
      seen[v] = true;
      total++;
      if (c > 0 && rows[r][c - 1] >= v) return false;
      if (r > 0 && c < rows[r - 1].length && rows[r - 1][c] >= v) return false;
    }
  }
  return total === n;
}
test("StandardTableauPairs(n) = n!, and every element is a genuinely same-shape SYT pair", () => {
  const entry = byHead.get("StandardTableauPairs")!;
  expect([0, 1, 2, 3, 4, 5].map((n) => entry.count([n]))).toEqual([1, 1, 2, 6, 24, 120]);
  for (let n = 0; n <= 5; n++) {
    const total = entry.count([n]);
    for (let r = 0; r < total; r++) {
      const [P, Q] = entry.unrank([n], r) as [number[][], number[][]];
      expect(isIndependentSyt(P, n)).toBe(true);
      expect(isIndependentSyt(Q, n)).toBe(true);
      expect(P.map((row) => row.length)).toEqual(Q.map((row) => row.length));
    }
  }
});

import { expect, test } from "vite-plus/test";
import { entries } from "../src/families/tableaux-plane.ts";

// SemistandardTableaux, GelfandTsetlin, AlternatingSignMatrices, SkewStandardTableaux,
// PlanePartitions and BoxedPlanePartitions moved to the tableaux area (§4 step 5,
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible)
// with their tests, now in tableaux/tests/tableaux-plane.test.ts -- every one of them carries a
// `declared.carrier`. ShiftedStandardTableaux joined them there (wire-carriers lane A-92), now
// carrying "ShiftedStandardTableau". StandardTableauPairs declares none and stays here.
const byHead = new Map(entries.map((e) => [e.head, e]));

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

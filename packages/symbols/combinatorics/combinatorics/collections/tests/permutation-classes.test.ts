import { expect, test } from "vite-plus/test";
import { entries } from "../src/families/permutation-classes.ts";

// Certify every permutation-class family: rank(unrank(p, r), p) === r across the whole
// family, unranked elements are valid members, and count matches the enumeration —
// same recipe as permutations.test.ts. The pattern-avoider classes (Baxter, Separable,
// Simple, Smooth, Vexillary) and NonCrossing all filter n! permutations, so n is kept
// small enough to stay fast (<~10s total across the suite).
const PARAMS: Record<string, number[][]> = {
  BaxterPermutations: [[0], [1], [2], [3], [4], [5], [6]],
  BooleanPermutations: [[0], [1], [2], [3], [4], [5], [6], [7]],
  GrassmannianPermutations: [[0], [1], [2], [3], [4], [5], [6]],
  CograssmannianPermutations: [[0], [1], [2], [3], [4], [5], [6]],
  NonCrossingPermutations: [[0], [1], [2], [3], [4], [5], [6]],
  SeparablePermutations: [[0], [1], [2], [3], [4], [5], [6]],
  SimplePermutations: [[0], [1], [2], [3], [4], [5], [6]],
  SmoothPermutations: [[0], [1], [2], [3], [4], [5], [6]],
  VexillaryPermutations: [[0], [1], [2], [3], [4], [5], [6]],
};

for (const entry of entries) {
  for (const p of PARAMS[entry.head] ?? [[3]]) {
    test(`${entry.head}(${p.join(", ")}) round-trips`, () => {
      const total = entry.count(p);
      for (let r = 0; r < total; r++) {
        const element = entry.unrank(p, r);
        expect(entry.valid(element, p)).toBe(true);
        expect(entry.rank(element, p)).toBe(r);
      }
    });
  }
}

// Counts against independently-written brute-force predicates / OEIS, independent of the
// round-trip above (a family could round-trip consistently against a WRONG count if
// unrank/rank/count were all wrong the same way).
const byHead = Object.fromEntries(entries.map((e) => [e.head, e]));
const countsOf = (head: string, ps: number[][]) => ps.map((p) => byHead[head].count(p));

test("BaxterPermutations count = Baxter numbers (A001181)", () => {
  expect(countsOf("BaxterPermutations", [[0], [1], [2], [3], [4], [5], [6], [7], [8]])).toEqual([
    1, 1, 2, 6, 22, 92, 422, 2074, 10754,
  ]);
});
test("BooleanPermutations count = Fibonacci F(n+1) (A000045)", () => {
  expect(countsOf("BooleanPermutations", [[0], [1], [2], [3], [4], [5], [6], [7], [8]])).toEqual([
    1, 1, 2, 3, 5, 8, 13, 21, 34,
  ]);
});
test("Grassmannian/CograssmannianPermutations count = 2^n - n (A000325)", () => {
  const ps = [[0], [1], [2], [3], [4], [5], [6], [7]];
  const expected = [1, 1, 2, 5, 12, 27, 58, 121];
  expect(countsOf("GrassmannianPermutations", ps)).toEqual(expected);
  expect(countsOf("CograssmannianPermutations", ps)).toEqual(expected);
});
test("NonCrossingPermutations count matches the noncrossing-partition recurrence", () => {
  expect(countsOf("NonCrossingPermutations", [[0], [1], [2], [3], [4], [5], [6], [7]])).toEqual([
    1, 1, 2, 6, 23, 105, 553, 3311,
  ]);
});
test("SeparablePermutations count = large Schröder numbers (A006318)", () => {
  expect(countsOf("SeparablePermutations", [[0], [1], [2], [3], [4], [5], [6], [7]])).toEqual([
    1, 1, 2, 6, 22, 90, 394, 1806,
  ]);
});
test("SimplePermutations count matches A111111", () => {
  expect(countsOf("SimplePermutations", [[1], [2], [3], [4], [5], [6], [7]])).toEqual([1, 2, 0, 2, 6, 46, 338]);
});
test("SmoothPermutations count matches A032351", () => {
  expect(countsOf("SmoothPermutations", [[0], [1], [2], [3], [4], [5], [6], [7]])).toEqual([
    1, 1, 2, 6, 22, 88, 366, 1552,
  ]);
});
test("VexillaryPermutations count matches A005802", () => {
  expect(countsOf("VexillaryPermutations", [[0], [1], [2], [3], [4], [5], [6], [7]])).toEqual([
    1, 1, 2, 6, 23, 103, 513, 2761,
  ]);
});

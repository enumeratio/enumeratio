import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { kernelsOn, liftFamily } from "../../collections/src/families/epsil.ts";
import { entries as families } from "../src/families/permutation-classes.ts";

const entries = kernelsOn(bareEngine(), families.map(liftFamily));

// Certify every permutation-class family: rank(unrank(p, r), p) === r across the whole
// family, unranked elements are valid members, and count matches the enumeration —
// same recipe as permutations.test.ts. Baxter, Simple and Smooth filter n!
// permutations, so n is kept small enough to stay fast.
const PARAMS: Record<string, number[][]> = {
  BaxterPermutations: [[0], [1], [2], [3], [4], [5], [6]],
  AdjacentTranspositionInvolutions: [[0], [1], [2], [3], [4], [5], [6], [7]],
  BooleanPermutations: [[0], [1], [2], [3], [4], [5], [6], [7]],
  GrassmannianPermutations: [[0], [1], [2], [3], [4], [5], [6]],
  CograssmannianPermutations: [[0], [1], [2], [3], [4], [5], [6]],
  NonCrossingCycleSupportPermutations: process.env.DEEP_TESTS ? [[0], [1], [2], [3], [4], [5], [6]] : [[3]],
  NonCrossingPermutations: [[0], [1], [2], [3], [4], [5], [6], [7]],
  SeparablePermutations: [[0], [1], [2], [3], [4], [5], [6]],
  SimplePermutations: [[0], [1], [2], [3], [4], [5], [6]],
  SmoothPermutations: [[0], [1], [2], [3], [4], [5], [6]],
  VexillaryPermutations: [[0], [1], [2], [3], [4], [5], [6]],
};

for (const entry of entries) {
  for (const p of PARAMS[entry.head] ?? [[3]]) {
    test(`${entry.head}(${p.join(", ")}) round-trips`, () => {
      const total = entry.count(p) as bigint;
      for (let r = 0n; r < total; r++) {
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
const countsOf = (head: string, ps: number[][]) => ps.map((p) => Number(byHead[head].count(p)));

test("BaxterPermutations count = Baxter numbers (A001181)", () => {
  expect(countsOf("BaxterPermutations", [[0], [1], [2], [3], [4], [5], [6], [7], [8]])).toEqual([
    1, 1, 2, 6, 22, 92, 422, 2074, 10754,
  ]);
});
test("AdjacentTranspositionInvolutions count = Fibonacci F(n+1) (A000045)", () => {
  expect(countsOf("AdjacentTranspositionInvolutions", [[0], [1], [2], [3], [4], [5], [6], [7], [8]])).toEqual([
    1, 1, 2, 3, 5, 8, 13, 21, 34,
  ]);
});
test("BooleanPermutations count = F(2n - 1) (A001519), and agrees with Av(321, 3412)", () => {
  expect(countsOf("BooleanPermutations", [[0], [1], [2], [3], [4], [5], [6], [7], [8]])).toEqual([
    1, 1, 2, 5, 13, 34, 89, 233, 610,
  ]);
  // Contains the adjacent-transposition products: every one of them avoids 321 and 3412.
  for (let n = 0; n <= 7; n++) {
    const boolean = new Set(
      Array.from({ length: Number(byHead.BooleanPermutations.count([n])) }, (_, r) =>
        String(byHead.BooleanPermutations.unrank([n], BigInt(r))),
      ),
    );
    for (let r = 0n; r < byHead.AdjacentTranspositionInvolutions.count([n]); r++) {
      expect(boolean.has(String(byHead.AdjacentTranspositionInvolutions.unrank([n], r)))).toBe(true);
    }
  }
});
test("NonCrossingPermutations count = Catalan (A000108), the increasing-cycle subset of the cycle-support family", () => {
  expect(countsOf("NonCrossingPermutations", [[0], [1], [2], [3], [4], [5], [6], [7]])).toEqual([
    1, 1, 2, 5, 14, 42, 132, 429,
  ]);
  // Every standard noncrossing permutation has noncrossing cycle support.
  for (let n = 0; n <= 6; n++) {
    for (let r = 0n; r < byHead.NonCrossingPermutations.count([n]); r++) {
      expect(byHead.NonCrossingCycleSupportPermutations.valid(byHead.NonCrossingPermutations.unrank([n], r), [n])).toBe(
        true,
      );
    }
  }
});
test("Grassmannian/CograssmannianPermutations count = 2^n - n (A000325)", () => {
  const ps = [[0], [1], [2], [3], [4], [5], [6], [7]];
  const expected = [1, 1, 2, 5, 12, 27, 58, 121];
  expect(countsOf("GrassmannianPermutations", ps)).toEqual(expected);
  expect(countsOf("CograssmannianPermutations", ps)).toEqual(expected);
});
test("NonCrossingCycleSupportPermutations count matches the noncrossing-partition recurrence", () => {
  expect(countsOf("NonCrossingCycleSupportPermutations", [[0], [1], [2], [3], [4], [5], [6], [7]])).toEqual([
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

import { expect, test } from "vite-plus/test";
import { entries } from "../src/families/tableaux-trees.ts";
import { CatalanNumber } from "../../collections/src/families/kernels-extra.ts";

// ParkingFunctions/NonDecreasingParkingFunctions split out of
// collections/tests/tableaux-trees.test.ts with the family (§4 step 5,
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible)
// -- same recipe: for every rank r in [0, count), valid(unrank(p, r), p) === true AND
// rank(unrank(p, r), p) === r.
const PARAMS: Record<string, number[][]> = {
  ParkingFunctions: [[1], [2], [3], [4]],
  NonDecreasingParkingFunctions: [[1], [4], [6]],
};

const byHead = new Map(entries.map((e) => [e.head, e]));

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

test("ParkingFunctions(n) = (n+1)^(n-1) — A000272-adjacent parking numbers", () => {
  const e = byHead.get("ParkingFunctions")!;
  expect([1, 2, 3, 4, 5].map((n) => e.count([n]))).toEqual([1, 3, 16, 125, 1296]);
});

test("NonDecreasingParkingFunctions(n) = CatalanNumber(n)", () => {
  const e = byHead.get("NonDecreasingParkingFunctions")!;
  for (const n of [0, 1, 2, 3, 4, 5, 6]) expect(e.count([n])).toBe(CatalanNumber(n));
});

// Golden first-few elements (rank 0 in each family), pinned as plain data — never a snapshot.
test("golden: rank-0 elements of each family at a fixed size", () => {
  const golden: Record<string, unknown> = {
    ParkingFunctions: byHead.get("ParkingFunctions")!.unrank([4], 0),
    NonDecreasingParkingFunctions: byHead.get("NonDecreasingParkingFunctions")!.unrank([6], 0),
  };
  expect(golden).toEqual({
    ParkingFunctions: [1, 1, 1, 1],
    NonDecreasingParkingFunctions: [1, 1, 1, 1, 1, 1],
  });
});

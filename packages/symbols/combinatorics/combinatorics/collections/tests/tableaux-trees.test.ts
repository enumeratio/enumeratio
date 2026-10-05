import { expect, test } from "vite-plus/test";
import { entriesAfterNonDecreasingParkingFunctions } from "../src/families/tableaux-trees.ts";
import { InvolutionCount } from "../src/families/kernels-extra.ts";
import { asNumbers } from "./number-kernels.ts";

// Self-cert every tableaux-trees.ts family: for every rank r in [0, count), unrank produces a
// valid element and rank(unrank(r)) === r. Sizes kept small so counts stay well under ~5000.
// ParkingFunctions/NonDecreasingParkingFunctions moved to words/tests/tableaux-trees.test.ts
// (wire-carriers lane A-91), now carrying "ParkingFunction". Tournaments/LabeledGraphs/
// LabeledGraphsByEdges moved to graphs/tests/core.test.ts (wire-carriers lane A-92), now
// carrying "Tournament"/"LabeledGraph". PruferSequences moved to
// trees/tests/prufer-sequences.test.ts (§4 step 5), now carrying "PruferSequence".
const PARAMS: Record<string, number[][]> = {
  RecursiveTrees: [[1], [2], [5]],
  IncreasingBinaryTrees: [[0], [1], [4]],
  StandardTableaux: [[0], [1], [4], [5]],
  SytHookShape: [[1], [4], [5]],
  SytTwoRow: [[1], [5], [6]],
  SytTwoColumn: [[1], [5], [6]],
};

const byHead = new Map(entriesAfterNonDecreasingParkingFunctions.map((e) => [e.head, asNumbers(e)]));

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

// Counts against known sequences (OEIS / closed forms), independent of the round-trip loop above.
test("RecursiveTrees(n) = (n-1)!", () => {
  const e = byHead.get("RecursiveTrees")!;
  expect([1, 2, 3, 4, 5].map((n) => e.count([n]))).toEqual([1, 1, 2, 6, 24]);
});

test("IncreasingBinaryTrees(n) = n!", () => {
  const e = byHead.get("IncreasingBinaryTrees")!;
  expect([0, 1, 2, 3, 4].map((n) => e.count([n]))).toEqual([1, 1, 2, 6, 24]);
});

test("StandardTableaux(n) = #involutions(n) — RSK's self-paired case, telephone numbers", () => {
  const e = byHead.get("StandardTableaux")!;
  for (const n of [0, 1, 2, 3, 4, 5, 6]) expect(e.count([n])).toBe(InvolutionCount(n));
});

test("SytHookShape(n) = 2^(n-1)", () => {
  const e = byHead.get("SytHookShape")!;
  expect([1, 2, 3, 4, 5].map((n) => e.count([n]))).toEqual([1, 2, 4, 8, 16]);
});

test("SytTwoRow(n) = SytTwoColumn(n) = C(n, floor(n/2))", () => {
  const r = byHead.get("SytTwoRow")!;
  const c = byHead.get("SytTwoColumn")!;
  expect([0, 1, 2, 3, 4, 5, 6].map((n) => r.count([n]))).toEqual([1, 1, 2, 3, 6, 10, 20]);
  expect([0, 1, 2, 3, 4, 5, 6].map((n) => c.count([n]))).toEqual([1, 1, 2, 3, 6, 10, 20]);
});

// Golden first-few elements (rank 0 in each family), pinned as plain data — never a snapshot.
test("golden: rank-0 elements of each family at a fixed size", () => {
  const golden: Record<string, unknown> = {
    RecursiveTrees: byHead.get("RecursiveTrees")!.unrank([5], 0),
    IncreasingBinaryTrees: byHead.get("IncreasingBinaryTrees")!.unrank([4], 0),
    StandardTableaux: byHead.get("StandardTableaux")!.unrank([5], 0),
    SytHookShape: byHead.get("SytHookShape")!.unrank([5], 0),
    SytTwoRow: byHead.get("SytTwoRow")!.unrank([6], 0),
  };
  expect(golden).toEqual({
    RecursiveTrees: [0, 1, 1, 1, 1],
    IncreasingBinaryTrees: [1, 0, [2, 0, [3, 0, [4, 0, 0]]]],
    StandardTableaux: [[1, 2, 3, 4, 5]],
    SytHookShape: [[1], [2], [3], [4], [5]],
    SytTwoRow: [[1, 2, 3, 4, 5, 6], []],
  });
});

import { expect, test } from "vite-plus/test";
import { entries } from "../src/packs/tableaux-trees.ts";
import { CatalanNumber, InvolutionCount, LabeledTreeCount } from "../src/packs/kernels-extra.ts";

// Self-cert every tableaux-trees.ts family: for every rank r in [0, count), unrank produces a
// valid element and rank(unrank(r)) === r. Sizes kept small so counts stay well under ~5000.
const PARAMS: Record<string, number[][]> = {
  PruferSequences: [[1], [2], [3], [5]],
  ParkingFunctions: [[1], [2], [3], [4]],
  NonDecreasingParkingFunctions: [[1], [4], [6]],
  Tournaments: [[1], [2], [3], [4]],
  LabeledGraphs: [[1], [2], [3], [4]],
  LabeledGraphsByEdges: [
    [4, 0],
    [4, 3],
    [4, 6],
  ],
  RecursiveTrees: [[1], [2], [5]],
  IncreasingBinaryTrees: [[0], [1], [4]],
  StandardTableaux: [[0], [1], [4], [5]],
  SytHookShape: [[1], [4], [5]],
  SytTwoRow: [[1], [5], [6]],
  SytTwoColumn: [[1], [5], [6]],
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

// Counts against known sequences (OEIS / closed forms), independent of the round-trip loop above.
test("PruferSequences(n) counts match LabeledTrees(n) (n^(n-2))", () => {
  const e = byHead.get("PruferSequences")!;
  for (const n of [1, 2, 3, 4, 5, 6]) expect(e.count([n])).toBe(LabeledTreeCount(n));
});

test("ParkingFunctions(n) = (n+1)^(n-1) — A000272-adjacent parking numbers", () => {
  const e = byHead.get("ParkingFunctions")!;
  expect([1, 2, 3, 4, 5].map((n) => e.count([n]))).toEqual([1, 3, 16, 125, 1296]);
});

test("NonDecreasingParkingFunctions(n) = CatalanNumber(n)", () => {
  const e = byHead.get("NonDecreasingParkingFunctions")!;
  for (const n of [0, 1, 2, 3, 4, 5, 6]) expect(e.count([n])).toBe(CatalanNumber(n));
});

test("Tournaments(n) = LabeledGraphs(n) = 2^C(n,2)", () => {
  const t = byHead.get("Tournaments")!;
  const g = byHead.get("LabeledGraphs")!;
  expect([1, 2, 3, 4].map((n) => t.count([n]))).toEqual([1, 2, 8, 64]);
  expect([1, 2, 3, 4].map((n) => g.count([n]))).toEqual([1, 2, 8, 64]);
});

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
    PruferSequences: byHead.get("PruferSequences")!.unrank([5], 0),
    ParkingFunctions: byHead.get("ParkingFunctions")!.unrank([4], 0),
    NonDecreasingParkingFunctions: byHead.get("NonDecreasingParkingFunctions")!.unrank([6], 0),
    Tournaments: byHead.get("Tournaments")!.unrank([3], 0),
    LabeledGraphs: byHead.get("LabeledGraphs")!.unrank([3], 0),
    RecursiveTrees: byHead.get("RecursiveTrees")!.unrank([5], 0),
    IncreasingBinaryTrees: byHead.get("IncreasingBinaryTrees")!.unrank([4], 0),
    StandardTableaux: byHead.get("StandardTableaux")!.unrank([5], 0),
    SytHookShape: byHead.get("SytHookShape")!.unrank([5], 0),
    SytTwoRow: byHead.get("SytTwoRow")!.unrank([6], 0),
  };
  expect(golden).toEqual({
    PruferSequences: [1, 1, 1],
    ParkingFunctions: [1, 1, 1, 1],
    NonDecreasingParkingFunctions: [1, 1, 1, 1, 1, 1],
    Tournaments: [
      [1, 2],
      [1, 3],
      [2, 3],
    ],
    LabeledGraphs: [],
    RecursiveTrees: [0, 1, 1, 1, 1],
    IncreasingBinaryTrees: [1, 0, [2, 0, [3, 0, [4, 0, 0]]]],
    StandardTableaux: [[1, 2, 3, 4, 5]],
    SytHookShape: [[1], [2], [3], [4], [5]],
    SytTwoRow: [[1, 2, 3, 4, 5, 6], []],
  });
});

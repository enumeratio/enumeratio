import { expect, test } from "vite-plus/test";
import { entries } from "../src/families/prufer-sequences.ts";
import { LabeledTreeCount } from "../../collections/src/families/kernels-extra.ts";

// Moved out of collections/tests/tableaux-trees.test.ts alongside the family (§4 step 5,
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible):
// PruferSequences now carries "PruferSequence". These tests exercise the pure kernel; the
// carrier wiring and the LabeledTree conversion are tested at the CE level in
// tests/declare-combinatorics.test.ts and tests/prufer-conversion.test.ts.
const byHead = new Map(entries.map((e) => [e.head, e]));

const PARAMS: Record<string, number[][]> = {
  PruferSequences: [[1], [2], [3], [5]],
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

test("PruferSequences(n) counts match LabeledTrees(n) (n^(n-2))", () => {
  const e = byHead.get("PruferSequences")!;
  for (const n of [1, 2, 3, 4, 5, 6]) expect(e.count([n])).toBe(LabeledTreeCount(n));
});

test("golden: rank-0 element at a fixed size", () => {
  expect(byHead.get("PruferSequences")!.unrank([5], 0)).toEqual([1, 1, 1]);
});

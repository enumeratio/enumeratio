// `declareCombinatorics` (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step
// 3): an engine built with ONLY this one call still yields typed elements -- carriers,
// families and maps all land without a host building `carrierTypes` or the constructor table
// itself.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCombinatorics } from "../src/index.ts";

const engine = (): ComputeEngine => {
  const ce = new ComputeEngine();
  declareCombinatorics(ce);
  return ce;
};

test("At(Permutations(5), 3) is a typed Permutation, and CycleCount evaluates on it", () => {
  const ce = engine();
  const p = ce.box(["At", ["Permutations", 5], 3]).evaluate();
  expect(p.operator).toEqual("Permutation");
  const count = ce.box(["CycleCount", p]).evaluate();
  expect(typeof count.re).toEqual("number");
});

test("an IntegerPartition comes out typed", () => {
  const ce = engine();
  const part = ce.box(["At", ["IntegerPartitions", 5], 1]).evaluate();
  expect(part.operator).toEqual("IntegerPartition");
});

test("a DyckPath comes out typed", () => {
  const ce = engine();
  const path = ce.box(["At", ["DyckPaths", 3], 1]).evaluate();
  expect(path.operator).toEqual("DyckPath");
});

test("a StandardTableauPair comes out typed, its two slots each a StandardTableau", () => {
  const ce = engine();
  const pair = ce.box(["At", ["StandardTableauPairs", 4], 1]).evaluate();
  expect(pair.operator).toEqual("StandardTableauPair");
  expect(pair.json).toEqual([
    "StandardTableauPair",
    ["Tuple", ["StandardTableau", ["List", 1, 2, 3, 4]], ["StandardTableau", ["List", 1, 2, 3, 4]]],
  ]);
});

test("Contains sees a StandardTableauPair it was just handed back", () => {
  const ce = engine();
  const pair = ce.box(["At", ["StandardTableauPairs", 4], 1]);
  const contained = ce.box(["Contains", ["StandardTableauPairs", 4], pair]).evaluate();
  expect(contained.json).toEqual("True");
});

test("a PruferSequence comes out typed", () => {
  const ce = engine();
  const seq = ce.box(["At", ["PruferSequences", 5], 1]).evaluate();
  expect(seq.operator).toEqual("PruferSequence");
});

test("LabeledTree(PruferSequence(...)) converts via the Prüfer bijection", () => {
  const ce = engine();
  const seq = ce.box(["At", ["PruferSequences", 5], 7]).evaluate();
  const tree = ce.box(["LabeledTree", seq] as never).evaluate();
  expect(tree.operator).toEqual("LabeledTree");
  const [, edges] = tree.json as unknown as [string, unknown[]];
  // n = 5: the tree has n - 1 = 4 edges, plus the "List" head.
  expect((edges as unknown[]).length - 1).toBe(4);
});

test("declareCombinatorics is not idempotent -- a second call on the same engine throws", () => {
  const ce = engine();
  expect(() => declareCombinatorics(ce)).toThrow();
});

// `declareCombinatorics` (design/speculative/combinatorics-layering-and-plausible.md §4 step
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

test("declareCombinatorics is not idempotent -- a second call on the same engine throws", () => {
  const ce = engine();
  expect(() => declareCombinatorics(ce)).toThrow();
});

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declarePermutations } from "../permutations/src/declare.ts";
import { ALL_STATISTICS, declareStatistics, StatisticCollisionError } from "../src/index.ts";

test("collections' own kernels take the names, and the definitions sit beside them", () => {
  // `declarePermutations` declares collections' fast kernels (Inversions, ...) before its own
  // expr-based statistics (step 6b) -- the kernel wins the name, the definition still files
  // into the same `CombinatorialStat` table beside it, and neither throws.
  const ce = new ComputeEngine();
  expect(() => declarePermutations(ce)).not.toThrow();
  const inversions = (head: string) => ce.box([head, ["List", 3, 1, 2]] as never).evaluate().json;
  expect(inversions("Inversions")).toEqual(2);
});

test("compute-engine's own head takes the carrier too, keeping its own meaning", () => {
  const ce = new ComputeEngine();
  declarePermutations(ce);
  expect(ce.box(["Sign", -3] as never).evaluate().json).toEqual(-1);
  const sign = ["CombinatorialStat", ["Permutation", ["List", 2, 1]], "'Sign'"];
  expect(ce.box(sign as never).evaluate().json).toEqual(-1);
  expect(ce.box(["Sign", ["Permutation", ["List", 2, 1]]] as never).evaluate().json).toEqual(-1);
  expect(ce.box(["Sign", ["Permutation", ["List", 3, 1, 2]]] as never).evaluate().json).toEqual(1);
});

test("any other taken name is an error that lists every collision", () => {
  const ce = new ComputeEngine();
  ce.declare("Descents", { signature: "(any) -> any" });
  ce.declare("Peaks", { signature: "(any) -> any" });
  expect(() => declareStatistics(ce, ALL_STATISTICS)).toThrow(/Descents@Permutation, Peaks@Permutation/);
  expect(() => declareStatistics(new ComputeEngine(), ALL_STATISTICS)).not.toThrow(StatisticCollisionError);
});

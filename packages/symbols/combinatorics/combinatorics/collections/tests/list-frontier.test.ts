import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

// SparseArray(rules, dims?, default?): densifies immediately. `Normal` itself has no
// reference record of its own (no declared head), so this stays a unit test.
test("Normal of a plain list is unchanged (no distinct sparse type is kept)", () => {
  expect(run(["Normal", ["List", 1, 2, 3]])).toEqual(["List", 1, 2, 3]);
});

// RandomInteger: seeded, so the shape and reproducibility are what's tested.
test("SeedRandom pins RandomInteger to a reproducible sequence", () => {
  ce.box(["SeedRandom", 7]).evaluate();
  const first = run(["RandomInteger", 100]);
  ce.box(["SeedRandom", 7]).evaluate();
  const second = run(["RandomInteger", 100]);
  expect(second).toEqual(first);
});
test("RandomInteger({min, max}) stays in range", () => {
  ce.box(["SeedRandom", 1]).evaluate();
  const draws = run(["RandomInteger", ["List", 10, 20], 50]) as unknown as unknown[];
  const values = draws.slice(1) as number[];
  expect(values.every((v) => v >= 10 && v <= 20)).toBe(true);
});
test("RandomInteger(max, {n1, n2}) builds a nested array of the given shape", () => {
  ce.box(["SeedRandom", 3]).evaluate();
  const arr = run(["RandomInteger", 1, ["List", 2, 3]]) as unknown as unknown[];
  expect(arr.length - 1).toBe(2);
  expect((arr[1] as unknown[]).length - 1).toBe(3);
});

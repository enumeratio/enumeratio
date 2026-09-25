import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

// Array(f, n) / Array(f, {n1, n2}) / Array(f, n, r) / Array(f, n, r, h)
test("Array(f, n) applies f over 1..n", () => {
  expect(run(["Array", "f", 5])).toEqual([
    "List",
    ["f", 1],
    ["f", 2],
    ["f", 3],
    ["f", 4],
    ["f", 5],
  ]);
});
test("Array(f, {n1, n2}) builds a 2-dimensional array", () => {
  expect(run(["Array", "f", ["List", 2, 2]])).toEqual([
    "List",
    ["List", ["f", 1, 1], ["f", 1, 2]],
    ["List", ["f", 2, 1], ["f", 2, 2]],
  ]);
});
test("Array(f, n, r) starts the index range at r", () => {
  expect(run(["Array", "f", 3, 0])).toEqual(["List", ["f", 0], ["f", 1], ["f", 2]]);
});
test("Array(f, n, r, h) wraps the result in h instead of List", () => {
  expect(run(["Array", "f", 3, 1, "g"])).toEqual(["g", ["f", 1], ["f", 2], ["f", 3]]);
});

// Accumulate(list): running sums, first element kept as-is.
test("Accumulate({1, 2, 3, 4}) is the running sum", () => {
  expect(run(["Accumulate", ["List", 1, 2, 3, 4]])).toEqual(["List", 1, 3, 6, 10]);
});
test("Accumulate of the empty list is empty", () => {
  expect(run(["Accumulate", ["List"]])).toEqual(["List"]);
});

// FoldList(f, x0, list) / FoldList(f, list)
test("FoldList(Add, 0, {1, 2, 3}) folds with an explicit seed", () => {
  expect(run(["FoldList", "Add", 0, ["List", 1, 2, 3]])).toEqual(["List", 0, 1, 3, 6]);
});
test("FoldList(Add, {1, 2, 3}) uses the first element as the seed", () => {
  expect(run(["FoldList", "Add", ["List", 1, 2, 3]])).toEqual(["List", 1, 3, 6]);
});

// Cases(collection, pattern): CE wildcard matching.
test("Cases(list, _) keeps every element", () => {
  expect(run(["Cases", ["List", 1, "a", 2, "b"], "_"])).toEqual(["List", 1, "a", 2, "b"]);
});
test("Cases(list, value) keeps only the literal matches", () => {
  expect(run(["Cases", ["List", 1, 2, 1, 3, 1], 1])).toEqual(["List", 1, 1, 1]);
});
test("Cases(list, f(_a)) keeps elements matching that structure", () => {
  expect(run(["Cases", ["List", ["List", 1], 2, ["List", 3]], ["List", "_a"]])).toEqual([
    "List",
    ["List", 1],
    ["List", 3],
  ]);
});

// SparseArray(rules, dims?, default?): densifies immediately.
test("SparseArray(rules, n) builds a dense vector, default 0 elsewhere", () => {
  expect(run(["SparseArray", ["List", ["Rule", 1, "x"], ["Rule", 3, "y"]], 4])).toEqual([
    "List",
    "x",
    0,
    "y",
    0,
  ]);
});
test("SparseArray(rules) infers dims from the largest index per axis", () => {
  expect(
    run(["SparseArray", ["List", ["Rule", ["List", 1, 1], 5], ["Rule", ["List", 2, 2], 7]]]),
  ).toEqual(["List", ["List", 5, 0], ["List", 0, 7]]);
});
test("SparseArray(rules, n, default) fills gaps with the given default", () => {
  expect(run(["SparseArray", ["List", ["Rule", 2, 9]], 3, -1])).toEqual(["List", -1, 9, -1]);
});
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

// IsNumeric / IsMachineNumber / Precision
test("IsNumeric is True for a symbolic numeric constant like Pi", () => {
  expect(run(["IsNumeric", "Pi"])).toEqual("True");
});
test("IsNumeric is False for a plain symbol", () => {
  expect(run(["IsNumeric", "x"])).toEqual("False");
});
test("IsMachineNumber is True for an ordinary inexact literal", () => {
  expect(run(["IsMachineNumber", 2.5])).toEqual("True");
});
test("IsMachineNumber is False for an exact number", () => {
  expect(run(["IsMachineNumber", 2])).toEqual("False");
});
test("Precision of an exact number is PositiveInfinity", () => {
  expect(run(["Precision", 2])).toEqual("PositiveInfinity");
});
test("Precision of an inexact literal is its written digit count", () => {
  expect(run(["Precision", 2.5])).toEqual(2);
});

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

// Riffle(list, x, n?)
test("Riffle(list, scalar) separates every consecutive pair", () => {
  expect(run(["Riffle", ["List", "a", "b", "c"], "x"])).toEqual(["List", "a", "x", "b", "x", "c"]);
});
test("Riffle(list, list-of-same-length) interleaves, including a trailing element", () => {
  expect(run(["Riffle", ["List", "a", "b", "c"], ["List", "x", "y", "z"]])).toEqual([
    "List",
    "a",
    "x",
    "b",
    "y",
    "c",
    "z",
  ]);
});
test("Riffle(list, shorter list) stops once the separator list runs out", () => {
  expect(run(["Riffle", ["List", "a", "b", "c"], ["List", "x", "y"]])).toEqual(["List", "a", "x", "b", "y", "c"]);
});
test("Riffle(list, x, n) places a separator every n elements", () => {
  expect(run(["Riffle", ["List", 1, 2, 3, 4, 5, 6, 7], "x", 3])).toEqual(["List", 1, 2, "x", 3, 4, "x", 5, 6, "x", 7]);
});
test("Riffle(singleton, x) has nothing to separate", () => {
  expect(run(["Riffle", ["List", "a"], "x"])).toEqual(["List", "a"]);
});

// Span, via At
test("At(list, Span(i, j)) selects positions i through j", () => {
  expect(run(["At", ["List", "a", "b", "c", "d", "f"], ["Span", 2, 4]])).toEqual(["List", "b", "c", "d"]);
});
test("At(list, Span(i, j, step)) strides through positions", () => {
  expect(run(["At", ["List", "a", "b", "c", "d", "f"], ["Span", 1, -1, 2]])).toEqual(["List", "a", "c", "f"]);
});
test("At(list, Span(i, j, negative step)) walks backwards", () => {
  expect(run(["At", ["List", "a", "b", "c", "d", "f"], ["Span", -1, 1, -1]])).toEqual([
    "List",
    "f",
    "d",
    "c",
    "b",
    "a",
  ]);
});
test("At(list, Span(-2, -1)) counts from the end", () => {
  expect(run(["At", ["List", "a", "b", "c", "d", "f"], ["Span", -2, -1]])).toEqual(["List", "d", "f"]);
});
test("At(matrix, Span, Span) cuts a submatrix at two levels", () => {
  const matrix = ["List", ["List", 1, 2, 3], ["List", 4, 5, 6], ["List", 7, 8, 9]];
  expect(run(["At", matrix, ["Span", 2, 3], ["Span", 1, 2]])).toEqual(["List", ["List", 4, 5], ["List", 7, 8]]);
});
test("At(list, integer) without a Span is unaffected", () => {
  expect(run(["At", ["List", "a", "b", "c"], 2])).toEqual("b");
});

// UpTo, via Partition / Ordering. Take(c, UpTo(n)) is aspirational — see
// list-ops-wolfram.ts's comment on why Take can't safely be widened the same way.
test("Partition(list, UpTo(n)) keeps a ragged final chunk", () => {
  expect(run(["Partition", ["List", 1, 2, 3, 4, 5, 6], ["UpTo", 4]])).toEqual([
    "List",
    ["List", 1, 2, 3, 4],
    ["List", 5, 6],
  ]);
});
test("Partition(list, n) without UpTo still drops the ragged remainder", () => {
  expect(run(["Partition", ["List", 1, 2, 3, 4, 5, 6], 4])).toEqual(["List", ["List", 1, 2, 3, 4]]);
});
test("Ordering(list, UpTo(n)) with n past the length gives the full ordering", () => {
  expect(run(["Ordering", ["List", 2, 6, 1, 9, 2], ["UpTo", 6]])).toEqual(["List", 3, 1, 5, 2, 4]);
});

// Gather / GatherBy
test("Gather groups identical elements in first-appearance order", () => {
  expect(run(["Gather", ["List", 1, 7, 3, 7, 2, 3, 9]])).toEqual([
    "List",
    ["List", 1],
    ["List", 7, 7],
    ["List", 3, 3],
    ["List", 2],
    ["List", 9],
  ]);
});
test("Gather(list, test) groups by a custom equivalence", () => {
  expect(
    run(["Gather", ["List", 1, 2, 3, 4, 5, 6], ["Function", ["Equal", ["Mod", "_1", 2], ["Mod", "_2", 2]]]]),
  ).toEqual(["List", ["List", 1, 3, 5], ["List", 2, 4, 6]]);
});
test("GatherBy groups by a function's value", () => {
  expect(run(["GatherBy", ["List", 1, 2, 3, 4, 5, 6, 7], ["Function", ["Mod", "_1", 3]]])).toEqual([
    "List",
    ["List", 1, 4, 7],
    ["List", 2, 5],
    ["List", 3, 6],
  ]);
});

// Split / SplitBy
test("Split breaks a list into runs of adjacent identical elements", () => {
  expect(run(["Split", ["List", 1, 1, 2, 2, 2, 3, 1, 1]])).toEqual([
    "List",
    ["List", 1, 1],
    ["List", 2, 2, 2],
    ["List", 3],
    ["List", 1, 1],
  ]);
});
test("Split(list, test) breaks runs on a custom adjacency test", () => {
  expect(run(["Split", ["List", 1, 2, 3, 5, 4, 6], "Less"])).toEqual(["List", ["List", 1, 2, 3, 5], ["List", 4, 6]]);
});
test("Split of the empty list is empty", () => {
  expect(run(["Split", ["List"]])).toEqual(["List"]);
});
test("SplitBy breaks runs on a function's changing value", () => {
  expect(run(["SplitBy", ["List", 1, 3, 5, 2, 4, 7, 9], ["Function", ["Mod", "_1", 2]]])).toEqual([
    "List",
    ["List", 1, 3, 5],
    ["List", 2, 4],
    ["List", 7, 9],
  ]);
});

// SortBy
test("SortBy sorts by a function's value", () => {
  expect(run(["SortBy", ["List", -3, 1, -2], "Abs"])).toEqual(["List", 1, -2, -3]);
});
test("SortBy is stable on ties", () => {
  const pairs = ["List", ["List", "a", 2], ["List", "c", 1], ["List", "d", 3]];
  expect(run(["SortBy", pairs, "Last"])).toEqual(["List", ["List", "c", 1], ["List", "a", 2], ["List", "d", 3]]);
});

// PadLeft / PadRight
test("PadLeft pads with zeros on the left", () => {
  expect(run(["PadLeft", ["List", 1, 2, 3], 5])).toEqual(["List", 0, 0, 1, 2, 3]);
});
test("PadLeft(list, n, x) pads with a given element", () => {
  expect(run(["PadLeft", ["List", 1, 2, 3], 5, "x"])).toEqual(["List", "x", "x", 1, 2, 3]);
});
test("PadLeft(list, n) with n shorter than list drops elements from the left", () => {
  expect(run(["PadLeft", ["List", 1, 2, 3, 4, 5], 3])).toEqual(["List", 3, 4, 5]);
});
test("PadLeft(ragged) pads every row to the widest row's length", () => {
  expect(run(["PadLeft", ["List", ["List", 1], ["List", 2, 3]]])).toEqual(["List", ["List", 0, 1], ["List", 2, 3]]);
});
test("PadRight pads with zeros on the right", () => {
  expect(run(["PadRight", ["List", 1, 2, 3], 5])).toEqual(["List", 1, 2, 3, 0, 0]);
});
test("PadRight(list, n) with n shorter than list drops elements from the right", () => {
  expect(run(["PadRight", ["List", 1, 2, 3, 4, 5], 3])).toEqual(["List", 1, 2, 3]);
});
test("PadRight(ragged) pads every row to the widest row's length", () => {
  expect(run(["PadRight", ["List", ["List", 1], ["List", 2, 3]]])).toEqual(["List", ["List", 1, 0], ["List", 2, 3]]);
});

// NoneTrue
test("NoneTrue is true when no element satisfies the predicate", () => {
  expect(run(["NoneTrue", ["List", 1, 3, 5], "IsEven"])).toEqual("True");
});
test("NoneTrue is false when some element satisfies the predicate", () => {
  expect(run(["NoneTrue", ["List", 1, 2, 3], "IsEven"])).toEqual("False");
});
test("NoneTrue is vacuously true on the empty list", () => {
  expect(run(["NoneTrue", ["List"], "IsEven"])).toEqual("True");
});
test("NoneTrue is the negation of Any", () => {
  const list = ["List", 4, 6, 9];
  expect(run(["NoneTrue", list, "IsPrime"])).toEqual(run(["Not", ["Any", list, "IsPrime"]]));
});

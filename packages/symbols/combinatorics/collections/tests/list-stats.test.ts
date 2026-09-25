import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);

/** Evaluates and, for a lazy collection (e.g. `Take`'s own protocol-backed result), forces
 *  it into its elements -- otherwise `.json` reports the call, not the answer. See
 *  `list-stats.ts`'s own note on why `Take` can't be made eager any other way. */
const run = (expr: unknown): unknown => {
  const result = ce.box(expr as never).evaluate();
  return (result.isLazyCollection ? result.evaluate({ materialization: true }) : result).json;
};

// Mean / Median: symbolic and exact-constant data, not just numbers.
test("Mean(symbols) is exact, not a numeric approximation", () => {
  expect(run(["Mean", ["List", "a", "b", "c", "d"]])).toEqual([
    "Multiply",
    ["Rational", 1, 4],
    ["Add", "a", "b", "c", "d"],
  ]);
});
test("Mean(exact constants) stays exact", () => {
  expect(run(["Mean", ["List", "Pi", "ExponentialE", 2]])).toEqual([
    "Multiply",
    ["Rational", 1, 3],
    ["Add", 2, "ExponentialE", "Pi"],
  ]);
});
test("Mean(matrix of symbols) is column-wise and exact", () => {
  expect(run(["Mean", ["List", ["List", "a", "u"], ["List", "b", "v"], ["List", "c", "w"]]])).toEqual([
    "List",
    ["Multiply", ["Rational", 1, 3], ["Add", "a", "b", "c"]],
    ["Multiply", ["Rational", 1, 3], ["Add", "u", "v", "w"]],
  ]);
});
test("Mean(numbers) is unaffected", () => {
  expect(run(["Mean", ["List", 1, 2, 3, 4]])).toEqual(["Rational", 5, 2]);
});
test("Median(exact constants) sorts by value", () => {
  expect(run(["Median", ["List", "Pi", "ExponentialE", 2]])).toEqual("ExponentialE");
});
test("Median(numbers) is unaffected", () => {
  expect(run(["Median", ["List", 1, 2, 3, 4, 5]])).toEqual(3);
});

// Commonest(c, n): the n commonest, most frequent first, ties broken by first appearance.
test("Commonest(c, n) ranks by frequency, most frequent first", () => {
  expect(run(["Commonest", ["List", 1, 2, 2, 3, 3, 3, 4], 2])).toEqual(["List", 3, 2]);
});
test("Commonest(c, n) breaks a frequency tie by first appearance", () => {
  expect(run(["Commonest", ["List", 4, 1, 1, 4], 1])).toEqual(["List", 4]);
});
test("Commonest(c) with no n is unaffected", () => {
  expect(run(["Commonest", ["List", 1, 1, 2, 2, 3]])).toEqual(["List", 1, 2]);
});

// Sort({}): the empty list sorts to itself.
test("Sort({}) is {}", () => {
  expect(run(["Sort", ["List"]])).toEqual(["List"]);
});
test("Sort(nonEmpty) is unaffected", () => {
  expect(run(["Sort", ["List", 3, 1, 2]])).toEqual(["List", 1, 2, 3]);
});

// Take(xs, UpTo(n)): at most n, never an error for asking for more than xs holds.
test("Take(xs, UpTo(n)) with n >= length(xs) takes everything", () => {
  expect(run(["Take", ["List", 1, 2, 3], ["UpTo", 5]])).toEqual(["List", 1, 2, 3]);
});
test("Take(xs, UpTo(n)) with n < length(xs) takes exactly n", () => {
  expect(run(["Take", ["List", 1, 2, 3, 4, 5, 6], ["UpTo", 2]])).toEqual(["List", 1, 2]);
});
test("Take(xs, n) with a plain integer is unaffected", () => {
  expect(run(["Take", ["List", 1, 2, 3, 4], 2])).toEqual(["List", 1, 2]);
});
test("Partition(xs, UpTo(n)) is unaffected", () => {
  expect(run(["Partition", ["List", 1, 2, 3, 4, 5, 6], ["UpTo", 4]])).toEqual([
    "List",
    ["List", 1, 2, 3, 4],
    ["List", 5, 6],
  ]);
});

// Fold(f, xs): the unseeded 2-argument form, starting from xs's own first element.
test("Fold(f, xs) with no seed starts from the first element", () => {
  expect(run(["Fold", "f", ["List", "a", "b", "c"]])).toEqual(["f", ["f", "a", "b"], "c"]);
});
test("Fold(f, init, xs) with an explicit seed is unaffected", () => {
  expect(run(["Fold", "Add", 0, ["List", 1, 2, 3, 4]])).toEqual(10);
});

// Tabulate(f, …): three or more dimensions, and a literal 0 in any dimension.
test("Tabulate(f, n, m, k) materializes three dimensions", () => {
  expect(run(["Tabulate", "f", 2, 2, 2])).toEqual([
    "List",
    ["List", ["List", ["f", 1, 1, 1], ["f", 1, 1, 2]], ["List", ["f", 1, 2, 1], ["f", 1, 2, 2]]],
    ["List", ["List", ["f", 2, 1, 1], ["f", 2, 1, 2]], ["List", ["f", 2, 2, 1], ["f", 2, 2, 2]]],
  ]);
});
test("Tabulate(f, 0) is the empty list", () => {
  expect(run(["Tabulate", "f", 0])).toEqual(["List"]);
});
test("Tabulate(f, n) at one dimension is unaffected", () => {
  expect(run(["Tabulate", ["Function", ["Power", "_1", 2]], 5])).toEqual(["List", 1, 4, 9, 16, 25]);
});
test("Tabulate(f, n, m) at two dimensions is unaffected", () => {
  expect(run(["Tabulate", ["Function", ["Multiply", "_1", "_2"]], 2, 2])).toEqual([
    "List",
    ["List", 1, 2],
    ["List", 2, 4],
  ]);
});

// Unique(xs, test): a second argument saying when two elements count as duplicates.
test("Unique(xs, test) drops an element matching an already-kept one", () => {
  expect(
    run(["Unique", ["List", 1, 2, 3, 4, 5, 6], ["Function", ["Less", ["Abs", ["Subtract", "_1", "_2"]], 2]]]),
  ).toEqual(["List", 1, 3, 5]);
});
test("Unique(xs) with no test is unaffected", () => {
  expect(run(["Unique", ["List", 1, 2, 2, 3, 1]])).toEqual(["List", 1, 2, 3]);
});

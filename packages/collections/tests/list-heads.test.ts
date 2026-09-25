import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

// First / Last: an explicit default for an empty collection.
test("First([], default) returns the default on an empty list", () => {
  expect(run(["First", ["List"], 99])).toEqual(99);
});
test("First(nonEmpty, default) still returns the first element", () => {
  expect(run(["First", ["List", 1, 2, 3], 99])).toEqual(1);
});
test("First(nonEmpty) with no default is unaffected", () => {
  expect(run(["First", ["List", 1, 2, 3]])).toEqual(1);
});
test("Last([], default) returns the default on an empty list", () => {
  expect(run(["Last", ["List"], 99])).toEqual(99);
});
test("Last(nonEmpty, default) still returns the last element", () => {
  expect(run(["Last", ["List", 1, 2, 3], 99])).toEqual(3);
});

// Ordering(collection, n): the first n indices of the full ordering.
test("Ordering(c, n) takes the first n of the full ordering", () => {
  expect(run(["Ordering", ["List", 2, 6, 1, 9, 1, 2, 3], 4])).toEqual(["List", 3, 5, 1, 6]);
});
test("Ordering(c, n) agrees with the first n of Ordering(c)", () => {
  const list = ["List", 2, 6, 1, 9, 1, 2, 3];
  const full = run(["Ordering", list]) as readonly unknown[];
  for (let n = 0; n <= 7; n++) {
    expect(run(["Ordering", list, n])).toEqual(["List", ...full.slice(1, n + 1)]);
  }
});
test("Ordering(c) with no n is unaffected", () => {
  expect(run(["Ordering", ["List", 3, 1, 2]])).toEqual(["List", 2, 3, 1]);
});

// Mean / Median: column-wise over a matrix.
test("Mean(matrix) is column-wise", () => {
  expect(run(["Mean", ["List", ["List", 1, 10], ["List", 2, 20], ["List", 3, 30]]])).toEqual([
    "List",
    2,
    20,
  ]);
});
test("Mean(flat list) is unaffected", () => {
  expect(run(["Mean", ["List", 1, 2, 3, 4]])).toEqual(["Rational", 5, 2]);
});
test("Median(matrix) is column-wise", () => {
  expect(run(["Median", ["List", ["List", 1, 11, 3], ["List", 4, 6, 7]]])).toEqual([
    "List",
    ["Rational", 5, 2],
    ["Rational", 17, 2],
    5,
  ]);
});
test("Median(flat list) is unaffected", () => {
  expect(run(["Median", ["List", 1, 2, 3, 4, 5]])).toEqual(3);
});

// Clamp(x): defaults to [-1, 1].
test("Clamp(x) defaults to the range [-1, 1]", () => {
  expect(run(["Clamp", 1.5])).toEqual(1);
  expect(run(["Clamp", -5])).toEqual(-1);
  expect(run(["Clamp", 0.5])).toEqual(0.5);
});
test("Clamp(x, lower, upper) is unaffected", () => {
  expect(run(["Clamp", 5, 0, 3])).toEqual(3);
});

// Sort: strings sort lexicographically; numeric and comparator forms are unaffected.
test("Sort(strings) sorts lexicographically", () => {
  expect(run(["Sort", ["List", "banana", "apple", "cherry"]])).toEqual([
    "List",
    "apple",
    "banana",
    "cherry",
  ]);
});
test("Sort(numbers) is unaffected", () => {
  expect(run(["Sort", ["List", 3, 1, 2]])).toEqual(["List", 1, 2, 3]);
});
test("Sort(list, comparator) is unaffected", () => {
  expect(run(["Sort", ["List", 3, 1, 2], ["Function", ["Greater", "_1", "_2"]]])).toEqual([
    "List",
    3,
    2,
    1,
  ]);
});

// Length(atom): 0, since an atom has no parts.
test("Length(atom) is 0", () => {
  expect(run(["Length", 5])).toEqual(0);
});
test("Length(collection) is unaffected", () => {
  expect(run(["Length", ["List", 1, 2, 3, 4]])).toEqual(4);
});

// At(c, 0): the head symbol, matching Wolfram's Part[c, 0].
test("At(c, 0) is the collection's head", () => {
  expect(run(["At", ["List", 1, 2, 3], 0])).toEqual("List");
});
test("At(c, i) for i != 0 is unaffected", () => {
  expect(run(["At", ["List", 1, 2, 3, 4], 2])).toEqual(2);
});

// Union: sorted, matching Wolfram.
test("Union(...) is sorted", () => {
  expect(run(["Union", ["Divisors", 10], ["Divisors", 12], ["Divisors", 20]])).toEqual([
    "Set",
    1,
    2,
    3,
    4,
    5,
    6,
    10,
    12,
    20,
  ]);
});
test("Union(...) is still de-duplicated", () => {
  expect(run(["Union", ["List", 1, 2, 3], ["List", 3, 4]])).toEqual(["Set", 1, 2, 3, 4]);
});

// Partition(c, n): the ragged tail is dropped, matching Wolfram; the sliding-window
// form, Partition(c, n, d), is untouched.
test("Partition(c, n) drops a ragged tail", () => {
  expect(run(["Partition", ["List", 1, 2, 3, 4, 5], 2])).toEqual([
    "List",
    ["List", 1, 2],
    ["List", 3, 4],
  ]);
});
test("Partition(c, n) with no ragged tail is unaffected", () => {
  expect(run(["Partition", ["List", 1, 2, 3, 4, 5, 6], 2])).toEqual([
    "List",
    ["List", 1, 2],
    ["List", 3, 4],
    ["List", 5, 6],
  ]);
});
test("Partition(c, n, d) sliding windows are unaffected", () => {
  expect(run(["Partition", ["List", 1, 2, 3, 4, 5, 6], 3, 1])).toEqual([
    "List",
    ["List", 1, 2, 3],
    ["List", 2, 3, 4],
    ["List", 3, 4, 5],
    ["List", 4, 5, 6],
  ]);
});

// Join(a, b, …, n): a trailing integer n >= 2 joins at that level.
test("Join(a, b, n) joins at level n", () => {
  expect(
    run([
      "Join",
      ["List", ["List", 1, 2], ["List", 3, 4]],
      ["List", ["List", 5, 6], ["List", 7, 8]],
      2,
    ]),
  ).toEqual(["List", ["List", 1, 2, 5, 6], ["List", 3, 4, 7, 8]]);
});
test("Join(a, b) with no level argument is unaffected", () => {
  expect(run(["Join", ["List", 1, 2], ["List", 3, 4]])).toEqual(["List", 1, 2, 3, 4]);
});

// Commonest: every tied mode, unlike Mode which returns just one.
test("Commonest returns every tied mode", () => {
  expect(run(["Commonest", ["List", 1, 1, 2, 2, 3]])).toEqual(["List", 1, 2]);
});
test("Commonest with a unique mode returns a single-element list", () => {
  expect(run(["Commonest", ["List", 1, 2, 2, 3]])).toEqual(["List", 2]);
});
test("Commonest agrees with a brute-force tally, for every subset of 1..5 repeated", () => {
  const values = [1, 2, 2, 3, 3, 3, 4, 4, 4, 4];
  for (let mask = 1; mask < 1 << values.length; mask++) {
    const subset = values.filter((_, i) => (mask & (1 << i)) !== 0);
    const tally = new Map<number, number>();
    for (const v of subset) tally.set(v, (tally.get(v) ?? 0) + 1);
    const max = Math.max(...tally.values());
    const expected = [...tally.entries()].filter(([, c]) => c === max).map(([v]) => v);
    // First-seen order, matching the implementation.
    const firstSeen = subset.filter((v, i) => subset.indexOf(v) === i && expected.includes(v));
    expect(run(["Commonest", ["List", ...subset]])).toEqual(["List", ...firstSeen]);
  }
});

// Position: every matching index, wrapped, unlike IndexOf which reports only the first.
test("Position returns every matching index", () => {
  expect(run(["Position", ["List", 1, 2, 3, 2], 2])).toEqual(["List", ["List", 2], ["List", 4]]);
});
test("Position returns an empty list when the value isn't present", () => {
  expect(run(["Position", ["List", 1, 2, 3], 9])).toEqual(["List"]);
});
test("Position's first entry agrees with IndexOf", () => {
  const list = ["List", 1, 2, 3, 2];
  const indexOf = run(["IndexOf", list, 2]);
  const positions = run(["Position", list, 2]) as readonly unknown[];
  expect(positions[1]).toEqual(["List", indexOf]);
});

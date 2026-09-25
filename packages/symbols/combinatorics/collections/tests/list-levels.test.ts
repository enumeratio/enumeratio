import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

// Partition(list, {n1, n2}, offset): a matrix cut into overlapping rectangular blocks.
test("Partition(matrix, {2, 2}, 1) cuts overlapping 2x2 blocks", () => {
  expect(
    run(["Partition", ["List", ["List", 11, 12, 13], ["List", 21, 22, 23], ["List", 31, 32, 33]], ["List", 2, 2], 1]),
  ).toEqual([
    "List",
    ["List", ["List", ["List", 11, 12], ["List", 21, 22]], ["List", ["List", 12, 13], ["List", 22, 23]]],
    ["List", ["List", ["List", 21, 22], ["List", 31, 32]], ["List", ["List", 22, 23], ["List", 32, 33]]],
  ]);
});
test("Partition(matrix, {2, 2}, 2) is non-overlapping, matching plain Partition per axis", () => {
  expect(run(["Partition", ["List", ["List", 1, 2, 3, 4], ["List", 5, 6, 7, 8]], ["List", 2, 2], 2])).toEqual([
    "List",
    ["List", ["List", ["List", 1, 2], ["List", 5, 6]], ["List", ["List", 3, 4], ["List", 7, 8]]],
  ]);
});

// Partition(list, n, d, {kL, kR}): cyclic-wraparound overhangs.
test("Partition overhang {1, 1} wraps cyclically", () => {
  expect(run(["Partition", ["List", 1, 2, 3, 4, 5, 6], 5, 1, ["List", 1, 1]])).toEqual([
    "List",
    ["List", 1, 2, 3, 4, 5],
    ["List", 2, 3, 4, 5, 6],
    ["List", 3, 4, 5, 6, 1],
    ["List", 4, 5, 6, 1, 2],
    ["List", 5, 6, 1, 2, 3],
    ["List", 6, 1, 2, 3, 4],
  ]);
});
test("Partition overhang {-1, 1} extends past both ends", () => {
  const result = run(["Partition", ["List", 1, 2, 3, 4, 5, 6], 5, 1, ["List", -1, 1]]) as readonly [
    string,
    ...unknown[],
  ];
  expect(result[0]).toEqual("List");
  expect(result.length - 1).toEqual(10);
});

// Partition(list, n, d, {kL, kR}, pad): padded overhangs instead of wraparound.
test("Partition padded overhang {1, 1} pads the tail", () => {
  expect(run(["Partition", ["List", 1, 2, 3, 4, 5, 6], 3, 1, ["List", 1, 1], "x"])).toEqual([
    "List",
    ["List", 1, 2, 3],
    ["List", 2, 3, 4],
    ["List", 3, 4, 5],
    ["List", 4, 5, 6],
    ["List", 5, 6, "x"],
    ["List", 6, "x", "x"],
  ]);
});
test("Partition padded overhang {-1, -1} pads the head", () => {
  expect(run(["Partition", ["List", 1, 2, 3, 4, 5, 6], 3, 1, ["List", -1, -1], "x"])).toEqual([
    "List",
    ["List", "x", "x", 1],
    ["List", "x", 1, 2],
    ["List", 1, 2, 3],
    ["List", 2, 3, 4],
    ["List", 3, 4, 5],
    ["List", 4, 5, 6],
  ]);
});

// Flatten(list, PositiveInfinity): same as the (already fully-flattening) default.
test("Flatten(list, PositiveInfinity) fully flattens, like the default", () => {
  const nested = ["List", 1, ["List", 2, ["List", 3, ["List", 4]]]];
  expect(run(["Flatten", nested, "PositiveInfinity"])).toEqual(run(["Flatten", nested]));
});

// Flatten(list, {{p1}, {p2}}): a permutation of levels regroups the dimensions.
test("Flatten with a permutation level spec transposes a matrix", () => {
  expect(run(["Flatten", ["List", ["List", 1, 2], ["List", 3, 4]], ["List", ["List", 2], ["List", 1]]])).toEqual([
    "List",
    ["List", 1, 3],
    ["List", 2, 4],
  ]);
});

// Flatten(f(a, f(b, f(c)))): nested calls of any one head flatten, not just List.
test("Flatten splices nested calls of any one head", () => {
  expect(run(["Flatten", ["f", "a", ["f", "b", ["f", "c"]]]])).toEqual(["f", "a", "b", "c"]);
});
test("Flatten on a single-level non-List call is unaffected", () => {
  expect(run(["Flatten", ["f", "a", "b"]])).toEqual(["f", "a", "b"]);
});

// Join(a, b, …, n): a row missing from a shorter array is skipped, not treated as an error.
test("Join at a level tolerates a shorter array (a missing row)", () => {
  expect(run(["Join", ["List", ["List", "x"]], ["List", ["List", 1, 2], ["List", 3, 4]], 2])).toEqual([
    "List",
    ["List", "x", 1, 2],
    ["List", 3, 4],
  ]);
});
test("Join at a level still works when the shorter array comes second", () => {
  expect(run(["Join", ["List", ["List", 1, 2], ["List", 3, 4]], ["List", ["List", "x"]], 2])).toEqual([
    "List",
    ["List", 1, 2, "x"],
    ["List", 3, 4],
  ]);
});

// Join(a, b, …): any head, as long as every argument shares it.
test("Join splices operands of any shared head", () => {
  expect(run(["Join", ["f", "a"], ["f", "b"], ["f", "c"]])).toEqual(["f", "a", "b", "c"]);
});
test("Join still rejects mismatched heads (stays unevaluated)", () => {
  const result = run(["Join", ["f", "a"], ["g", "b"]]) as readonly unknown[];
  expect(result[0]).toEqual("Join");
});

// Count(collection, value, level): a bare integer is cumulative (levels 1..n); {n} is exact.
test("Count with a bare integer level counts levels 1 through n", () => {
  expect(run(["Count", ["List", ["List", "a", "a", "b"], "b", ["List", "a", "b", "a"]], "b", 2])).toEqual(3);
});
test("Count with a {n} level counts that level only", () => {
  expect(run(["Count", ["List", ["List", "a", "a", "b"], "b", ["List", "a", "b", "a"]], "b", ["List", 2]])).toEqual(2);
});
test("Count with no level argument is unaffected", () => {
  expect(run(["Count", ["List", 1, 2, 2, 3, 2], 2])).toEqual(3);
});

// All/Any(collection, predicate, level): tests the elements at exactly that level.
test("All at a level tests only the elements at that depth", () => {
  expect(run(["All", ["List", ["List", 1, 2], ["List", 3, 4]], ["Function", ["Greater", "_1", 0]], 2])).toEqual("True");
});
test("Any at a level tests only the elements at that depth", () => {
  expect(run(["Any", ["List", ["List", 1, 2], ["List", 3, -4]], ["Function", ["Less", "_1", 0]], 2])).toEqual("True");
});

// At(expr, index): parts of any expression, not just a collection's.
test("At indexes into the operands of a non-collection expression", () => {
  expect(run(["At", ["Add", "a", "b", "c"], 2])).toEqual("b");
});
test("At still works normally on an actual collection", () => {
  expect(run(["At", ["List", 1, 2, 3, 4], 2])).toEqual(2);
});
test("At still finds a lazy family collection's element", () => {
  expect(run(["At", ["KSubsets", 5, 2], 1])).toEqual(["List", 1, 2]);
});

// FirstPosition(collection, value): the first occurrence at any nested level.
test("FirstPosition finds a match nested inside a sublist", () => {
  expect(
    run(["FirstPosition", ["List", ["List", "a", "a", "b"], ["List", "b", "a", "a"], ["List", "a", "b", "a"]], "b"]),
  ).toEqual(["List", 1, 3]);
});
test("FirstPosition finds a match nested earlier over one later at the top level", () => {
  expect(run(["FirstPosition", ["List", "a", ["List", "a", "b"], "b"], "b"])).toEqual(["List", 2, 2]);
});
test("FirstPosition gives the empty list when the value is absent", () => {
  expect(run(["FirstPosition", ["List", "a", ["List", "a", "c"]], "b"])).toEqual(["List"]);
});

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

// Nest / NestList

test("Nest applies f n times", () => {
  expect(run(["Nest", "f", "x", 3])).toEqual(["f", ["f", ["f", "x"]]]);
});
test("Nest(f, x, 0) leaves x alone", () => {
  expect(run(["Nest", "f", "x", 0])).toEqual("x");
});
test("Nest agrees with the last entry of NestList", () => {
  const fn = ["Function", ["Multiply", 2, "_1"]];
  const nested = run(["Nest", fn, 1, 6]);
  const list = run(["NestList", fn, 1, 6]) as readonly unknown[];
  expect(nested).toEqual(list[list.length - 1]);
});
test("NestList has n + 1 entries, the first being the seed", () => {
  expect(run(["NestList", "f", "x", 3])).toEqual([
    "List",
    "x",
    ["f", "x"],
    ["f", ["f", "x"]],
    ["f", ["f", ["f", "x"]]],
  ]);
});
test("NestList(f, x, 0) is just the seed", () => {
  expect(run(["NestList", "f", "x", 0])).toEqual(["List", "x"]);
});

// FixedPoint

test("FixedPoint halves and floors down to 0", () => {
  expect(run(["FixedPoint", ["Function", ["Floor", ["Divide", "_1", 2]]], 100])).toEqual(0);
});
test("FixedPoint is idempotent once reached: one more f does nothing", () => {
  const fn = ["Function", ["Floor", ["Divide", "_1", 2]]];
  const fixed = run(["FixedPoint", fn, 100]);
  expect(run(["Apply", fn, fixed])).toEqual(fixed);
});
test("FixedPoint(f) alone (no x) still declines — the widened signature requires both", () => {
  const result = run(["FixedPoint", "f"]) as readonly unknown[];
  expect(result[0]).toEqual("Error");
});

// LinearRecurrence: cross-checked against a hand-rolled recurrence.
function handRecurrence(kernel: number[], init: number[], n: number): number[] {
  const seq = [...init];
  for (let i = seq.length; i < n; i++) {
    let term = 0;
    for (let j = 0; j < kernel.length; j++) term += kernel[j] * seq[i - 1 - j];
    seq.push(term);
  }
  return seq.slice(0, n);
}

test("LinearRecurrence matches a hand-rolled Fibonacci recurrence", () => {
  const expected = handRecurrence([1, 1], [1, 1], 15);
  expect(run(["LinearRecurrence", ["List", 1, 1], ["List", 1, 1], 15])).toEqual([
    "List",
    ...expected,
  ]);
});
test("LinearRecurrence matches a hand-rolled tribonacci recurrence", () => {
  const expected = handRecurrence([1, 1, 1], [0, 0, 1], 12);
  expect(run(["LinearRecurrence", ["List", 1, 1, 1], ["List", 0, 0, 1], 12])).toEqual([
    "List",
    ...expected,
  ]);
});
test("LinearRecurrence({m}) is the m-th term of the full sequence", () => {
  const full = run(["LinearRecurrence", ["List", 1, 1], ["List", 1, 1], 10]) as readonly unknown[];
  expect(run(["LinearRecurrence", ["List", 1, 1], ["List", 1, 1], ["List", 7]])).toEqual([
    "List",
    full[7],
  ]);
});
test("LinearRecurrence({start, end}) is a slice of the full sequence", () => {
  const full = run(["LinearRecurrence", ["List", 1, 1], ["List", 1, 1], 10]) as readonly unknown[];
  expect(run(["LinearRecurrence", ["List", 1, 1], ["List", 1, 1], ["List", 3, 6]])).toEqual([
    "List",
    ...full.slice(3, 7),
  ]);
});
test("LinearRecurrence stays exact over rationals", () => {
  expect(run(["LinearRecurrence", ["List", ["Rational", 1, 2]], ["List", 4], 5])).toEqual([
    "List",
    4,
    2,
    1,
    ["Rational", 1, 2],
    ["Rational", 1, 4],
  ]);
});

// RecurrenceTable: cross-checked against LinearRecurrence for the same Fibonacci recurrence.
test("RecurrenceTable agrees with LinearRecurrence on the Fibonacci recurrence", () => {
  const viaLinear = run(["LinearRecurrence", ["List", 1, 1], ["List", 1, 1], 10]);
  const viaTable = run([
    "RecurrenceTable",
    [
      "List",
      ["Equal", ["a", "n"], ["Add", ["a", ["Subtract", "n", 1]], ["a", ["Subtract", "n", 2]]]],
      ["Equal", ["a", 1], 1],
      ["Equal", ["a", 2], 1],
    ],
    "a",
    ["List", "n", 1, 10],
  ]);
  expect(viaTable).toEqual(viaLinear);
});
test("RecurrenceTable handles a shifted-index equation (a(n+1) = ...)", () => {
  expect(
    run([
      "RecurrenceTable",
      [
        "List",
        ["Equal", ["a", ["Add", "n", 1]], ["Multiply", 3, ["a", "n"]]],
        ["Equal", ["a", 1], 7],
      ],
      "a",
      ["List", "n", 1, 5],
    ]),
  ).toEqual(["List", 7, 21, 63, 189, 567]);
});
test("RecurrenceTable can start past the initial conditions", () => {
  const full = run([
    "RecurrenceTable",
    [
      "List",
      ["Equal", ["a", "n"], ["Add", ["a", ["Subtract", "n", 1]], ["a", ["Subtract", "n", 2]]]],
      ["Equal", ["a", 1], 1],
      ["Equal", ["a", 2], 1],
    ],
    "a",
    ["List", "n", 1, 10],
  ]) as readonly unknown[];
  const tail = run([
    "RecurrenceTable",
    [
      "List",
      ["Equal", ["a", "n"], ["Add", ["a", ["Subtract", "n", 1]], ["a", ["Subtract", "n", 2]]]],
      ["Equal", ["a", 1], 1],
      ["Equal", ["a", 2], 1],
    ],
    "a",
    ["List", "n", 6, 10],
  ]);
  expect(tail).toEqual(["List", ...full.slice(6)]);
});

// Outer: cross-checked against a nested Map.
test("Outer(f, xs, ys) agrees with applying f to every pair by hand", () => {
  const xs = [1, 2, 3];
  const ys = [4, 5];
  const outer = run(["Outer", "Multiply", ["List", ...xs], ["List", ...ys]]);
  const byHand = ["List", ...xs.map((x) => ["List", ...ys.map((y) => run(["Multiply", x, y]))])];
  expect(outer).toEqual(byHand);
});
test("Outer produces a matrix of the right shape", () => {
  expect(run(["Outer", "Add", ["List", 1, 2], ["List", 10, 20, 30]])).toEqual([
    "List",
    ["List", 11, 21, 31],
    ["List", 12, 22, 32],
  ]);
});

// Association
test("Length/First/Last on an Association read its values, not its rules", () => {
  const assoc = ["Association", ["Rule", 1, "a"], ["Rule", 2, "b"], ["Rule", 3, "c"]];
  expect(run(["Length", assoc])).toEqual(3);
  expect(run(["First", assoc])).toEqual("a");
  expect(run(["Last", assoc])).toEqual("c");
});
test("First/Last on a plain List are unaffected", () => {
  expect(run(["First", ["List", 1, 2, 3]])).toEqual(1);
  expect(run(["Last", ["List", 1, 2, 3]])).toEqual(3);
});
test("Join on Associations keeps first-seen key order and lets a later value win", () => {
  expect(
    run([
      "Join",
      ["Association", ["Rule", "a", "b"]],
      ["Association", ["Rule", "c", "d"], ["Rule", "a", "f"]],
    ]),
  ).toEqual(["Association", ["Rule", "a", "f"], ["Rule", "c", "d"]]);
});
test("Sort on an Association orders by value", () => {
  expect(
    run(["Sort", ["Association", ["Rule", "a", 4], ["Rule", "b", 1], ["Rule", "c", 3]]]),
  ).toEqual(["Association", ["Rule", "b", 1], ["Rule", "c", 3], ["Rule", "a", 4]]);
});

// GeometricMean / HarmonicMean
test("GeometricMean of n equal values is that value", () => {
  expect(run(["GeometricMean", ["List", 7, 7, 7]])).toEqual(7);
});
test("GeometricMean squared equals the product, for two values", () => {
  const gm = run(["GeometricMean", ["List", 2, 3]]);
  expect(run(["Equal", ["Power", gm, 2], 6])).toEqual("True");
});
test("HarmonicMean of n equal values is that value", () => {
  expect(run(["HarmonicMean", ["List", 5, 5, 5]])).toEqual(5);
});
test("HarmonicMean is the reciprocal of the mean of the reciprocals", () => {
  const list = ["List", 1, 2, 4];
  const viaDefinition = run([
    "Divide",
    1,
    ["Mean", ["List", ["Divide", 1, 1], ["Divide", 1, 2], ["Divide", 1, 4]]],
  ]);
  expect(run(["HarmonicMean", list])).toEqual(viaDefinition);
});
test("AM-GM-HM ordering holds on a non-constant list: HM <= GM <= AM", () => {
  const list = ["List", 1, 2, 4];
  expect(run(["LessEqual", ["HarmonicMean", list], ["GeometricMean", list]])).toEqual("True");
  expect(run(["LessEqual", ["GeometricMean", list], ["Mean", list]])).toEqual("True");
});

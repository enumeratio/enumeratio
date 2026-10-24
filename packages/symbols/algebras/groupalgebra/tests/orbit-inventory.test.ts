import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareGroupAlgebra } from "../src/declare.ts";

const ce = bareEngine();
declareGroupAlgebra(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const L = (...xs: Expr[]): Expr => ["List", ...xs];
const xs = (n: number) => Array.from({ length: n }, (_, i) => `x${i + 1}`);
const inventory = (group: Expr, n: number, weights: Expr) =>
  ce.box(["OrbitInventory", ["CycleIndexPolynomial", group, L(...xs(n))], L(...xs(n)), weights] as never).evaluate();
const count = (group: Expr, n: number, k: number) => inventory(group, n, k).re;

// OEIS A000031 (necklaces) and A000029 (bracelets), two colors, n = 1 … 12.
const A000031 = [2, 3, 4, 6, 8, 14, 20, 36, 60, 108, 188, 352];
const A000029 = [2, 3, 4, 6, 8, 13, 18, 30, 46, 78, 126, 224];

test("two-color necklaces and bracelets match OEIS", () => {
  A000031.forEach((expected, i) => expect(count(["CyclicGroup", i + 1], i + 1, 2)).toBe(expected));
  // D_1 and D_2 are Wolfram's degenerate cases (2 and 4 points), not 1- and 2-gons.
  A000029.slice(2).forEach((expected, i) => expect(count(["DihedralGroup", i + 3], i + 3, 2)).toBe(expected));
});

test("a weighted inventory expands: red and blue squares", () => {
  const expected = ce
    .box([
      "Add",
      ["Power", "r", 4],
      ["Power", "b", 4],
      ["Multiply", "r", ["Power", "b", 3]],
      ["Multiply", "b", ["Power", "r", 3]],
      ["Multiply", 2, ["Power", "r", 2], ["Power", "b", 2]],
    ] as never)
    .evaluate();
  expect(inventory(["CyclicGroup", 4], 4, L("r", "b")).isSame(expected)).toBe(true);
});

test("the weights sum to the count: every weight 1 is the count form", () => {
  expect(inventory(["CyclicGroup", 6], 6, L(1, 1, 1)).re).toBe(count(["CyclicGroup", 6], 6, 3));
});

test("substitution is simultaneous: weights named like the variables", () => {
  const ci = ["Multiply", ["Rational", 1, 2], ["Add", ["Power", "a", 2], "b"]];
  const got = ce.box(["OrbitInventory", ci, L("a", "b"), L("a", "b")] as never).evaluate();
  expect(got.json).toEqual(["Add", ["Power", "a", 2], ["Power", "b", 2], ["Multiply", "a", "b"]]);
});

test("cube faces under the rotation group, two colors: 10", () => {
  // The 24 rotations of the cube on its 6 faces: identity, 6 quarter turns about face axes (x1^2 x4),
  // 3 half turns about face axes (x1^2 x2^2), 8 third turns (x3^2), 6 half turns about edge axes (x2^3).
  const cube = [
    "Multiply",
    ["Rational", 1, 24],
    [
      "Add",
      ["Power", "x1", 6],
      ["Multiply", 6, ["Power", "x1", 2], ["Power", "x4", 1]],
      ["Multiply", 3, ["Power", "x1", 2], ["Power", "x2", 2]],
      ["Multiply", 8, ["Power", "x3", 2]],
      ["Multiply", 6, ["Power", "x2", 3]],
    ],
  ];
  expect(ce.box(["OrbitInventory", cube, L(...xs(6)), 2] as never).evaluate().re).toBe(10);
});

test("a malformed call stays unevaluated", () => {
  expect(ce.box(["OrbitInventory", "f", L(1, 2), 2] as never).evaluate().operator).toBe("OrbitInventory");
  expect(ce.box(["OrbitInventory", "f", L("a", "a"), 2] as never).evaluate().operator).toBe("OrbitInventory");
  expect(ce.box(["OrbitInventory", "f", L("a"), L()] as never).evaluate().operator).toBe("OrbitInventory");
});

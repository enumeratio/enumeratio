import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareGroupAlgebra } from "../src/declare.ts";

const ce = bareEngine();
declareGroupAlgebra(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const L = (...xs: Expr[]): Expr => ["List", ...xs];
const C = (...cycles: readonly number[][]): Expr => ["Cycles", L(...cycles.map((c) => L(...c)))];
const same = (input: Expr, expected: Expr) =>
  expect(ce.box(input).evaluate().json).toEqual(ce.box(expected).evaluate().json);

// Every expected value below was cross-checked against a Wolfram kernel.

test("PermutationProduct applies the left factor first, in Wolfram's notation", () => {
  same(["PermutationProduct", C([1, 2, 3]), C([1, 2])], C([2, 3]));
  same(["PermutationProduct", C([1, 2]), C([1, 2, 3])], C([1, 3]));
  same(["PermutationProduct", C([1, 2, 3]), C([1, 2]), C([1, 2, 3])], C([1, 2]));
  same(["PermutationProduct", L(2, 3, 1), L(2, 1, 3)], L(1, 3, 2));
  same(["PermutationProduct", L(2, 1), L(1, 3, 2)], L(3, 1, 2)); // shorter words pad with fixed points
  same(["PermutationProduct", C([1, 2]), L(2, 3, 1)], C([1, 3])); // any Cycles makes the result Cycles
  same(["PermutationProduct", L(2, 1), C([2, 3])], C([1, 3, 2]));
  same(["PermutationProduct"], C());
  same(["PermutationProduct", C([1, 2, 3])], C([1, 2, 3]));
});

test("PermutationPower: any integer exponent, negative via the inverse", () => {
  same(["PermutationPower", C([1, 2, 3]), 2], C([1, 3, 2]));
  same(["PermutationPower", C([1, 2, 3]), -1], C([1, 3, 2]));
  same(["PermutationPower", C([1, 2, 3]), -2], C([1, 2, 3]));
  same(["PermutationPower", C([1, 2, 3]), 0], C());
  same(["PermutationPower", C([1, 2, 3, 4]), 7], C([1, 4, 3, 2]));
  same(["PermutationPower", C([1, 2, 3, 4]), 1000000000001], C([1, 2, 3, 4]));
  same(["PermutationPower", L(2, 3, 1), 2], L(3, 1, 2));
  same(["PermutationPower", L(2, 1, 3), -1], L(2, 1, 3));
  same(["PermutationPower", C([1, 2, 3]), ["Rational", 1, 2]], ["PermutationPower", C([1, 2, 3]), ["Rational", 1, 2]]);
});

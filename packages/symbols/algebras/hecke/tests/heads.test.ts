import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareHecke } from "../src/declare.ts";

const ce = new ComputeEngine();
declareHecke(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const same = (input: Expr, expected: Expr) =>
  expect(ce.box(input).evaluate().json).toEqual(ce.box(expected).evaluate().json);
const T = (...w: number[]): Expr => ["HeckeT", ["List", ...w]];
const times = (...parts: Expr[]): Expr => ["NonCommutativeMultiply", ...parts];

test("the algebra has n! basis elements", () => {
  same(["AlgebraDimension", ["HeckeAlgebra", 4]], 24);
  same(["AlgebraDimension", ["HeckeAlgebra", 6]], 720);
  const basis = ce.box(["Basis", ["HeckeAlgebra", 3]]).evaluate().json as unknown as unknown[];
  expect(basis.length - 1).toBe(6);
});

test("length up: the product is a single basis element", () => {
  // s_1 · s_2 has length 2, so no deformation appears.
  same(times(T(2, 1, 3), T(1, 3, 2)), T(2, 3, 1));
});

test("length down: the quadratic relation, with q", () => {
  // T_s² = q·T_e + (q−1)·T_s — a genuine linear combination, not a scalar multiple.
  same(times(T(2, 1, 3), T(2, 1, 3)), [
    "Add",
    ["Multiply", "q", T(1, 2, 3)],
    ["Multiply", ["Subtract", "q", 1], T(2, 1, 3)],
  ]);
});

test("the braid relation holds through the heads", () => {
  same(times(T(2, 1, 3), T(1, 3, 2), T(2, 1, 3)), times(T(1, 3, 2), T(2, 1, 3), T(1, 3, 2)));
  // Distant generators commute.
  same(times(T(2, 1, 3, 4), T(1, 2, 4, 3)), times(T(1, 2, 4, 3), T(2, 1, 3, 4)));
});

test("specialising q to 1 collapses to the symmetric group algebra", () => {
  // T_s² was q·T_e + (q−1)·T_s; at q = 1 the second term vanishes and the first is T_e.
  same(["HeckeSpecialize", times(T(2, 1, 3), T(2, 1, 3)), 1], T(1, 2, 3));
  same(["HeckeSpecialize", times(T(2, 1, 3), T(1, 3, 2)), 1], T(2, 3, 1));
  // At q = 2 it does not collapse.
  same(
    ["HeckeSpecialize", times(T(2, 1, 3), T(2, 1, 3)), 2],
    ["Add", ["Multiply", 2, T(1, 2, 3)], T(2, 1, 3)],
  );
});

test("sums read back in, so products compose", () => {
  // The result of one product is a valid operand for the next.
  const squared = times(T(2, 1, 3), T(2, 1, 3));
  same(["HeckeSpecialize", times(squared, T(2, 1, 3)), 1], T(2, 1, 3));
  same(times(["Add", T(1, 2, 3), T(2, 1, 3)], T(1, 2, 3)), ["Add", T(1, 2, 3), T(2, 1, 3)]);
});

test("the identity, and containment", () => {
  same(["HeckeIdentity", 3], T(1, 2, 3));
  same(times(["HeckeIdentity", 3], T(2, 3, 1)), T(2, 3, 1));
  same(["Element", T(2, 1, 3), ["HeckeAlgebra", 3]], "True");
  same(["Element", T(2, 1), ["HeckeAlgebra", 3]], "False"); // wrong size
});

test("a non-permutation is not a basis element", () => {
  expect(ce.box(["HeckeT", ["List", 1, 1]]).evaluate().operator).toBe("HeckeT");
  expect(ce.box(times(T(1, 2), T(1, 2, 3))).evaluate().operator).toBe("NonCommutativeMultiply");
});

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareGroupAlgebra } from "../src/declare.ts";

const ce = new ComputeEngine();
declareGroupAlgebra(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const same = (input: Expr, expected: Expr) =>
  expect(ce.box(input).evaluate().json).toEqual(ce.box(expected).evaluate().json);
const G = (label: string): Expr => ["GroupBasis", ["String", label]];
const Z = (n: number): Expr => ["CyclicGroup", n];
const D = (n: number): Expr => ["DihedralGroup", n];

test("orders and abelian-ness", () => {
  same(["GroupOrder", Z(6)], 6);
  same(["GroupOrder", D(4)], 8);
  same(["GroupOrder", ["GroupDirectProduct", Z(2), Z(3)]], 6);
  same(["GroupIsAbelian", Z(6)], "True");
  same(["GroupIsAbelian", D(4)], "False");
  same(["GroupIsAbelian", ["GroupDirectProduct", Z(2), Z(3)]], "True");
});

test("k[Z_n] multiplies by adding indices — it is k[x]/(xⁿ−1)", () => {
  same(["GroupProduct", Z(6), G("2"), G("5")], G("1")); // 2 + 5 = 7 ≡ 1
  same(["GroupProduct", Z(6), G("0"), G("4")], G("4"));
  // (1 + x)(1 + x⁵) = 2 + x + x⁵.
  same(
    ["GroupProduct", Z(6), ["Add", G("0"), G("1")], ["Add", G("0"), G("5")]],
    ["Add", ["Multiply", 2, G("0")], G("1"), G("5")],
  );
});

test("the dihedral relations: s² = 1 and s r s = r⁻¹", () => {
  same(["GroupProduct", D(4), G("s0"), G("s0")], G("0")); // s² = 1
  same(["GroupProduct", D(4), G("1"), G("1")], G("2")); // r²
  // s r s = r⁻¹ = r³ in D_4.
  same(["GroupProduct", D(4), ["GroupProduct", D(4), G("s0"), G("1")], G("s0")], G("3"));
  // The algebra is non-commutative: r s ≠ s r.
  expect(ce.box(["GroupProduct", D(4), G("1"), G("s0")]).evaluate().json).not.toEqual(
    ce.box(["GroupProduct", D(4), G("s0"), G("1")]).evaluate().json,
  );
});

test("conjugacy classes, and the dimension of the centre", () => {
  // Abelian: one class per element.
  same(["GroupCentreDimension", Z(6)], 6);
  // D_3 ≅ S_3 has three classes; D_4 has five.
  same(["GroupCentreDimension", D(3)], 3);
  same(["GroupCentreDimension", D(4)], 5);
  same(["GroupCentreDimension", D(5)], 4); // (5+3)/2
  const classes = ce.box(["ConjugacyClasses", D(3)]).evaluate().json as unknown as unknown[];
  expect(classes.length - 1).toBe(3);
});

test("class sums are central; a lone reflection is not", () => {
  // The payoff: a non-commutative algebra with a canonical commutative subalgebra.
  for (const k of [1, 2, 3]) {
    same(["IsCentral", D(3), ["ClassSum", D(3), k]], "True");
  }
  same(["IsCentral", D(3), G("s0")], "False");
  same(["IsCentral", Z(6), G("3")], "True"); // everything is central in an abelian group
  // The first class is always the identity alone.
  same(["ClassSum", D(3), 1], G("0"));
});

test("the group algebra's dimension is the group's order", () => {
  same(["AlgebraDimension", ["GroupAlgebra", D(4)]], 8);
  same(["AlgebraDimension", ["GroupAlgebra", Z(12)]], 12);
  const basis = ce.box(["Basis", ["GroupAlgebra", Z(4)]]).evaluate().json as unknown as unknown[];
  expect(basis.length - 1).toBe(4);
});

test("containment recognises elements of the right group", () => {
  same(["Element", G("s0"), ["GroupAlgebra", D(3)]], "True");
  same(["Element", G("s9"), ["GroupAlgebra", D(3)]], "False"); // no such element
  same(["Element", G("s0"), ["GroupAlgebra", Z(6)]], "False"); // wrong group
});

test("a malformed group or element leaves the call alone", () => {
  expect(ce.box(["GroupOrder", Z(0)]).evaluate().operator).toBe("GroupOrder");
  expect(ce.box(["GroupProduct", Z(6), G("9"), G("1")]).evaluate().operator).toBe("GroupProduct");
  expect(ce.box(["ClassSum", D(3), 99]).evaluate().operator).toBe("ClassSum");
});

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareIncidence } from "../src/declare.ts";

const ce = new ComputeEngine();
declareIncidence(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const same = (input: Expr, expected: Expr) =>
  expect(ce.box(input).evaluate().json).toEqual(ce.box(expected).evaluate().json);
const L = (...xs: number[]): Expr => ["List", ...xs];

test("the divisor lattice reproduces number theory's Möbius function", () => {
  // μ([1, n]) in the divisor lattice IS the classical μ(n).
  same(["MoebiusFunction", ["DivisorLattice", 30], 1, 30], -1); // 3 primes
  same(["MoebiusFunction", ["DivisorLattice", 30], 1, 6], 1); // 2 primes
  same(["MoebiusFunction", ["DivisorLattice", 12], 1, 12], 0); // 4 = 2² divides it
  same(["MoebiusFunction", ["DivisorLattice", 30], 5, 30], 1); // μ(6)
  same(["MoebiusFunction", ["DivisorLattice", 30], 6, 5], 0); // not an interval
});

test("the Boolean lattice gives inclusion–exclusion", () => {
  // μ([S,T]) = (−1)^{|T\S|}.
  same(["MoebiusFunction", ["BooleanLattice", 3], L(), L(1, 2, 3)], -1);
  same(["MoebiusFunction", ["BooleanLattice", 3], L(), L(1, 2)], 1);
  same(["MoebiusFunction", ["BooleanLattice", 3], L(1), L(1, 2, 3)], 1);
  same(["MoebiusFunction", ["BooleanLattice", 3], L(1, 2), L(1, 2)], 1);
});

test("a chain: μ is −1 on covers and 0 beyond", () => {
  same(["MoebiusFunction", ["Chain", 5], 2, 3], -1);
  same(["MoebiusFunction", ["Chain", 5], 2, 4], 0);
  same(["MoebiusFunction", ["Chain", 5], 2, 2], 1);
});

test("ζ is the indicator of the order relation", () => {
  same(["PosetZeta", ["DivisorLattice", 12], 2, 12], 1);
  same(["PosetZeta", ["DivisorLattice", 12], 3, 4], 0);
});

test("Möbius inversion undoes summing down", () => {
  const poset: Expr = ["Chain", 4];
  const f = L(1, 2, 3, 4);
  same(["MoebiusInvert", poset, ["PosetSumDown", poset, f]], f);
  // On the Boolean lattice, summing down then inverting is inclusion–exclusion.
  const b: Expr = ["BooleanLattice", 2];
  const g = L(5, 1, 2, 7);
  same(["MoebiusInvert", b, ["PosetSumDown", b, g]], g);
});

test("elements come back in a linear extension", () => {
  same(["PosetElements", ["Chain", 4]], L(1, 2, 3, 4));
  same(["PosetElements", ["DivisorLattice", 12]], L(1, 2, 3, 4, 6, 12));
  const subsets = ce.box(["PosetElements", ["BooleanLattice", 2]]).evaluate()
    .json as unknown as unknown[];
  expect(subsets.length - 1).toBe(4);
});

test("the incidence algebra's dimension is its interval count", () => {
  same(["AlgebraDimension", ["IncidenceAlgebra", ["Chain", 4]]], 10); // C(5,2)
  same(["AlgebraDimension", ["IncidenceAlgebra", ["BooleanLattice", 3]]], 27); // 3^3
  same(["AlgebraDimension", ["IncidenceAlgebra", ["DivisorLattice", 12]]], 18);
  const basis = ce.box(["Basis", ["IncidenceAlgebra", ["Chain", 3]]]).evaluate()
    .json as unknown as unknown[];
  expect(basis.length - 1).toBe(6);
});

test("containment tests whether a pair really is an interval", () => {
  same(["Element", ["PosetInterval", 2, 12], ["IncidenceAlgebra", ["DivisorLattice", 12]]], "True");
  same(["Element", ["PosetInterval", 3, 4], ["IncidenceAlgebra", ["DivisorLattice", 12]]], "False");
});

test("an unreadable poset or element leaves the call alone", () => {
  expect(ce.box(["MoebiusFunction", ["Chain", 0], 1, 1]).evaluate().operator).toBe(
    "MoebiusFunction",
  );
  expect(ce.box(["MoebiusFunction", ["DivisorLattice", 12], 5, 12]).evaluate().operator).toBe(
    "MoebiusFunction",
  ); // 5 is not a divisor of 12
});

import { createEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareResidues } from "../src/declare.ts";
import { gcd as polynomialGcd, integersModulo, monomialKey, type Poly } from "../src/modular-fractions.ts";

// `Numerator(expr, Over -> QuotientRing(Integers, p))` is Wolfram's `Numerator[expr, Modulus -> p]`;
// every value here was checked against wolframscript.

const ce = createEngine(declareResidues);
const R = (n: number, d: number) => ["Rational", n, d];
const over = (p: number) => ["KeyValuePair", "Over", ["QuotientRing", "Integers", p]];
const parts = (expr: unknown, p: number) => ({
  numerator: ce.box(["Numerator", expr, over(p)] as never).evaluate().json,
  denominator: ce.box(["Denominator", expr, over(p)] as never).evaluate().json,
});

test("a rational function's coefficients are read mod p", () => {
  // 24 x^y / (3 b)^3 mod 5: 8/9 is 2.
  const big = ["Multiply", 24, ["Power", "x", "y"], ["Power", ["Multiply", 3, "b"], -3]];
  expect(parts(big, 5)).toEqual({ numerator: ["Multiply", 2, ["Power", "x", "y"]], denominator: ["Power", "b", 3] });
  // (x/3 + 3y/4) / (3x/5 - y/2) mod 7 is (6x + 3y) / (x + 5y).
  const quotient = [
    "Divide",
    ["Add", ["Multiply", R(1, 3), "x"], ["Multiply", R(3, 4), "y"]],
    ["Add", ["Multiply", R(3, 5), "x"], ["Multiply", R(-1, 2), "y"]],
  ];
  expect(parts(quotient, 7)).toEqual({
    numerator: ["Add", ["Multiply", 6, "x"], ["Multiply", 3, "y"]],
    denominator: ["Add", "x", ["Multiply", 5, "y"]],
  });
});

test("a factor common to both parts cancels over ℚ first", () => {
  const cancels = ["Divide", ["Subtract", ["Power", "x", 2], 1], ["Subtract", "x", 1]];
  expect(parts(cancels, 3)).toEqual({ numerator: ["Add", "x", 1], denominator: 1 });
  // Zero numerator is 0 over 1, however the denominator reads.
  expect(parts(["Divide", ["Add", ["Multiply", 3, "x"], 6], ["Add", ["Multiply", 2, "y"], 4]], 3)).toEqual({
    numerator: 0,
    denominator: 1,
  });
});

test("a monomial denominator's unit moves into the numerator", () => {
  expect(parts(["Divide", "x", ["Multiply", 2, "y"]], 7)).toEqual({
    numerator: ["Multiply", 4, "x"],
    denominator: "y",
  });
  // A numerator of several terms keeps the negative powers inline, over 1: 4 + 4x/y.
  expect(parts(["Divide", ["Add", "x", "y"], ["Multiply", 2, "y"]], 7).denominator).toBe(1);
  // A polynomial denominator keeps its coefficients mod p.
  expect(parts(["Divide", ["Add", "x", "y"], ["Multiply", 3, ["Subtract", "x", "y"]]], 7)).toEqual({
    numerator: ["Add", "x", "y"],
    denominator: ["Add", ["Multiply", 3, "x"], ["Multiply", 4, "y"]],
  });
});

test("a factor that appears only mod p cancels between monomials, and nowhere else", () => {
  // (x^2 + 5)/(x^2 + 5x) mod 5 is x^2/x^2; (5y + x^2)/(5y + x) is x^2/x.
  const one = { numerator: 1, denominator: 1 };
  expect(parts(["Divide", ["Add", ["Power", "x", 2], 5], ["Add", ["Power", "x", 2], ["Multiply", 5, "x"]]], 5)).toEqual(
    one,
  );
  expect(
    parts(["Divide", ["Add", ["Multiply", 5, "y"], ["Power", "x", 2]], ["Add", ["Multiply", 5, "y"], "x"]], 5),
  ).toEqual({ numerator: "x", denominator: 1 });
  // x(x + 1)/(x(x + 3)) mod 5 keeps its common x, as Wolfram's does.
  const kept = [
    "Divide",
    ["Multiply", ["Add", "x", 1], ["Add", "x", 5]],
    ["Multiply", ["Add", "x", 3], ["Add", "x", 10]],
  ];
  expect(parts(kept, 5).denominator).toEqual(["Add", ["Power", "x", 2], ["Multiply", 3, "x"]]);
});

test("it threads over a list, and leaves a relation alone", () => {
  const list = ["List", ["Divide", "x", 2], ["Divide", 3, "y"]];
  expect(ce.box(["Numerator", list, over(7)] as never).evaluate().json).toEqual(["List", ["Multiply", 4, "x"], 3]);
  expect(ce.box(["Denominator", list, over(7)] as never).evaluate().json).toEqual(["List", 1, "y"]);
  const relation = ["Equal", "x", ["Rational", 3, 2]];
  expect(ce.box(["Numerator", relation, over(7)] as never).evaluate().operator).toBe("Numerator");
});

test("it declines where Wolfram has no answer, or the ring is not one it reads", () => {
  // A denominator that vanishes mod p; a modulus that is not prime.
  const stays = (expr: unknown, p: number) => ce.box(["Numerator", expr, over(p)] as never).evaluate().operator;
  expect(stays(["Divide", "x", ["Multiply", 3, ["Add", "y", "z"]]], 3)).toBe("Numerator");
  expect(stays(["Divide", "x", ["Add", "y", 1]], 6)).toBe("Numerator");
  expect(stays(["Divide", "x", ["Add", "y", 1]], 0)).toBe("Numerator");
});

test("Over -> Integers is the numerator over ℚ, as Wolfram's has it", () => {
  const ordinary = ["Divide", ["Multiply", 24, "x"], 27];
  const over = ["KeyValuePair", "Over", "Integers"];
  expect(ce.box(["Numerator", ordinary, over] as never).evaluate().json).toEqual(["Multiply", 8, "x"]);
  expect(ce.box(["Denominator", ordinary, over] as never).evaluate().json).toBe(9);
});

test("polynomial gcd over ℤ/p, in several variables", () => {
  const F = integersModulo(5n);
  const poly = (terms: [number[], bigint][]): Poly<bigint> => new Map(terms.map(([e, c]) => [monomialKey(e), c]));
  // (x + y)(x + 2y) and (x + y)(x - y) share x + y.
  const a = poly([
    [[2, 0], 1n],
    [[1, 1], 3n],
    [[0, 2], 2n],
  ]);
  const b = poly([
    [[2, 0], 1n],
    [[0, 2], 4n],
  ]);
  const g = polynomialGcd(F, a, b, 2);
  expect(g).toEqual(
    poly([
      [[1, 0], 1n],
      [[0, 1], 1n],
    ]),
  );
});

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// e^a e^b = e^(a+b) holds for every complex a, b, unlike x^a x^b in general -- see
// exp-combine.ts. Exact symbolic identities throughout, not a golden file.

const ce = new ComputeEngine();
declareAnalytic(ce);

const evalJson = (expr: unknown) => ce.box(expr as never).evaluate().json;

test("Multiply(Exp(x), Exp(y)) combines into a single power", () => {
  expect(evalJson(["Multiply", ["Exp", "x"], ["Exp", "y"]])).toEqual(["Power", "ExponentialE", ["Add", "x", "y"]]);
});

test("combines past two factors, and past extra non-exponential factors in the product", () => {
  expect(evalJson(["Multiply", ["Exp", "a"], ["Exp", "b"], ["Exp", "c"]])).toEqual([
    "Power",
    "ExponentialE",
    ["Add", "a", "b", "c"],
  ]);
  expect(evalJson(["Multiply", 2, ["Exp", "x"], ["Exp", "y"], "z"])).toEqual([
    "Multiply",
    2,
    "z",
    ["Power", "ExponentialE", ["Add", "x", "y"]],
  ]);
});

test("e^x * e^-x cancels to 1, past what compute-engine's own like-term merge catches", () => {
  expect(evalJson(["Multiply", ["Exp", "x"], ["Exp", ["Negate", "x"]]])).toEqual(1);
});

test("a lone Exp factor is untouched -- the gate needs at least two", () => {
  expect(evalJson(["Multiply", ["Exp", "x"], "y"])).toEqual(["Multiply", "y", ["Power", "ExponentialE", "x"]]);
});

test("N() still decimalizes a combined product", () => {
  const n = ce.box(["N", ["Multiply", ["Exp", 1.0], ["Exp", 2.0]]]).evaluate();
  expect(n.re).toBeCloseTo(Math.exp(3), 9);
});

test("agrees numerically with the plain product at a complex point", () => {
  const product = ce.box(["Multiply", ["Exp", ["Complex", 1.3, 0.7]], ["Exp", ["Complex", -0.4, 2.1]]]).N();
  const direct = ce.box(["Exp", ["Complex", 0.9, 2.8]]).N();
  expect(product.re).toBeCloseTo(direct.re, 9);
  expect(product.im).toBeCloseTo(direct.im, 9);
});

test("Multiply of two same-base non-E powers is left to compute-engine's own rules", () => {
  // 2^x * 2^y also holds as an identity, but that's a separate widening (if ever added) --
  // this rule only touches ExponentialE.
  expect(evalJson(["Multiply", ["Power", 2, "x"], ["Power", 2, "y"]])).toEqual([
    "Multiply",
    ["Power", 2, "x"],
    ["Power", 2, "y"],
  ]);
});

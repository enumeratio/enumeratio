import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// The exact-value overrides in widened.ts closed by issue #92 group B: Gamma and Digamma
// past compute-engine's plain-evaluate policy of leaving exact arguments symbolic, plus
// Ln and Arcsin past their real domains. Each is pinned against the closed form (not a
// golden file — these are exact rationals and small integers, not numeric approximations).

const ce = new ComputeEngine();
declareAnalytic(ce);

const evalJson = (expr: unknown) => ce.box(expr as never).evaluate().json;

test("Gamma reduces exact integer and half-integer arguments, and threads over a list", () => {
  expect(evalJson(["Gamma", 5])).toEqual(24);
  expect(evalJson(["Gamma", ["List", 1, 2, 3, 4, 5]])).toEqual(["List", 1, 1, 2, 6, 24]);
  expect(evalJson(["Gamma", ["Rational", 5, 2]])).toEqual([
    "Multiply",
    ["Rational", 3, 4],
    ["Sqrt", "Pi"],
  ]);
  // Still a pole, not a new exact value — untouched by this override.
  expect(evalJson(["Gamma", 0])).toEqual("ComplexInfinity");
});

test("Digamma(n) = H_{n-1} - gamma at a positive integer n", () => {
  expect(evalJson(["Digamma", 1])).toEqual(["Negate", "EulerGamma"]);
  expect(evalJson(["Digamma", 2])).toEqual(["Add", 1, ["Negate", "EulerGamma"]]);
  expect(evalJson(["Digamma", 3])).toEqual(["Add", ["Rational", 3, 2], ["Negate", "EulerGamma"]]);
  // Poles are untouched — still compute-engine's native ComplexInfinity.
  expect(evalJson(["Digamma", 0])).toEqual("ComplexInfinity");
});

test("Ln(-q) = Ln(q) + i*pi for a positive rational q", () => {
  expect(evalJson(["Ln", -1])).toEqual(["Multiply", ["Complex", 0, 1], "Pi"]);
  // Ln(1/2) itself now folds to -Ln(2) (elementary-remaining.ts's unit-fraction rule),
  // so this comes back as i*pi - Ln(2) rather than i*pi + Ln(1/2) -- same value, still
  // built from this test's own `Ln(-q) = Ln(q) + i*pi` before that further fold.
  expect(evalJson(["Ln", ["Rational", -1, 2]])).toEqual([
    "Add",
    ["Multiply", ["Complex", 0, 1], "Pi"],
    ["Negate", ["Ln", 2]],
  ]);
  // A positive argument is untouched.
  expect(evalJson(["Ln", 1])).toEqual(0);
});

test("Arcsin(x) past [-1, 1], for a rational x", () => {
  expect(evalJson(["Arcsin", 2])).toEqual([
    "Add",
    ["Multiply", ["Rational", 1, 2], "Pi"],
    ["Multiply", ["Complex", 0, -1], ["Ln", ["Add", 2, ["Sqrt", 3]]]],
  ]);
  // Odd function: Arcsin(-x) = -Arcsin(x).
  expect(evalJson(["Arcsin", -2])).toEqual([
    "Add",
    ["Multiply", ["Rational", -1, 2], "Pi"],
    ["Multiply", ["Complex", 0, 1], ["Ln", ["Add", 2, ["Sqrt", 3]]]],
  ]);
  // Inside the real domain, untouched.
  expect(evalJson(["Arcsin", ["Rational", 1, 2]])).toEqual(["Multiply", ["Rational", 1, 6], "Pi"]);
});

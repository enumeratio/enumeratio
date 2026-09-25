import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// The exact-value overrides in widened.ts closed by issue #92 group B: Gamma and Digamma
// past compute-engine's plain-evaluate policy of leaving exact arguments symbolic. Each is
// pinned against the closed form (not a golden file -- these are exact rationals and small
// integers, not numeric approximations).

const ce = new ComputeEngine();
declareAnalytic(ce);

const evalJson = (expr: unknown) => ce.box(expr as never).evaluate().json;

test("Gamma reduces exact integer and half-integer arguments, and threads over a list", () => {
  expect(evalJson(["Gamma", 5])).toEqual(24);
  expect(evalJson(["Gamma", ["List", 1, 2, 3, 4, 5]])).toEqual(["List", 1, 1, 2, 6, 24]);
  expect(evalJson(["Gamma", ["Rational", 5, 2]])).toEqual(["Multiply", ["Rational", 3, 4], ["Sqrt", "Pi"]]);
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

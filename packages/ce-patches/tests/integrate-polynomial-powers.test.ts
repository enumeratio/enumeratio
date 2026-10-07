import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyAllPatches } from "../src/index.ts";

const ce = new ComputeEngine();
applyAllPatches(ce);

const integrate = (f: unknown, ...limits: unknown[]) => ce.box(["Integrate", f, ...limits] as never).evaluate().json;
const power = (base: unknown, exponent: unknown) => ["Power", base, exponent];

const trinomial = ["Add", 1, "x", power("x", 2)];

test("a power of a quadratic integrates over finite limits", () => {
  // 1 + 2x + 3x² + 2x³ + x⁴ over [-1, 1]
  expect(integrate(power(trinomial, 2), ["Limits", "x", -1, 1])).toEqual(["Rational", 22, 5]);
  expect(integrate(power(["Add", power("x", 2), 1], 2), ["Limits", "x", 0, 1])).toEqual(["Rational", 28, 15]);
});

test("a cubed quadratic integrates, as does one with a symbolic coefficient", () => {
  expect(integrate(power(trinomial, 3), ["Limits", "x", 0, 1])).toEqual(["Rational", 1133, 140]);
  const withParameter = ce
    .box(["Integrate", power(["Add", 1, ["Multiply", "a", "x"], power("x", 2)], 2), ["Limits", "x", 0, 1]] as never)
    .evaluate();
  expect(withParameter.operator).not.toBe("Integrate");
});

test("an indefinite integral of a power of a quadratic is its antiderivative", () => {
  const antiderivative = integrate(power(["Add", power("x", 2), 1], 2), "x");
  expect(antiderivative).toEqual([
    "Add",
    ["Multiply", ["Rational", 1, 5], power("x", 5)],
    ["Multiply", ["Rational", 2, 3], power("x", 3)],
    "x",
  ]);
});

test("an integrand with no polynomial form is left to the native handler", () => {
  expect(integrate(power(["Add", power("x", 2), 1], ["Rational", 1, 2]), ["Limits", "x", 0, 1])).toEqual([
    "Multiply",
    ["Rational", 1, 2],
    ["Add", ["Sqrt", 2], ["Arsinh", 1]],
  ]);
});

test("a polynomial a native integral gets without expansion is unchanged", () => {
  expect(integrate(power(["Add", "x", 1], 3), ["Limits", "x", 0, 1])).toEqual(["Rational", 15, 4]);
});

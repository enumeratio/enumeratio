import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyPatch, powerOfNumbersFoldsRoots } from "../src/index.ts";

const ce = new ComputeEngine();
applyPatch(ce, powerOfNumbersFoldsRoots);

const evaluate = (expr: unknown): unknown => ce.box(expr as never).evaluate().json;
const R = (n: number, d: number) => ["Rational", n, d];

test("a list of exponents folds a real odd root as the scalar does", () => {
  expect(evaluate(["Power", -8, R(1, 3)])).toEqual(-2);
  expect(evaluate(["Power", -8, ["List", R(1, 3), 5]])).toEqual(["List", -2, -32768]);
  expect(evaluate(["Power", -27, ["List", R(1, 3), R(2, 3)]])).toEqual(["List", -3, 9]);
});

test("a list of bases and a list of exponents together", () => {
  expect(evaluate(["Power", ["List", -8, 27], ["List", R(1, 3), R(1, 3)]])).toEqual(["List", -2, 3]);
});

test("a Power built without canonicalizing evaluates like Root of the same radicand", () => {
  const power = (base: number, exponent: [number, number]) =>
    ce._fn("Power", [ce.number(base), ce.number(exponent)]).evaluate();
  expect(power(8, [1, 3]).is(2)).toBe(true);
  expect(power(16, [1, 4]).is(2)).toBe(true);
  expect(power(-1, [1, 5]).is(-1)).toBe(true);
  expect(power(8, [-1, 3]).isSame(ce.number([1, 2]))).toBe(true);
});

test("what has no closed form, or is not over numbers, is as it was", () => {
  expect(evaluate(["Power", 2, R(1, 3)])).toEqual(["Root", 2, 3]);
  expect(evaluate(["Power", "x", R(1, 3)])).toEqual(["Root", "x", 3]);
  expect(evaluate(["Power", -8, R(2, 3)])).toEqual(4);
});

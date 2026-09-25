import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { isExactExpression, nextDown, nextUp, outwardBound } from "../src/interval-bounds.ts";

// The rounding rules behind every inexact interval bound (see interval-bounds.ts): what counts
// as exact, and how far an inexact value is pushed outward.

const ce = new ComputeEngine();
const box = (json: unknown) => ce.box(json as never).evaluate();

test("nextUp and nextDown step to the adjacent double", () => {
  expect(nextUp(1)).toBe(1 + Number.EPSILON);
  expect(nextDown(1)).toBe(1 - Number.EPSILON / 2);
  expect(nextUp(0)).toBe(Number.MIN_VALUE);
  expect(nextDown(0)).toBe(-Number.MIN_VALUE);
  expect(nextUp(-1)).toBe(-1 + Number.EPSILON / 2);
  expect(nextUp(Infinity)).toBe(Infinity);
});

test("exact means no inexact number literal anywhere", () => {
  expect(isExactExpression(box(["Rational", 1, 3]))).toBe(true);
  expect(isExactExpression(box(["Arctan", 3]))).toBe(true);
  expect(isExactExpression(box(["Multiply", 2, ["Sqrt", 2]]))).toBe(true);
  expect(isExactExpression(box(1.4))).toBe(false);
  expect(isExactExpression(ce.box(["Sin", 1.4] as never))).toBe(false);
});

test("an exact bound is kept as it is", () => {
  const third = box(["Rational", 1, 3]);
  expect(outwardBound(ce, third, "lo", "function").json).toEqual(["Rational", 1, 3]);
});

test("a short decimal from arithmetic is exact, so it is not rounded", () => {
  expect(outwardBound(ce, box(["Add", 1.4, 1]), "lo", "arithmetic").json).toBe(2.4);
  expect(outwardBound(ce, box(["Add", 1.4, 1]), "hi", "arithmetic").json).toBe(2.4);
});

test("a rounded arithmetic result and any function value step one double outward", () => {
  // 1/3.3 = 0.303030…: rounded at the working precision, so pushed past it either way.
  const third = box(["Divide", 1, 3.3]);
  const nearest = third.N().re;
  expect(outwardBound(ce, third, "lo", "arithmetic").re).toBe(nextDown(nearest));
  expect(outwardBound(ce, third, "hi", "arithmetic").re).toBe(nextUp(nearest));
  // Sin(1.4) at working precision, 21 digits: one double outward.
  const sine = box(["Sin", 1.4]);
  expect(outwardBound(ce, sine, "lo", "function").re).toBe(nextDown(sine.N().re));
});

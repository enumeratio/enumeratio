import { createEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// #911: the regularized Beta and Gamma past their real domain. Reference values are mpmath's
// `betainc(a, b, 0, x, regularized=True)` and `gammainc(s, z, regularized=True)`.

const ce = createEngine(declareAnalytic);

const R = (n: number, d: number) => ["Rational", n, d];
const exact = (expr: unknown): unknown => ce.box(expr as never).evaluate().json;
const numeric = (expr: unknown) => ce.box(expr as never).N();

test("I_x(a, b) at integer a, b is a polynomial: exact for a rational x outside [0, 1]", () => {
  expect(exact(["BetaRegularized", 2, 2, 3])).toBe(8);
  expect(exact(["BetaRegularized", -1, 2, 3])).toBe(17);
  expect(exact(["BetaRegularized", 5, 3, 4])).toBe(-69375);
  expect(exact(["BetaRegularized", R(3, 2), 2, 3])).toEqual(R(27, 16));
  expect(exact(["BetaRegularized", R(-5, 3), 3, 4])).toEqual(R(-814375, 729));
  expect(numeric(["BetaRegularized", 2, 2, 3]).re).toBe(8);
});

test("a float x gives the polynomial's value at that double, within an ulp of the exact one", () => {
  expect(numeric(["BetaRegularized", -1.25, 4, 3]).re).toBe(148.01025390625);
  expect(numeric(["BetaRegularized", 2.5, 2, 3]).re).toBe(29.6875);
  expect(numeric(["BetaRegularized", -7.5, 9, 11]).re / -6.91916095873125e21).toBeCloseTo(1, 14);
});

test("past a double's digits the value is rounded from the exact rational", () => {
  const value = ce.box(["N", ["BetaRegularized", R(-5, 3), 3, 4], 40] as never).evaluate();
  // -814375/729
  expect(String((value.json as { num: string }).num).startsWith("-1117.112482853223593964334705075445816")).toBe(true);
  expect(ce.box(["N", ["BetaRegularized", 2, 2, 3], 40] as never).evaluate().json).toEqual({ num: "8.0" });
});

test("inside [0, 1], and off the integers, the earlier answers stand", () => {
  expect(exact(["BetaRegularized", R(1, 2), 2, 3])).toEqual(R(11, 16));
  expect(numeric(["BetaRegularized", 2, 2.5, 3]).re).toBeCloseTo(16.263455967290593, 12);
  // A non-integer b past x = 1 is complex; declined rather than guessed.
  expect(exact(["BetaRegularized", 2, 2, 3.5])).toEqual(["BetaRegularized", 2, 2, 3.5]);
});

test("Q(s, z) at a non-integer s and z < 0 is complex (principal branch)", () => {
  const q = numeric(["GammaRegularized", 2.5, -1]);
  expect(q.re).toBeCloseTo(1, 13);
  expect(q.im).toBeCloseTo(-0.6280082302883814, 13);
  const half = numeric(["GammaRegularized", 0.5, -2]);
  expect(half.re).toBeCloseTo(1, 13);
  expect(half.im).toBeCloseTo(-3.77312251159902, 12);
  const negative = numeric(["GammaRegularized", -1.5, -2]);
  expect(negative.re).toBeCloseTo(1, 13);
  expect(negative.im).toBeCloseTo(-0.0883638989471347, 13);
});

test("where Q(s, z) would lose digits to cancellation it declines rather than answer noise", () => {
  // Near an integer order, or at a tiny one, Re Q is a difference of nearly equal numbers.
  expect(numeric(["GammaRegularized", 2.0000001, -1]).operator).toBe("GammaRegularized");
  expect(numeric(["GammaRegularized", 1e-8, -2]).operator).toBe("GammaRegularized");
  // Large order: Q is 1 to a double's digits.
  expect(numeric(["GammaRegularized", 150.5, -1]).re).toBe(1);
  // mpmath: gammainc(25.5, -20, regularized=True) is 1 + 5.234103e15 i.
  expect(numeric(["GammaRegularized", 25.5, -20]).im / 5.234103024184011e15).toBeCloseTo(1, 12);
});

test("a float operand answers in doubles; an exact one that cannot reduce stays unevaluated", () => {
  const q = exact(["GammaRegularized", 2.5, -1]) as ["Complex", number, number];
  expect(q[0]).toBe("Complex");
  expect(typeof q[1]).toBe("number");
  expect(exact(["GammaRegularized", R(5, 2), -1])).toEqual(["GammaRegularized", R(5, 2), -1]);
  // An integer order keeps the native real answer.
  expect(exact(["GammaRegularized", 2, -1])).toBe(0);
});

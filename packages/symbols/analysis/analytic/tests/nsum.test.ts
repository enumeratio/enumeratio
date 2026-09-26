import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// NSum -- numeric series via convergence acceleration (Wynn epsilon for alternating
// series, Euler-Maclaurin for a smooth power-law tail), with a strict internal error
// check. Values below are cross-checked against mpmath (see the command noted per test).
// Not a golden file -- see nsum.ts.

const ce = new ComputeEngine();
declareAnalytic(ce);
const evalOf = (expr: unknown) => ce.box(expr as never).evaluate();
const evalJson = (expr: unknown) => evalOf(expr).json;

const TOL = 1e-10;
const closeTo = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThan(TOL);

test("zeta(2) = pi^2/6 (mpmath: mpmath.zeta(2) = 1.64493406684822643647...)", () => {
  closeTo(evalOf(["NSum", ["Power", "n", -2], ["List", "n", 1, "PositiveInfinity"]]).re, Math.PI ** 2 / 6);
});

test("the alternating harmonic series = ln 2 (mpmath: mpmath.log(2) = 0.69314718055994530941...)", () => {
  const expr = ["NSum", ["Divide", ["Power", -1, ["Add", "n", 1]], "n"], ["List", "n", 1, "PositiveInfinity"]];
  closeTo(evalOf(expr).re, Math.log(2));
});

test("Sum 1/n! from n=1 = e - 1 (already stable, no acceleration needed)", () => {
  const expr = ["NSum", ["Divide", 1, ["Factorial", "n"]], ["List", "n", 1, "PositiveInfinity"]];
  closeTo(evalOf(expr).re, Math.E - 1);
});

test("a much more slowly convergent power law, Sum 1/n^1.1, still clears the bar (mpmath: mpmath.zeta(1.1) = 10.5844484649508009...)", () => {
  const expr = ["NSum", ["Power", "n", -1.1], ["List", "n", 1, "PositiveInfinity"]];
  closeTo(evalOf(expr).re, 10.5844484649508009509826043743);
});

test("a finite range is a direct sum, no acceleration", () => {
  expect(evalJson(["NSum", "n", ["List", "n", 1, 5]])).toBe(15);
});

test("an empty finite range is 0", () => {
  expect(evalJson(["NSum", "n", ["List", "n", 5, 1]])).toBe(0);
});

test("declines the harmonic series -- it diverges", () => {
  const expr = ["NSum", ["Divide", 1, "n"], ["List", "n", 1, "PositiveInfinity"]];
  expect(evalJson(expr)).toEqual(expr);
});

test("declines a series whose terms don't shrink at all", () => {
  const expr = ["NSum", "n", ["List", "n", 1, "PositiveInfinity"]];
  expect(evalJson(expr)).toEqual(expr);
});

test("declines a geometric series with ratio > 1", () => {
  const expr = ["NSum", ["Power", 2, "n"], ["List", "n", 1, "PositiveInfinity"]];
  expect(evalJson(expr)).toEqual(expr);
});

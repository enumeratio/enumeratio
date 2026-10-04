import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyPatch, hurwitzZeta, hurwitzZetaReal, valuesAtZero, zetaGeneralized } from "../src/index.ts";

const ce = new ComputeEngine();
applyPatch(ce, valuesAtZero);
const value = (expr: unknown) => ce.box(expr as never).evaluate();
const halfPi = ce.box(["Multiply", ["Rational", 1, 2], "Pi"]).evaluate();
const halfPiI = ce.box(["Multiply", ["Rational", 1, 2], "ImaginaryUnit", "Pi"]).evaluate();

test("Arcosh(0) and Arcoth(0) are iπ/2, on every route", () => {
  for (const head of ["Arcosh", "Arcoth"]) {
    expect(value([head, 0]).isSame(halfPiI)).toBe(true);
    const numeric = value(["N", [head, 0]]);
    expect(numeric.re).toBe(0);
    expect(numeric.im).toBeCloseTo(Math.PI / 2, 15);
  }
});

test("EllipticK(0) and EllipticE(0) are π/2, on every route", () => {
  for (const head of ["EllipticK", "EllipticE"]) {
    expect(value([head, 0]).isSame(halfPi)).toBe(true);
    expect(value(["N", [head, 0]]).re).toBeCloseTo(Math.PI / 2, 15);
  }
});

test("other arguments still reach the native handler", () => {
  expect(value(["Arcosh", 1]).json).toBe(0);
  expect(value(["EllipticE", 1]).json).toBe(1);
  expect(value(["Arcoth", "x"]).json).toEqual(["Arcoth", "x"]);
});

test("Zeta(0, a) = 1/2 − a keeps the (n+a)=0 term, on every route", () => {
  expect(value(["Zeta", 0, 0]).re).toBe(0.5);
  expect(value(["Zeta", 0, -1]).re).toBe(1.5);
  expect(value(["N", ["Zeta", 0.0, -2]]).re).toBe(2.5);
  expect(hurwitzZeta({ re: 0, im: 0 }, { re: -3, im: 0 }).re).toBe(3.5);
  expect(zetaGeneralized({ re: 0, im: 0 }, { re: -1, im: 0 }).re).toBe(1.5);
  expect(hurwitzZetaReal(0, 0)).toBe(0.5);
  // Every other s still drops it: ζ(2, 0) = ζ(2).
  expect(value(["N", ["Zeta", 2, 0]]).re).toBeCloseTo(Math.PI ** 2 / 6, 12);
});

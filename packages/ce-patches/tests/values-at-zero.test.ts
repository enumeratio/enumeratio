import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyPatch, hurwitzZeta, hurwitzZetaReal, valuesAtZero, zetaGeneralized } from "../src/index.ts";

const ce = new ComputeEngine();
applyPatch(ce, valuesAtZero);
const value = (expr: unknown) => ce.box(expr as never).evaluate();

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

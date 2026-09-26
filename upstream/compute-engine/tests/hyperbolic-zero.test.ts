import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyPatch, hyperbolicZero } from "../src/index.ts";

const ce = new ComputeEngine();
applyPatch(ce, hyperbolicZero);

test("Sinh, Tanh, Sech, Arsinh, Artanh at 0", () => {
  expect(ce.box(["Sinh", 0]).evaluate().isSame(ce.Zero)).toBe(true);
  expect(ce.box(["Tanh", 0]).evaluate().isSame(ce.Zero)).toBe(true);
  expect(ce.box(["Sech", 0]).evaluate().isSame(ce.One)).toBe(true);
  expect(ce.box(["Arsinh", 0]).evaluate().isSame(ce.Zero)).toBe(true);
  expect(ce.box(["Artanh", 0]).evaluate().isSame(ce.Zero)).toBe(true);
});

test("Cosh(0) = 1", () => {
  expect(ce.box(["Cosh", 0]).evaluate().isSame(ce.One)).toBe(true);
});

test("Csch and Coth blow up at 0", () => {
  expect(ce.box(["Csch", 0]).evaluate().isSame(ce.ComplexInfinity)).toBe(true);
  expect(ce.box(["Coth", 0]).evaluate().isSame(ce.ComplexInfinity)).toBe(true);
});

test("does not fire away from 0, or at a non-exact 0.0", () => {
  expect(ce.box(["Sinh", 1]).evaluate().json).toEqual(["Sinh", 1]);
  expect(ce.box(["Sinh", "x"]).evaluate().json).toEqual(["Sinh", "x"]);
});

test("applying twice is a no-op", () => {
  applyPatch(ce, hyperbolicZero);
  expect(ce.box(["Cosh", 0]).evaluate().isSame(ce.One)).toBe(true);
});

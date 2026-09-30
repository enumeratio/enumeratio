// Fibonacci(nu, x) at a non-integer or negative-integer order (declare.ts's two-variable
// Binet rule): exact input must stay exact. The rule used to finish with an unconditional
// `.N()`, so FunctionExpand(Fibonacci(n, x)) and FunctionExpand(Fibonacci(1/2, x)) came back
// with Pi rounded to a float and stray ~1e-43 terms instead of a symbolic closed form.
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareNumerals } from "@enumeratio/numerals/src";
import { declareResidues } from "@enumeratio/residues/src";
import { declareNumberTheory } from "../src/declare.ts";

const ce = new ComputeEngine();
declareResidues(ce);
declareNumerals(ce);
declareNumberTheory(ce);

const evaluate = (expr: unknown): ReturnType<ComputeEngine["box"]> =>
  ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate();

// Any float literal anywhere in the boxed result's JSON -- the bug's signature (a rounded
// Pi, a stray ~1e-43 cancellation term) is always some operand with digits after the point.
function hasFloat(json: unknown): boolean {
  if (typeof json === "number") return !Number.isInteger(json);
  if (Array.isArray(json)) return json.some(hasFloat);
  if (json !== null && typeof json === "object") return Object.values(json).some(hasFloat);
  return false;
}

test("Fibonacci(n, x) at a fully symbolic order stays exact (no float Pi)", () => {
  const r = evaluate(["Fibonacci", "n", "x"]);
  expect(hasFloat(r.json)).toBe(false);
});

test("Fibonacci(1/2, x) at an exact half-integer order stays exact", () => {
  const r = evaluate(["Fibonacci", ["Rational", 1, 2], "x"]);
  expect(hasFloat(r.json)).toBe(false);
});

test("Fibonacci(1/2, x): Cos(Pi/2) vanishes exactly, leaving a bare power over the discriminant", () => {
  const r = evaluate(["Fibonacci", ["Rational", 1, 2], "x"]);
  // F_(1/2)(x) = sqrt(root) / sqrt(x^2+4), root = (x + sqrt(x^2+4))/2 -- no Cos term survives.
  expect(r.toString()).not.toContain("Cos");
});

test("Fibonacci(-1, x) at a negative-integer order stays exact", () => {
  const r = evaluate(["Fibonacci", -1, "x"]);
  expect(hasFloat(r.json)).toBe(false);
});

test("Fibonacci(1/2, x) still agrees with N() to machine precision at a concrete x", () => {
  const exact = evaluate(["Fibonacci", ["Rational", 1, 2], 3]).N();
  const numeric = evaluate(["N", ["Fibonacci", ["Rational", 1, 2], 3]]);
  expect(exact.re).toBeCloseTo(numeric.re, 10);
});

test("a genuinely float order still reduces to a float (unaffected by the exactness fix)", () => {
  const r = evaluate(["Fibonacci", 0.5, "x"]);
  expect(hasFloat(r.json)).toBe(true);
});

test("a genuinely float x still reduces to a float even at an exact order", () => {
  const r = evaluate(["Fibonacci", ["Rational", 1, 2], 2.5]);
  const expected = evaluate(["Fibonacci", 0.5, 2.5]);
  expect(Number.isFinite(r.re)).toBe(true);
  expect(r.re).toBeCloseTo(expected.re, 10);
});

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// Sin's symbolic normalisations (parity, an integer-multiple-of-pi shift, an imaginary
// argument, Sin(Arccos(x))) and Arcsin's principal-branch reduction of Sin(y), from
// trig-normalisation.ts. Exact symbolic identities throughout, not a golden file.

const ce = new ComputeEngine();
declareAnalytic(ce);

const evalJson = (expr: unknown) => ce.box(expr as never).evaluate().json;

test("Sin(k*pi) = 0 for any integer k", () => {
  expect(evalJson(["Sin", "Pi"])).toEqual(0);
  expect(evalJson(["Sin", ["Negate", "Pi"]])).toEqual(0);
  expect(evalJson(["Sin", ["Multiply", 1000001, "Pi"]])).toEqual(0);
  expect(evalJson(["Sin", ["Multiply", 4, "Pi"]])).toEqual(0);
});

test("Sin(x + k*pi) = (-1)^k * Sin(x)", () => {
  expect(evalJson(["Sin", ["Add", "x", "Pi"]])).toEqual(["Negate", ["Sin", "x"]]);
  expect(evalJson(["Sin", ["Add", "x", ["Multiply", 2, "Pi"]]])).toEqual(["Sin", "x"]);
});

test("Sin is odd: Sin(-x) = -Sin(x)", () => {
  expect(evalJson(["Sin", ["Negate", "x"]])).toEqual(["Negate", ["Sin", "x"]]);
});

test("Sin(i*t) = i*Sinh(t), for any real coefficient folded into the imaginary literal", () => {
  expect(evalJson(["Sin", ["Multiply", "ImaginaryUnit", "x"]])).toEqual(["Multiply", ["Complex", 0, 1], ["Sinh", "x"]]);
  expect(evalJson(["Sin", ["Multiply", "ImaginaryUnit", ["Divide", "Pi", 2]]])).toEqual([
    "Multiply",
    ["Complex", 0, 1],
    ["Sinh", ["Multiply", ["Rational", 1, 2], "Pi"]],
  ]);
});

test("N() decimalizes Sin(i*t), not just evaluate()", () => {
  // Regression for #107's bug: i*Sinh(pi/2) is exact and symbolic (Sinh has no special
  // value at pi/2); a wrapper that ignores `options.numericApproximation` would leave
  // N(...) with that exact form instead of a decimal.
  const n = ce.box(["N", ["Sin", ["Multiply", "ImaginaryUnit", ["Divide", "Pi", 2]]]]).evaluate();
  expect(n.re).toBe(0);
  expect(n.im).toBeCloseTo(Math.sinh(Math.PI / 2), 9);
});

test("Sin(Arccos(x)) = Sqrt(1 - x^2)", () => {
  expect(evalJson(["Sin", ["Arccos", "x"]])).toEqual(["Sqrt", ["Add", ["Negate", ["Power", "x", 2]], 1]]);
});

test("a plain or special-angle Sin call is untouched", () => {
  expect(evalJson(["Sin", 2])).toEqual(["Sin", 2]);
  expect(evalJson(["Sin", ["Divide", "Pi", 6]])).toEqual(["Rational", 1, 2]);
  expect(evalJson(["Sin", ["Add", "x", "y"]])).toEqual(["Sin", ["Add", "x", "y"]]);
});

test("Arcsin(Sin(y)) reflects a real y outside [-pi/2, pi/2] back into range", () => {
  expect(evalJson(["Arcsin", ["Sin", 2]])).toEqual(["Add", -2, "Pi"]);
  expect(evalJson(["Arcsin", ["Sin", -2]])).toEqual(["Add", 2, ["Negate", "Pi"]]);
  // Already principal: untouched (native Sin(0.5) is float, so this doesn't even reach
  // the wrapper, but Sin(Rational(1,2)) does and should reduce to itself).
  expect(evalJson(["Arcsin", ["Sin", ["Rational", 1, 2]]])).toEqual(["Rational", 1, 2]);
});

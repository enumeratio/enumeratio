import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// Fourier / InverseFourier (the discrete transform) and FourierSeries / FourierCoefficient
// (the order-n complex exponential series) -- see fourier-transform.ts and fourier-series.ts
// for scope. Expected values are each verified against `wolframscript` directly (see the
// heads' reference/*.yaml `details`), so they're inlined here as exact structural MathJSON
// comparisons rather than a golden JSON file.

const ce = new ComputeEngine();
declareAnalytic(ce);

const evalOf = (mj: unknown) => ce.box(mj as never).evaluate().json;

test("Fourier: the DFT of a list, matching Wolfram's default FourierParameters {0,1}", () => {
  expect(evalOf(["Fourier", ["List", 1, 2, 3, 4]])).toEqual(["List", 5, ["Complex", -1, -1], -1, ["Complex", -1, 1]]);
  expect(evalOf(["InverseFourier", ["Fourier", ["List", 1, 2, 3, 4]]])).toEqual(["List", 1, 2, 3, 4]);
});

test("Fourier: a rectangular matrix is the separable 2D transform", () => {
  expect(evalOf(["Fourier", ["List", ["List", 1, 2], ["List", 3, 4]]])).toEqual([
    "List",
    ["List", 5, -1],
    ["List", -2, 0],
  ]);
  expect(evalOf(["InverseFourier", ["List", ["List", 5, -1], ["List", -2, 0]]])).toEqual([
    "List",
    ["List", 1, 2],
    ["List", 3, 4],
  ]);
});

test("Fourier: a custom FourierParameters option, and InverseFourier's sign flip", () => {
  const params = ["KeyValuePair", "FourierParameters", ["List", 1, -1]];
  expect(evalOf(["Fourier", ["List", 1, 2, 3, 4], params])).toEqual([
    "List",
    10,
    ["Complex", -2, 2],
    -2,
    ["Complex", -2, -2],
  ]);
  expect(evalOf(["InverseFourier", ["List", 1, 2, 3, 4], params])).toEqual([
    "List",
    2.5,
    ["Complex", -0.5, -0.5],
    -0.5,
    ["Complex", -0.5, 0.5],
  ]);
});

test("Fourier: declines a symbolic list, an empty list, and a ragged matrix", () => {
  expect(ce.box(["Fourier", ["List", "a", "b"]]).evaluate().operator).toBe("Fourier");
  expect(ce.box(["Fourier", ["List"]]).evaluate().operator).toBe("Fourier");
  expect(ce.box(["Fourier", ["List", ["List", 1, 2], ["List", 3]]]).evaluate().operator).toBe("Fourier");
});

test("FourierCoefficient: the covered atoms, checked against Wolfram", () => {
  expect(evalOf(["FourierCoefficient", "x", "x", 2])).toEqual(["Complex", 0, ["Rational", 1, 2]]);
  expect(evalOf(["FourierCoefficient", "x", "x", 0])).toEqual(0);
  expect(evalOf(["FourierCoefficient", ["Power", "x", 2], "x", 0])).toEqual([
    "Multiply",
    ["Rational", 1, 3],
    ["Power", "Pi", 2],
  ]);
  expect(evalOf(["FourierCoefficient", ["Power", ["Cos", "x"], 2], "x", 0])).toEqual(["Rational", 1, 2]);
  expect(evalOf(["FourierCoefficient", ["Power", ["Cos", "x"], 2], "x", 2])).toEqual(["Rational", 1, 4]);
  expect(evalOf(["FourierCoefficient", ["Power", ["Cos", "x"], 2], "x", 1])).toEqual(0);
  expect(evalOf(["FourierCoefficient", ["Abs", "x"], "x", 0])).toEqual(["Multiply", ["Rational", 1, 2], "Pi"]);
  expect(evalOf(["FourierCoefficient", ["Abs", "x"], "x", 1])).toEqual(["Divide", -2, "Pi"]);
});

test("FourierCoefficient: declines a symbolic order and an uncovered function", () => {
  expect(ce.box(["FourierCoefficient", "x", "x", "n"]).evaluate().operator).toBe("FourierCoefficient");
  expect(ce.box(["FourierCoefficient", ["Tan", "x"], "x", 1]).evaluate().operator).toBe("FourierCoefficient");
});

test("FourierSeries: sums FourierCoefficient's terms from -n to n", () => {
  expect(evalOf(["FourierSeries", ["Sin", "x"], "x", 3])).toEqual([
    "Add",
    ["Multiply", ["Complex", 0, ["Rational", -1, 2]], ["Power", "ExponentialE", ["Multiply", ["Complex", 0, 1], "x"]]],
    ["Multiply", ["Complex", 0, ["Rational", 1, 2]], ["Power", "ExponentialE", ["Multiply", ["Complex", 0, -1], "x"]]],
  ]);
  expect(evalOf(["FourierSeries", ["Power", "x", 2], "x", 0])).toEqual([
    "Multiply",
    ["Rational", 1, 3],
    ["Power", "Pi", 2],
  ]);
});

test("FourierSeries: declines a mixed polynomial-times-trig product", () => {
  expect(ce.box(["FourierSeries", ["Multiply", "x", ["Cos", "x"]], "x", 1]).evaluate().operator).toBe("FourierSeries");
});

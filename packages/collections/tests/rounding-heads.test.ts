import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

// Floor/Ceil(x, step): cross-checked against the hand formula step*floor(x/step), computed
// independently in plain JS floating point.
test("Floor(x, step) matches step*floor(x/step)", () => {
  for (const [x, step] of [
    [226, 10],
    [-10.3, 3.5],
    [17.5, 2.5],
  ] as const) {
    const expected = step * Math.floor(x / step);
    expect(run(["Floor", x, step]), `Floor(${x}, ${step})`).toEqual(expected);
  }
});
test("Ceil(x, step) matches step*ceil(x/step)", () => {
  for (const [x, step] of [
    [226, 10],
    [-10.3, 3.5],
    [17.5, 2.5],
  ] as const) {
    const expected = step * Math.ceil(x / step);
    expect(run(["Ceil", x, step]), `Ceil(${x}, ${step})`).toEqual(expected);
  }
});
test("Floor(x, step) is exact for a rational step", () => {
  expect(run(["Floor", 226, 10])).toEqual(220);
  expect(run(["Ceil", 226, 10])).toEqual(230);
});
test("a 1-argument call is unaffected", () => {
  expect(run(["Floor", 3.7])).toEqual(3);
  expect(run(["Ceil", 3.2])).toEqual(4);
});

// Chop(x, tolerance)
test("Chop(x, tolerance) uses the given threshold, not the default ~1e-10", () => {
  expect(run(["Chop", 0.001, 0.01])).toEqual(0);
  expect(run(["Chop", 0.001, 0.0001])).toEqual(0.001);
});
test("a tighter tolerance keeps a value the default 1-argument form would chop", () => {
  expect(run(["Chop", 1e-15])).toEqual(0);
  expect(run(["Chop", 1e-15, 1e-20])).toEqual(1e-15);
});
test("Chop(x, tolerance) still chops the real and imaginary parts independently", () => {
  expect(run(["Chop", ["Complex", 0.005, 3], 0.01])).toEqual(["Complex", 0, 3]);
});

// Clamp(x, lower, upper, vLower, vUpper): Wolfram's Clip replacement-value form.
test("Clamp with replacement values returns vLower/vUpper outside the range", () => {
  expect(run(["Clamp", 5, 0, 3, -1, 10])).toEqual(10);
  expect(run(["Clamp", -5, 0, 3, -1, 10])).toEqual(-1);
});
test("Clamp with replacement values still returns x unchanged inside the range", () => {
  expect(run(["Clamp", 2, 0, 3, -1, 10])).toEqual(2);
});
test("the 3-argument Clamp (nearer bound) is unaffected", () => {
  expect(run(["Clamp", 5, 0, 3])).toEqual(3);
});

// Min() -> +∞, the identity element.
test("Min() is the identity element +∞", () => {
  expect(run(["Min"])).toEqual("PositiveInfinity");
});
test("Min() as the identity is consistent with folding it into a normal call", () => {
  expect(run(["Min", ["Min"], 5])).toEqual(5);
});

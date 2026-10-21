import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, it } from "vite-plus/test";
import { conform, declareStructures } from "../src/index.ts";

const ce = new ComputeEngine();
declareStructures(ce);
const order = (x: unknown) => ce.box(["OrderOfElement", x] as never).evaluate().json;

// Brute force: the least n >= 1 with z^n = 1 over exact Gaussian rationals (a, b) = a + bi.
const brute = (a: number, b: number): number => {
  let [x, y] = [a, b];
  for (let n = 1; n <= 8; n++) {
    if (x === 1 && y === 0) return n;
    [x, y] = [x * a - y * b, x * b + y * a];
  }
  return Infinity;
};

it("roots of unity among the exact numbers", () => {
  expect(order(1)).toEqual(1);
  expect(order(-1)).toEqual(2);
  expect(order(["Complex", 0, 1])).toEqual(4);
  expect(order(["Complex", 0, -1])).toEqual(4);
  for (const [a, b] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [2, 0],
    [1, 1],
    [0, 0],
  ] as const) {
    const expected = brute(a, b);
    expect(order(b === 0 ? a : ["Complex", a, b])).toEqual(expected === Infinity ? "PositiveInfinity" : expected);
  }
});

it("other rationals and Gaussian rationals have infinite order", () => {
  expect(order(["Rational", -1, 2])).toEqual("PositiveInfinity");
  expect(order(["Complex", ["Rational", 3, 5], ["Rational", 4, 5]])).toEqual("PositiveInfinity");
});

it("declines on inexact, symbolic and matrix operands", () => {
  for (const x of [0.5, "x", ["Sqrt", 2], ["List", ["List", 0, -1], ["List", 1, 0]]])
    expect(order(x)).toEqual(["OrderOfElement", x]);
});

it("a conforming type answers for itself", () => {
  const own = new ComputeEngine();
  declareStructures(own);
  own.declareType("flip", "real", { mint: true } as never);
  own.declare("Flip", { signature: "(real) -> flip" });
  conform(own, "flip", { Monoid: { OrderOfElement: () => own.number(2) } });
  expect(own.box(["OrderOfElement", ["Flip", 3]] as never).evaluate().json).toEqual(2);
});

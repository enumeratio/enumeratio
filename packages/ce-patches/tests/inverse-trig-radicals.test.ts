import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyPatch, inverseTrigRadicals } from "../src/index.ts";

const ce = new ComputeEngine();
applyPatch(ce, inverseTrigRadicals);
const value = (expr: unknown) => ce.box(expr as never).evaluate().json;
const tenths = (k: number) => ce.box(["Multiply", ["Rational", k, 10], "Pi"]).evaluate().json;

const sinPi5 = ["Multiply", ["Divide", ["Sqrt", 2], 4], ["Sqrt", ["Add", 5, ["Negate", ["Sqrt", 5]]]]];
const tanPi10 = ["Sqrt", ["Add", 1, ["Multiply", ["Rational", -2, 5], ["Sqrt", 5]]]];
const tan3Pi10 = ["Sqrt", ["Add", 1, ["Multiply", ["Rational", 2, 5], ["Sqrt", 5]]]];

test("the radicals of the tenths of π fold to their angle", () => {
  expect(value(["Arcsin", sinPi5])).toEqual(tenths(2));
  expect(value(["Arcsin", ["Negate", sinPi5]])).toEqual(tenths(-2));
  expect(value(["Arccos", sinPi5])).toEqual(tenths(3));
  expect(value(["Arccos", ["Negate", sinPi5]])).toEqual(tenths(7));
  expect(value(["Arctan", tanPi10])).toEqual(tenths(1));
  expect(value(["Arctan", ["Negate", tan3Pi10]])).toEqual(tenths(-3));
});

test("N agrees, and a radical at no tenth of π stays", () => {
  expect(ce.box(["N", ["Arcsin", sinPi5]] as never).evaluate().re).toBeCloseTo(Math.PI / 5, 15);
  expect(value(["Arcsin", ["Divide", ["Sqrt", 3], 3]])).toEqual(["Arcsin", ["Divide", ["Sqrt", 3], 3]]);
  // A float isn't a radical: the native kernel answers it.
  expect(ce.box(["Arcsin", 0.5877852522924731]).evaluate().re).toBeCloseTo(Math.PI / 5, 12);
});

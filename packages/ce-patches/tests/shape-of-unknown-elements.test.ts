import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyPatch, shapeOfUnknownElements } from "../src/index.ts";

const ce = new ComputeEngine();
applyPatch(ce, shapeOfUnknownElements);

const shape = (expr: unknown): unknown => ce.box(["Shape", expr] as never).evaluate().json;

test("a nested list of unknown applications has the shape of its nesting", () => {
  expect(shape(["List", ["List", ["a", 1], ["a", 2]], ["List", ["a", 3], ["a", 4]]])).toEqual(["Tuple", 2, 2]);
  expect(shape(["List", ["a", 1], ["a", 2], ["a", 3]])).toEqual(["Tuple", 3]);
});

test("a ragged list keeps the dimensions its rows agree on, as Dimensions does", () => {
  expect(shape(["List", ["List", ["a", 1], ["a", 2]], ["List", ["a", 3]]])).toEqual(["Tuple", 2]);
});

test("typed lists and scalars are untouched", () => {
  expect(shape(["List", ["List", 1, 2, 3], ["List", 4, 5, 6]])).toEqual(["Tuple", 2, 3]);
  expect(shape(5)).toEqual(["Tuple"]);
});

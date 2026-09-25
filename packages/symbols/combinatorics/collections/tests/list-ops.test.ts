import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);

test("Prepend adds element at the front of a list", () => {
  const expr = ce.box(["Prepend", ["List", 1, 2, 3], 0]);
  expect(expr.evaluate().json).toEqual(["List", 0, 1, 2, 3]);
});

test("Prepend with a single element list", () => {
  const expr = ce.box(["Prepend", ["List", 5], 10]);
  expect(expr.evaluate().json).toEqual(["List", 10, 5]);
});

test("Prepend with an empty list", () => {
  const expr = ce.box(["Prepend", ["List"], 42]);
  expect(expr.evaluate().json).toEqual(["List", 42]);
});

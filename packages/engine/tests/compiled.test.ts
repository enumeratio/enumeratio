import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { isCacheableDefinition } from "../src/compiled.ts";

const ce = new ComputeEngine();
const cacheable = (expression: unknown): boolean => isCacheableDefinition(ce, expression, { _x: "integer" });

test("a pure definition's answer can be reused", () => {
  expect(cacheable(["Add", "_x", 1])).toBe(true);
});

test("so can one that only writes to the console", () => {
  expect(cacheable(["Print", "_x"])).toBe(true);
});

test("one that draws a random number can't", () => {
  expect(cacheable(["Add", "_x", ["RandomInteger", 1, 6]])).toBe(false);
});

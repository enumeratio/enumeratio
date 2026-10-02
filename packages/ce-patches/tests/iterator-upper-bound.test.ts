import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyPatch, iteratorUpperBound } from "../src/index.ts";

const ce = new ComputeEngine();
applyPatch(ce, iteratorUpperBound);

const value = (expr: unknown): unknown => ce.box(expr as never).evaluate().json;

test("a lone upper bound runs from 1, as Wolfram's {k, n} does", () => {
  expect(value(["Sum", ["Power", "k", 2], ["Tuple", "k", 10]])).toBe(385);
  expect(value(["Sum", ["Power", "k", 2], ["Limits", "k", "Nothing", 10]])).toBe(385);
  expect(value(["Product", "k", ["Tuple", "k", 5]])).toBe(120);
});

test("explicit bounds are untouched", () => {
  expect(value(["Sum", "k", ["Limits", "k", 3, 5]])).toBe(12);
});

test("a lone lower bound still stays unevaluated", () => {
  expect(value(["Sum", ["Power", "k", -2], ["Limits", "k", 1, "Nothing"]])).toEqual([
    "Sum",
    ["Power", "k", -2],
    ["Limits", "k", 1, "Nothing"],
  ]);
});

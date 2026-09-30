import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyPatch, solveIdentity } from "../src/index.ts";

const ce = new ComputeEngine();
applyPatch(ce, solveIdentity);

test("Solve(x == x, x) is one solution with no constraint, not none", () => {
  expect(ce.box(["Solve", ["Equal", "x", "x"], "x"]).evaluate().json).toEqual(["List", ["List"]]);
});

test("Solve(0 == 0, x) is also an identity", () => {
  expect(ce.box(["Solve", ["Equal", 0, 0], "x"]).evaluate().json).toEqual(["List", ["List"]]);
});

test("Solve(1 == 0, x) stays no solutions -- native was already correct", () => {
  expect(ce.box(["Solve", ["Equal", 1, 0], "x"]).evaluate().json).toEqual(["List"]);
});

test("a genuine unsatisfiable equation over a symbol is still no solutions", () => {
  expect(ce.box(["Solve", ["Equal", "x", ["Add", "x", 1]], "x"]).evaluate().json).toEqual(["List"]);
});

test("an ordinary solve is untouched", () => {
  const roots = ce.box(["Solve", ["Equal", ["Power", "x", 2], 1], "x"]).evaluate().json;
  expect(roots).toEqual(["List", 1, -1]);
});

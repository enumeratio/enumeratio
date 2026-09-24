import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAestimatio } from "../src/index.ts";

const ce = new ComputeEngine();
declareAestimatio(ce);
const box = (expr: unknown) => ce.box(expr as Parameters<ComputeEngine["box"]>[0]);

// A loop long enough that, run to completion, it takes far longer than any deadline below —
// so hitting the deadline is not a race against machine speed, only against N.
const SLOW = ["Sum", ["Mod", "k", 97], ["Tuple", "k", 1, 500_000_000]];

test("TimeConstrained returns the value when it finishes in time", () => {
  const result = box(["TimeConstrained", ["Add", 1, 2], 5]).evaluate();
  expect(result.json).toBe(3);
});

test("TimeConstrained aborts a slow computation to $Aborted", () => {
  const result = box(["TimeConstrained", SLOW, 0.02]).evaluate();
  expect(result.json).toBe("Aborted");
});

test("TimeConstrained returns failexpr instead of $Aborted when given one", () => {
  const result = box(["TimeConstrained", SLOW, 0.02, -1]).evaluate();
  expect(result.json).toBe(-1);
});

test("TimeConstrained's async route also aborts a slow computation", async () => {
  const result = await box(["TimeConstrained", SLOW, 0.02]).evaluateAsync();
  expect(result.json).toBe("Aborted");
});

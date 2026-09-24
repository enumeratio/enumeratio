import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAestimatio } from "../src/index.ts";

const ce = new ComputeEngine();
declareAestimatio(ce);

test("MemoryConstrained cannot be enforced in-process, so it stays unevaluated", () => {
  // Documented in design/aestimatio.md §3: a bound this process cannot enforce is never
  // silently ignored — the call simply does not reduce.
  const result = ce.box(["MemoryConstrained", ["Add", 1, 2], 1_000_000]);
  expect(result.evaluate().operator).toBe("MemoryConstrained");
});

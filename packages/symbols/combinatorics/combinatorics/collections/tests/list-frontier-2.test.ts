import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

// PascalBinomial(n, m)
test("PascalBinomial satisfies Pascal's recurrence for a negative n", () => {
  const p = (n: number, m: number) => run(["PascalBinomial", n, m]) as number;
  expect(p(-1, 3) === p(-2, 2) + p(-2, 3)).toBe(true);
});

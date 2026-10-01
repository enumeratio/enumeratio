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

// CellularAutomaton: the background is a cell the rule updates
test("CellularAutomaton rule 73 flips its background each generation", () => {
  // Wolfram's own rows for CellularAutomaton[73, {{1}, 0}, 4].
  expect(run(["CellularAutomaton", 73, ["List", ["List", 1], 0], 4])).toEqual([
    "List",
    ["List", 0, 0, 0, 0, 1, 0, 0, 0, 0],
    ["List", 1, 1, 1, 0, 0, 0, 1, 1, 1],
    ["List", 0, 0, 1, 0, 1, 0, 1, 0, 0],
    ["List", 1, 0, 0, 0, 0, 0, 0, 0, 1],
    ["List", 1, 0, 1, 1, 1, 1, 1, 0, 1],
  ]);
});

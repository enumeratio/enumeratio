import { ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

const ce = new ComputeEngine();
declareAnalytic(ce);
const simplify = (expr: unknown): unknown => ce.box(["Simplify", expr] as never).evaluate().json;

test("Simplify folds an expression in GoldenRatio that is rational", () => {
  expect(simplify(["Add", 1, ["Power", "GoldenRatio", -1], ["Negate", "GoldenRatio"]])).toEqual(0);
  expect(simplify(["Subtract", ["Power", "GoldenRatio", 2], ["Add", "GoldenRatio", 1]])).toEqual(0);
  expect(simplify(["Multiply", "GoldenRatio", ["Subtract", "GoldenRatio", 1]])).toEqual(1);
  // 1/φ² + 1/φ = 1; φ⁻¹ = φ − 1 and φ⁻² = 2 − φ
  expect(simplify(["Add", ["Power", "GoldenRatio", -2], ["Power", "GoldenRatio", -1]])).toEqual(1);
});

test("what is not rational is left as it was", () => {
  for (const expr of ["GoldenRatio", ["Power", "GoldenRatio", 2], ["Add", "GoldenRatio", "x"]]) {
    expect(typeof simplify(expr)).not.toBe("number");
    expect(JSON.stringify(simplify(expr))).toMatch(/GoldenRatio|Sqrt/);
  }
});

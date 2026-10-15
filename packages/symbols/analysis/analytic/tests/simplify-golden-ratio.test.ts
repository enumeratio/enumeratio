// unstable: ComputeEngine, the engine class itself; the stable entry has no constructor
import { ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";
import { goldenRatioCollapse } from "../src/simplify-identities.ts";

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

test("0^0 is not folded to 1, and a part past a double's exact integers leaves the input", () => {
  const zeroToZero = ["Multiply", "GoldenRatio", ["Power", ["Subtract", "GoldenRatio", "GoldenRatio"], 0]];
  expect(goldenRatioCollapse(zeroToZero)).toEqual(zeroToZero);
  // L_64 = φ^64 + φ^-64 is 23725150497407, so its square, about 5.6e26, is not an exact double
  const lucas = ["Add", ["Power", "GoldenRatio", 64], ["Power", "GoldenRatio", -64]];
  expect(goldenRatioCollapse(["Add", lucas, ["Negate", "GoldenRatio"], "GoldenRatio"])).toEqual(23725150497407);
  const square = ["Multiply", lucas, lucas];
  expect(goldenRatioCollapse(square)).toEqual(square);
});

test("what is not rational is left as it was", () => {
  for (const expr of ["GoldenRatio", ["Power", "GoldenRatio", 2], ["Add", "GoldenRatio", "x"]]) {
    expect(typeof simplify(expr)).not.toBe("number");
    expect(JSON.stringify(simplify(expr))).toMatch(/GoldenRatio|Sqrt/);
  }
});

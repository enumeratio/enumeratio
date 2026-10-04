import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

const ce = new ComputeEngine();
declareAnalytic(ce);

// compute-engine's model (cortex-js/compute-engine#401): Sin/Cos of an infinity is a type
// error at boxing, not a value, and we follow it.
test("Sin/Cos of an infinity is a boxing type error", () => {
  for (const head of ["Sin", "Cos"]) {
    for (const x of ["PositiveInfinity", "NegativeInfinity", "ComplexInfinity"]) {
      expect(ce.box([head, x]).isValid, `${head}(${x})`).toBe(false);
    }
  }
});

test("ordinary Sin/Cos calls are untouched", () => {
  expect(ce.box(["Sin", 0]).evaluate().json).toBe(0);
  expect(ce.box(["Cos", 0]).evaluate().json).toBe(1);
});

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

const ce = new ComputeEngine();
declareAnalytic(ce);

test("Sin/Cos(+-Infinity) = Interval(-1, 1)", () => {
  for (const head of ["Sin", "Cos"]) {
    expect(ce.box([head, "PositiveInfinity"]).evaluate().json, head).toEqual(["Interval", -1, 1]);
    expect(ce.box([head, "NegativeInfinity"]).evaluate().json, head).toEqual(["Interval", -1, 1]);
  }
});

// Wolfram docs sweep #124: off the real axis Sin/Cos grow like exp(|z|) rather than staying
// bounded, so the undirected ComplexInfinity has no limit in any sense -- Indeterminate, not
// the Interval(-1, 1) the real infinities get.
test("Sin/Cos(ComplexInfinity) = Indeterminate", () => {
  expect(ce.box(["Sin", "ComplexInfinity"]).evaluate().json).toBe("Indeterminate");
  expect(ce.box(["Cos", "ComplexInfinity"]).evaluate().json).toBe("Indeterminate");
});

test("ordinary Sin/Cos calls are untouched", () => {
  expect(ce.box(["Sin", 0]).evaluate().json).toBe(0);
  expect(ce.box(["Cos", 0]).evaluate().json).toBe(1);
});

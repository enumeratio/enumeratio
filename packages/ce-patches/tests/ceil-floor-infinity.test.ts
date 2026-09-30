import { ComputeEngine } from "@cortex-js/compute-engine";
import { describe, expect, test } from "vite-plus/test";
import { applyAllPatches } from "../src/index.ts";

const ce = new ComputeEngine();
applyAllPatches(ce);

describe("Ceil/Floor at ComplexInfinity", () => {
  test("Ceil(ComplexInfinity) = ComplexInfinity", () => {
    expect(ce.box(["Ceil", "ComplexInfinity"]).evaluate().json).toBe("ComplexInfinity");
  });

  test("Floor(ComplexInfinity) = ComplexInfinity", () => {
    expect(ce.box(["Floor", "ComplexInfinity"]).evaluate().json).toBe("ComplexInfinity");
  });

  test("ordinary Ceil/Floor calls are untouched", () => {
    expect(ce.box(["Ceil", 2.3]).evaluate().json).toBe(3);
    expect(ce.box(["Floor", 2.3]).evaluate().json).toBe(2);
    expect(ce.box(["Ceil", "PositiveInfinity"]).evaluate().json).toBe("PositiveInfinity");
  });
});

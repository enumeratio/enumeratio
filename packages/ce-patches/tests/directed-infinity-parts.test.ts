import { ComputeEngine } from "@cortex-js/compute-engine";
import { describe, expect, test } from "vite-plus/test";
import { applyAllPatches } from "../src/index.ts";

const ce = new ComputeEngine();
applyAllPatches(ce);
const at = (expr: unknown) => ce.box(expr as never).evaluate().json;

describe("Re, Im and Abs of a directed infinity", () => {
  test("Re(I*Infinity) = 0, Im(I*Infinity) = Infinity", () => {
    expect(at(["Real", ["Multiply", "ImaginaryUnit", "PositiveInfinity"]])).toBe(0);
    expect(at(["Imaginary", ["Multiply", "ImaginaryUnit", "PositiveInfinity"]])).toBe("PositiveInfinity");
  });

  test("an oblique direction takes the sign of each part", () => {
    expect(at(["Real", ["Multiply", ["Add", 1, "ImaginaryUnit"], "PositiveInfinity"]])).toBe("PositiveInfinity");
    expect(at(["Real", ["Multiply", ["Add", 1, "ImaginaryUnit"], "NegativeInfinity"]])).toBe("NegativeInfinity");
  });

  test("Abs of a directed infinity is +Infinity", () => {
    expect(at(["Abs", ["Multiply", "ImaginaryUnit", "PositiveInfinity"]])).toBe("PositiveInfinity");
  });

  test("the undirected ComplexInfinity stays Indeterminate", () => {
    expect(at(["Real", "ComplexInfinity"])).toBe("Indeterminate");
  });
});

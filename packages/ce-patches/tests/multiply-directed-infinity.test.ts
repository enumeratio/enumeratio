import { ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/engine";
import { describe, expect, test } from "vite-plus/test";
import { applyAllPatches } from "../src/index.ts";

const ce = new ComputeEngine();
applyAllPatches(ce);

describe("Multiply at the infinities", () => {
  test("ImaginaryUnit * PositiveInfinity = DirectedInfinity(i)", () => {
    const r = ce.box(["Multiply", "ImaginaryUnit", "PositiveInfinity"]).evaluate();
    expect(r.operator).toBe("DirectedInfinity");
    expect(r.toString()).toBe("DirectedInfinity(i)");
  });

  test("operand order doesn't matter", () => {
    expect(ce.box(["Multiply", "PositiveInfinity", "ImaginaryUnit"]).evaluate().toString()).toBe("DirectedInfinity(i)");
  });

  test("NegativeInfinity flips the direction", () => {
    expect(ce.box(["Multiply", "ImaginaryUnit", "NegativeInfinity"]).evaluate().toString()).toBe(
      "DirectedInfinity(-i)",
    );
  });

  test("a real scale factor doesn't change the unit direction", () => {
    expect(ce.box(["Multiply", 2, "ImaginaryUnit", "PositiveInfinity"]).evaluate().toString()).toBe(
      "DirectedInfinity(i)",
    );
  });

  test("a general complex factor normalizes by its modulus", () => {
    const r = ce.box(["Multiply", "PositiveInfinity", ["Add", 1, "ImaginaryUnit"]]).evaluate();
    expect(r.operator).toBe("DirectedInfinity");
    // direction has modulus 1
    const direction = operandsOf(r)[0]?.N();
    const modulus = Math.hypot(direction?.re ?? Number.NaN, direction?.im ?? Number.NaN);
    expect(modulus).toBeCloseTo(1, 10);
  });

  test("a real finite factor still gives the native undirected +-Infinity", () => {
    expect(ce.box(["Multiply", 3, "PositiveInfinity"]).evaluate().toString()).toBe("+oo");
    expect(ce.box(["Multiply", -3, "PositiveInfinity"]).evaluate().toString()).toBe("-oo");
  });

  test("0 * Infinity is untouched (stays Indeterminate)", () => {
    expect(ce.box(["Multiply", 0, "PositiveInfinity"]).evaluate().toString()).toBe("Indeterminate");
  });

  test("two infinite factors are untouched (native)", () => {
    expect(ce.box(["Multiply", "PositiveInfinity", "NegativeInfinity"]).evaluate().toString()).toBe("-oo");
  });

  test("ordinary Multiply calls are untouched", () => {
    expect(ce.box(["Multiply", 2, 3]).evaluate().re).toBe(6);
  });

  test("consequence: Gamma(ImaginaryUnit * PositiveInfinity) = 0 via gamma-infinity", () => {
    expect(
      ce
        .box(["Gamma", ["Multiply", "ImaginaryUnit", "PositiveInfinity"]])
        .evaluate()
        .is(0),
    ).toBe(true);
  });
});

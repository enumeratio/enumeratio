import { ComputeEngine } from "@cortex-js/compute-engine";
import { describe, expect, test } from "vite-plus/test";
import { applyAllPatches } from "../src/index.ts";

const ce = new ComputeEngine();
applyAllPatches(ce);

describe("Gamma at the infinities", () => {
  test("Gamma(+Infinity) = +Infinity (native)", () => {
    expect(ce.box(["Gamma", "PositiveInfinity"]).evaluate().toString()).toBe("+oo");
  });

  test("Gamma(-Infinity) = Indeterminate exact, NaN float (native)", () => {
    expect(ce.box(["Gamma", "NegativeInfinity"]).evaluate().toString()).toBe("Indeterminate");
    expect(ce.box(["Gamma", "NegativeInfinity"]).N().isNaN).toBe(true);
  });

  test("Gamma(ComplexInfinity) = Indeterminate exact, NaN float (native)", () => {
    expect(ce.box(["Gamma", "ComplexInfinity"]).evaluate().toString()).toBe("Indeterminate");
    expect(ce.box(["Gamma", "ComplexInfinity"]).N().isNaN).toBe(true);
  });

  test("Gamma(DirectedInfinity(i)) = 0 -- |Γ(iy)| → 0 as y → ∞ (DLMF 5.11.9)", () => {
    expect(
      ce
        .box(["Gamma", ["DirectedInfinity", "ImaginaryUnit"]])
        .evaluate()
        .is(0),
    ).toBe(true);
    expect(
      ce
        .box(["Gamma", ["DirectedInfinity", "ImaginaryUnit"]])
        .N()
        .is(0),
    ).toBe(true);
  });

  test("Gamma(DirectedInfinity(-i)) = 0 by conjugate symmetry", () => {
    expect(
      ce
        .box(["Gamma", ["DirectedInfinity", ["Negate", "ImaginaryUnit"]]])
        .evaluate()
        .is(0),
    ).toBe(true);
  });

  test("threads over a list (Gamma is broadcastable)", () => {
    const threaded = ce
      .box(["Map", "Gamma", ["List", "PositiveInfinity", ["DirectedInfinity", "ImaginaryUnit"]]])
      .evaluate();
    expect(threaded.toString()).toBe("[+oo,0]");
  });

  test("ordinary Gamma calls are untouched", () => {
    expect(ce.box(["Gamma", 5]).N().re).toBe(24);
  });
});

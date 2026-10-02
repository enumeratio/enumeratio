import { ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/engine";
import { describe, expect, test } from "vite-plus/test";
import { applyAllPatches } from "../src/index.ts";
import { integrateSemiInfiniteOscillatory } from "../src/compute-engine/numerics/oscillatory-quadrature.ts";

const ce = new ComputeEngine();
applyAllPatches(ce);

const integrate = (f: unknown, lo: unknown, hi: unknown) =>
  ce.box(["Integrate", f, ["Limits", "t", lo, hi]] as never).N();

// Closed forms, checked with mpmath at 20 digits: ∫₀^∞ sin t·t^(−p) = π/(2Γ(p)sin(πp/2)),
// ∫₀^∞ cos t·t^(−p) = Γ(1−p)sin(πp/2).
describe("∫ₐ^∞ of an oscillatory integrand singular at a", () => {
  test.each([
    ["sin t/t", ["Divide", ["Sin", "t"], "t"], 0, Math.PI / 2],
    [
      "sin t/(2t)",
      ["Divide", ["Multiply", ["Sin", ["Divide", "t", 2]], ["Cos", ["Divide", "t", 2]]], "t"],
      0,
      Math.PI / 4,
    ],
    ["sin t/√t", ["Divide", ["Sin", "t"], ["Sqrt", "t"]], 0, Math.sqrt(Math.PI / 2)],
    ["sin t/t^1.5", ["Divide", ["Sin", "t"], ["Power", "t", 1.5]], 0, 2.5066282746310002],
    ["cos t/t^0.8", ["Divide", ["Cos", "t"], ["Power", "t", 0.8]], 0, 4.366151827589093],
    ["sin(t−1)/(t−1)", ["Divide", ["Sin", ["Subtract", "t", 1]], ["Subtract", "t", 1]], 1, Math.PI / 2],
  ])("%s: the error bar holds the value", (_, f, lo, truth) => {
    const r = integrate(f, lo, "PositiveInfinity");
    expect(r.operator).toBe("Measurement");
    const [value, error] = operandsOf(r).map((x) => x.re) as [number, number];
    expect(Math.abs(value - truth)).toBeLessThanOrEqual(error);
    expect(Math.abs(value - truth)).toBeLessThan(1e-9);
  });

  test("the mirrored interval, ∫_{−∞}^0 sin t/t", () => {
    const r = integrate(["Divide", ["Sin", "t"], "t"], "NegativeInfinity", 0);
    expect(Math.abs(operandsOf(r)[0]!.re - Math.PI / 2)).toBeLessThan(1e-9);
  });

  test("NIntegrate agrees", () => {
    const r = ce.box(["NIntegrate", ["Function", ["Divide", ["Sin", "t"], "t"], "t"], 0, "PositiveInfinity"] as never);
    expect(Math.abs(r.evaluate().re - Math.PI / 2)).toBeLessThan(1e-9);
  });

  test("a finite endpoint value, a finite interval and the exact route are the native ones", () => {
    const native = new ComputeEngine();
    for (const [f, lo, hi] of [
      [["Divide", ["Sin", "t"], ["Add", "t", 1]], 0, "PositiveInfinity"],
      [["Divide", ["Sin", "t"], "t"], 0, 1],
    ] as const)
      expect(integrate(f, lo, hi).json).toEqual(
        native.box(["Integrate", f, ["Limits", "t", lo, hi]] as never).N().json,
      );
    expect(ce.box(["Integrate", ["Sin", "t"], ["Limits", "t", 0, 1]] as never).evaluate().json).toEqual(
      native.box(["Integrate", ["Sin", "t"], ["Limits", "t", 0, 1]] as never).evaluate().json,
    );
  });

  test("a divergent integral has no estimate", () => {
    expect(typeof integrateSemiInfiniteOscillatory((t) => (Math.sin(t) / Math.sqrt(Math.sqrt(t))) * t, 0)).not.toBe(
      "object",
    );
  });

  // ∫₀^∞ sin t·cos 3t/t = 0; the beating lobes settle the lobe sum 6e-6 off with a 7e-10 spread.
  test("beating lobes stay unevaluated", () => {
    const f = ["Divide", ["Multiply", ["Sin", "t"], ["Cos", ["Multiply", 3, "t"]]], "t"];
    expect(integrate(f, 0, "PositiveInfinity").operator).toBe("Integrate");
  });
});

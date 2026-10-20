import { ComputeEngine } from "@cortex-js/compute-engine";
import { describe, expect, test } from "vite-plus/test";
import { applyAllPatches } from "../src/index.ts";

const ce = new ComputeEngine();
applyAllPatches(ce);

// Past |z| = 1 at a negative a, native's imaginary part is rounding noise of the real part once
// the true one (−sin(πs)·Σ zⁿ(−a−n)^−s) drops under ~1e-13 of the modulus: decline there.
describe("LERCH PHI imaginary part below native's noise", () => {
  for (const z of [-9000, -900000, -90])
    test(`Φ(${z}, −1e−12, −3) stays unevaluated`, () => {
      expect(ce.box(["N", ["LerchPhi", z, -1e-12, -3]]).evaluate().operator).toBe("LerchPhi");
    });

  test("a resolvable imaginary part is kept", () => {
    const r = ce.box(["N", ["LerchPhi", -2, -1e-12, -3]]).evaluate();
    expect(r.re).toBeCloseTo(8.3333333333, 8);
    expect(r.im).toBeCloseTo(9.42e-12, 13);
  });

  test("a real value (positive a) is kept", () => {
    expect(ce.box(["N", ["LerchPhi", -9000, -1e-12, 2]]).evaluate().operator).not.toBe("LerchPhi");
  });
});

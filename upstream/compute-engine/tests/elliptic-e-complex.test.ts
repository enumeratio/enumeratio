import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyPatch, ellipticEComplex } from "../src/index.ts";

// EllipticE(m) at a complex modulus. The full oracle comparison (mpmath and a Wolfram
// kernel) lives beside the reference entries, in
// packages/reference/tests/upstream-elliptic-e-complex-golden.test.ts.

const ce = new ComputeEngine();
applyPatch(ce, ellipticEComplex);

test("EllipticE(m) at real m is untouched by the patch -- matches the two-argument reduction", () => {
  for (const m of [0.3, 0.7, -0.5]) {
    const viaPatched = ce.box(["EllipticE", m]).N().re;
    const viaIncomplete = ce.box(["EllipticE", ["Divide", "Pi", 2], m]).N().re;
    expect(viaPatched).toBeCloseTo(viaIncomplete, 13);
  }
});

test("EllipticE(m) stays symbolic under plain evaluate at a symbolic or exact argument", () => {
  expect(ce.box(["EllipticE", "x"]).evaluate().json).toEqual(["EllipticE", "x"]);
});

test("applying twice is a no-op", () => {
  applyPatch(ce, ellipticEComplex);
  const r = ce.box(["EllipticE", ce.complex(0.57, 0.23)]).N();
  expect(r.re).toBeCloseTo(1.3248077726970517, 10);
});

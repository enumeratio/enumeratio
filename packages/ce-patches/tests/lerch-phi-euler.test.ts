import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyAllPatches, lerchPhiReal } from "../src/index.ts";

// Real z < 0 goes through the van Wijngaarden Euler transform. For s = -1 the sum has the closed
// form Φ(z, -1, a) = a/(1-z) + z/(1-z)², which an early stop of the transform used to miss
// (Φ(-1/3, -1, 1) came back 0.56173 for 0.5625). Measured against mpmath on a grid of
// z ∈ [-1, -0.001], s ∈ [-6.5, 12], a ∈ [0.05, 20]: worst relative error 3e-12 (near zero
// crossings, from cancellation in the terms), median 2e-16.

const closed = (z: number, a: number): number => a / (1 - z) + z / (1 - z) ** 2;

test("Φ(z, -1, a) matches its closed form at real z < 0", () => {
  for (const z of [-1 / 3, -0.2, -0.5, -0.9]) {
    for (const a of [0.5, 1, 1.5, 3]) {
      const expected = closed(z, a);
      expect(Math.abs(lerchPhiReal(z, -1, a) - expected)).toBeLessThan(1e-13 * (1 + Math.abs(expected)));
    }
  }
});

test("the evaluate, parse and .N routes agree on Φ(-1/3, -1, 1)", () => {
  const ce = new ComputeEngine();
  applyAllPatches(ce);
  const call = ["LerchPhi", ["Rational", -1, 3], -1, 1];
  expect(ce.box(call as never).N().re).toBeCloseTo(0.5625, 14);
  expect(ce.parse("\\operatorname{LerchPhi}(-\\frac13,-1,1)").N().re).toBeCloseTo(0.5625, 14);
  expect(lerchPhiReal(-1 / 3, -1, 1)).toBeCloseTo(0.5625, 14);
});

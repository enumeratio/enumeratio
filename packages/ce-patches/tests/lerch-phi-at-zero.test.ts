import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyAllPatches } from "../src/index.ts";

// Φ(0, s, a) = a^(−s). A negative base to a non-integer float power is complex on the principal
// branch (mpmath: −0.05399760899362249 − 0.004079056397704415i); compute-engine's own Power and
// LerchPhi read it as a real odd root and return 0.05415….
const expected = { re: -0.05399760899362249, im: -0.004079056397704415 };

test("Φ(0, 2.976, −2.664) takes the principal branch on evaluate and .N()", () => {
  const ce = new ComputeEngine();
  applyAllPatches(ce);
  for (const call of [
    ["LerchPhi", 0, 2.976, -2.664],
    ["LerchPhi", ["Complex", 0, 0], 2.976, -2.664],
  ]) {
    for (const value of [ce.box(call as never).evaluate(), ce.box(call as never).N()]) {
      expect(value.re).toBeCloseTo(expected.re, 14);
      expect(value.im).toBeCloseTo(expected.im, 14);
    }
  }
});

test("an exact power or an integer order still evaluates exactly", () => {
  const ce = new ComputeEngine();
  applyAllPatches(ce);
  expect(ce.box(["LerchPhi", 0, 2, -3] as never).evaluate().json).toEqual(["Rational", 1, 9]);
  expect(ce.box(["LerchPhi", 0, ["Rational", 3, 2], -2] as never).N().im).toBeCloseTo(0.3535533905932738, 14);
});

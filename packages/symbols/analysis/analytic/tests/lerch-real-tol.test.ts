import { expect, test } from "vite-plus/test";
import { lerchPhiRealF32, makeJitter } from "../scripts/lerch-f32.ts";
import { zetaWGSL } from "../src/shader.ts";

const tol = Number(/const LERCH_REAL_TOL: f32 = ([0-9.e-]+);/.exec(zetaWGSL)![1]);

test("the f32 emulation reads measured noise as real", () => {
  // Worst noise points of the measurement grid (scripts/lerch-real-tol.ts), at ±2 ulp.
  for (const [z, s, a] of [
    [-0.9, -7, -4.7],
    [-0.9, 14, -1.5],
    [0.5, 3, -2.5],
    [0.5, 2.5, 1],
  ] as const) {
    expect(lerchPhiRealF32(z, s, a, tol, makeJitter(2))).not.toBeNaN();
  }
});

test("the f32 emulation declines complex values over the threshold", () => {
  // z = 0: Φ = a^-s, with Im/Re = |tan(πδ)| for s = 2 + δ at a = -1.5.
  expect(lerchPhiRealF32(0, 2 + 5e-5, -1.5, tol)).not.toBeNaN(); // ratio ~1.6e-4, under tol
  expect(lerchPhiRealF32(0, 2 + 2e-4, -1.5, tol)).toBeNaN(); // ratio ~6.3e-4, over tol
  expect(lerchPhiRealF32(0, -2.976, -2.664, tol)).toBeNaN(); // ratio 0.08
});

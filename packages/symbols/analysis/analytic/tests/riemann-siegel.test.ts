import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// RiemannSiegelTheta, RiemannSiegelZ, RiemannZetaZero. mpmath (`siegeltheta`, `siegelz`,
// `zetazero`) and a Wolfram kernel (`RiemannSiegelTheta`, `RiemannSiegelZ`, `ZetaZero`)
// values are pinned as examples on each head's record. Both reuse the existing log-gamma
// (loggamma.ts) and generalized-zeta (hurwitz-zeta.ts) kernels, so this file is only
// pinning the theta/Z/zero-finding logic layered on top of them.

const ce = new ComputeEngine();
declareAnalytic(ce);

test("RiemannZetaZero: real part is exactly 1/2", () => {
  for (const k of [1, 2, 10, 50]) {
    expect(ce.box(["RiemannZetaZero", k]).N().re, `k=${k}`).toBe(0.5);
  }
});

test("RiemannSiegelTheta(0) is exact — no N() needed", () => {
  expect(ce.box(["RiemannSiegelTheta", 0]).evaluate().json).toEqual(0);
});

test("RiemannZetaZero declines (stays symbolic) for k = 0", () => {
  expect(ce.box(["RiemannZetaZero", 0]).N().operator).toBe("RiemannZetaZero");
});

test("RiemannZetaZero(-k) is the conjugate of RiemannZetaZero(k)", () => {
  const z = ce.box(["RiemannZetaZero", -3]).N();
  expect(z.re).toBe(0.5);
  expect(z.im).toBe(-ce.box(["RiemannZetaZero", 3]).N().im);
});

test("RiemannSiegelZ continues to complex t (Wolfram: -0.5893 - 0.1041i at 4 + i)", () => {
  const z = ce.box(["RiemannSiegelZ", ["Complex", 4, 1]]).N();
  expect(z.re).toBeCloseTo(-0.5892999749710801, 12);
  expect(z.im).toBeCloseTo(-0.1041331674965732, 12);
});

test("the double-only kernels decline an explicit digit count past a double's", () => {
  expect(ce.box(["N", ["RiemannSiegelZ", ["Rational", 5, 4]], 30]).evaluate().operator).toBe("RiemannSiegelZ");
  expect(ce.box(["N", ["RiemannZetaZero", 2], 30]).evaluate().operator).toBe("RiemannZetaZero");
});

test("RiemannZetaZero rejects a non-integer k as a type error, per its declared signature", () => {
  expect(ce.box(["RiemannZetaZero", 1.5]).N().operator).toBe("Error");
});

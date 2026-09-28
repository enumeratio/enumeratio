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

test("RiemannZetaZero declines (stays symbolic) for k < 1", () => {
  expect(ce.box(["RiemannZetaZero", 0]).N().operator).toBe("RiemannZetaZero");
  expect(ce.box(["RiemannZetaZero", -1]).N().operator).toBe("RiemannZetaZero");
});

test("RiemannZetaZero rejects a non-integer k as a type error, per its declared signature", () => {
  expect(ce.box(["RiemannZetaZero", 1.5]).N().operator).toBe("Error");
});

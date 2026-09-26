import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// DigammaFunctionZero(n) — see digamma-zero.ts for the bisection over ψ's monotone
// intervals. mpmath's `findroot(digamma, …)` values from the same intervals are pinned
// as examples on the head's record; fungrim:3f15eb is checked directly below (ψ at its
// own claimed zero).

const ce = new ComputeEngine();
declareAnalytic(ce);

test("fungrim:3f15eb — Digamma(DigammaFunctionZero(n)) = 0", () => {
  for (const n of [0, 1, 2, 3, 4]) {
    const zero = ce.box(["DigammaFunctionZero", n]).N().re;
    const psi = ce.box(["Digamma", zero]).N().re;
    expect(Math.abs(psi)).toBeLessThan(1e-8);
  }
});

test("declines a negative index", () => {
  expect(ce.box(["DigammaFunctionZero", -1]).N().operator).toBe("DigammaFunctionZero");
});

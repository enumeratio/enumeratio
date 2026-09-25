import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// DigammaFunctionZero(n) — see digamma-zero.ts for the bisection over ψ's monotone
// intervals. Golden values are mpmath's `findroot(digamma, …)` from the same
// intervals; fungrim:3f15eb is checked directly below (ψ at its own claimed zero).

const ce = new ComputeEngine();
declareAnalytic(ce);

interface GoldenCase {
  head: string;
  args: unknown[];
  label: string;
  tol: number;
  mpmath: [number, number];
}

const goldens: GoldenCase[] = JSON.parse(readFileSync(new URL("./digamma-zero.golden.json", import.meta.url), "utf8"));

test("DigammaFunctionZero matches mpmath.findroot(digamma, ...)", () => {
  const off: string[] = [];
  for (const g of goldens) {
    const r = ce.box([g.head, ...g.args] as never).N();
    const err = Math.abs(r.re - g.mpmath[0]);
    if (!(err <= g.tol)) off.push(`${g.label}: got ${r.re}, expected ${g.mpmath[0]} (err ${err})`);
  }
  expect(off).toEqual([]);
});

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

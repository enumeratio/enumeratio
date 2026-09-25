import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// KeiperLiLambda(n) — the Keiper–Li coefficients (see keiper-li.ts for the contour-
// differentiation kernel). Golden values are an independent mpmath implementation of
// the same Cauchy-formula contour integral (radius 1, 256 points) at 60-digit
// precision, not a re-run of our own float64 code — see .scratch/gen-keiper-goldens.py
// (not committed; regenerate with mpmath if these ever need to move).

const ce = new ComputeEngine();
declareAnalytic(ce);

interface GoldenCase {
  n: number;
  mpmath: number;
  tol: number;
}

const goldens: GoldenCase[] = JSON.parse(readFileSync(new URL("./keiper-li.golden.json", import.meta.url), "utf8"));

test("KeiperLiLambda(n) matches the mpmath contour-integral oracle for n = 0..20", () => {
  const off: string[] = [];
  for (const g of goldens) {
    const r = ce.box(["N", ["KeiperLiLambda", g.n]]).evaluate();
    const err = Math.abs(r.re - g.mpmath);
    if (!(err <= g.tol)) off.push(`n=${g.n}: got ${r.re}, expected ${g.mpmath} (err ${err})`);
  }
  expect(off).toEqual([]);
});

test("KeiperLiLambda(0) = 0 and KeiperLiLambda(1) = 1 + γ/2 - ½ln(4π), both exact under plain evaluate", () => {
  expect(ce.box(["KeiperLiLambda", 0]).evaluate().re).toBe(0);
  const lambda1 = ce.box(["KeiperLiLambda", 1]).N().re;
  const closedForm = 1 + 0.5772156649015329 / 2 - 0.5 * Math.log(4 * Math.PI);
  expect(lambda1).toBeCloseTo(closedForm, 12);
});

test("declines n beyond MAX_N, a negative n, and a non-integer/symbolic n", () => {
  expect(ce.box(["KeiperLiLambda", 21]).N().operator).toBe("KeiperLiLambda");
  expect(ce.box(["KeiperLiLambda", -1]).N().operator).toBe("KeiperLiLambda");
  expect(ce.box(["KeiperLiLambda", "n"]).evaluate().json).toEqual(["KeiperLiLambda", "n"]);
});

test("stays symbolic under plain evaluate at n ≥ 2 without N(); N() forces the numeric answer", () => {
  expect(ce.box(["KeiperLiLambda", 3]).evaluate().operator).toBe("KeiperLiLambda");
  expect(ce.box(["N", ["KeiperLiLambda", 3]]).evaluate().re).toBeCloseTo(0.2076389205543248, 9);
});

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// #113 "wrong answers today" (§7): HarmonicNumber(2.5, 1), LogGamma(10^300) and
// Rationalize(Pi, 0.001) each had a wrong or non-finite value. Every value here was
// checked against `wolframscript` and mpmath before being wired up — see
// precision-113.ts for the derivations.

const ce = new ComputeEngine();
declareAnalytic(ce);

test("LogGamma(10^300) uses Stirling directly, not Gamma(10^300) first", () => {
  ce.precision = 15;
  // wolframscript: N[LogGamma[10^300], 30] = 6.897755278982137052053974364...e302
  const r = ce.box(["N", ["LogGamma", ["Power", 10, 300]]]).evaluate();
  expect(Number.isFinite(r.re)).toBe(true);
  expect(r.re / 6.897755278982137e302).toBeCloseTo(1, 12); // agrees to a double's precision
  // prints as a double, not a 303-digit exact-integer expansion of that double's bits
  expect(r.toString().length).toBeLessThan(25);
});

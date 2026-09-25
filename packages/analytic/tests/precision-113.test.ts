import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// #113 "wrong answers today" (§7): HarmonicNumber(2.5, 1), LogGamma(10^300) and
// Rationalize(Pi, 0.001) each had a wrong or non-finite value. Every value here was
// checked against `wolframscript` and mpmath before being wired up — see
// precision-113.ts for the derivations.

const ce = new ComputeEngine();
declareAnalytic(ce);

test("HarmonicNumber(z, 1) is H_z, not the ζ(1) pole", () => {
  ce.precision = 15;
  // wolframscript: N[HarmonicNumber[5/2, 1], 20] = 1.68037230554677604783
  const r = ce.box(["N", ["HarmonicNumber", 2.5, 1]]).evaluate();
  expect(r.re).toBeCloseTo(1.680372305546776, 14);
  // order 1 still agrees with the exact one-argument case at an integer
  expect(ce.box(["HarmonicNumber", 10, 1]).evaluate().json).toEqual(["Rational", 7381, 2520]);
  // every other order is untouched
  expect(ce.box(["HarmonicNumber", 5, -1]).evaluate().json).toEqual(15);
});

test("LogGamma(10^300) uses Stirling directly, not Gamma(10^300) first", () => {
  ce.precision = 15;
  // wolframscript: N[LogGamma[10^300], 30] = 6.897755278982137052053974364...e302
  const r = ce.box(["N", ["LogGamma", ["Power", 10, 300]]]).evaluate();
  expect(Number.isFinite(r.re)).toBe(true);
  expect(r.re / 6.897755278982137e302).toBeCloseTo(1, 12); // agrees to a double's precision
  // small arguments, and the actual poles, are unaffected
  expect(ce.box(["LogGamma", 5]).evaluate().json).toEqual([
    "Add",
    ["Multiply", 3, ["Ln", 2]],
    ["Ln", 3],
  ]);
  expect(ce.box(["LogGamma", 0]).evaluate().json).toEqual("PositiveInfinity");
  expect(ce.box(["LogGamma", -3]).evaluate().json).toEqual("PositiveInfinity");
});

test("Rationalize(Pi, tolerance) finds the smallest denominator, not the closest convergent", () => {
  // wolframscript: Rationalize[Pi, 0.001] = 201/64 (not 333/106, the closer convergent)
  expect(ce.box(["Rationalize", "Pi", 0.001]).evaluate().json).toEqual(["Rational", 201, 64]);
  // existing convergent-and-simplest-agree cases are unaffected
  expect(ce.box(["Rationalize", "Pi", 0.01]).evaluate().json).toEqual(["Rational", 22, 7]);
  expect(ce.box(["Rationalize", "Pi", 0.000001]).evaluate().json).toEqual(["Rational", 355, 113]);
  expect(ce.box(["Rationalize", ["Sqrt", 2], 0.001]).evaluate().json).toEqual(["Rational", 41, 29]);
  // a loose tolerance spanning 0 still snaps to the integer, not Rational(0, 1)
  expect(ce.box(["Rationalize", 0.1, 0.5]).evaluate().json).toEqual(0);
  // an already-exact value is returned unchanged
  expect(ce.box(["Rationalize", ["Rational", 1, 3], 0.1]).evaluate().json).toEqual([
    "Rational",
    1,
    3,
  ]);
});

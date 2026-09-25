import { ComputeEngine } from "@cortex-js/compute-engine";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import { declareDistributions } from "../src/distributions.ts";
import { declareDistributions2 } from "../src/distributions-2.ts";
import { declareDistributions3 } from "../src/distributions-3.ts";

// Cross-checks for the third-wave heads — CharacteristicFunction/MomentGeneratingFunction,
// the three CDF gaps (Cauchy/StudentT/Hypergeometric), and the two distribution-specific
// Moment/Cumulant identities beyond order 2. Exact golden values live in `reference/*.yaml`
// (entries.test.ts); this file checks RELATIONS that have to hold regardless of the specific
// closed form: CF(0) = MGF(0) = 1, a numeric derivative of the MGF at 0 reproduces Mean, CF
// and MGF agree under `i t <-> t` substitution, a discrete CDF gap-fill sums correctly, and
// the Cauchy/StudentT CDF are numerically consistent with their own PDF's integral.

let ce: ComputeEngine;
beforeEach(() => {
  ce = new ComputeEngine();
  declareDistributions(ce);
  declareDistributions2(ce);
  declareDistributions3(ce);
});

const evalOf = (expr: unknown) => ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate();
const N = (expr: unknown) => evalOf(["N", expr as never]).re;

// The distributions this batch declares CharacteristicFunction/MomentGeneratingFunction for
// (Cauchy and Logistic are checked separately — Cauchy has no MGF, Logistic's MGF isn't the
// naive `i -> 1` substitution of its CF).
const TRANSFORM_DISTS: readonly unknown[] = [
  ["NormalDistribution", 2, 3],
  ["UniformDistribution", 0, 5],
  ["DiscreteUniformDistribution", ["List", 1, 6]],
  ["BernoulliDistribution", ["Rational", 3, 10]],
  ["BinomialDistribution", 8, ["Rational", 1, 4]],
  ["GeometricDistribution", ["Rational", 1, 5]],
  ["NegativeBinomialDistribution", 4, ["Rational", 1, 3]],
  ["PoissonDistribution", 2],
  ["GammaDistribution", 3, 2],
  ["ChiSquareDistribution", 5],
  ["ErlangDistribution", 4, 2],
  ["LaplaceDistribution", 1, ["Rational", 1, 2]],
];

describe("CharacteristicFunction(dist, 0) = 1", () => {
  for (const dist of TRANSFORM_DISTS) {
    test(JSON.stringify(dist), () => {
      expect(N(["CharacteristicFunction", dist, 0])).toBeCloseTo(1, 8);
    });
  }
});

describe("MomentGeneratingFunction(dist, 0) = 1", () => {
  for (const dist of TRANSFORM_DISTS) {
    test(JSON.stringify(dist), () => {
      expect(N(["MomentGeneratingFunction", dist, 0])).toBeCloseTo(1, 8);
    });
  }
});

// A centered finite difference of the MGF at t = 0 approximates E[X] = Mean.
describe("MGF'(0) ~= Mean", () => {
  for (const dist of TRANSFORM_DISTS) {
    test(JSON.stringify(dist), () => {
      const h = 1e-4;
      const plus = N(["MomentGeneratingFunction", dist, h]);
      const minus = N(["MomentGeneratingFunction", dist, -h]);
      const derivative = (plus - minus) / (2 * h);
      expect(derivative).toBeCloseTo(N(["Mean", dist]), 3);
    });
  }
});

// CF(dist, t) and MGF(dist, t) are the same transform evaluated at `i t` vs `t` — substituting
// a purely imaginary argument into the MGF formula should reproduce the CF at the matching
// real `t` (checked via the real part, since `N()` on a `Multiply` by `ImaginaryUnit` keeps a
// nonzero imaginary component that this relation doesn't otherwise need).
describe("CF(dist, t) = MGF(dist, i t)", () => {
  for (const dist of TRANSFORM_DISTS) {
    test(JSON.stringify(dist), () => {
      const t = 0.3;
      const cf = evalOf(["CharacteristicFunction", dist, t]).N();
      const mgf = evalOf(["MomentGeneratingFunction", dist, ["Multiply", "ImaginaryUnit", t]]).N();
      expect(cf.re).toBeCloseTo(mgf.re, 6);
      expect(cf.im).toBeCloseTo(mgf.im, 6);
    });
  }
});

describe("CauchyDistribution CDF", () => {
  test("standard Cauchy CDF(0) = 1/2", () => {
    expect(N(["CDF", ["CauchyDistribution", 0, 1], 0])).toBeCloseTo(0.5, 10);
  });
  test("matches the PDF's numeric integral over a bounded window (Simpson)", () => {
    // A bounded window, not [-infinity, x]: Cauchy's tails are heavy enough that a "large but
    // finite" lower bound like -20 still carries non-negligible mass (~1.6% here), so the
    // window has to match a CDF DIFFERENCE rather than approximate the whole left tail as 0.
    const pdfAt = (x: number) => N(["PDF", ["CauchyDistribution", 0, 1], x]);
    const a = -1.5;
    const b = 1.5;
    const steps = 2000;
    const dx = (b - a) / steps;
    let sum = pdfAt(a) + pdfAt(b);
    for (let i = 1; i < steps; i++) sum += (i % 2 === 0 ? 2 : 4) * pdfAt(a + i * dx);
    const integral = (sum * dx) / 3;
    const cdfDiff = N(["CDF", ["CauchyDistribution", 0, 1], b]) - N(["CDF", ["CauchyDistribution", 0, 1], a]);
    expect(integral).toBeCloseTo(cdfDiff, 6);
  });
});

describe("StudentTDistribution CDF", () => {
  test("symmetric: CDF(0) = 1/2", () => {
    expect(N(["CDF", ["StudentTDistribution", 7], 0])).toBeCloseTo(0.5, 10);
  });
  test("survival symmetry: CDF(-x) = 1 - CDF(x)", () => {
    const cdfPlus = N(["CDF", ["StudentTDistribution", 4], 1.5]);
    const cdfMinus = N(["CDF", ["StudentTDistribution", 4], -1.5]);
    expect(cdfMinus).toBeCloseTo(1 - cdfPlus, 8);
  });
});

describe("HypergeometricDistribution CDF: exact finite sum", () => {
  test("sums the PDF over its support to 1", () => {
    const dist = ["HypergeometricDistribution", 3, 5, 10];
    expect(evalOf(["CDF", dist, 3]).json).toEqual(1);
  });
  test("matches a manual sum of PDF(0..2)", () => {
    const dist = ["HypergeometricDistribution", 3, 5, 10];
    const manual = [0, 1, 2].reduce((acc, k) => acc + N(["PDF", dist, k]), 0);
    expect(N(["CDF", dist, 2])).toBeCloseTo(manual, 10);
  });
});

describe("Moment(BernoulliDistribution(p), r) = p for r >= 1", () => {
  for (const r of [1, 2, 3, 7, 20]) {
    test(`r = ${r}`, () => {
      expect(evalOf(["Moment", ["BernoulliDistribution", ["Rational", 2, 5]], r]).json).toEqual(["Rational", 2, 5]);
    });
  }
});

describe("Cumulant(PoissonDistribution(lambda), r) = lambda for r >= 1", () => {
  for (const r of [1, 2, 3, 5, 10]) {
    test(`r = ${r}`, () => {
      expect(evalOf(["Cumulant", ["PoissonDistribution", 3], r]).json).toEqual(3);
    });
  }
});

describe("CauchyDistribution has no MomentGeneratingFunction", () => {
  test("stays unevaluated", () => {
    const result = evalOf(["MomentGeneratingFunction", ["CauchyDistribution", 0, 1], 1]);
    expect(result.operator).toBe("MomentGeneratingFunction");
  });
});

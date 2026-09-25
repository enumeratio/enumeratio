import { ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import { declareDistributions } from "../src/distributions.ts";
import { declareDistributions2 } from "../src/distributions-2.ts";

// Cross-checks for the second-wave distribution and property-function heads — the exact
// golden values themselves live in `reference/*.yaml` (run through `entries.test.ts`); this
// file instead checks the RELATIONS that have to hold regardless of which distribution:
// Mean = Moment(_, 1), Variance = CentralMoment(_, 2), CDF(InverseCDF(_, q)) ≈ q, a discrete
// PDF summing to 1 over its support, RandomVariate's seeded reproducibility.

let ce: ComputeEngine;
beforeEach(() => {
  ce = new ComputeEngine();
  declareDistributions(ce);
  declareDistributions2(ce);
});

const evalOf = (expr: unknown) => ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate();
const N = (expr: unknown) => evalOf(["N", expr as never]).re;

const CONTINUOUS_DISTS: readonly unknown[] = [
  ["ChiSquareDistribution", 3],
  ["LogNormalDistribution", 0, 1],
  ["WeibullDistribution", 2, 5],
  ["LaplaceDistribution", 0, ["Rational", 1, 2]],
  ["RayleighDistribution", 3],
  ["ParetoDistribution", 1, 3],
  ["LogisticDistribution", 0, 1],
  ["ErlangDistribution", 3, 2],
  ["ChiDistribution", 3],
  ["HalfNormalDistribution", 1],
  ["MaxwellDistribution", 1],
];

describe("Mean = Moment(_, 1), Variance = CentralMoment(_, 2)", () => {
  for (const dist of CONTINUOUS_DISTS) {
    test(JSON.stringify(dist), () => {
      expect(N(["Moment", dist, 1])).toBeCloseTo(N(["Mean", dist]), 10);
      expect(N(["CentralMoment", dist, 2])).toBeCloseTo(N(["Variance", dist]), 10);
      expect(N(["Cumulant", dist, 1])).toBeCloseTo(N(["Mean", dist]), 10);
      expect(N(["Cumulant", dist, 2])).toBeCloseTo(N(["Variance", dist]), 10);
    });
  }
});

describe("SurvivalFunction = 1 - CDF, HazardFunction = PDF / SurvivalFunction", () => {
  for (const dist of CONTINUOUS_DISTS) {
    test(JSON.stringify(dist), () => {
      const x = 2;
      const survival = N(["SurvivalFunction", dist, x]);
      expect(survival).toBeCloseTo(1 - N(["CDF", dist, x]), 10);
      expect(N(["HazardFunction", dist, x])).toBeCloseTo(N(["PDF", dist, x]) / survival, 8);
    });
  }
});

describe("InverseCDF: CDF(InverseCDF(dist, q)) = q", () => {
  const cases: [unknown, number][] = [
    [["ChiSquareDistribution", 3], 0.3],
    [["WeibullDistribution", 2, 5], 0.7],
    [["LogisticDistribution", 0, 1], 0.42],
    [["NormalDistribution", 0, 1], 0.05],
  ];
  for (const [dist, q] of cases) {
    test(`${JSON.stringify(dist)} at q=${q}`, () => {
      const x = N(["InverseCDF", dist, q]);
      expect(N(["CDF", dist, x])).toBeCloseTo(q, 6);
    });
  }
});

describe("discrete PDFs sum to 1 over their (finite or truncated) support", () => {
  test("DiscreteUniformDistribution({1, 6})", () => {
    let total = 0;
    for (let k = 1; k <= 6; k++)
      total += N(["PDF", ["DiscreteUniformDistribution", ["List", 1, 6]], k]);
    expect(total).toBeCloseTo(1, 10);
  });

  test("HypergeometricDistribution(20, 50, 100)", () => {
    let total = 0;
    for (let k = 0; k <= 20; k++)
      total += N(["PDF", ["HypergeometricDistribution", 20, 50, 100], k]);
    expect(total).toBeCloseTo(1, 8);
  });

  test("BernoulliDistribution(1/3)", () => {
    const p0 = N(["PDF", ["BernoulliDistribution", ["Rational", 1, 3]], 0]);
    const p1 = N(["PDF", ["BernoulliDistribution", ["Rational", 1, 3]], 1]);
    expect(p0 + p1).toBeCloseTo(1, 10);
  });

  test("GeometricDistribution(1/4), truncated to the first 200 terms", () => {
    let total = 0;
    for (let k = 0; k < 200; k++)
      total += N(["PDF", ["GeometricDistribution", ["Rational", 1, 4]], k]);
    expect(total).toBeCloseTo(1, 6);
  });
});

describe("RandomVariate: seeded reproducibility for the second-wave kinds", () => {
  test("same seed, same draw", () => {
    const draw = (dist: unknown) => {
      evalOf(["SeedRandom", 7]);
      return evalOf(["RandomVariate", dist as never]).json;
    };
    for (const dist of [
      ["GeometricDistribution", ["Rational", 1, 4]],
      ["WeibullDistribution", 2, 5],
      ["HypergeometricDistribution", 20, 50, 100],
    ]) {
      expect(draw(dist)).toEqual(draw(dist));
    }
  });

  test("RandomVariate(dist, n) draws land within the distribution's own support", () => {
    evalOf(["SeedRandom", 3]);
    const draws = evalOf(["RandomVariate", ["ParetoDistribution", 1, 3], 50]);
    for (const d of operandsOf(draws)) expect(d.re).toBeGreaterThanOrEqual(1);
  });
});

describe("CauchyDistribution's zero-argument default", () => {
  test("is the standard Cauchy(0, 1)", () => {
    expect(evalOf(["CauchyDistribution"]).json).toEqual(["CauchyDistribution", 0, 1]);
  });
});

describe("Moment/CentralMoment/FactorialMoment/Cumulant: higher orders stay unevaluated", () => {
  test("order 3 doesn't fake an answer", () => {
    const dist = ["ChiSquareDistribution", 3];
    expect(evalOf(["Moment", dist, 3]).operator).toBe("Moment");
    expect(evalOf(["CentralMoment", dist, 3]).operator).toBe("CentralMoment");
    expect(evalOf(["FactorialMoment", dist, 3]).operator).toBe("FactorialMoment");
    expect(evalOf(["Cumulant", dist, 3]).operator).toBe("Cumulant");
  });
});

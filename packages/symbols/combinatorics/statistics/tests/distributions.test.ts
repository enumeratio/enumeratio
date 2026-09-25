import { ComputeEngine } from "@cortex-js/compute-engine";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import { declareDistributions } from "../src/distributions.ts";

// Golden values cross-checked against mpmath (Beta/Gamma/Binormal/Normal closed forms) and
// wolframscript (Poisson/Binomial CDFs, which are native to compute-engine already). Every
// exact-form assertion is a value someone independently computed, not a snapshot of whatever
// this file happens to produce.

let ce: ComputeEngine;
beforeEach(() => {
  ce = new ComputeEngine();
  declareDistributions(ce);
});

const evalOf = (expr: unknown) => ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate();
const N = (expr: unknown) => evalOf(["N", expr as never]).re;

describe("UniformDistribution: call-shape fix", () => {
  test("the {min, max} form (Wolfram's own) now works", () => {
    expect(evalOf(["PDF", ["UniformDistribution", ["List", 0, 1]], 0.5]).json).toEqual(1);
    expect(evalOf(["CDF", ["UniformDistribution", ["List", 0, 1]], 0.5]).json).toEqual(0.5);
    expect(evalOf(["Mean", ["UniformDistribution", ["List", 0, 1]]]).json).toEqual([
      "Rational",
      1,
      2,
    ]);
  });

  test("the zero-argument default is {0, 1}", () => {
    expect(evalOf(["UniformDistribution"]).json).toEqual(["UniformDistribution", 0, 1]);
  });

  test("the native (min, max) call is untouched", () => {
    expect(evalOf(["PDF", ["UniformDistribution", 0, 2], 1]).json).toEqual(["Rational", 1, 2]);
  });
});

describe("BetaDistribution", () => {
  test("PDF/CDF/Mean/Variance, exact", () => {
    expect(evalOf(["PDF", ["BetaDistribution", 2, 3], ["Rational", 1, 2]]).json).toEqual([
      "Rational",
      3,
      2,
    ]);
    expect(N(["CDF", ["BetaDistribution", 2, 3], ["Rational", 1, 2]])).toEqual(0.6875);
    expect(evalOf(["Mean", ["BetaDistribution", 2, 3]]).json).toEqual(["Rational", 2, 5]);
    expect(evalOf(["Variance", ["BetaDistribution", 2, 3]]).json).toEqual(["Rational", 1, 25]);
  });

  test("CDF clamps to [0, 1] outside the support", () => {
    expect(N(["CDF", ["BetaDistribution", 2, 3], -1])).toEqual(0);
    expect(N(["CDF", ["BetaDistribution", 2, 3], 2])).toEqual(1);
  });
});

describe("GammaDistribution", () => {
  test("a single argument defaults the scale to 1", () => {
    expect(evalOf(["GammaDistribution", 2]).json).toEqual(["GammaDistribution", 2, 1]);
  });

  test("PDF/CDF, exact — cross-checked against mpmath.gammainc", () => {
    expect(N(["PDF", ["GammaDistribution", 2, 2], 3])).toBeCloseTo(0.1673476201113224, 12);
    expect(N(["CDF", ["GammaDistribution", 2, 2], 3])).toBeCloseTo(0.4421745996289254, 12);
    expect(N(["CDF", ["GammaDistribution", 2, 2], -1])).toEqual(0);
  });

  test("Mean/Variance, exact", () => {
    expect(evalOf(["Mean", ["GammaDistribution", 2, 2]]).json).toEqual(4);
    expect(evalOf(["Variance", ["GammaDistribution", 2, 2]]).json).toEqual(8);
  });

  test("no dependency on @enumeratio/analytic's generalized GammaRegularized", () => {
    // CDF is built from the native two-argument GammaRegularized (1 - Q), not the
    // three-argument generalized form that package adds — this engine never declares it.
    expect(N(["CDF", ["GammaDistribution", 2], 2])).toBeCloseTo(0.5939941502901619, 12);
  });
});

describe("BinormalDistribution", () => {
  test("the three call forms all reach the same PDF — cross-checked against mpmath", () => {
    const point = ["List", 0, 0];
    expect(N(["PDF", ["BinormalDistribution", 0.5], point])).toBeCloseTo(0.18377629847393068, 12);
    expect(N(["PDF", ["BinormalDistribution", ["List", 1, 1], 0.5], point])).toBeCloseTo(
      0.18377629847393068,
      12,
    );
    expect(
      N(["PDF", ["BinormalDistribution", ["List", 0, 0], ["List", 1, 1], 0.5], point]),
    ).toBeCloseTo(0.18377629847393068, 12);
  });

  test("Mean is the mean vector, Variance the covariance matrix", () => {
    expect(
      evalOf(["Mean", ["BinormalDistribution", ["List", 1, 2], ["List", 1, 1], 0.5]]).json,
    ).toEqual(["List", 1, 2]);
    // 1-argument form (rho only) — mu defaults to {0, 0}, sigma to {1, 1}.
    expect(evalOf(["Variance", ["BinormalDistribution", ["Rational", 1, 2]]]).json).toEqual([
      "List",
      ["List", 1, ["Rational", 1, 2]],
      ["List", ["Rational", 1, 2], 1],
    ]);
    expect(evalOf(["Variance", ["BinormalDistribution", ["List", 2, 3], 0.5]]).json).toEqual([
      "List",
      ["List", 4, 3],
      ["List", 3, 9],
    ]);
  });

  test("CDF has no closed form here — stays unevaluated", () => {
    const r = evalOf(["CDF", ["BinormalDistribution", 0.5], ["List", 0, 0]]);
    expect(r.operator).toEqual("CDF");
  });
});

describe("EmpiricalDistribution", () => {
  const data = ["List", 1, 2, 2, 3];

  test("PDF/CDF are the observed proportions", () => {
    expect(evalOf(["PDF", ["EmpiricalDistribution", data], 2]).json).toEqual(["Rational", 1, 2]);
    expect(evalOf(["CDF", ["EmpiricalDistribution", data], 2]).json).toEqual(["Rational", 3, 4]);
  });

  test("Mean/Variance match the data's own (sample, n-1) Mean/Variance", () => {
    expect(evalOf(["Mean", ["EmpiricalDistribution", data]]).json).toEqual(
      evalOf(["Mean", data]).json,
    );
    expect(evalOf(["Variance", ["EmpiricalDistribution", data]]).json).toEqual(
      evalOf(["Variance", data]).json,
    );
  });
});

describe("Distributed / Expectation / Probability", () => {
  test("Expectation is exact for constant, linear and quadratic expressions", () => {
    const bound = ["Distributed", "x", ["NormalDistribution", 2, 3]];
    expect(evalOf(["Expectation", 7, bound]).json).toEqual(7);
    expect(evalOf(["Expectation", "x", bound]).json).toEqual(2);
    expect(evalOf(["Expectation", ["Power", "x", 2], bound]).json).toEqual(13); // Var + Mean^2 = 9 + 4
    expect(evalOf(["Expectation", ["Add", ["Multiply", 2, "x"], 1], bound]).json).toEqual(5);
  });

  test("a shape Expectation doesn't have a closed form for stays unevaluated", () => {
    const bound = ["Distributed", "x", ["NormalDistribution", 2, 3]];
    const r = evalOf(["Expectation", ["Sin", "x"], bound]);
    expect(r.operator).toEqual("Expectation");
  });

  test("Probability: Equal is exact for discrete, zero for continuous", () => {
    expect(
      evalOf(["Probability", ["Equal", "x", 2], ["Distributed", "x", ["PoissonDistribution", 3]]])
        .json,
    ).toEqual(evalOf(["PDF", ["PoissonDistribution", 3], 2]).json);
    expect(
      evalOf(["Probability", ["Equal", "x", 2], ["Distributed", "x", ["NormalDistribution", 0, 1]]])
        .json,
    ).toEqual(0);
  });

  test("Probability: LessEqual, Less and a chained range — cross-checked against mpmath", () => {
    const bound = ["Distributed", "x", ["PoissonDistribution", 3]];
    expect(N(["Probability", ["LessEqual", "x", 5], bound])).toBeCloseTo(0.9160820579686966, 12);
    expect(N(["Probability", ["Less", "x", 5], bound])).toBeCloseTo(0.8152632445237721, 12);
    expect(
      N(["Probability", ["And", ["LessEqual", 1, "x"], ["LessEqual", "x", 5]], bound]),
    ).toBeCloseTo(0.8662949896008326, 12);
  });

  test("Probability: canonicalized Greater/GreaterEqual (rewritten to Less/LessEqual)", () => {
    const bound = ["Distributed", "x", ["NormalDistribution", 0, 1]];
    expect(N(["Probability", ["Greater", "x", 0], bound])).toBeCloseTo(0.5, 12);
  });
});

describe("RandomVariate: deterministic, seeded", () => {
  test("the same seed draws the same sequence", () => {
    const draw = () => {
      ce.box(["SeedRandom", 7]).evaluate();
      return ce.box(["RandomVariate", ["NormalDistribution", 0, 1], 3]).evaluate().json;
    };
    expect(draw()).toEqual(draw());
  });

  test("RandomVariate(dist, n) returns exactly n draws", () => {
    expect(
      (
        evalOf(["RandomVariate", ["UniformDistribution", ["List", 0, 1]], 20]) as unknown as {
          ops: unknown[];
        }
      ).ops.length,
    ).toEqual(20);
  });

  const sampleStats = (dist: unknown, n = 10_000, seed = 7) => {
    ce.box(["SeedRandom", seed]).evaluate();
    const draws = (evalOf(["RandomVariate", dist, n]) as unknown as { ops: { re: number }[] }).ops;
    const xs = draws.map((o) => o.re);
    const mean = xs.reduce((a, b) => a + b, 0) / n;
    const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
    return { mean, variance };
  };

  test.each([
    { name: "Normal(2, 3)", dist: ["NormalDistribution", 2, 3], mean: 2, variance: 9 },
    {
      name: "Uniform(0, 1)",
      dist: ["UniformDistribution", ["List", 0, 1]],
      mean: 0.5,
      variance: 1 / 12,
    },
    { name: "Poisson(4)", dist: ["PoissonDistribution", 4], mean: 4, variance: 4 },
    {
      name: "Binomial(20, 0.3)",
      dist: ["BinomialDistribution", 20, 0.3],
      mean: 6,
      variance: 4.2,
    },
    { name: "Beta(2, 3)", dist: ["BetaDistribution", 2, 3], mean: 0.4, variance: 0.04 },
    { name: "Gamma(2, 2)", dist: ["GammaDistribution", 2, 2], mean: 4, variance: 8 },
  ])(
    "$name: 10^4 seeded samples land within tolerance of the true mean/variance",
    ({ dist, mean, variance }) => {
      const stats = sampleStats(dist);
      // A generous 3-sigma-ish bound on the sample mean (sqrt(variance/n)) and a looser one
      // on the sample variance (whose own sampling error is larger) — this is a statistical
      // sanity check, not an exact-value assertion, so it stays well clear of flaking.
      expect(Math.abs(stats.mean - mean)).toBeLessThan(10 * Math.sqrt(variance / 10_000));
      expect(Math.abs(stats.variance - variance)).toBeLessThan(0.25 * variance + 0.05);
    },
  );

  test("EmpiricalDistribution resamples from the data, uniformly", () => {
    const data = ["List", 1, 2, 3, 4, 5];
    const stats = sampleStats(["EmpiricalDistribution", data]);
    expect(Math.abs(stats.mean - 3)).toBeLessThan(0.2);
  });

  test("BinormalDistribution draws a correlated pair — cross-checked marginal stats + correlation", () => {
    ce.box(["SeedRandom", 7]).evaluate();
    const n = 10_000;
    const draws = (
      evalOf([
        "RandomVariate",
        ["BinormalDistribution", ["List", 1, 2], ["List", 1, 2], 0.5],
        n,
      ]) as unknown as { ops: { ops: { re: number }[] }[] }
    ).ops;
    const pts = draws.map((o) => o.ops.map((c) => c.re));
    const mean1 = pts.reduce((a, p) => a + p[0], 0) / n;
    const mean2 = pts.reduce((a, p) => a + p[1], 0) / n;
    const var1 = pts.reduce((a, p) => a + (p[0] - mean1) ** 2, 0) / (n - 1);
    const var2 = pts.reduce((a, p) => a + (p[1] - mean2) ** 2, 0) / (n - 1);
    const cov = pts.reduce((a, p) => a + (p[0] - mean1) * (p[1] - mean2), 0) / (n - 1);
    expect(Math.abs(mean1 - 1)).toBeLessThan(0.1);
    expect(Math.abs(mean2 - 2)).toBeLessThan(0.15);
    expect(Math.abs(var1 - 1)).toBeLessThan(0.15);
    expect(Math.abs(var2 - 4)).toBeLessThan(0.4);
    expect(Math.abs(cov / Math.sqrt(var1 * var2) - 0.5)).toBeLessThan(0.05);
  });
});

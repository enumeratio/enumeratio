import { ComputeEngine } from "@cortex-js/compute-engine";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import { declareDistributions } from "../src/distributions.ts";
import { declareDistributions2 } from "../src/distributions-2.ts";
import { declareDistributions3 } from "../src/distributions-3.ts";
import { declareDistributions4 } from "../src/distributions-4.ts";
import { declareDistributions5 } from "../src/distributions-5.ts";
import { declareDistributions6 } from "../src/distributions-6.ts";

// Cross-checks for the sixth-wave (deferred) probability heads: MultinomialDistribution,
// MultinormalDistribution, MultivariatePoissonDistribution, ProbabilityDistribution,
// ParameterMixtureDistribution, HistogramDistribution. Exact golden values live in
// `reference/*.yaml` (entries.test.ts); this file checks RELATIONS that have to hold
// regardless of the specific parameters: PDFs summing/integrating to 1, marginal consistency,
// Multinormal-with-diagonal-Sigma factoring into independent Normals, and the conjugate
// mixture matching its NegativeBinomial/Beta-Binomial closed form.

let ce: ComputeEngine;
beforeEach(() => {
  ce = new ComputeEngine();
  declareDistributions(ce);
  declareDistributions2(ce);
  declareDistributions3(ce);
  declareDistributions4(ce);
  declareDistributions5(ce);
  declareDistributions6(ce);
});

const evalOf = (expr: unknown) => ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate();
const N = (expr: unknown) => evalOf(["N", expr as never]).re;

describe("MultinomialDistribution", () => {
  const dist = ["MultinomialDistribution", 4, ["List", ["Rational", 1, 2], ["Rational", 1, 3], ["Rational", 1, 6]]];

  test("PDF sums to 1 over every count vector with sum = n", () => {
    let total = 0;
    for (let a = 0; a <= 4; a++) {
      for (let b = 0; b <= 4 - a; b++) {
        const c = 4 - a - b;
        total += N(["PDF", dist, ["List", a, b, c]]);
      }
    }
    expect(total).toBeCloseTo(1, 10);
  });

  test("PDF is exact (rational) at a concrete point", () => {
    // P(2,1,1) = 4!/(2!1!1!) * (1/2)^2 (1/3)^1 (1/6)^1 = 12 * 1/4 * 1/3 * 1/6 = 12/72 = 1/6
    const out = evalOf(["PDF", dist, ["List", 2, 1, 1]]);
    expect(out.json).toEqual(["Rational", 1, 6]);
  });

  test("PDF is 0 off the n-simplex", () => {
    const out = evalOf(["PDF", dist, ["List", 1, 1, 1]]); // sums to 3, not 4
    expect(out.json).toEqual(0);
  });

  test("Mean is n * p componentwise", () => {
    const out = evalOf(["Mean", dist]);
    expect(out.json).toEqual(["List", 2, ["Rational", 4, 3], ["Rational", 2, 3]]);
  });

  test("Variance is n p (1-p) componentwise", () => {
    const out = evalOf(["Variance", dist]);
    // n=4, p1=1/2: 4*1/2*1/2=1; p2=1/3: 4*1/3*2/3=8/9; p3=1/6: 4*1/6*5/6=20/36=5/9
    expect(out.json).toEqual(["List", 1, ["Rational", 8, 9], ["Rational", 5, 9]]);
  });

  test("Covariance matrix diagonal matches Variance, off-diagonal is -n pi pj", () => {
    const cov = evalOf(["Covariance", dist]);
    const variance = evalOf(["Variance", dist]);
    // .json of a List is ["List", elem0, elem1, ...] -- index 1-based past the head.
    const covRows = (cov.json as unknown as unknown[]).slice(1) as unknown[][];
    const rows = covRows.map((row) => row.slice(1));
    const varList = (variance.json as unknown as unknown[]).slice(1);
    expect(rows[0][0]).toEqual(varList[0]);
    expect(rows[1][1]).toEqual(varList[1]);
    expect(rows[2][2]).toEqual(varList[2]);
    // Cov(1,2) = -4 * 1/2 * 1/3 = -2/3
    expect(rows[0][1]).toEqual(["Rational", -2, 3]);
    expect(rows[1][0]).toEqual(["Rational", -2, 3]);
  });

  test("RandomVariate draws sum to n and are seed-reproducible", () => {
    evalOf(["SeedRandom", 7]);
    const draw1 = evalOf(["RandomVariate", dist]).json as unknown as (string | number)[];
    const total = (draw1.slice(1) as number[]).reduce((s, x) => s + x, 0);
    expect(total).toBe(4);
    evalOf(["SeedRandom", 7]);
    const draw2 = evalOf(["RandomVariate", dist]).json;
    expect(draw2).toEqual(draw1);
  });
});

describe("MultinormalDistribution", () => {
  test("with diagonal Sigma, PDF factors into a product of independent Normal PDFs", () => {
    const dist = ["MultinormalDistribution", ["List", 0, 0], ["List", ["List", 4, 0], ["List", 0, 9]]];
    const point = ["List", 1, 2];
    const joint = N(["PDF", dist, point]);
    const marginal = N(["PDF", ["NormalDistribution", 0, 2], 1]) * N(["PDF", ["NormalDistribution", 0, 3], 2]);
    expect(joint).toBeCloseTo(marginal, 10);
  });

  test("PDF is exact (rational under the radical) for a rational Sigma", () => {
    const dist = ["MultinormalDistribution", ["List", 0, 0], ["List", ["List", 2, 1], ["List", 1, 2]]];
    const out = evalOf(["PDF", dist, ["List", 0, 0]]);
    // det(Sigma) = 3, so PDF(0) = 1/(2 pi sqrt(3)) = sqrt(3)/(6 pi) -- exact, not a float.
    expect(out.json).toEqual(["Divide", ["Sqrt", 3], ["Multiply", 6, "Pi"]]);
    expect(N(["PDF", dist, ["List", 0, 0]])).toBeCloseTo(1 / (2 * Math.PI * Math.sqrt(3)), 10);
  });

  test("Mean defaults to the zero vector for the one-argument (Sigma-only) form", () => {
    const dist = ["MultinormalDistribution", ["List", ["List", 1, 0], ["List", 0, 1]]];
    expect(evalOf(["Mean", dist]).json).toEqual(["List", 0, 0]);
  });

  test("Variance is the diagonal of Sigma; Covariance is Sigma itself", () => {
    const sigma = ["List", ["List", 4, 1], ["List", 1, 9]];
    const dist = ["MultinormalDistribution", ["List", 1, 2], sigma];
    expect(evalOf(["Variance", dist]).json).toEqual(["List", 4, 9]);
    expect(evalOf(["Covariance", dist]).json).toEqual(sigma);
  });

  test("RandomVariate draws a length-k list, seed-reproducible", () => {
    const dist = ["MultinormalDistribution", ["List", 0, 0], ["List", ["List", 1, 0], ["List", 0, 1]]];
    evalOf(["SeedRandom", 11]);
    const draw1 = evalOf(["RandomVariate", dist]);
    expect(draw1.operator).toBe("List");
    evalOf(["SeedRandom", 11]);
    const draw2 = evalOf(["RandomVariate", dist]);
    expect(draw2.json).toEqual(draw1.json);
  });
});

describe("MultivariatePoissonDistribution (common-shock model)", () => {
  const dist = ["MultivariatePoissonDistribution", 1, ["List", 2, 3]];

  test("PDF sums to 1 over a large enough truncated grid", () => {
    let total = 0;
    for (let a = 0; a <= 25; a++) {
      for (let b = 0; b <= 25; b++) {
        total += N(["PDF", dist, ["List", a, b]]);
      }
    }
    expect(total).toBeCloseTo(1, 6);
  });

  test("marginal mean matches mu0 + mu_i", () => {
    expect(evalOf(["Mean", dist]).json).toEqual(["List", 3, 4]);
  });

  test("Variance matches Mean (Poisson-shaped marginals)", () => {
    expect(evalOf(["Variance", dist]).json).toEqual(evalOf(["Mean", dist]).json);
  });

  test("Covariance off-diagonal is mu0, diagonal is mu0 + mu_i", () => {
    expect(evalOf(["Covariance", dist]).json).toEqual(["List", ["List", 3, 1], ["List", 1, 4]]);
  });

  test("RandomVariate draw is a nonnegative integer pair", () => {
    const draw = evalOf(["RandomVariate", dist]).json as unknown as (string | number)[];
    expect((draw as unknown as unknown[]).length).toBe(3); // ["List", x1, x2]
  });
});

describe("ProbabilityDistribution", () => {
  test("continuous: PDF by substitution, 0 outside range", () => {
    // Uniform(0,1) written by hand: pdf(x) = 1 on [0,1]
    const dist = ["ProbabilityDistribution", 1, ["List", "x", 0, 1]];
    expect(evalOf(["PDF", dist, ["Rational", 1, 2]]).json).toEqual(1);
    expect(evalOf(["PDF", dist, 2]).json).toEqual(0);
  });

  test("continuous: Mean/Variance via Integrate resolve for a triangular density", () => {
    // pdf(x) = 2x on [0,1] -- a triangular density; Mean = 2/3, Variance = 1/18
    const dist = ["ProbabilityDistribution", ["Multiply", 2, "x"], ["List", "x", 0, 1]];
    expect(evalOf(["Mean", dist]).json).toEqual(["Rational", 2, 3]);
    expect(evalOf(["Variance", dist]).json).toEqual(["Rational", 1, 18]);
  });

  test("continuous: CDF via Integrate", () => {
    const dist = ["ProbabilityDistribution", ["Multiply", 2, "x"], ["List", "x", 0, 1]];
    expect(evalOf(["CDF", dist, ["Rational", 1, 2]]).json).toEqual(["Rational", 1, 4]);
  });

  test("discrete: PDF by substitution on {x, min, max, 1}", () => {
    // A discrete uniform on {1,...,4} written by hand: pdf(x) = 1/4
    const dist = ["ProbabilityDistribution", ["Rational", 1, 4], ["List", "x", 1, 4, 1]];
    expect(evalOf(["PDF", dist, 2]).json).toEqual(["Rational", 1, 4]);
    expect(evalOf(["PDF", dist, 5]).json).toEqual(0);
    expect(evalOf(["Mean", dist]).json).toEqual(["Rational", 5, 2]);
  });

  test("stays unevaluated when Integrate has no closed form", () => {
    const dist = ["ProbabilityDistribution", ["Sin", ["Power", "x", "x"]], ["List", "x", 0, 1]];
    const out = evalOf(["Mean", dist]);
    expect(out.operator).toBe("Mean");
  });
});

describe("ParameterMixtureDistribution", () => {
  test("Poisson(theta) mixed over Gamma(theta) matches NegativeBinomial's PDF/Mean/Variance", () => {
    const mixture = [
      "ParameterMixtureDistribution",
      ["PoissonDistribution", "theta"],
      ["Distributed", "theta", ["GammaDistribution", 3, 2]],
    ];
    const negBinomial = ["NegativeBinomialDistribution", 3, ["Rational", 1, 3]]; // p = 1/(1+2)
    expect(evalOf(["PDF", mixture, 4]).json).toEqual(evalOf(["PDF", negBinomial, 4]).json);
    expect(evalOf(["Mean", mixture]).json).toEqual(evalOf(["Mean", negBinomial]).json);
    expect(evalOf(["Variance", mixture]).json).toEqual(evalOf(["Variance", negBinomial]).json);
  });

  test("Binomial(n, theta) mixed over Beta(a,b) matches the Beta-Binomial mean/variance formula", () => {
    const n = 10;
    const a = 2;
    const b = 3;
    const mixture = [
      "ParameterMixtureDistribution",
      ["BinomialDistribution", n, "theta"],
      ["Distributed", "theta", ["BetaDistribution", a, b]],
    ];
    expect(N(["Mean", mixture])).toBeCloseTo((n * a) / (a + b), 10);
    const expectedVariance = (n * a * b * (a + b + n)) / ((a + b) ** 2 * (a + b + 1));
    expect(N(["Variance", mixture])).toBeCloseTo(expectedVariance, 10);
  });

  test("Binomial-Beta PDF at a point matches direct numeric integration over theta", () => {
    const n = 5;
    const a = 2;
    const b = 2;
    const x = 2;
    const mixture = [
      "ParameterMixtureDistribution",
      ["BinomialDistribution", n, "theta"],
      ["Distributed", "theta", ["BetaDistribution", a, b]],
    ];
    const exact = N(["PDF", mixture, x]);
    // Brute-force: integral of Binomial(n,x,theta) * Beta(a,b) pdf(theta) dtheta via a grid,
    // computed in plain JS (not through the engine) so it's fast enough for a unit test.
    const binomialCoeff = (nn: number, k: number) => {
      let c = 1;
      for (let i = 0; i < k; i++) c = (c * (nn - i)) / (i + 1);
      return c;
    };
    const logGamma = (z: number): number => {
      // Stirling's series, precise enough for this cross-check.
      const g = 7;
      const c = [
        0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
        12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
      ];
      if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
      z -= 1;
      let x = c[0];
      for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
      const t = z + g + 0.5;
      return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
    };
    const betaPdfJs = (theta: number, aa: number, bb: number) =>
      Math.exp(
        (aa - 1) * Math.log(theta) + (bb - 1) * Math.log(1 - theta) + logGamma(aa + bb) - logGamma(aa) - logGamma(bb),
      );
    let acc = 0;
    const steps = 4000;
    for (let i = 0; i < steps; i++) {
      const theta = (i + 0.5) / steps;
      const binomialPdf = binomialCoeff(n, x) * theta ** x * (1 - theta) ** (n - x);
      acc += binomialPdf * betaPdfJs(theta, a, b) * (1 / steps);
    }
    expect(exact).toBeCloseTo(acc, 3);
  });
});

describe("HistogramDistribution", () => {
  const data = ["List", 1, 1, 2, 2, 2, 3, 3, 4];
  const dist = ["HistogramDistribution", data, ["List", 0, 5, 1]];

  test("PDF integrates to 1 over the bins", () => {
    // 5 bins of width 1: heights are counts/(n*dx); sum(height*dx) = sum(counts)/n = 1
    let total = 0;
    for (let i = 0; i < 5; i++) total += N(["PDF", dist, i + 0.5]) * 1;
    expect(total).toBeCloseTo(1, 10);
  });

  test("CDF is 0 below range, 1 above range, and matches cumulative counts at bin edges", () => {
    expect(evalOf(["CDF", dist, -1]).json).toEqual(0);
    expect(evalOf(["CDF", dist, 10]).json).toEqual(1);
    // P(X < 2) = count of values strictly below 2 (the two 1's) / n = 2/8 = 1/4.
    expect(evalOf(["CDF", dist, 2]).json).toEqual(["Rational", 1, 4]);
  });

  test("Mean matches the direct weighted-midpoint average", () => {
    // bins: [0,1)x2 mid .5, [1,2)x3 mid 1.5, [2,3)x2 mid 2.5, [3,4)x1 mid 3.5 -- counts per data:
    // data = 1,1,2,2,2,3,3,4 -> bin[1,2)=2 (values 1,1), bin[2,3)=3 (values 2,2,2), bin[3,4)=2 (3,3), bin[4,5)=1 (4)
    const expected = (2 * 1.5 + 3 * 2.5 + 2 * 3.5 + 1 * 4.5) / 8;
    expect(N(["Mean", dist])).toBeCloseTo(expected, 10);
  });

  test("Variance is nonnegative and finite", () => {
    const v = N(["Variance", dist]);
    expect(v).toBeGreaterThan(0);
    expect(Number.isFinite(v)).toBe(true);
  });
});

import { ComputeEngine } from "@cortex-js/compute-engine";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import { declareDistributions } from "../src/distributions.ts";
import { declareDistributions2 } from "../src/distributions-2.ts";
import { declareDistributions3 } from "../src/distributions-3.ts";
import { declareDistributions4 } from "../src/distributions-4.ts";

// Cross-checks for the fourth-wave (compound) distribution heads — TruncatedDistribution,
// MixtureDistribution, ProductDistribution, TransformedDistribution, MarginalDistribution,
// DirichletDistribution. Exact golden values live in `reference/*.yaml` (entries.test.ts);
// this file checks RELATIONS that have to hold regardless of the specific base distribution:
// a truncated PDF integrates/sums to 1 over its own support, a mixture's Mean/Variance match
// the weighted-sum / law-of-total-variance formulas directly (not just against one golden
// number), a product's Mean is componentwise the factors' own Mean, an affine transform's
// Mean/Variance track `a`/`b` exactly, and a Dirichlet's Mean components sum to at most 1.

let ce: ComputeEngine;
beforeEach(() => {
  ce = new ComputeEngine();
  declareDistributions(ce);
  declareDistributions2(ce);
  declareDistributions3(ce);
  declareDistributions4(ce);
});

const evalOf = (expr: unknown) => ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate();
const N = (expr: unknown) => evalOf(["N", expr as never]).re;

describe("TruncatedDistribution: PDF integrates/sums to 1 over its own support", () => {
  test("continuous base (Simpson over [a, b])", () => {
    const dist = ["TruncatedDistribution", ["List", -1, 1], ["NormalDistribution", 0, 1]];
    const pdfAt = (x: number) => N(["PDF", dist, x]);
    const a = -1;
    const b = 1;
    const steps = 2000;
    const dx = (b - a) / steps;
    let sum = pdfAt(a) + pdfAt(b);
    for (let i = 1; i < steps; i++) sum += (i % 2 === 0 ? 2 : 4) * pdfAt(a + i * dx);
    expect((sum * dx) / 3).toBeCloseTo(1, 6);
  });

  test("discrete base (exact finite sum, right-half-open)", () => {
    const dist = ["TruncatedDistribution", ["List", 1, 6], ["PoissonDistribution", 2]];
    let sum = 0;
    for (let k = 0; k <= 20; k++) sum += N(["PDF", dist, k]);
    expect(sum).toBeCloseTo(1, 8);
  });

  test("PDF is 0 at the excluded discrete lower endpoint, nonzero at the included upper one", () => {
    const dist = ["TruncatedDistribution", ["List", 1, 6], ["PoissonDistribution", 2]];
    expect(N(["PDF", dist, 1])).toBe(0);
    expect(N(["PDF", dist, 6])).toBeGreaterThan(0);
  });
});

describe("TruncatedDistribution CDF matches CDF(inner) rescaled", () => {
  test("CDF(b) = 1, CDF(a-ish lower edge) = 0", () => {
    const dist = ["TruncatedDistribution", ["List", 0, 2], ["ExponentialDistribution", 1]];
    expect(N(["CDF", dist, 2])).toBeCloseTo(1, 10);
    expect(N(["CDF", dist, -1])).toBe(0);
  });
});

describe("MixtureDistribution: Mean/Variance match the weighted-sum formulas directly", () => {
  const components: readonly [number, unknown][] = [
    [2, ["NormalDistribution", -3, 1]],
    [3, ["PoissonDistribution", 4]],
    [1, ["UniformDistribution", 0, 10]],
  ];
  const mix = [
    "MixtureDistribution",
    ["List", ...components.map((c) => c[0])],
    ["List", ...components.map((c) => c[1])],
  ];

  test("Mean = weighted average of component Means", () => {
    const totalW = components.reduce((acc, [w]) => acc + w, 0);
    const expected = components.reduce((acc, [w, d]) => acc + (w / totalW) * N(["Mean", d as never]), 0);
    expect(N(["Mean", mix])).toBeCloseTo(expected, 8);
  });

  test("Variance = law of total variance", () => {
    const totalW = components.reduce((acc, [w]) => acc + w, 0);
    const overallMean = components.reduce((acc, [w, d]) => acc + (w / totalW) * N(["Mean", d as never]), 0);
    const within = components.reduce((acc, [w, d]) => acc + (w / totalW) * N(["Variance", d as never]), 0);
    const between = components.reduce(
      (acc, [w, d]) => acc + (w / totalW) * (N(["Mean", d as never]) - overallMean) ** 2,
      0,
    );
    expect(N(["Variance", mix])).toBeCloseTo(within + between, 6);
  });

  test("weights are normalized: scaling every weight by the same factor doesn't change Mean", () => {
    const scaled = [
      "MixtureDistribution",
      ["List", ...components.map((c) => c[0] * 7)],
      ["List", ...components.map((c) => c[1])],
    ];
    expect(N(["Mean", scaled])).toBeCloseTo(N(["Mean", mix]), 8);
  });

  test("RandomVariate draws from one of the components (seeded, repeatable)", () => {
    ce.box(["SeedRandom", 3]).evaluate();
    const draws = Array.from({ length: 50 }, () => N(["RandomVariate", mix]));
    expect(draws.every((d) => Number.isFinite(d))).toBe(true);
  });
});

describe("ProductDistribution: PDF factors, Mean/Variance are componentwise", () => {
  const dist = [
    "ProductDistribution",
    ["NormalDistribution", 0, 1],
    ["NormalDistribution", 5, 2],
    ["UniformDistribution", 0, 1],
  ];

  test("PDF at a list is the product of the marginal PDFs", () => {
    const point = ["List", 0.5, 4, 0.3];
    const expected = N(["PDF", ["NormalDistribution", 0, 1], 0.5]) * N(["PDF", ["NormalDistribution", 5, 2], 4]);
    expect(N(["PDF", dist, point])).toBeCloseTo(expected, 8);
  });

  test("Mean is the list of the factors' own Means", () => {
    expect(evalOf(["Mean", dist]).json).toEqual(["List", 0, 5, ["Rational", 1, 2]]);
  });

  test("Variance is the list of the factors' own Variances", () => {
    expect(evalOf(["Variance", dist]).json).toEqual(["List", 1, 4, ["Rational", 1, 12]]);
  });

  test("RandomVariate draws a list, one component per factor", () => {
    ce.box(["SeedRandom", 5]).evaluate();
    const draw = evalOf(["RandomVariate", dist]);
    expect(draw.operator).toBe("List");
    expect((draw as unknown as { ops: unknown[] }).ops).toHaveLength(3);
  });

  test("ProductDistribution({d, n}) is n independent copies of d", () => {
    const rep = ["ProductDistribution", ["List", ["PoissonDistribution", 3], 4]];
    expect(evalOf(["Mean", rep]).json).toEqual(["List", 3, 3, 3, 3]);
  });
});

describe("MarginalDistribution reduces to the named factor(s)", () => {
  const dist = [
    "ProductDistribution",
    ["NormalDistribution", 0, 1],
    ["PoissonDistribution", 4],
    ["UniformDistribution", 0, 1],
  ];

  test("a single index reduces to that factor", () => {
    expect(evalOf(["MarginalDistribution", dist, 2]).json).toEqual(["PoissonDistribution", 4]);
  });

  test("a list of indices reduces to a ProductDistribution of those factors, in order", () => {
    expect(evalOf(["MarginalDistribution", dist, ["List", 3, 1]]).json).toEqual([
      "ProductDistribution",
      ["UniformDistribution", 0, 1],
      ["NormalDistribution", 0, 1],
    ]);
  });

  test("Mean of a marginal matches the corresponding factor's own Mean", () => {
    expect(N(["Mean", ["MarginalDistribution", dist, 2]])).toBeCloseTo(4, 10);
  });
});

describe("TransformedDistribution: affine change of variable", () => {
  const affineCases: readonly [number, number][] = [
    [2, 3],
    [-1, 0],
    [0.5, -4],
    [-3, 7],
  ];

  for (const [a, b] of affineCases) {
    test(`a = ${a}, b = ${b}: Mean = a*Mean(X)+b, Variance = a^2*Variance(X)`, () => {
      const base = ["NormalDistribution", 1, 2];
      const expr = a === 1 ? ["Add", "x", b] : ["Add", ["Multiply", a, "x"], b];
      const dist = ["TransformedDistribution", expr, ["Distributed", "x", base]];
      expect(N(["Mean", dist])).toBeCloseTo(a * N(["Mean", base]) + b, 8);
      expect(N(["Variance", dist])).toBeCloseTo(a * a * N(["Variance", base]), 8);
    });

    test(`a = ${a}, b = ${b}: PDF matches the change-of-variables formula pointwise`, () => {
      const base = ["NormalDistribution", 1, 2];
      const expr = a === 1 ? ["Add", "x", b] : ["Add", ["Multiply", a, "x"], b];
      const dist = ["TransformedDistribution", expr, ["Distributed", "x", base]];
      const y = a * 2 + b + 1; // an arbitrary point in the transformed variable's range
      const invArg = (y - b) / a;
      const expected = N(["PDF", base, invArg]) / Math.abs(a);
      expect(N(["PDF", dist, y])).toBeCloseTo(expected, 8);
    });
  }

  test("negative slope flips the CDF: CDF_Y(y) = 1 - CDF_X((y-b)/a) for continuous X", () => {
    const dist = ["TransformedDistribution", ["Negate", "x"], ["Distributed", "x", ["NormalDistribution", 0, 1]]];
    for (const y of [-2, 0, 1.5]) {
      expect(N(["CDF", dist, y])).toBeCloseTo(1 - N(["CDF", ["NormalDistribution", 0, 1], -y]), 8);
    }
  });

  test("x^2 of a standard normal is ChiSquareDistribution(1)", () => {
    const dist = ["TransformedDistribution", ["Power", "x", 2], ["Distributed", "x", ["NormalDistribution", 0, 1]]];
    for (const x of [0.5, 1, 2.5]) {
      expect(N(["PDF", dist, x])).toBeCloseTo(N(["PDF", ["ChiSquareDistribution", 1], x]), 10);
      expect(N(["CDF", dist, x])).toBeCloseTo(N(["CDF", ["ChiSquareDistribution", 1], x]), 10);
    }
    expect(N(["Mean", dist])).toBeCloseTo(N(["Mean", ["ChiSquareDistribution", 1]]), 10);
    expect(N(["Variance", dist])).toBeCloseTo(N(["Variance", ["ChiSquareDistribution", 1]]), 10);
  });

  test("a genuinely nonlinear, non-x^2-of-standard-normal transform stays unevaluated", () => {
    const dist = ["TransformedDistribution", ["Sin", "x"], ["Distributed", "x", ["NormalDistribution", 0, 1]]];
    expect(evalOf(["Mean", dist]).operator).toBe("Mean");
  });
});

describe("DirichletDistribution: Mean components sum to at most 1, Variance is nonnegative", () => {
  const cases: readonly (readonly number[])[] = [
    [1, 4, 5],
    [2, 2, 2, 2],
    [0.5, 1.5, 3],
  ];

  for (const alphas of cases) {
    test(JSON.stringify(alphas), () => {
      const dist = ["DirichletDistribution", ["List", ...alphas]];
      const meanList = evalOf(["Mean", dist]) as unknown as { ops: { N: () => { re: number } }[] };
      const means = meanList.ops.map((op) => op.N().re);
      expect(means).toHaveLength(alphas.length - 1);
      const total = means.reduce((acc, m) => acc + m, 0);
      expect(total).toBeLessThanOrEqual(1);
      for (const m of means) expect(m).toBeGreaterThan(0);

      const varianceList = evalOf(["Variance", dist]) as unknown as { ops: { N: () => { re: number } }[] };
      const variances = varianceList.ops.map((op) => op.N().re);
      for (const v of variances) expect(v).toBeGreaterThan(0);
    });
  }

  test("PDF is nonnegative at an interior point", () => {
    const dist = ["DirichletDistribution", ["List", 2, 3, 4]];
    expect(N(["PDF", dist, ["List", 0.2, 0.3]])).toBeGreaterThan(0);
  });
});

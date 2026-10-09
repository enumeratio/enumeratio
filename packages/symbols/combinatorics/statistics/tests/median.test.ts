import { box, type Engine, type Json } from "@enumeratio/engine";
import { createEngine } from "@enumeratio/engine/testing";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import { declareDistributions } from "../src/distributions.ts";
import { declareDistributions2 } from "../src/distributions-2.ts";

// Exact values live in `reference/*/examples.tsv`; this file holds the relations the discrete
// medians must satisfy: the answer is the least integer whose CDF reaches 1/2, and a law that
// can't be answered exactly stays unevaluated.

let ce: Engine;
beforeEach(() => {
  ce = createEngine(declareDistributions, declareDistributions2);
});

const evalOf = (expr: unknown) => box(ce, expr as Json).evaluate();
const cdf = (dist: unknown, k: number) => box(ce, ["N", ["CDF", dist, k]] as Json).evaluate().re;
const median = (dist: unknown) => evalOf(["Median", dist]).re;

describe("a discrete median is the least k with CDF(k) >= 1/2", () => {
  const laws: [string, unknown][] = [
    ["Poisson(1/3)", ["PoissonDistribution", ["Rational", 1, 3]]],
    ["Poisson(12)", ["PoissonDistribution", 12]],
    ["Poisson(37/2)", ["PoissonDistribution", ["Rational", 37, 2]]],
    ["Binomial(10, 1/2)", ["BinomialDistribution", 10, ["Rational", 1, 2]]],
    ["Binomial(25, 1/7)", ["BinomialDistribution", 25, ["Rational", 1, 7]]],
    ["Geometric(1/10)", ["GeometricDistribution", ["Rational", 1, 10]]],
    ["Geometric(1/2)", ["GeometricDistribution", ["Rational", 1, 2]]],
  ];
  test.each(laws)("%s", (_name, dist) => {
    const m = median(dist);
    expect(Number.isInteger(m)).toBe(true);
    expect(cdf(dist, m)).toBeGreaterThanOrEqual(0.5);
    expect(cdf(dist, m - 1)).toBeLessThan(0.5);
  });

  test("a tie with 1/2 takes the lower point", () => {
    // Bernoulli(1/2) has CDF(0) = 1/2 exactly.
    expect(median(["BernoulliDistribution", ["Rational", 1, 2]])).toBe(0);
    expect(median(["BernoulliDistribution", ["Rational", 3, 5]])).toBe(1);
  });
});

describe("a continuous median is the exact quantile", () => {
  test("symbolic parameters", () => {
    expect(evalOf(["Median", ["NormalDistribution", "m", "s"]]).json).toEqual("m");
    expect(evalOf(["Median", ["ExponentialDistribution", "r"]]).json).toEqual(["Divide", ["Ln", 2], "r"]);
  });

  test("a symmetric beta sits at its midpoint", () => {
    expect(evalOf(["Median", ["BetaDistribution", 3, 3]]).json).toEqual(["Rational", 1, 2]);
  });
});

test("a law with no exact median stays unevaluated", () => {
  expect(evalOf(["Median", ["PoissonDistribution", "x"]]).operator).toBe("Median");
  expect(evalOf(["Median", ["GammaDistribution", 2, 3]]).operator).toBe("Median");
});

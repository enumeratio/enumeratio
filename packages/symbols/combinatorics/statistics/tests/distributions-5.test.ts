import { ComputeEngine } from "@cortex-js/compute-engine";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import { declareDistributions } from "../src/distributions.ts";
import { declareDistributions2 } from "../src/distributions-2.ts";
import { declareDistributions3 } from "../src/distributions-3.ts";
import { declareDistributions4 } from "../src/distributions-4.ts";
import { declareDistributions5 } from "../src/distributions-5.ts";

// Cross-checks for the fifth-wave (narrowed) probability heads — NExpectation, NProbability,
// and Conditioned inside Probability/Expectation. Exact golden values live in
// `reference/*.yaml` (entries.test.ts); this file checks RELATIONS that have to hold
// regardless of the specific distribution: NExpectation of the identity/square matches the
// exact Mean/Variance, NProbability of a bound matches the exact CDF, P(A|B)*P(B) = P(A,B),
// and a handful of scope-boundary cases (unsupported shapes staying unevaluated).

let ce: ComputeEngine;
beforeEach(() => {
  ce = new ComputeEngine();
  declareDistributions(ce);
  declareDistributions2(ce);
  declareDistributions3(ce);
  declareDistributions4(ce);
  declareDistributions5(ce);
});

const evalOf = (expr: unknown) => ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate();
const N = (expr: unknown) => evalOf(["N", expr as never]).re;

describe("NExpectation agrees with the exact Mean/Variance it would delegate to", () => {
  test("NExpectation(x, dist) matches Mean(dist) — continuous", () => {
    const dist = ["NormalDistribution", 2, 3];
    const ne = evalOf(["NExpectation", "x", ["Distributed", "x", dist]]).re;
    expect(ne).toBeCloseTo(N(["Mean", dist]), 10);
  });

  test("NExpectation(x, dist) matches Mean(dist) — discrete, infinite support", () => {
    const dist = ["PoissonDistribution", 5];
    const ne = evalOf(["NExpectation", "x", ["Distributed", "x", dist]]).re;
    expect(ne).toBeCloseTo(N(["Mean", dist]), 8);
  });

  test("NExpectation(x^2, dist) matches Variance(dist) + Mean(dist)^2 — discrete, finite support", () => {
    const dist = ["BinomialDistribution", 7, ["Rational", 3, 10]];
    const ne = evalOf(["NExpectation", ["Power", "x", 2], ["Distributed", "x", dist]]).re;
    const expected = N(["Mean", dist]) ** 2 + N(["Variance", dist]);
    expect(ne).toBeCloseTo(expected, 8);
  });

  test("a smooth f past Expectation's linear/quadratic reach still gets a numeric answer", () => {
    const dist = ["ExponentialDistribution", 2];
    const ne = evalOf(["NExpectation", ["Power", "x", 3], ["Distributed", "x", dist]]).re;
    expect(ne).toBeCloseTo(6 / 2 ** 3, 8); // E[X^n] = n!/lambda^n for Exponential(lambda)
  });

  test("stays unevaluated for a distribution this file has no support/domain table for", () => {
    // `f = x^3` is past Expectation's own linear/quadratic reach, and MixtureDistribution isn't
    // in this file's `discreteSupport`/`continuousDomain` tables (even though Mean/Variance
    // ARE extended for it by distributions-4.ts) — so there's no domain to integrate/sum over.
    const dist = [
      "MixtureDistribution",
      ["List", 1, 1],
      ["List", ["NormalDistribution", 0, 1], ["NormalDistribution", 5, 1]],
    ];
    const out = evalOf(["NExpectation", ["Power", "x", 3], ["Distributed", "x", dist]]);
    expect(out.operator).toBe("NExpectation");
  });
});

describe("NProbability agrees with the exact CDF it would delegate to", () => {
  test("NProbability(x <= k, dist) matches CDF(dist, k) — continuous", () => {
    const dist = ["NormalDistribution", 0, 1];
    const np = evalOf(["NProbability", ["LessEqual", "x", 1.5], ["Distributed", "x", dist]]).re;
    expect(np).toBeCloseTo(N(["CDF", dist, 1.5]), 9);
  });

  test("NProbability(x <= k, dist) matches CDF(dist, k) — discrete, infinite support", () => {
    const dist = ["PoissonDistribution", 4];
    const np = evalOf(["NProbability", ["LessEqual", "x", 6], ["Distributed", "x", dist]]).re;
    expect(np).toBeCloseTo(N(["CDF", dist, 6]), 9);
  });

  test("a condition Probability can't parse still gets a numeric answer, matching a direct sum", () => {
    const dist = ["PoissonDistribution", 4];
    const np = evalOf(["NProbability", ["Equal", ["Mod", "x", 2], 0], ["Distributed", "x", dist]]).re;
    let bruteForce = 0;
    for (let k = 0; k <= 60; k += 2) bruteForce += N(["PDF", dist, k]);
    expect(np).toBeCloseTo(bruteForce, 9);
  });

  test("a discontinuous indicator on a continuous distribution is still accurate to the documented tolerance", () => {
    const dist = ["NormalDistribution", 0, 1];
    const np = evalOf(["NProbability", ["Greater", ["Power", "x", 2], 1], ["Distributed", "x", dist]]).re;
    const exact = 2 * (1 - N(["CDF", dist, 1])); // P(|X| > 1) = 2(1 - Phi(1))
    expect(Math.abs(np - exact)).toBeLessThan(1e-9);
  });
});

describe("Conditioned: P(A | B) * P(B) = P(A, B)", () => {
  test("discrete: P(X=2 | X<=5) * P(X<=5) = PDF(2)", () => {
    const dist = ["PoissonDistribution", 3];
    const binding = ["Distributed", "x", dist];
    const conditional = N(["Probability", ["Conditioned", ["Equal", "x", 2], ["LessEqual", "x", 5]], binding]);
    const marginal = N(["Probability", ["LessEqual", "x", 5], binding]);
    expect(conditional * marginal).toBeCloseTo(N(["PDF", dist, 2]), 10);
  });

  test("continuous: P(X<=0 | X>=-1) * P(X>=-1) = P(-1<=X<=0)", () => {
    const dist = ["NormalDistribution", 0, 1];
    const binding = ["Distributed", "x", dist];
    const conditional = N(["Probability", ["Conditioned", ["LessEqual", "x", 0], ["LessEqual", -1, "x"]], binding]);
    const marginal = N(["Probability", ["LessEqual", -1, "x"], binding]);
    const joint = N(["CDF", dist, 0]) - N(["CDF", dist, -1]);
    expect(conditional * marginal).toBeCloseTo(joint, 10);
  });

  test("E[X | X<=3] on Poisson(3) matches a hand-rolled weighted average over {0,1,2,3}", () => {
    const dist = ["PoissonDistribution", 3];
    const binding = ["Distributed", "x", dist];
    const ce_ = N(["Expectation", ["Conditioned", "x", ["LessEqual", "x", 3]], binding]);
    let num = 0;
    let den = 0;
    for (let k = 0; k <= 3; k++) {
      const p = N(["PDF", dist, k]);
      num += k * p;
      den += p;
    }
    expect(ce_).toBeCloseTo(num / den, 10);
  });

  test("conditioning on a point collapses f to its value there", () => {
    const out = evalOf([
      "Expectation",
      ["Conditioned", ["Power", "x", 2], ["Equal", "x", 3]],
      ["Distributed", "x", ["PoissonDistribution", 3]],
    ]);
    expect(out.re).toBe(9);
  });

  test("a continuous distribution with an interval condition stays unevaluated (out of scope)", () => {
    const expr = [
      "Expectation",
      ["Conditioned", "x", ["LessEqual", "x", 3]],
      ["Distributed", "x", ["NormalDistribution", 0, 1]],
    ];
    const out = evalOf(expr);
    expect(out.operator).toBe("Expectation");
  });

  test("Probability(Conditioned(...)) stays unevaluated when the And case can't compose it either", () => {
    // Both bounds are upper bounds on x (x<=2 and x<=5) — not the lo/hi chain shape
    // `Probability`'s own `And` case recognizes, and neither is an `Equal`.
    const expr = [
      "Probability",
      ["Conditioned", ["LessEqual", "x", 2], ["LessEqual", "x", 5]],
      ["Distributed", "x", ["PoissonDistribution", 3]],
    ];
    const out = evalOf(expr);
    expect(out.operator).toBe("Probability");
  });
});

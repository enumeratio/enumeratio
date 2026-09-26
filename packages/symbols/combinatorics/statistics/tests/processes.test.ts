import { ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import { declareDistributions } from "../src/distributions.ts";
import { declareDistributions2 } from "../src/distributions-2.ts";
import { declareDistributions3 } from "../src/distributions-3.ts";
import { declareDistributions4 } from "../src/distributions-4.ts";
import { declareDistributions5 } from "../src/distributions-5.ts";
import { declareProcesses } from "../src/processes.ts";

// Cross-checks for the random-process heads — WienerProcess, PoissonProcess,
// SliceDistribution, RandomFunction. Exact golden values (slice Mean/Variance,
// SliceDistribution's rewrite, a fixed seeded path) live in `reference/*.yaml`
// (entries.test.ts); this file checks RELATIONS and statistical properties that have to
// hold regardless of the exact numbers: reseeded-path reproducibility, the Poisson path's
// nondecreasing-integer invariant, and the Wiener path's increment statistics converging to
// the theoretical mean/variance over a long seeded path.

let ce: ComputeEngine;
beforeEach(() => {
  ce = new ComputeEngine();
  declareDistributions(ce);
  declareDistributions2(ce);
  declareDistributions3(ce);
  declareDistributions4(ce);
  declareDistributions5(ce);
  declareProcesses(ce);
});

const evalOf = (expr: unknown) => ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate();

// A path drawn under `[SeedRandom, seed]` then reset back to the default seed afterward —
// same "reseed, extract, reseed back to default" idiom `reference/RandomFunction.examples.yaml`
// uses, so a test run doesn't leak RNG state into whatever test runs after it.
const seededPath = (seed: number, proc: unknown, spec: unknown): number[][] => {
  const out = evalOf(["Last", ["List", ["SeedRandom", seed], ["RandomFunction", proc, spec], ["SeedRandom", 42]]]);
  return operandsOf(out).map((pair) => {
    const ops = operandsOf(pair);
    return [ops[0].re, ops[1].re];
  });
};

describe("SliceDistribution", () => {
  test("WienerProcess slice is Normal(mu*t, sigma*sqrt(t))", () => {
    const dist = evalOf(["SliceDistribution", ["WienerProcess", 2, 3], 4]);
    expect(dist.operator).toBe("NormalDistribution");
    expect(evalOf(["Mean", dist]).N().re).toBeCloseTo(2 * 4, 10);
    expect(evalOf(["Variance", dist]).N().re).toBeCloseTo(3 ** 2 * 4, 10);
  });

  test("PoissonProcess slice is Poisson(lambda*t)", () => {
    const dist = evalOf(["SliceDistribution", ["PoissonProcess", 5], 3]);
    expect(dist.json).toEqual(evalOf(["PoissonDistribution", 15]).json);
  });

  test("Mean/Variance/PDF/CDF reach the slice with no changes of their own", () => {
    const slice = ["SliceDistribution", ["PoissonProcess", 2], 3];
    expect(evalOf(["Mean", slice]).re).toBe(6);
    expect(evalOf(["PDF", slice, 6]).N().re).toBeCloseTo(evalOf(["PDF", ["PoissonDistribution", 6], 6]).N().re, 12);
  });

  test("unevaluated for a process kind this file doesn't know", () => {
    const out = evalOf(["SliceDistribution", ["NormalDistribution", 0, 1], 2]);
    expect(out.operator).toBe("SliceDistribution");
  });
});

describe("RandomFunction: reproducibility and shape", () => {
  test("same seed and grid draw the same path every time", () => {
    const a = seededPath(11, ["WienerProcess", 0, 1], ["List", 0, 2, 0.25]);
    const b = seededPath(11, ["WienerProcess", 0, 1], ["List", 0, 2, 0.25]);
    expect(a).toEqual(b);
  });

  test("a different seed draws a different path", () => {
    const a = seededPath(11, ["WienerProcess", 0, 1], ["List", 0, 2, 0.25]);
    const b = seededPath(12, ["WienerProcess", 0, 1], ["List", 0, 2, 0.25]);
    expect(a).not.toEqual(b);
  });

  test("the grid's t-coordinates run from tmin to tmax at the requested dt, landing exactly on tmax", () => {
    const path = seededPath(1, ["WienerProcess", 0, 1], ["List", 0, 1, 0.3]);
    const ts = path.map(([t]) => t);
    expect(ts[0]).toBe(0);
    expect(ts[ts.length - 1]).toBe(1);
    for (let i = 1; i < ts.length - 1; i++) expect(ts[i] - ts[i - 1]).toBeCloseTo(0.3, 9);
  });

  test("a Wiener path always starts at X(tmin) = 0", () => {
    const path = seededPath(9, ["WienerProcess", 5, 2], ["List", 0, 1, 0.1]);
    expect(path[0][1]).toBe(0);
  });
});

describe("PoissonProcess path: counts are nondecreasing nonnegative integers", () => {
  test("over several seeds and grids", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const path = seededPath(seed, ["PoissonProcess", 3], ["List", 0, 5, 0.2]);
      let prev = 0;
      for (const [, x] of path) {
        expect(Number.isInteger(x)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeGreaterThanOrEqual(prev);
        prev = x;
      }
    }
  });
});

describe("WienerProcess path: increment statistics converge to the theoretical mean/variance", () => {
  test("over a long seeded path", () => {
    const mu = 0.5;
    const sigma = 2;
    const dt = 0.01;
    const steps = 4000;
    const path = seededPath(3, ["WienerProcess", mu, sigma], ["List", 0, steps * dt, dt]);
    const increments: number[] = [];
    for (let i = 1; i < path.length; i++) increments.push(path[i][1] - path[i - 1][1]);
    const n = increments.length;
    const mean = increments.reduce((a, b) => a + b, 0) / n;
    const variance = increments.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    // Standard error of the mean of n increments of variance sigma^2*dt is sigma*sqrt(dt/n);
    // 6 standard errors is generous enough not to flake, tight enough to catch a wrong
    // drift/scale.
    const meanTolerance = 6 * (sigma * Math.sqrt(dt)) * Math.sqrt(1 / n);
    expect(Math.abs(mean - mu * dt)).toBeLessThan(meanTolerance);
    // The sample variance of n draws of variance v has standard deviation ~ v*sqrt(2/n);
    // same generous multiplier.
    const varianceTolerance = 6 * (sigma ** 2 * dt) * Math.sqrt(2 / n);
    expect(Math.abs(variance - sigma ** 2 * dt)).toBeLessThan(varianceTolerance);
  });
});

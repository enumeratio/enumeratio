import { box, type Engine, type Json } from "@enumeratio/engine";
import { createEngine } from "@enumeratio/engine/testing";
import { beforeEach, expect, test } from "vite-plus/test";
import { declareDistributions } from "../src/distributions.ts";

// A binomial CDF at an integer point is the finite sum of its PDF, not a BetaRegularized that
// nothing reduces. Exact values live in the Probability records; these are the relations.

let ce: Engine;
beforeEach(() => {
  ce = createEngine(declareDistributions);
});

const evalOf = (expr: unknown) => box(ce, expr as Json).evaluate();

test("an integer point sums the PDF, exactly for exact parameters", () => {
  const dist = ["BinomialDistribution", 8, ["Rational", 1, 4]];
  expect(evalOf(["CDF", dist, 2]).json).toEqual(["Rational", 44469, 65536]);
  const pdfs = [0, 1, 2].map((k) => evalOf(["PDF", dist, k]));
  expect(evalOf(["Add", ...pdfs.map((p) => p.json)]).json).toEqual(["Rational", 44469, 65536]);
});

test("symbolic parameters expand too", () => {
  expect(evalOf(["CDF", ["BinomialDistribution", "n", "p"], 0]).json).toEqual([
    "Power",
    ["Add", ["Negate", "p"], 1],
    "n",
  ]);
});

test("below the support is 0 and past it is 1", () => {
  expect(evalOf(["CDF", ["BinomialDistribution", "n", "p"], -1]).json).toBe(0);
  expect(evalOf(["CDF", ["BinomialDistribution", 3, "p"], 5]).json).toBe(1);
});

test("a symbolic point keeps the BetaRegularized form", () => {
  expect(JSON.stringify(evalOf(["CDF", ["BinomialDistribution", "n", "p"], "k"]).json)).toContain("BetaRegularized");
});

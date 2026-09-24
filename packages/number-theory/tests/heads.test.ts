import { ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, operandsOf } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import { declareResidues } from "@enumeratio/residues/src";
import { declareNumberTheory } from "../src/declare.ts";

const ce = new ComputeEngine();
declareResidues(ce);
declareNumberTheory(ce);
const run = (expr: unknown): unknown =>
  ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate().json;

test("RationalReconstruction", () => {
  expect(run(["RationalReconstruction", 6, 11])).toEqual(["Rational", 1, 2]);
  expect(run(["RationalReconstruction", 3, 11])).toEqual(["RationalReconstruction", 3, 11]);
});

test("Gaussian integers reach the integer heads, as in Wolfram", () => {
  const c = (re: number, im: number) => ["Complex", re, im];
  const gaussian = ["KeyValuePair", "GaussianIntegers", "True"];
  expect(run(["Mod", c(7, 5), 3])).toEqual(c(1, -1));
  expect(run(["Mod", 7, 3])).toBe(1);
  expect(run(["Quotient", c(7, 5), c(2, 1)])).toEqual(c(4, 1));
  expect(run(["Quotient", -7, 2])).toBe(-4);
  expect(run(["GCD", c(3, 1), c(1, 3)])).toEqual(c(1, 1));
  expect(run(["LCM", c(3, 1), c(-1, 3)])).toEqual(c(3, 1));
  expect(run(["ExtendedGCD", c(3, 1), 5])).toEqual(["Tuple", c(1, 2), 2, -1]);
  expect(run(["ModularInverse", c(3, -1), c(5, 2)])).toEqual(c(-1, -1));
  expect(run(["PowerMod", c(2, 1), 2, 3])).toEqual(c(0, 1));
  expect(run(["IsPrime", c(2, 1)])).toBe("True");
  expect(run(["IsPrime", 5, gaussian])).toBe("False");
  expect(run(["IsPrime", 5])).toBe("True");
  expect(run(["IsPrime", ["List", 2, 3, 4]])).toEqual(["List", "True", "True", "False"]);
  expect(run(["FactorInteger", 5, gaussian])).toEqual([
    "List",
    ["Tuple", c(0, -1), 1],
    ["Tuple", c(1, 2), 1],
    ["Tuple", c(2, 1), 1],
  ]);
  expect(run(["Divisors", 5, gaussian])).toEqual(["List", 1, c(1, 2), c(2, 1), 5]);
  expect(run(["PowerModList", c(2, 1), ["Rational", 1, 2], 5])).toEqual([
    "List",
    c(-1, 2),
    c(1, -2),
  ]);
});

test("FactorInteger and Divisors over the integers, as in Wolfram", () => {
  expect(run(["FactorInteger", -12])).toEqual([
    "List",
    ["Tuple", -1, 1],
    ["Tuple", 2, 2],
    ["Tuple", 3, 1],
  ]);
  expect(run(["FactorInteger", 1])).toEqual(["List", ["Tuple", 1, 1]]);
  expect(run(["FactorInteger", 0])).toEqual(["List", ["Tuple", 0, 1]]);
  expect(run(["Divisors", -12])).toEqual(["List", 1, 2, 3, 4, 6, 12]);
  expect(run(["Divisors", 1])).toEqual(["List", 1]);
  expect(run(["Divisors", 0])).toEqual(["Divisors", 0]);
  // p³ for a 21-digit prime: compute-engine's own rho gives up here.
  const p = 100000000000000000039n;
  const factors = ce.box(["FactorInteger", { num: String(p ** 3n) }]).evaluate();
  expect(operandsOf(factors).map((t) => operandsOf(t).map(bigIntegerAt))).toEqual([[p, 3n]]);
  const divisors = ce.box(["Divisors", { num: String(p ** 2n) }]).evaluate();
  expect(operandsOf(divisors).map(bigIntegerAt)).toEqual([1n, p, p ** 2n]);
});

test("widened integer heads still leave a non-integer alone", () => {
  expect(run(["FactorInteger", 2.5])).toEqual(["FactorInteger", 2.5]);
  expect(run(["Divisors", ["Rational", 5, 2]])).toEqual(["Divisors", ["Rational", 5, 2]]);
  expect(run(["ExtendedGCD", 2.5, 3])).toEqual(["ExtendedGCD", 2.5, 3]);
  expect(run(["ExtendedGCD", 6, 4])).toEqual(["Tuple", 2, 1, -1]);
});

test("Gaussian results stay exact past a double", () => {
  const big = ["Complex", { num: "100000000000000000001" }, { num: "9007199254740993" }];
  expect(run(["Mod", big, ["Complex", 2, 1]])).toBe(0);
  expect(run(["GCD", big, ["Complex", 0, { num: "9007199254740993" }]])).toBeDefined();
});

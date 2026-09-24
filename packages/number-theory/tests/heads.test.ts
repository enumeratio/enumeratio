import { ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, operandsOf } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import { declareNumberTheory } from "../src/declare.ts";

const ce = new ComputeEngine();
declareNumberTheory(ce);
const run = (expr: unknown): unknown =>
  ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate().json;

test("PowerModList: roots, powers, inverses", () => {
  expect(run(["PowerModList", 3, ["Divide", 1, 2], 11])).toEqual(["List", 5, 6]);
  expect(run(["PowerModList", 1, ["Divide", 1, 2], 15])).toEqual(["List", 1, 4, 11, 14]);
  expect(run(["PowerModList", -1, ["Divide", 1, 2], 15])).toEqual(["List"]);
  expect(run(["PowerModList", 8, ["Divide", 1, 3], 13])).toEqual(["List", 2, 5, 6]);
  expect(run(["PowerModList", 2, 10, 100])).toEqual(["List", 24]);
  expect(run(["PowerModList", 3, -1, 7])).toEqual(["List", 5]);
  expect(run(["PowerModList", 2, -1, 4])).toEqual(["List"]);
  // x³ ≡ 2² (mod 13): 4 is not a cube mod 13
  expect(run(["PowerModList", 2, ["Rational", 2, 3], 13])).toEqual(["List"]);
  expect(run(["PowerModList", ["Rational", 2, 3], 1, 7])).toEqual(["List", 3]);
  expect(run(["PowerModList", ["List", 1, 4], ["Divide", 1, 2], 5])).toEqual([
    "List",
    ["List", 1, 4],
    ["List", 2, 3],
  ]);
  expect(run(["PowerModList", 1, ["Divide", 1, 2], "m"])).toEqual([
    "PowerModList",
    1,
    ["Rational", 1, 2],
    "m",
  ]);
});

test("PowerModList reaches moduli no scan could", () => {
  const cubeRoots = operandsOf(
    ce.box(["PowerModList", 2, ["Divide", 1, 3], ["Subtract", ["Power", 2, 89], 1]]).evaluate(),
  ).map(bigIntegerAt);
  expect(cubeRoots).toHaveLength(3);
  const p = 2n ** 89n - 1n;
  for (const root of cubeRoots) expect(root! ** 3n % p).toBe(2n);
});

test("PowerMod gains Wolfram's rational exponent, and keeps its native forms", () => {
  expect(run(["PowerMod", 4, ["Rational", 1, 2], 7])).toBe(2);
  expect(run(["PowerMod", 3, ["Rational", 1, 2], 2])).toBe(1);
  expect(run(["PowerMod", 2, ["Rational", 1, 2], 5])).toEqual([
    "PowerMod",
    2,
    ["Rational", 1, 2],
    5,
  ]);
  expect(run(["PowerMod", 2, 10, 3])).toBe(1);
  expect(run(["PowerMod", 3, -2, 7])).toBe(4);
  expect(run(["PowerMod", 2, ["List", 10, 11, 12, 13, 14], 5])).toEqual(["List", 4, 3, 1, 2, 4]);
});

test("MultiplicativeOrder gains the discrete-log form", () => {
  expect(run(["MultiplicativeOrder", 2, 7])).toBe(3);
  expect(run(["MultiplicativeOrder", 5, 7, ["List", 2, 3, 4]])).toBe(2);
  expect(run(["MultiplicativeOrder", 2, 7, ["List", 3]])).toEqual([
    "MultiplicativeOrder",
    2,
    7,
    ["List", 3],
  ]);
});

test("PrimitiveRootList and RationalReconstruction", () => {
  expect(run(["PrimitiveRootList", 7])).toEqual(["List", 3, 5]);
  expect(run(["PrimitiveRootList", 8])).toEqual(["List"]);
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

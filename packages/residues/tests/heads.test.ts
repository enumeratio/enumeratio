import { ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, operandsOf } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import { declareResidues } from "../src/declare.ts";

const ce = new ComputeEngine();
declareResidues(ce);
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

test("PrimitiveRootList", () => {
  expect(run(["PrimitiveRootList", 7])).toEqual(["List", 3, 5]);
  expect(run(["PrimitiveRootList", 8])).toEqual(["List"]);
  // Past the listing cap the head stays unevaluated, but its length and elements still answer.
  expect(run(["PrimitiveRootList", 1000003])).toEqual(["PrimitiveRootList", 1000003]);
  expect(run(["Length", ["PrimitiveRootList", 1000003]])).toBe(333332);
  expect(run(["At", ["PrimitiveRootList", 1000003], 1])).toBe(2);
});

test("IntegerMod normalises, and reads a rational through the inverse", () => {
  expect(run(["IntegerMod", 10, 7])).toEqual(["IntegerMod", 3, 7]);
  expect(run(["IntegerMod", -1, 7])).toEqual(["IntegerMod", 6, 7]);
  expect(run(["IntegerMod", ["Rational", 1, 3], 7])).toEqual(["IntegerMod", 5, 7]);
  expect(run(["IntegerMod", ["Rational", 1, 2], 4])).toEqual(["IntegerMod", ["Rational", 1, 2], 4]);
});

test("IntegerMod arithmetic", () => {
  const z7 = (a: number) => ["IntegerMod", a, 7];
  expect(run(["Add", z7(5), z7(4)])).toEqual(z7(2));
  expect(run(["Add", z7(5), 3])).toEqual(z7(1));
  expect(run(["Subtract", z7(2), z7(5)])).toEqual(z7(4));
  expect(run(["Multiply", z7(3), z7(5)])).toEqual(z7(1));
  expect(run(["Divide", 1, z7(3)])).toEqual(z7(5));
  expect(run(["Power", z7(3), 6])).toEqual(z7(1));
  expect(run(["Power", z7(3), -1])).toEqual(z7(5));
  expect(run(["Negate", z7(3)])).toEqual(z7(4));
  // Mixed moduli meet in ℤ/gcd, as in Sage.
  expect(run(["Add", ["IntegerMod", 2, 4], ["IntegerMod", 1, 6]])).toEqual(["IntegerMod", 1, 2]);
  // 2 is not a unit mod 4.
  expect(run(["Power", ["IntegerMod", 2, 4], -1])).toEqual(["Divide", 1, ["IntegerMod", 2, 4]]);
});

test("ChineseRemainder and MultiplicativeOrder take IntegerMod values", () => {
  expect(run(["ChineseRemainder", ["IntegerMod", 2, 3], ["IntegerMod", 3, 5]])).toEqual([
    "IntegerMod",
    8,
    15,
  ]);
  expect(run(["ChineseRemainder", ["IntegerMod", 1, 4], ["IntegerMod", 3, 6]])).toEqual([
    "IntegerMod",
    9,
    12,
  ]);
  expect(run(["ChineseRemainder", ["List", 3, 4], ["List", 4, 5]])).toBe(19);
  expect(run(["MultiplicativeOrder", ["IntegerMod", 2, 7]])).toBe(3);
});

test("Mod of a bare symbolic constant reduces exactly (#113)", () => {
  expect(run(["Mod", "Pi", 2])).toEqual(["Add", -2, "Pi"]);
  // Cross-check numerically: the exact symbolic result and a double both land in [0, 2).
  const exact = ce
    .box(["Mod", "Pi", 2] as never)
    .evaluate()
    .N().re;
  expect(exact).toBeCloseTo(Math.PI - 2, 10);
  expect(exact).toBeGreaterThanOrEqual(0);
  expect(exact).toBeLessThan(2);

  // ExponentialE mod 2: e ≈ 2.718, one period past 2.
  expect(run(["Mod", "ExponentialE", 2])).toEqual(["Add", -2, "ExponentialE"]);

  // A free (non-numeric) symbol is untouched — the wrapper declines.
  expect(run(["Mod", "x", 2])).toEqual(["Mod", "x", 2]);
});

test("IntegerModRing is ℤ/m as a finite collection", () => {
  expect(run(["QuotientRing", "Integers", 5])).toEqual(["IntegerModRing", 5]);
  expect(ce.parse("\\mathbb{Z}/6\\mathbb{Z}").evaluate().json).toEqual(["IntegerModRing", 6]);
  expect(run(["Count", ["IntegerModRing", 5]])).toBe(5);
  expect(run(["Element", ["IntegerMod", 3, 5], ["IntegerModRing", 5]])).toBe("True");
  expect(run(["Element", ["IntegerMod", 3, 7], ["IntegerModRing", 5]])).toBe("False");
  expect(run(["ListFrom", ["IntegerModRing", 3]])).toEqual([
    "List",
    ["IntegerMod", 0, 3],
    ["IntegerMod", 1, 3],
    ["IntegerMod", 2, 3],
  ]);
});

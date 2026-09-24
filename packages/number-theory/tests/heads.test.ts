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

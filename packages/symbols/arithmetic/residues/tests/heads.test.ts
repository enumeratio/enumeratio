import { createEngine } from "@enumeratio/engine/testing";
import { bigIntegerAt, operandsOf, type Json } from "@enumeratio/engine";
import { expect, test } from "vite-plus/test";
import { declareResidues } from "../src/declare.ts";

const ce = createEngine(declareResidues);

test("PowerModList reaches moduli no scan could", () => {
  const cubeRoots = operandsOf(
    ce.box(["PowerModList", 2, ["Divide", 1, 3], ["Subtract", ["Power", 2, 89], 1]]).evaluate(),
  ).map(bigIntegerAt);
  expect(cubeRoots).toHaveLength(3);
  const p = 2n ** 89n - 1n;
  for (const root of cubeRoots) expect(root! ** 3n % p).toBe(2n);
});

test("Mod of a bare symbolic constant reduces exactly (#113)", () => {
  // Cross-check numerically: the exact symbolic result and a double both land in [0, 2).
  const exact = ce
    .box(["Mod", "Pi", 2] as never)
    .evaluate()
    .N().re;
  expect(exact).toBeCloseTo(Math.PI - 2, 10);
  expect(exact).toBeGreaterThanOrEqual(0);
  expect(exact).toBeLessThan(2);
});

test("ℤ/m is QuotientRing(Integers, m), and IntegerModRing(m) is its alias", () => {
  const ring = ce.parse("\\mathbb{Z}/6\\mathbb{Z}").evaluate();
  expect(ring.json).toEqual(["QuotientRing", "Integers", 6]);
  expect(ring.count).toBe(6);
  expect(ce.box(["IntegerModRing", 6]).evaluate().json).toEqual(["QuotientRing", "Integers", 6]);
  expect(ce.box(["Count", ["IntegerModRing", 6]]).evaluate().json).toBe(6);
});

test("IntegerMod is the old spelling of compute-engine's ResidueClass", () => {
  expect(ce.box(["IntegerMod", 10, 7]).json).toEqual(["ResidueClass", 3, 7]);
  expect(ce.box(["Add", ["IntegerMod", 5, 7], 3]).evaluate().json).toEqual(["ResidueClass", 1, 7]);
  expect(ce.box(["Element", ["IntegerMod", 3, 7], ["IntegerModRing", 7]]).evaluate().json).toBe("True");
});

test("classes of two moduli stay as written; ChineseRemainder is the way across", () => {
  const mixed: Json = ["Add", ["ResidueClass", 2, 4], ["ResidueClass", 1, 6]];
  expect(ce.box(mixed).evaluate().json).toEqual(mixed);
  expect(ce.box(["ChineseRemainder", ["ResidueClass", 1, 4], ["ResidueClass", 3, 6]]).evaluate().json).toEqual([
    "ResidueClass",
    9,
    12,
  ]);
  expect(ce.box(["MultiplicativeOrder", ["ResidueClass", 2, 7]]).evaluate().json).toBe(3);
});

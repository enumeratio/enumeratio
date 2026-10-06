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

test("IntegerMod is ResidueClass's arithmetic over one ring", () => {
  expect(ce.box(["IntegerMod", 10, 7]).json).toEqual(["IntegerMod", 3, 7]);
  expect(ce.box(["Add", ["IntegerMod", 5, 7], 3]).evaluate().json).toEqual(["IntegerMod", 1, 7]);
  expect(ce.box(["Power", ["IntegerMod", 3, 7], -1]).evaluate().json).toEqual(["IntegerMod", 5, 7]);
  expect(ce.box(["Element", ["IntegerMod", 3, 7], ["IntegerModRing", 7]]).evaluate().json).toBe("True");
  expect(ce.box(["ChineseRemainder", ["IntegerMod", 2, 3], ["IntegerMod", 3, 5]]).evaluate().json).toEqual([
    "IntegerMod",
    8,
    15,
  ]);
});

// Values from Sage 10.9: Mod(2, 4) + Mod(1, 6) is 1 in Z/2, and so on.
test("IntegerMod classes of different moduli combine in Z/gcd, as in Sage", () => {
  const run = (expr: Json): Json => ce.box(expr).evaluate().json;
  const a: Json = ["IntegerMod", 2, 4];
  const b: Json = ["IntegerMod", 1, 6];
  expect(run(["Add", a, b])).toEqual(["IntegerMod", 1, 2]);
  expect(run(["Multiply", a, b])).toEqual(["IntegerMod", 0, 2]);
  expect(run(["Subtract", a, b])).toEqual(["IntegerMod", 1, 2]);
  expect(run(["Multiply", a, 5])).toEqual(a);
  expect(run(["Divide", ["IntegerMod", 1, 3], ["IntegerMod", 2, 6]])).toEqual(["IntegerMod", 2, 3]);
  expect(run(["Add", ["IntegerMod", 4, 8], ["IntegerMod", 3, 12], ["IntegerMod", 1, 4]])).toEqual(["IntegerMod", 0, 4]);
  expect(run(["Equal", a, ["IntegerMod", 0, 2]])).toBe("True");
  expect(run(["Equal", a, b])).toBe("False");
  expect(run(["Equal", a, 6])).toBe("True");
  expect(run(["NotEqual", a, b])).toBe("True");
});

test("IntegerMod declines what Sage rejects, and never mixes with ResidueClass", () => {
  const stays = (expr: Json): void => expect(ce.box(expr).evaluate().json).toEqual(ce.box(expr).json);
  stays(["Add", ["IntegerMod", 3, 4], ["IntegerMod", 5, 7]]); // gcd 1: no common ring
  stays(["Divide", ["IntegerMod", 1, 6], ["IntegerMod", 2, 4]]); // 0 in Z/2 is no unit
  stays(["Power", ["IntegerMod", 2, 4], -1]);
  stays(["Add", ["IntegerMod", 2, 4], ["ResidueClass", 1, 6]]);
  stays(["Equal", ["IntegerMod", 2, 4], ["IntegerMod", 1, 3]]);
  // The strict head is unchanged.
  stays(["Add", ["ResidueClass", 2, 4], ["ResidueClass", 1, 6]]);
});

test("IntegerMod keeps its operands exact under N", () => {
  expect(ce.box(["IntegerMod", ["Rational", 1, 2], 4]).N().json).toEqual(["IntegerMod", ["Rational", 1, 2], 4]);
  expect(ce.box(["Add", ["IntegerMod", 2, 4], ["IntegerMod", 1, 6]]).N().json).toEqual(["IntegerMod", 1, 2]);
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

import { createEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareNumerals } from "@enumeratio/numerals";
import { declareNumberTheory } from "../src/declare.ts";

const ce = createEngine(declareNumerals, declareNumberTheory);
// The bare engine keeps the precision `N(expr, d)` set, so each call restores it.
const n = (expr: unknown, digits?: number) => {
  const precision = ce.precision;
  try {
    return digits ? ce.box(["N", expr, digits] as never).evaluate() : ce.box(expr as never).N();
  } finally {
    ce.precision = precision;
  }
};

// A bignum prints as `{num: "…"}`; a machine number as a plain JS number.
const isMachine = (e: { json: unknown }) => !JSON.stringify(e.json).includes('"num"');

const i = ["Complex", 0, 1];
const onePlusI = ["Complex", 1, 1];

// Wrappers whose route runs on double-only kernels (complex Gamma, the complex incomplete
// Gamma, complex Cos): the result is the machine double it is, never padded to engine
// precision, and an explicit digit count past a double declines.
const doubleOnly: [string, unknown][] = [
  ["Subfactorial of a real", ["Subfactorial", 2.5]],
  ["CatalanNumber of a complex", ["CatalanNumber", onePlusI]],
  ["Pochhammer of a complex", ["Pochhammer", 2.5, i]],
  ["Binomial of a complex", ["Binomial", onePlusI, 2.5]],
  ["Multinomial of a complex", ["Multinomial", onePlusI, 2.5]],
  ["Fibonacci at a complex index", ["Fibonacci", onePlusI]],
  ["LucasL at a complex index", ["LucasL", onePlusI]],
];

for (const [name, expr] of doubleOnly) {
  test(`${name} boxes as a machine number at default precision`, () => {
    const result = n(expr);
    expect(Number.isFinite(result.re)).toBe(true);
    expect(isMachine(result)).toBe(true);
  });
  test(`${name} declines past a double's digits`, () => {
    const head = (expr as unknown[])[0] as string;
    expect(n(expr, 50).operator).toBe(head);
  });
}

test("a real operand's Gamma route is bignum-backed, and still evaluates past a double", () => {
  for (const expr of [
    ["CatalanNumber", 2.5],
    ["Pochhammer", 2.5, 1.5],
    ["Multinomial", 2.5, 1.5],
  ]) {
    const result = n(expr, 30);
    expect(isMachine(result)).toBe(false);
  }
  expect(n(["CatalanNumber", 2.5], 30).re).toBeCloseTo(3.104279270973349, 14);
});

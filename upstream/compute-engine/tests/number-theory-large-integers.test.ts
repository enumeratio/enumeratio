import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyPatch, numberTheoryLargeIntegers } from "../src/index.ts";

// Only the ModularInverse sign fix lives here -- see number-theory-large-integers/patch.ts
// for why FactorInteger, Divisors and MultiplicativeOrder's large-integer fixes stay in
// @enumeratio/number-theory and @enumeratio/residues instead of moving.

const ce = new ComputeEngine();
applyPatch(ce, numberTheoryLargeIntegers);

test("ModularInverse takes the sign of a negative modulus", () => {
  expect(ce.box(["ModularInverse", 3, -7]).evaluate().json).toEqual(-2);
  expect(ce.box(["ModularInverse", 1, -1]).evaluate().json).toEqual(0);
});

test("agrees with the positive-modulus answer up to sign", () => {
  const positive = ce.box(["ModularInverse", 3, 7]).evaluate().json;
  const negative = ce.box(["ModularInverse", 3, -7]).evaluate().json;
  expect(negative).toEqual((positive as number) - 7);
});

test("still declines when gcd(a, m) ≠ 1", () => {
  expect(ce.box(["ModularInverse", 2, -4]).evaluate().json).toEqual(["ModularInverse", 2, -4]);
});

test("positive modulus is untouched (native answers directly)", () => {
  expect(ce.box(["ModularInverse", 3, 7]).evaluate().json).toEqual(5);
});

test("applying twice is a no-op", () => {
  applyPatch(ce, numberTheoryLargeIntegers);
  expect(ce.box(["ModularInverse", 3, -7]).evaluate().json).toEqual(-2);
});

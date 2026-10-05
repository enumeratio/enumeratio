// Parameters are arguments, never declared constants: `QPochhammer(a, q, n)`, not a declared
// `q` (hecke's `q` is the argument of `HeckeAlgebra(n, q)`). A declared nullary symbol holds a
// value or is a constant, so it is a fixture of the global namespace; this lists every one and
// the reason it is allowed to be.

import { expect, test } from "vite-plus/test";
import { declaredValues } from "../src/engine.ts";

/** Collections are sets of values, named plurally (`Primes`, `FibonacciNumbers`). */
const COLLECTION = /^(set|indexed_collection)</;

/** The other nullary symbols, each with why it is not a parameter. */
const ALLOWED: Record<string, string> = {
  Aborted: "a status tag, the value a cancelled evaluation reports",
  ConstGlaisher: "the Glaisher–Kinkelin constant",
  Khinchin: "Khinchin's constant",
  Quaternions: "the algebra of quaternions, a fixed algebra",
  H_doublestruck: "the quaternion algebra as Wolfram's ℍ",
  BicomplexNumbers: "a fixed hypercomplex algebra",
  TricomplexNumbers: "a fixed hypercomplex algebra",
  SplitComplexNumbers: "a fixed hypercomplex algebra",
  DualNumbers: "a fixed hypercomplex algebra",
  // Old numeral-system names, kept as aliases of the …Numerals heads (BL-89).
  Factoradic: "an old numeral-system name, an alias of the …Numerals head",
  PrimorialRadix: "an old numeral-system name, an alias of the …Numerals head",
  Zeckendorf: "an old numeral-system name, an alias of the …Numerals head",
};

const values = declaredValues();

test("a declared value is a collection or an allowlisted constant, with a reason", () => {
  const stray = values.filter(({ name, type }) => !COLLECTION.test(type) && ALLOWED[name] === undefined);
  expect(stray).toEqual([]);
});

test("the allowlist names only values that are still declared", () => {
  const declared = new Set(values.map(({ name }) => name));
  expect(Object.keys(ALLOWED).filter((name) => !declared.has(name))).toEqual([]);
});

test("the census sees the collections and constants", () => {
  const declared = new Set(values.map(({ name }) => name));
  expect(declared.has("PrimeNumbers")).toBe(true);
  expect(declared.has("Khinchin")).toBe(true);
  expect(declared.has("HeckeParameter")).toBe(false);
});

import type { Json } from "@enumeratio/engine";
import { createEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareResidues } from "../src/declare.ts";

// BL-238: where IntegerMod differs from CE's ResidueClass. IntegerMod is typed `residue`, so CE
// protects it as a class; its arithmetic stays ours. A row changing is news, not necessarily a regression.

const ce = createEngine(declareResidues);
const ev = (e: unknown): unknown => ce.box(e as Json).evaluate().json;
const simp = (e: unknown): unknown => ce.box(e as Json).simplify().json;
const both = (build: (head: string) => unknown, fn: (e: unknown) => unknown): [unknown, unknown] => [
  fn(build("IntegerMod")),
  fn(build("ResidueClass")),
];

test("mixed moduli combine in Z/gcd for IntegerMod, stay as written for ResidueClass", () => {
  const [im, rc] = both((H) => ["Add", [H, 2, 4], [H, 1, 6]], ev);
  expect(im).toEqual(["IntegerMod", 1, 2]);
  expect(rc).toEqual(["Add", ["ResidueClass", 2, 4], ["ResidueClass", 1, 6]]);
});

test("equality reads a plain integer, and mixed moduli, in the common ring for IntegerMod only", () => {
  const [im, rc] = both((H) => ["Equal", [H, 2, 7], 9], ev);
  expect(im).toBe("True");
  expect(rc).toEqual(["Equal", ["ResidueClass", 2, 7], 9]);
});

test("a class mod 1 absorbs the other class for IntegerMod only", () => {
  const [im, rc] = both((H) => ["Add", [H, 5, 1], [H, 2, 7]], ev);
  expect(im).toEqual(["IntegerMod", 0, 1]);
  expect(rc).toEqual(["Add", ["ResidueClass", 0, 1], ["ResidueClass", 2, 7]]);
});

test("simplify(): only ResidueClass sums fold beside a symbol, not IntegerMod's; both keep a non-unit quotient and Equal(c, c)", () => {
  const sum = (H: string): unknown => ["Add", "x", [H, 2, 4], [H, 1, 4]];
  expect(simp(sum("ResidueClass"))).toEqual(["Add", "x", ["ResidueClass", 3, 4]]);
  expect(simp(sum("IntegerMod"))).toEqual(["Add", "x", ["IntegerMod", 2, 4], ["IntegerMod", 1, 4]]);
  for (const H of ["ResidueClass", "IntegerMod"]) {
    // A non-unit over itself is not 1.
    expect(simp(["Divide", [H, 2, 4], [H, 2, 4]])).toEqual(["Divide", [H, 2, 4], [H, 2, 4]]);
    expect(simp(["Equal", [H, 2, 7], [H, 2, 7]])).toBe("True");
  }
});

test("Simplify(...) folds IntegerMod beside a symbol through our wrapper, not .simplify()", () => {
  expect(ev(["Simplify", ["Add", "x", ["IntegerMod", 2, 4], ["IntegerMod", 1, 4]]])).toEqual([
    "Add",
    "x",
    ["IntegerMod", 3, 4],
  ]);
});

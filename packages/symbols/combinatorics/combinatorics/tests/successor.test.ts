// Successor(c, x): the rank kernel's answer against the Epsil definition (IndexOf, then At), element
// by element over small families, plus the cases the definition leaves unevaluated.

import { bareEngine } from "@enumeratio/engine/testing";
import { evaluateEpsil } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { SUCCESSOR_EPSIL } from "../collections/src/successor.ts";
import { declareCombinatorics } from "../src/index.ts";

const ce = bareEngine();
declareCombinatorics(ce);

const value = (expr: unknown): unknown => ce.box(expr as never).evaluate().json;

const FAMILIES: unknown[] = [
  ["Permutations", 4],
  ["IntegerPartitions", 7],
  ["WeakCompositions", 4, 3],
  ["StandardTableaux", 5],
  ["Subsets", 4],
  ["KSubsets", 6, 3],
  ["BinaryStrings", 3],
  ["GrayCodeSubsets", 4],
];

for (const family of FAMILIES) {
  test(`${JSON.stringify(family)}: the kernel agrees with the definition at every element`, () => {
    const total = ce.box(["Count", family] as never).evaluate().re;
    const elements = Array.from({ length: total }, (_, i) => value(["At", family, i + 1]));
    elements.forEach((element, i) => {
      const defined = evaluateEpsil(ce, SUCCESSOR_EPSIL, { _c: value(family), _x: element });
      const answer = value(["Successor", family, element]);
      if (i === total - 1) {
        expect(defined, "definition at the last element").toEqual("Nothing");
        expect(answer, "kernel at the last element").toEqual(["Successor", value(family), element]);
      } else {
        expect(answer, `kernel after element ${i + 1}`).toEqual(elements[i + 1]);
        expect(defined, `definition after element ${i + 1}`).toEqual(elements[i + 1]);
      }
    });
  });
}

test("a non-member stays unevaluated", () => {
  const stays = (c: unknown, x: unknown): void =>
    expect(value(["Successor", c, x])).toEqual(["Successor", value(c), x]);
  stays(["KSubsets", 5, 2], ["Finset", ["Tuple", 5, ["List", 1, 2, 3]]]);
  stays(["Permutations", 3], ["List", 1, 1, 2]);
  stays(["IntegerPartitions", 6], ["IntegerPartition", ["List", 5, 2]]);
});

test("the next of a list is the definition's", () => {
  expect(value(["Successor", ["List", 5, 7, 9], 7])).toEqual(9);
  expect(value(["Successor", ["List", 5, 7, 9], 9])).toEqual(["Successor", ["List", 5, 7, 9], 9]);
  expect(value(["Successor", ["List", 5, 7, 9], 4])).toEqual(["Successor", ["List", 5, 7, 9], 4]);
});

test("wrapping around: Successor, and At with Mod where it stays unevaluated", () => {
  const family = ["KSubsets", 5, 2];
  const total = ce.box(["Count", family] as never).evaluate().re;
  for (let i = 1; i <= total; i++) {
    const x = value(["At", family, i]);
    const after = value(["Successor", family, x]);
    const wrapped = i === total ? value(["At", family, ["Add", ["Mod", ["IndexOf", family, x], total], 1]]) : after;
    expect(wrapped, `after element ${i}`).toEqual(value(["At", family, (i % total) + 1]));
  }
});

test("a family without params, used as a symbol, is ranked too", () => {
  expect(value(["Successor", "PrimeNumbers", 7])).toEqual(11);
});

test("a large family is answered by rank, not by walking", () => {
  const last = ["At", ["Permutations", 12], 479001599];
  expect(value(["Successor", ["Permutations", 12], last])).toEqual(value(["At", ["Permutations", 12], 479001600]));
});

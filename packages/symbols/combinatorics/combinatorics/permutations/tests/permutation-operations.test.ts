// PermutationProduct / PermutationPower on `Permutation` values agree with their one-line-word and
// `Cycles` readings (values checked against a Wolfram kernel in groupalgebra's tests).
import { operandsOf } from "@enumeratio/engine";
import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareGroupAlgebra } from "@enumeratio/groupalgebra";
import { declareCombinatorics } from "../../src/index.ts";

const ce = bareEngine();
declareGroupAlgebra(ce);
declareCombinatorics(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const L = (...xs: number[]): Expr => ["List", ...xs];
const P = (...xs: number[]): Expr => ["Permutation", L(...xs)];
const C = (...cycles: number[][]): Expr => ["Cycles", ["List", ...cycles.map((c) => L(...c))]];
const json = (e: Expr) => ce.box(e).evaluate().json;

test("PermutationProduct of Permutations: left factor first, a Permutation back", () => {
  expect(json(["PermutationProduct", P(2, 3, 1), P(2, 1, 3)])).toEqual(json(P(1, 3, 2)));
  expect(json(["PermutationProduct", P(2, 1), P(1, 3, 2)])).toEqual(json(P(3, 1, 2))); // padded
  expect(json(["PermutationProduct", P(2, 3, 1)])).toEqual(json(P(2, 3, 1)));
});

test("a Permutation and a list or Cycles argument: Cycles if any is, else a Permutation", () => {
  expect(json(["PermutationProduct", P(2, 3, 1), C([1, 2])])).toEqual(json(C([2, 3])));
  expect(json(["PermutationProduct", C([1, 2]), P(2, 3, 1)])).toEqual(json(C([1, 3])));
  expect(json(["PermutationProduct", P(2, 3, 1), L(2, 1, 3)])).toEqual(json(P(1, 3, 2)));
});

test("PermutationPower of a Permutation", () => {
  expect(json(["PermutationPower", P(2, 3, 1), 2])).toEqual(json(P(3, 1, 2)));
  expect(json(["PermutationPower", P(2, 3, 1), -1])).toEqual(json(P(3, 1, 2)));
  expect(json(["PermutationPower", P(2, 3, 1), 0])).toEqual(json(P(1, 2, 3)));
});

test("the same inputs agree across Permutation, word and Cycles", () => {
  const word = ce.box(["PermutationProduct", L(2, 3, 1), L(2, 1, 3)]).evaluate();
  const carried = ce.box(["PermutationProduct", P(2, 3, 1), P(2, 1, 3)]).evaluate();
  expect(carried.operator).toBe("Permutation");
  expect(operandsOf(carried)[0]?.json).toEqual(word.json);
});

test("a Permutation of invalid word stays unevaluated", () => {
  expect(ce.box(["PermutationPower", P(1, 1, 2), 2]).evaluate().operator).toBe("PermutationPower");
});

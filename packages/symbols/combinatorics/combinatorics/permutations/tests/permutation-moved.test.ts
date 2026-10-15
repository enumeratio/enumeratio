// The moved-point statistic, as Wolfram's PermutationSupport reads a permutation.
import { expect, test } from "vite-plus/test";
import { applyDefinition } from "../../src/statistics/declare.ts";
import { ce, checkAgainstEngine, index } from "./permutation-helpers.ts";

checkAgainstEngine(["PermutationSupport"]);

const support = (p: number[]) =>
  applyDefinition(ce, index.get("PermutationSupport@Permutation")!, ce.box(["List", ...p])).json;

test("PermutationSupport lists the moved points ascending", () => {
  expect(support([5, 3, 4, 2, 1])).toEqual(["List", 1, 2, 3, 4, 5]);
  expect(support([1, 3, 2, 4])).toEqual(["List", 2, 3]);
  expect(support([1, 2, 3])).toEqual(["List"]);
});

// Wolfram's PermutationLength, PermutationMax and PermutationMin are these of the support. At
// the identity Max and Min of an empty list are NaN here, so they carry the bound that
// Wolfram's heads have (0 and infinity).
test("PermutationLength, PermutationMax and PermutationMin read off the support", () => {
  const of = (head: string, p: number[], ...bound: (string | number)[]) =>
    ce.box([head, ...bound, support(p)] as never).evaluate().json;
  expect(of("Length", [5, 3, 4, 2, 1])).toBe(5);
  expect(of("Length", [1, 2, 3])).toBe(0);
  expect(of("Max", [2, 1, 3, 4], 0)).toBe(2);
  expect(of("Max", [1, 2, 3], 0)).toBe(0);
  expect(of("Min", [1, 3, 2, 4], "PositiveInfinity")).toBe(2);
  expect(of("Min", [1, 2, 3], "PositiveInfinity")).toBe("PositiveInfinity");
});

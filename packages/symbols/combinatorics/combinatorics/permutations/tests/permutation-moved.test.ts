// The moved-point statistics, as Wolfram's PermutationLength / Max / Min / Support read a permutation.
import { expect, test } from "vite-plus/test";
import { applyDefinition } from "../../src/statistics/declare.ts";
import { ce, checkAgainstEngine, index } from "./permutation-helpers.ts";

checkAgainstEngine(["PermutationLength", "PermutationMax", "PermutationMin"]);

test("PermutationSupport lists the moved points ascending", () => {
  const support = (p: number[]) =>
    applyDefinition(ce, index.get("PermutationSupport@Permutation")!, ce.box(["List", ...p])).json;
  expect(support([5, 3, 4, 2, 1])).toEqual(["List", 1, 2, 3, 4, 5]);
  expect(support([1, 3, 2, 4])).toEqual(["List", 2, 3]);
  expect(support([1, 2, 3])).toEqual(["List"]);
});

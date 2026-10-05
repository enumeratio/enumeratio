// A subset of 1..n and its characteristic word: the conversions invert each other, and the
// bitmask order of subsets is BinaryWords(n) read through Finset(word).

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { CARRIERS, declareCombinatorics, declareMaps } from "../src/index.ts";

const ce = bareEngine();
declareCombinatorics(ce);
declareMaps(ce, Object.fromEntries(CARRIERS.map((c) => [c.type, c.name])));
const json = (expr: unknown): unknown => ce.box(expr as never).evaluate().json;

test("a subset and its characteristic word convert both ways", () => {
  const subset = ["Finset", ["Tuple", 5, ["List", 2, 3, 5]]];
  expect(json(["BinaryWord", subset])).toEqual(["BinaryWord", ["List", 0, 1, 1, 0, 1]]);
  expect(json(["Finset", ["BinaryWord", subset]])).toEqual(json(subset));
});

test("BinaryWords(n) through Finset(word) lists the subsets in their words' order", () => {
  const members = Array.from({ length: 8 }, (_, i) => json(["Finset", ["At", ["BinaryWords", 3], i + 1]]));
  expect(members.map((s) => (s as unknown[])[1])).toEqual([
    ["Tuple", 3, ["List"]],
    ["Tuple", 3, ["List", 3]],
    ["Tuple", 3, ["List", 2]],
    ["Tuple", 3, ["List", 2, 3]],
    ["Tuple", 3, ["List", 1]],
    ["Tuple", 3, ["List", 1, 3]],
    ["Tuple", 3, ["List", 1, 2]],
    ["Tuple", 3, ["List", 1, 2, 3]],
  ]);
});

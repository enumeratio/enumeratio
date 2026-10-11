// Through the engine, `Count` past 2^53 is an exact integer for every area's families, not only the
// permutations': the `count` handler can't carry it, so `Count` answers from the kernel.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareCombinatorics } from "../src/index.ts";

const engine = bareEngine();
declareCombinatorics(engine);
const count = (expr: unknown): unknown => engine.box(["Count", expr] as never).evaluate().json;
const exactly = (n: bigint): unknown => ({ num: n.toString() });

/** C(n, k) by the multiplicative formula. */
const binomial = (n: number, k: number): bigint => {
  let result = 1n;
  for (let i = 1; i <= k; i++) result = (result * BigInt(n - k + i)) / BigInt(i);
  return result;
};

test("Count of a trees, words, tableaux or collections family past 2^53 is exact", () => {
  expect(count(["BinaryTrees", 40])).toEqual(exactly(binomial(80, 40) / 41n));
  expect(count(["FullKAryTrees", 20, 5])).toEqual(exactly(binomial(100, 20) / 81n));
  expect(count(["NonDecreasingParkingFunctions", 40])).toEqual(exactly(binomial(80, 40) / 41n));
  expect(count(["SytTwoRow", 80])).toEqual(exactly(binomial(80, 40)));
  expect(count(["Tuples", 7, 19])).toEqual(exactly(7n ** 19n));
});

test("Count below 2^53 is still the plain number", () => {
  expect(count(["BinaryTrees", 10])).toBe(16796);
});

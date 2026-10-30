import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { compileBigint, fromBigint, isBigintDecline, toBigint } from "../src/compiled-bigint.ts";

const ce = new ComputeEngine();
const run = (expression: unknown, types: Record<string, string>, vars: Record<string, unknown>): unknown =>
  compileBigint(ce, expression, types)!.run(toBigint(vars) as Record<string, unknown>);

test("integer arithmetic is exact past 2^53", () => {
  expect(run(["Multiply", "_n", "_n"], { _n: "integer" }, { _n: 94906267 })).toBe(94906267n * 94906267n);
});

test("a division is exact, and declines (RangeError) where it isn't", () => {
  const divide = ["Divide", "_n", 2];
  expect(run(divide, { _n: "integer" }, { _n: 2 ** 60 })).toBe(2n ** 59n);
  expect(() => run(divide, { _n: "integer" }, { _n: 7 })).toThrow(RangeError);
});

test("Binomial and a fold over a range are exact", () => {
  expect(run(["Binomial", 70, "_k"], { _k: "integer" }, { _k: 35 })).toBe(112186277816662845432n);
  const factorial = ["Fold", ["Function", ["Multiply", "a", "i"], "a", "i"], 1, ["Range", 1, "_n", 1]];
  expect(run(factorial, { _n: "integer" }, { _n: 25 })).toBe(15511210043330985984000000n);
});

test("a list of integers in, a list out", () => {
  const sum = ["Fold", ["Function", ["Add", "a", ["At", "_x", "i"]], "a", "i"], 0, ["Range", 1, 2, 1]];
  expect(run(sum, { _x: "list<integer>" }, { _x: [2 ** 52, 2 ** 52, 5] })).toBe(2n ** 53n);
});

test("what mixes in a real declines with a TypeError", () => {
  let error: unknown;
  try {
    run(["Sqrt", "_n"], { _n: "integer" }, { _n: 16 });
  } catch (e) {
    error = e;
  }
  expect(isBigintDecline(error)).toBe(true);
});

test("results come back as numbers where a double holds them", () => {
  expect(fromBigint([1n, 2n ** 60n])).toEqual([1, 2n ** 60n]);
});

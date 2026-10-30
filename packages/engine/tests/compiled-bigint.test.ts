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

test("a power of two is exact, and floor(log2) by shifting needs no Log", () => {
  expect(run(["Power", 2, "_k"], { _k: "integer" }, { _k: 100 })).toBe(2n ** 100n);
  const shift = [
    "Function",
    [
      "If",
      ["GreaterEqual", ["At", "s", 1], ["Power", 2, "k"]],
      [
        "List",
        ["Divide", ["Subtract", ["At", "s", 1], ["Mod", ["At", "s", 1], ["Power", 2, "k"]]], ["Power", 2, "k"]],
        ["Add", ["At", "s", 2], "k"],
      ],
      "s",
    ],
    "s",
    "k",
  ];
  const log2 = ["At", ["Fold", shift, ["List", "_x", 0], ["List", 64, 32, 16, 8, 4, 2, 1]], 2];
  expect(run(log2, { _x: "integer" }, { _x: 2 ** 60 + 5 })).toBe(60n);
});

test("an equality of integers past 2^53 holds", () => {
  const same = ["If", ["And", ["Equal", ["At", "_x", 1], "_n"], ["Less", ["At", "_x", 1], 2 ** 62]], 1, 0];
  const types = { _x: "list<integer>", _n: "integer" };
  expect(run(same, types, { _x: [2 ** 60], _n: 2 ** 60 })).toBe(1n);
  expect(run(same, types, { _x: [2 ** 60], _n: 2 ** 61 })).toBe(0n);
});

test("Take, Drop, Min, Max and Length work on bigint counts", () => {
  const types = { _x: "list<integer>", _n: "integer" };
  const vars = { _x: [10, 20, 30, 2 ** 60], _n: 2 };
  expect(run(["Take", "_x", "_n"], types, vars)).toEqual([10n, 20n]);
  expect(run(["Drop", "_x", ["Add", "_n", 1]], types, vars)).toEqual([2n ** 60n]);
  expect(run(["Max", "_n", ["At", "_x", 4]], types, vars)).toBe(2n ** 60n);
  expect(run(["Min", "_n", ["At", "_x", 4]], types, vars)).toBe(2n);
  expect(run(["Add", ["Length", "_x"], "_n"], types, vars)).toBe(6n);
});

test("a list's length bounds a range, and ReplaceAt copies", () => {
  const types = { _x: "list<integer>" };
  const sum = ["Fold", ["Function", ["Add", "a", ["At", "_x", "i"]], "a", "i"], 0, ["Range", 1, ["Length", "_x"], 1]];
  expect(run(sum, types, { _x: [2 ** 60, 1, 2] })).toBe(2n ** 60n + 3n);
  const x = [1n, 2n, 3n];
  const replaced = ["ReplaceAt", "_x", 2, ["Add", ["At", "_x", 1], 2 ** 60]];
  expect(run(replaced, types, { _x: x })).toEqual([1n, 2n ** 60n + 1n, 3n]);
});

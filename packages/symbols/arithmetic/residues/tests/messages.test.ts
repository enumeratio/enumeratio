import { ComputeEngine } from "@cortex-js/compute-engine";
import { collectMessages, messageLine } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import { declareResidues } from "../src/declare.ts";

const ce = new ComputeEngine();
declareResidues(ce);

/** The result, and the messages evaluating it emitted. */
const run = (expr: unknown): [unknown, string[]] => {
  const { value, messages } = collectMessages(ce, () => ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate());
  return [value.json, messages.map(messageLine)];
};

const NINV = "IntegerMod::ninv: 2 is not a unit mod 4; gcd(2, 4) = 2.";

test("a non-unit divisor declines, and says why", () => {
  expect(run(["Divide", 1, ["IntegerMod", 2, 4]])).toEqual([["Divide", 1, ["IntegerMod", 2, 4]], [NINV]]);
  expect(run(["Divide", ["IntegerMod", 1, 4], ["IntegerMod", 6, 8]])[1]).toEqual([NINV]);
  expect(run(["Power", ["IntegerMod", 2, 4], -3])[1]).toEqual([NINV]);
  expect(run(["IntegerMod", ["Rational", 1, 2], 4])[1]).toEqual([NINV]);
  // A unit is quiet.
  expect(run(["Divide", 1, ["IntegerMod", 3, 4]])).toEqual([["IntegerMod", 3, 4], []]);
});

test("an inconsistent Chinese remainder names the clashing pair, in either form", () => {
  const nsol =
    "ChineseRemainder::nsol: No integer is 1 mod 4 and 2 mod 6: gcd(4, 6) = 2 does not divide their difference.";
  expect(run(["ChineseRemainder", ["IntegerMod", 1, 4], ["IntegerMod", 2, 6]])[1]).toEqual([nsol]);
  expect(run(["ChineseRemainder", ["List", 1, 2], ["List", 4, 6]])).toEqual([
    ["ChineseRemainder", ["List", 1, 2], ["List", 4, 6]],
    [nsol],
  ]);
  expect(run(["ChineseRemainder", ["List", 1, 3], ["List", 4, 6]])).toEqual([9, []]);
});

test("a class of a class is read in the smaller ring", () => {
  expect(run(["IntegerMod", ["IntegerMod", 5, 6], 3])).toEqual([["IntegerMod", 2, 3], []]);
});

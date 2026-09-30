import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyPatch, exactRounding } from "../src/index.ts";

// Floor/Ceil/Round/Truncate of an exact rational, against Python's exact integer arithmetic
// (fractions.Fraction; Round is half away from zero, as compute-engine's own Round is).
// [numerator, denominator, floor, ceil, round, truncate]
const cases: [string, string, string, string, string, string][] = [
  ["15511210043330985983999999", "620448401733239439360000", "24", "25", "25", "24"],
  [
    "15511210043330985983999999",
    "3",
    "5170403347776995327999999",
    "5170403347776995328000000",
    "5170403347776995328000000",
    "5170403347776995327999999",
  ],
  ["-15511210043330985983999999", "620448401733239439360000", "-25", "-24", "-25", "-24"],
  [
    "31022420086661971967999999",
    "2",
    "15511210043330985983999999",
    "15511210043330985984000000",
    "15511210043330985984000000",
    "15511210043330985983999999",
  ],
  [
    "-31022420086661971967999999",
    "2",
    "-15511210043330985984000000",
    "-15511210043330985983999999",
    "-15511210043330985984000000",
    "-15511210043330985983999999",
  ],
  ["5", "2", "2", "3", "3", "2"],
  ["-5", "2", "-3", "-2", "-3", "-2"],
  ["7", "3", "2", "3", "2", "2"],
  ["-7", "3", "-3", "-2", "-2", "-2"],
  ["1000000000000000000000000000001", "1000000000000000000000000000000", "1", "2", "1", "1"],
];

const ce = new ComputeEngine();
applyPatch(ce, exactRounding);

const big = (s: string) => (Number.isSafeInteger(Number(s)) ? Number(s) : { num: s });
// The exact integer as compute-engine writes it (a long one may print as `…e+6`).
const exact = (s: string) => ce.number(BigInt(s)).json;

for (const [n, d, ...expected] of cases) {
  (["Floor", "Ceil", "Round", "Truncate"] as const).forEach((head, i) => {
    test(`${head}(${n}/${d}) = ${expected[i]}`, () => {
      const value = ce.box([head, ["Divide", big(n), big(d)]] as never).evaluate().json;
      expect(value).toEqual(exact(expected[i]!));
    });
  });
}

test("a float operand and Round(x, n) are left to the native handlers", () => {
  expect(ce.box(["Floor", 2.7]).evaluate().json).toBe(2);
  expect(ce.box(["Round", 3.14159, 2]).evaluate().json).toEqual(["Rational", 157, 50]);
});

import { expect, test } from "vite-plus/test";
import { compareMachine } from "../src/compare.ts";
import type { MathJSON } from "../src/emit.ts";

// One of ours as a double, as the scan reads it: literals and ratios, nothing it would have to evaluate.
const value = (expr: MathJSON): number | undefined => {
  if (typeof expr === "number") return expr;
  if (Array.isArray(expr) && expr[0] === "Rational") return (expr[1] as number) / (expr[2] as number);
  return undefined;
};
const against = (expected: MathJSON, theirs: string) => compareMachine(expected, theirs, 1e-9, value);

test("an integer or a ratio of ours is compared exactly, however large", () => {
  expect(against(120, "120")).toBe("agree");
  expect(against(120, "121")).toBe("disagree");
  // A double would hold both of these as one number.
  expect(against({ num: "1000000000000000000000000" }, "1000000000000000000000001")).toBe("disagree");
  expect(against({ num: "1000000000000000000000000" }, "1000000000000000000000000")).toBe("agree");
  expect(against(["Rational", 1, 3], "1/3")).toBe("agree");
  expect(against(["Rational", 2, 6], "1/3")).toBe("agree");
  expect(against(["Rational", 1, 3], "1/4")).toBe("disagree");
  expect(against(["Rational", -1, 2], "-1/2")).toBe("agree");
});

test("a double is compared relative to its size, so a tiny answer cannot agree with zero", () => {
  expect(against(0.1, "0.10000000001")).toBe("agree");
  expect(against(0.1, "0.1001")).toBe("disagree");
  // compare()'s absolute floor of 1 would call these equal.
  expect(against(0, "1.2246467991473532e-16")).toBe("disagree");
  expect(against(3e-12, "4e-12")).toBe("disagree");
  expect(against(3e-12, "3.000000000001e-12")).toBe("agree");
  // An exact integer against a double (a statrs factorial) is a relative comparison.
  expect(against(2432902008176640000, "2.43290200817664e18")).toBe("agree");
  expect(against({ num: "15511210043330985984000000" }, "1.5511210043330986e25")).toBe("agree");
});

test("a list or a tuple is compared entry by entry, and one entry is enough to disagree", () => {
  expect(against(["List", 1, ["Rational", 1, 2]], "[1, 1/2]")).toBe("agree");
  expect(against(["List", 1, ["Rational", 1, 2]], "[1, 1/3]")).toBe("disagree");
  expect(against(["Tuple", 2, 1, -1], "[2, 1, -1]")).toBe("agree");
  expect(against(["List", ["List", 1, 2], ["List", 3, 4]], "[[1, 2], [3, 4]]")).toBe("agree");
  expect(against(["List", ["List", 1, 2], ["List", 3, 4]], "[[1, 2], [3, 5]]")).toBe("disagree");
  // An entry that can't be read doesn't hide one that definitely differs, nor settle the list as agreeing.
  expect(against(["List", ["Complex", 0, 1], 0], "[NaN, 1.2e-16]")).toBe("disagree");
  expect(against(["List", "True", 1], "[true, 1.0]")).toBeUndefined();
  // A different length is not decided here.
  expect(against(["List", 1, 2], "[1, 2, 3]")).toBeUndefined();
});

test("what cannot be read as a number is left to the text comparison", () => {
  expect(against("True", "true")).toBeUndefined();
  expect(against(["Complex", 0, 1], "NaN")).toBeUndefined();
  expect(against(5, "PositiveInfinity")).toBeUndefined();
});

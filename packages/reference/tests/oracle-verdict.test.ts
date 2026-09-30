import { expect, test } from "vite-plus/test";
import { asksForDigits, sameDigits, verdictOf } from "../scripts/oracle-verdict.ts";

// An N(x, d) example is judged by Wolfram's displayed digits as well as its value: the value
// agrees within a tolerance that can't see the last digit, and Wolfram holds more digits than
// it shows (N[1/8, 2] is 0.125 at precision 2).

test("an example asks for digits when it is N with a digit count", () => {
  expect(asksForDigits(["N", "Pi", 30])).toBe(true);
  expect(asksForDigits(["N", "Pi"])).toBe(false);
  expect(asksForDigits(["Sin", 1])).toBe(false);
});

test("digits are compared significant digit for significant digit", () => {
  expect(sameDigits({ num: "1.17520119364380145688238185060" }, "1.175201193643801456882381850600")).toBe(true);
  expect(sameDigits({ num: "1.1752011936438014568823818506" }, "1.17520119364380145688238185059")).toBe(false);
  expect(sameDigits(0.12, "0.13")).toBe(false);
  // Truncated Pi/E, not Math.PI/Math.E: sameDigits compares the digits actually shown.
  expect(sameDigits(["List", 3.1416, 2.7183], "{3.1416, 2.7183}")).toBe(true);
  expect(sameDigits(["Complex", 0.25, -1.5], "0.25 - 1.5 I")).toBe(true);
  // Not lined up number for number: no digit verdict.
  expect(sameDigits(["List", 0.5, 0.25], "0.5")).toBeUndefined();
});

test("Wolfram's value agreeing is not enough for N(x, d): its displayed digits must too", () => {
  const tie = { value: "0.125`2.", numeric: "0.125`2.", shown: "0.13" };
  expect(verdictOf("wolfram", 0.12, tie, 0.05)).toBe("agree");
  expect(verdictOf("wolfram", 0.12, tie, 0.05, true)).toBe("disagree");
  expect(verdictOf("wolfram", 0.12, { ...tie, shown: "0.12" }, 0.05, true)).toBe("agree");
});

test("a lone integer answer to N(x, d) is judged by the digits Wolfram displays", () => {
  const e = { value: "2.7182818284590452354`1.", numeric: "2.7182818284590452354`1.", shown: "3." };
  expect(verdictOf("wolfram", 3, e, undefined, true)).toBe("agree");
  expect(verdictOf("wolfram", 2, e, undefined, true)).toBe("disagree");
});

test("Solve: Wolfram's rules and ours are the same solutions, in any order", () => {
  const rules = "List[List[Rule[x, -1]], List[Rule[x, 1]]]";
  const answer = { value: rules, numeric: rules };
  expect(verdictOf("wolfram", ["List", 1, -1], answer, undefined, false, "Solve")).toBe("agree");
  expect(verdictOf("wolfram", ["List", 1, 2], answer, undefined, false, "Solve")).toBe("disagree");
  const system = { value: "List[List[Rule[x, 2], Rule[y, 1]]]", numeric: "List[List[Rule[x, 2], Rule[y, 1]]]" };
  expect(verdictOf("wolfram", ["List", ["Tuple", 2, 1]], system, undefined, false, "Solve")).toBe("agree");
  // Without the head, a list of values is not a list of rule lists.
  expect(verdictOf("wolfram", ["List", 1, -1], answer)).toBe("disagree");
});

test("an interval is its endpoints, and NaN is Wolfram's Indeterminate", () => {
  const interval = { value: "Interval[List[Power[E, -1], 2]]", numeric: "Interval[List[0.36787944117144233, 2.]]" };
  expect(verdictOf("wolfram", ["Interval", ["Divide", 1, "ExponentialE"], 2], interval)).toBe("agree");
  expect(verdictOf("wolfram", "NaN", { value: "Indeterminate" })).toBe("agree");
});

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
  expect(
    sameDigits({ num: "1.17520119364380145688238185060" }, "1.175201193643801456882381850600"),
  ).toBe(true);
  expect(
    sameDigits({ num: "1.1752011936438014568823818506" }, "1.17520119364380145688238185059"),
  ).toBe(false);
  expect(sameDigits(0.12, "0.13")).toBe(false);
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

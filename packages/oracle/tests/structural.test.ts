import { describe, expect, test } from "vite-plus/test";
import { compare, parsePython } from "../src/compare.ts";
import type { MathJSON } from "../src/emit.ts";
import { compareTrees, isNumericValue, type Leaf, reduce, symbolic, valuesOnly } from "../src/structural.ts";

// A stand-in for the caller's engine: it "evaluates" everything, the way compute-engine
// evaluates a call Wolfram declined.
const evaluateAll = (expr: MathJSON): Leaf =>
  Array.isArray(expr) && expr[0] === "Rational" ? (expr[1] as number) / (expr[2] as number) : 1;

test("numbers, constants and arithmetic on them are numeric values", () => {
  expect(isNumericValue(3)).toBe(true);
  expect(isNumericValue("Pi")).toBe(true);
  expect(isNumericValue(["Rational", 1, 2])).toBe(true);
  expect(isNumericValue(["Complex", 1.5, -2])).toBe(true);
  expect(isNumericValue(["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]])).toBe(true);
  expect(isNumericValue(["N", ["Sqrt", 2]])).toBe(true);
});

test("a declined call, a free symbol or a list is not", () => {
  expect(isNumericValue(["MatrixRank", ["List", 1, 2, 3]])).toBe(false);
  expect(isNumericValue(["PowerMod", 2, -1, 4])).toBe(false);
  expect(isNumericValue(["Add", 1, "x"])).toBe(false);
  expect(isNumericValue(["List", 1, 2])).toBe(false);
  expect(isNumericValue("'text'")).toBe(false);
});

test("an unevaluated call disagrees with the value we computed", () => {
  const theirs = ["MatrixRank", ["List", 1, 2, 3]] as MathJSON;
  // Unguarded, our evaluator turns their unevaluated call into our answer.
  expect(compareTrees(1, reduce(theirs, evaluateAll))).toBe("agree");
  expect(reduce(theirs, valuesOnly(evaluateAll))).toEqual(symbolic(theirs));
  expect(compareTrees(1, reduce(theirs, valuesOnly(evaluateAll)))).toBe("disagree");
});

test("numeric values still reduce, inside lists too", () => {
  const theirs = ["List", ["Rational", 1, 2], ["PowerMod", 2, -1, 4], 3] as MathJSON;
  expect(reduce(theirs, valuesOnly(evaluateAll))).toEqual([0.5, symbolic(["PowerMod", 2, -1, 4]), 1]);
});

test("truth values reduce to booleans whichever evaluator reads the rest", () => {
  expect(reduce("True", symbolic)).toBe(true);
  expect(reduce(["List", "True", "False"], valuesOnly(symbolic))).toEqual([true, false]);
  expect(compareTrees(reduce("True", symbolic), reduce("True", symbolic))).toBe("agree");
});

describe("comparison past the double range and of exact rationals", () => {
  test("decimals too large for a double still compare by their digits", () => {
    expect(compare("5.57316894480137913364e+373", "5.57316894480137913364320296291e+373")).toBe("agree");
    expect(compare("5.57316894480137913364e+373", "5.57316894480137913364e+372")).toBe("disagree");
  });
  test("a SymPy list of rationals parses", () => {
    expect(parsePython("[1/6, -1/30, 1/42]")).toEqual([1 / 6, -1 / 30, 1 / 42]);
  });
});

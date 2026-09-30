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

test("a carrier constructor reduces to its contents, same as List vs. Tuple leniency", () => {
  const ours = ["Permutation", ["List", 2, 1, 3]] as MathJSON;
  const theirs = ["List", 2, 1, 3] as MathJSON; // an external system's own, unwrapped, encoding
  expect(reduce(ours, symbolic)).toEqual(reduce(theirs, symbolic));
  expect(compareTrees(reduce(ours, symbolic), reduce(theirs, symbolic))).toBe("agree");
  // Nested carriers unwrap all the way down.
  const nested = ["SetPartition", ["Permutation", ["List", 1, 2]]] as MathJSON;
  expect(reduce(nested, symbolic)).toEqual(reduce(["List", 1, 2] as MathJSON, symbolic));
});

test("a composite carrier (carrierElements) reduces both slots, not just the last", () => {
  // StandardTableauPair(Tuple(StandardTableau(P), StandardTableau(Q))): every slot of the
  // packed Tuple is itself a carrier call, unlike a `carrierParams` pack (Tournament(n,
  // edges)) where only the trailing element matters — both P and Q have to survive.
  const p: MathJSON = ["List", ["List", 1, 3], ["List", 2]];
  const q: MathJSON = ["List", ["List", 1, 2], ["List", 3]];
  const pair: MathJSON = ["StandardTableauPair", ["Tuple", ["StandardTableau", p], ["StandardTableau", q]]];
  expect(reduce(pair, symbolic)).toEqual(reduce(["List", p, q] as MathJSON, symbolic));
});

test("truth values reduce to booleans whichever evaluator reads the rest", () => {
  expect(reduce("True", symbolic)).toBe(true);
  expect(reduce(["List", "True", "False"], valuesOnly(symbolic))).toEqual([true, false]);
  expect(compareTrees(reduce("True", symbolic), reduce("True", symbolic))).toBe("agree");
});

test("Rule and KeyValuePair compare by their two operands, not their head", () => {
  // `fromWolfram` reads a scanned `Rule[x, 2]` back as `KeyValuePair` (the ambiguous reverse
  // of `HEADS`, kept for the `Over` option's own round trip in from-wolfram.test.ts), while
  // Maximize/FindInstance bindings and Association entries are built as `Rule` directly — so
  // this pair has to compare equal, the same List vs. Tuple leniency `SEQUENCE_HEADS` gives.
  const ours = ["Rule", "x", 2] as MathJSON;
  const theirs = ["KeyValuePair", "x", 2] as MathJSON;
  expect(reduce(ours, symbolic)).toEqual(reduce(theirs, symbolic));
  expect(compareTrees(reduce(ours, symbolic), reduce(theirs, symbolic))).toBe("agree");
  // Nested inside a List, as Maximize's `{value, {x -> argmax}}` answer shape does.
  const wrapped = ["List", 3, ["List", ours]] as MathJSON;
  const wrappedTheirs = ["List", 3, ["List", theirs]] as MathJSON;
  expect(compareTrees(reduce(wrapped, symbolic), reduce(wrappedTheirs, symbolic))).toBe("agree");
  // A genuine value difference on either side still disagrees.
  const different = ["KeyValuePair", "x", 3] as MathJSON;
  expect(compareTrees(reduce(ours, symbolic), reduce(different, symbolic))).toBe("disagree");
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

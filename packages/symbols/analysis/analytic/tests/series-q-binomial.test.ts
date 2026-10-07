// unstable: a bare engine to declare the analytic library against
import { ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// Series of QBinomial/QFactorial at q = 0 for a non-integer rational argument is a series in
// q^(1/d). Truncation and coefficients are Wolfram's (checked against wolframscript).

const ce = new ComputeEngine();
declareAnalytic(ce);

const series = (f: unknown, order?: number) =>
  ce.box(["Series", f, "q", 0, ...(order === undefined ? [] : [order])] as never).evaluate();
const qbinomial = (n: unknown, k: unknown) => ["QBinomial", n, k, "q"];
const half = ["Rational", 1, 2];
const power = (e: unknown) => ["Power", "q", e];

test("symbolic q-analogs are canonical, so a difference of them is a plain Add", () => {
  for (const f of [["QFactorial", "k", "q"], qbinomial("n", "k"), qbinomial(half, 1), ["QFactorial", -2, "q"]]) {
    expect(ce.box(f as never).isCanonical, JSON.stringify(f)).toBe(true);
  }
  const difference = ce.box(["Subtract", ["QFactorial", ["Add", "k", 1], "q"], ["QFactorial", "k", "q"]] as never);
  expect(difference.isCanonical).toBe(true);
  expect(difference.operator).toBe("Add");
});

test("the series of QBinomial(1/2, 1, q) is 1/(1 + sqrt(q)), cut as Wolfram cuts it", () => {
  expect(series(qbinomial(half, 1), 2).json).toEqual([
    "Add",
    power(2),
    "q",
    ["Negate", ["Sqrt", "q"]],
    ["Negate", power(["Rational", 3, 2])],
    ["BigO", power(["Rational", 5, 2])],
    1,
  ]);
  const normal = ce.box(["Normal", ["Series", qbinomial(half, 1), "q", 0, 3]] as never).evaluate();
  const q = 0.01;
  expect(normal.subs({ q: ce.number(q) }).N().re).toBeCloseTo(1 / (1 + Math.sqrt(q)), 6);
});

test("QBinomial(5, 5/2, q) matches Wolfram term for term, including the order-0 and order-1 cuts", () => {
  const n = ["Rational", 5, 2];
  expect(series(qbinomial(5, n), 4).json).toEqual([
    "Add",
    ["Multiply", 5, power(4)],
    ["Multiply", 3, power(3)],
    ["Multiply", 2, power(2)],
    "q",
    ["Multiply", -4, power(["Rational", 9, 2])],
    ["Multiply", -2, power(["Rational", 7, 2])],
    ["BigO", power(5)],
    1,
  ]);
  expect(series(qbinomial(5, n), 1).json).toEqual(["Add", "q", ["BigO", power(2)], 1]);
  expect(series(qbinomial(5, n), 0).json).toEqual(["Add", ["BigO", ["Sqrt", "q"]], 1]);
});

test("an exponent below 1 on a numerator factor sets the remainder", () => {
  // (3/4, 1): (q^(3/4);q)∞ stands alone, so the series stops at q^(2 + 3/4) rather than q^3.
  expect(series(qbinomial(["Rational", 3, 4], 1), 2).json).toEqual([
    "Add",
    power(2),
    "q",
    ["Negate", power(["Rational", 3, 4])],
    ["Negate", power(["Rational", 7, 4])],
    ["BigO", power(["Rational", 11, 4])],
    1,
  ]);
});

test("a vanishing factor gives 0; shapes outside the product are held, not answered with Derivative terms", () => {
  expect(series(qbinomial(half, ["Rational", 3, 2]), 2).json).toBe(0);
  for (const f of [qbinomial(["Rational", -1, 2], 1), qbinomial(half, 2), ["QFactorial", -2, "q"]]) {
    expect(series(f, 2).operator, JSON.stringify(f)).toBe("Series");
  }
});

test("QFactorial at a non-integer n carries rational coefficients", () => {
  expect(series(["QFactorial", half, "q"], 2).json).toEqual([
    "Add",
    ["Multiply", ["Rational", -9, 8], power(2)],
    ["Multiply", ["Rational", -1, 2], "q"],
    ["Multiply", half, power(["Rational", 5, 2])],
    ["BigO", power(3)],
    power(["Rational", 3, 2]),
    1,
  ]);
});

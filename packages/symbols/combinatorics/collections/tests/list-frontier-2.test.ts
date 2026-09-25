import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

// Thread(f(args...)) / Thread(f(args...), h)
test("Thread distributes a non-listable head over list arguments", () => {
  expect(run(["Thread", ["Equal", ["List", 1, 2, 3], ["List", 1, 5, 3]]])).toEqual([
    "List",
    ["Equal", 1, 1],
    ["Equal", 2, 5],
    ["Equal", 3, 3],
  ]);
});
test("Thread broadcasts a scalar operand", () => {
  expect(run(["Thread", ["Equal", ["List", 1, 2, 3], 1]])).toEqual([
    "List",
    ["Equal", 1, 1],
    ["Equal", 2, 1],
    ["Equal", 3, 1],
  ]);
});
test("Thread(expr, h) threads only over h-headed operands", () => {
  expect(run(["Thread", ["f", ["g", 1, 2], ["g", 3, 4]], "g"])).toEqual([
    "g",
    ["f", 1, 3],
    ["f", 2, 4],
  ]);
});

// MapAt(f, expr, n) / MapAt(f, expr, {{n1}, {n2}})
test("MapAt applies f at a single position", () => {
  expect(run(["MapAt", "f", ["List", "a", "b", "c"], 2])).toEqual(["List", "a", ["f", "b"], "c"]);
});
test("MapAt applies f at a negative (from-end) position", () => {
  expect(run(["MapAt", "f", ["List", "a", "b", "c"], -1])).toEqual(["List", "a", "b", ["f", "c"]]);
});
test("MapAt applies f at several positions at once", () => {
  expect(run(["MapAt", "f", ["List", "a", "b", "c"], ["List", ["List", 1], ["List", 3]]])).toEqual([
    "List",
    ["f", "a"],
    "b",
    ["f", "c"],
  ]);
});

// Normalize(v) / Normalize(v, f)
test("Normalize divides by the Euclidean norm", () => {
  expect(run(["Normalize", ["List", 3, 4]])).toEqual([
    "List",
    ["Rational", 3, 5],
    ["Rational", 4, 5],
  ]);
});
test("Normalize leaves the zero vector unchanged", () => {
  expect(run(["Normalize", ["List", 0, 0]])).toEqual(["List", 0, 0]);
});

// Surd(x, n)
test("Surd takes the real cube root of a negative number", () => {
  expect(run(["Surd", -8, 3])).toEqual(-2);
});
test("Surd matches Power for a nonnegative base", () => {
  expect(run(["Surd", 8, 3])).toEqual(2);
});

// LetterNumber(c) / LetterNumber(s)
test("LetterNumber gives a single letter's alphabet position", () => {
  expect(run(["LetterNumber", "'d'"])).toEqual(4);
});
test("LetterNumber of a string gives one position per character", () => {
  expect(run(["LetterNumber", "'cab'"])).toEqual(["List", 3, 1, 2]);
});

// FactorialPower(x, n) / FactorialPower(x, n, h)
test("FactorialPower(x, 3) is the falling factorial", () => {
  expect(run(["FactorialPower", "x", 3])).toEqual([
    "Multiply",
    "x",
    ["Add", "x", -2],
    ["Add", "x", -1],
  ]);
});
test("FactorialPower(5, 3) evaluates numerically", () => {
  expect(run(["FactorialPower", 5, 3])).toEqual(60);
});
test("FactorialPower(x, 2, h) steps by h instead of 1", () => {
  expect(run(["FactorialPower", "x", 2, "h"])).toEqual([
    "Multiply",
    "x",
    ["Add", ["Negate", "h"], "x"],
  ]);
});

// HankelMatrix(c) / HankelMatrix(c, r)
test("HankelMatrix(c) is constant along anti-diagonals, zero-padded", () => {
  expect(run(["HankelMatrix", ["List", 1, 2, 3]])).toEqual([
    "List",
    ["List", 1, 2, 3],
    ["List", 2, 3, 0],
    ["List", 3, 0, 0],
  ]);
});

// MovingMap(f, list, r)
test("MovingMap keeps the input length, clipping the window at the edges", () => {
  expect(run(["MovingMap", "Length", ["List", 1, 2, 3, 4], 1])).toEqual(["List", 2, 3, 3, 2]);
});

// PascalBinomial(n, m)
test("PascalBinomial agrees with Binomial in the standard range", () => {
  expect(run(["PascalBinomial", 5, 2])).toEqual(10);
});
test("PascalBinomial extends to a negative n, matching (-1)^m C(m, m)", () => {
  // C(-1, k) = (-1)^k is the standard generalized-binomial identity.
  expect(run(["PascalBinomial", -1, 3])).toEqual(-1);
  expect(run(["PascalBinomial", -1, 4])).toEqual(1);
});
test("PascalBinomial satisfies Pascal's recurrence for a negative n", () => {
  const p = (n: number, m: number) => run(["PascalBinomial", n, m]) as number;
  expect(p(-1, 3) === p(-2, 2) + p(-2, 3)).toBe(true);
});

// CellularAutomaton(rule, init, t)
test("CellularAutomaton(30, 1, 2) grows the classic rule-30 triangle from a single seed", () => {
  expect(run(["CellularAutomaton", 30, 1, 2])).toEqual([
    "List",
    ["List", 1],
    ["List", 1, 1, 1],
    ["List", 1, 1, 0, 0, 1],
  ]);
});

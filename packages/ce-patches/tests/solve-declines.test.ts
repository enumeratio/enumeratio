import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyPatch, solveIdentity } from "../src/index.ts";

const ce = new ComputeEngine();
const box = (json: unknown) => ce.box(json as never);
applyPatch(ce, solveIdentity);

const equal = (left: unknown, right: unknown) => ["Equal", left, right];
const power = (base: unknown, exponent: unknown) => ["Power", base, exponent];

// An unsolved equation stays the unevaluated `Solve`, on the evaluate and the parse route.
const declines = (equation: unknown, ...specs: unknown[]) => {
  const solve = ["Solve", equation, ...specs];
  expect(box(solve).evaluate().json).toEqual(solve);
  expect(ce.parse(box(solve).latex).evaluate().operator).toBe("Solve");
};

test("a quintic with symbolic coefficients is not 'no solutions'", () => {
  declines(equal(["Add", ["Multiply", "a", power("x", 5)], ["Multiply", "b", "x"], "c"], 0), "x");
});

test("symbolic and variable exponents decline", () => {
  declines(equal(["Add", power("x", ["Multiply", 2, "a"]), ["Multiply", 2, power("x", "a")], 1], 0), "x");
  declines(equal(power(["Add", power("x", 5), -1], "x"), 0), "x");
});

test("x*2^(x^2) == 5 declines", () => {
  declines(equal(["Multiply", "x", power(2, power("x", 2))], 5), "x");
});

test("a transcendental equation under a side condition declines", () => {
  declines(["And", equal("x", power("ExponentialE", ["Divide", 1, "x"])), ["Less", ["Abs", "x"], 5]], "x");
});

test("a trig equation does not answer its principal solutions alone", () => {
  declines(equal(["Sin", "x"], ["Rational", 1, 3]), "x");
  declines(equal(["Tan", "x"], 1), "x");
});

test("an equation free of the unknown is not 'no solutions' unless it is false", () => {
  declines(equal("a", 0), "x");
  expect(box(["Solve", equal(1, 0), "x"]).evaluate().json).toEqual(["List"]);
});

test("a proved contradiction keeps the empty answer", () => {
  expect(box(["Solve", equal("x", ["Add", "x", 1]), "x"]).evaluate().json).toEqual(["List"]);
});

test("a never-zero expression set to zero keeps the empty answer", () => {
  expect(box(["Solve", equal(power("ExponentialE", "x"), 0), "x"]).evaluate().json).toEqual(["List"]);
  const reciprocalSquare = equal(power(["Add", power("x", 2), 1], -2), 0);
  expect(box(["Solve", reciprocalSquare, "x"]).evaluate().json).toEqual(["List"]);
});

test("a polynomial whose roots a domain excludes keeps the empty answer", () => {
  const noRealRoots = ["Solve", equal(["Add", power("x", 2), 1], 0), ["Element", "x", "RealNumbers"]];
  expect(box(noRealRoots).evaluate().json).toEqual(["List"]);
  const noIntegerRoots = ["Solve", equal(["Add", power("x", 2), -2], 0), ["Element", "x", "Integers"]];
  expect(box(noIntegerRoots).evaluate().json).toEqual(["List"]);
});

test("an answer with fewer roots than the degree declines over the complexes", () => {
  declines(equal(["Add", power("x", 5), "x", 1], 0), "x");
  declines(equal(["Subtract", power("x", 4), 1], 0), "x");
  declines(equal(["Subtract", power("x", 4), 1], 0), ["Element", "x", "ComplexNumbers"]);
  declines(equal(["Subtract", power("x", 3), 1], 0), "x");
});

test("roots counted with multiplicity, and real or integer domains, keep their answers", () => {
  const repeated = equal(["Multiply", power(["Subtract", "x", 1], 2), ["Add", "x", 2]], 0);
  expect(box(["Solve", repeated, "x"]).evaluate().json).toEqual(["List", 1, -2]);
  const quartic = equal(["Subtract", power("x", 4), 1], 0);
  expect(box(["Solve", quartic, ["Element", "x", "RealNumbers"]]).evaluate().json).toEqual(["List", 1, -1]);
  expect(box(["Solve", quartic, ["Element", "x", "Integers"]]).evaluate().json).toEqual(["List", 1, -1]);
});

test("a principal square root and an absolute value are never negative", () => {
  expect(box(["Solve", equal(["Sqrt", "x"], -1), "x"]).evaluate().json).toEqual(["List"]);
  expect(box(["Solve", equal(["Abs", "x"], -1), "x"]).evaluate().json).toEqual(["List"]);
});

test("sin x == 2 and e^x == -1 have complex solutions, so they decline", () => {
  declines(equal(["Sin", "x"], 2), "x");
  declines(equal(power("ExponentialE", "x"), -1), "x");
});

test("solvable equations and systems are untouched", () => {
  expect(box(["Solve", equal(["Ln", "x"], 0), "x"]).evaluate().json).toEqual(["List", 1]);
  const system = ["Solve", ["List", equal(["Add", "x", "y"], 3), equal(["Subtract", "x", "y"], 1)], ["List", "x", "y"]];
  expect(box(system).evaluate().json).toEqual(["List", ["Tuple", 2, 1]]);
});

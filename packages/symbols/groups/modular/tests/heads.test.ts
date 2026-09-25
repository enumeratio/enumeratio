import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareModular } from "../src/declare.ts";

const ce = new ComputeEngine();
declareModular(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const M = (a: number, b: number, c: number, d: number): Expr => ["ModularMatrix", a, b, c, d];

test("Dot leaves a non-matrix operand paired with a ModularMatrix unevaluated", () => {
  // A nested List canonicalises the same way `Matrix(...)` does, so it reads as an ordinary
  // integer matrix (matching what ModularTrace already accepted); a Tuple does not, and
  // there's no settled convention for what it should mean next to a ModularMatrix.
  expect(ce.box(["Dot", ["Tuple", 1, 2], M(1, 1, 0, 1)]).evaluate().operator).toBe("Dot");
});

test("the S/T factorisation round-trips: Abs of the negated trace", () => {
  // Equal in PSL(2,Z) — which is to say up to an overall sign, and the rebuilt matrix
  // really does come back negated. That sign IS the ±I being quotiented out. The trace
  // itself (-6) is a `role: test` example on ModularWord; this is just `Abs` on top of it,
  // and `Abs` is documented elsewhere (analytic), so it stays here rather than growing an
  // unrelated head's reference examples.
  const back = ce.box(["ModularFromSTWord", ["ModularSTWord", M(3, 2, 4, 3)]]).evaluate();
  expect(ce.box(["Abs", ["ModularTrace", back.json as Expr]]).evaluate().json).toEqual(6);
});

test("continued fractions and the Stern-Brocot tree: the Farey sequence's size", () => {
  const farey = ce.box(["FareySequence", 5]).evaluate().json as unknown as unknown[];
  expect(farey.length - 1).toBe(11); // |F_5| = 11
});

test("closed geodesics are necklaces of L and R: how many of a given length", () => {
  const classes = ce.box(["ModularClasses", 4]).evaluate().json as unknown as unknown[];
  expect(classes.length - 1).toBe(4); // LLLR, LLRR, LRLR, LRRR
});

test("a malformed or out-of-range input leaves the call alone", () => {
  expect(ce.box(["ModularWord", M(1, 2, 3, 4)]).evaluate().operator).toBe("ModularWord");
  expect(ce.box(["RademacherSymbol", M(1, 1, 0, 1)]).evaluate().operator).toBe("RademacherSymbol");
  expect(ce.box(["DedekindSum", 2, 4]).evaluate().operator).toBe("DedekindSum");
  expect(ce.box(["ModularClasses", 0]).evaluate().operator).toBe("ModularClasses");
});

test("indefinite quadratic forms: a class is a cycle of even length", () => {
  const F = (a: number, b: number, c: number): Expr => ["QuadraticForm", a, b, c];
  // A class is a CYCLE of reduced forms, and the cycle length is even.
  const cycle = ce.box(["FormCycle", F(1, 1, -1)]).evaluate().json as unknown as unknown[];
  expect((cycle.length - 1) % 2).toBe(0);
});

test("a form with no cycle leaves the call alone", () => {
  const F = (a: number, b: number, c: number): Expr => ["QuadraticForm", a, b, c];
  expect(ce.box(["ReduceForm", F(1, 0, 1)]).evaluate().operator).toBe("ReduceForm"); // definite
  expect(ce.box(["FormCycle", F(1, 3, 2)]).evaluate().operator).toBe("FormCycle"); // D = 1
  expect(ce.box(["ReducedForms", 9]).evaluate().operator).toBe("ReducedForms"); // a square
  expect(ce.box(["PellSolution", -4]).evaluate().operator).toBe("PellSolution");
});

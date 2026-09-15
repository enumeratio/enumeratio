import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareModular } from "../src/declare.ts";

const ce = new ComputeEngine();
declareModular(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const same = (input: Expr, expected: Expr) =>
  expect(ce.box(input).evaluate().json).toEqual(ce.box(expected).evaluate().json);
const M = (a: number, b: number, c: number, d: number): Expr => ["ModularMatrix", a, b, c, d];
/** A MathJSON string literal — the form the heads hand back, single-quoted. */
const W = (word: string): Expr => `'${word}'`;

test("the group: products, inverses, powers and the trace trichotomy", () => {
  same(["ModularProduct", M(1, 1, 0, 1), M(1, 0, 1, 1)], M(2, 1, 1, 1));
  same(["ModularInverse", M(1, 1, 0, 1)], M(1, -1, 0, 1));
  same(["ModularPower", M(1, 1, 0, 1), 5], M(1, 5, 0, 1));
  same(["ModularTrace", M(1, 1, 1, 2)], 3);
  same(["ModularKind", M(1, 0, 0, 1)], W("Identity"));
  same(["ModularKind", M(0, -1, 1, 0)], W("Elliptic"));
  same(["ModularKind", M(1, 1, 0, 1)], W("Parabolic"));
  same(["ModularKind", M(1, 1, 1, 2)], W("Hyperbolic"));
});

test("a word IS a matrix — every head takes either spelling", () => {
  same(["ModularWord", M(1, 1, 1, 2)], W("LR"));
  same(["ModularTrace", W("LR")], 3);
  same(["ModularTrace", ["ModularMatrix", W("LRLR")]], 7);
  // A nested list works too, so CE's own matrix notation is accepted.
  same(["ModularTrace", ["List", ["List", 1, 1], ["List", 1, 2]]], 3);
});

test("the S/T factorisation round-trips", () => {
  same(["ModularSTWord", M(1, 5, 0, 1)], ["List", 5]);
  // Equal in PSL(2,Z) — which is to say up to an overall sign, and the rebuilt matrix
  // really does come back negated. That sign IS the ±I being quotiented out.
  const back = ce.box(["ModularFromSTWord", ["ModularSTWord", M(3, 2, 4, 3)]]).evaluate();
  same(["ModularTrace", back.json as Expr], -6);
  same(["Abs", ["ModularTrace", back.json as Expr]], 6);
});

test("continued fractions and the Stern-Brocot tree", () => {
  // `ContinuedFraction` and `FromContinuedFraction` are compute-engine's own, and take the
  // RATIONAL — not (numerator, denominator). We used to redeclare them with the latter
  // signature, which silently changed what `ContinuedFraction(x, n)` meant.
  same(["ContinuedFraction", ["Rational", 355, 113]], ["List", 3, 7, 16]);
  same(["FromContinuedFraction", ["List", 3, 7, 16]], ["Rational", 355, 113]);
  same(["ContinuedFraction", 355, 113], ["List", 355]); // 113 terms of the integer 355
  same(["SternBrocotPath", 5, 3], W("RLR"));
  same(["FromSternBrocotPath", W("RLR")], ["Rational", 5, 3]);
  // The golden ratio's convergents are the Fibonacci fractions, so its path alternates.
  same(["SternBrocotPath", 13, 8], W("RLRLR"));
  same(["FareyNeighbours", 1, 3, 1, 2], "True");
  same(["FareyNeighbours", 1, 3, 2, 3], "False");
  const farey = ce.box(["FareySequence", 5]).evaluate().json as unknown as unknown[];
  expect(farey.length - 1).toBe(11); // |F_5| = 11
});

test("closed geodesics are necklaces of L and R", () => {
  same(["ModularClass", W("RLL")], W("LLR"));
  same(["ModularClass", W("LRL")], W("LLR")); // the same geodesic, entered elsewhere
  same(["IsPrimitiveClass", W("LRLR")], "False");
  same(["IsPrimitiveClass", W("LRR")], "True");
  const classes = ce.box(["ModularClasses", 4]).evaluate().json as unknown as unknown[];
  expect(classes.length - 1).toBe(4); // LLLR, LLRR, LRLR, LRRR
});

test("the Rademacher symbol, three ways", () => {
  same(["RademacherSymbol", W("LRRRR")], 3);
  same(["WordSymbol", W("LRRRR")], 3);
  same(["LinkingWithTrefoil", W("LRRRR")], 3);
  // Balanced turning means the geodesic is unlinked from the trefoil.
  same(["LinkingWithTrefoil", W("LLRR")], 0);
  // Φ is the uncorrected quasimorphism, and on T^n it just counts.
  same(["RademacherPhi", M(1, 7, 0, 1)], 7);
  same(["DedekindSum", 4, 3], ["Rational", 1, 18]);
  same(["DedekindSum", 1, 5], ["Rational", 1, 5]);
});

test("a malformed or out-of-range input leaves the call alone", () => {
  expect(ce.box(["ModularWord", M(1, 2, 3, 4)]).evaluate().operator).toBe("ModularWord");
  expect(ce.box(["RademacherSymbol", M(1, 1, 0, 1)]).evaluate().operator).toBe("RademacherSymbol");
  expect(ce.box(["DedekindSum", 2, 4]).evaluate().operator).toBe("DedekindSum");
  expect(ce.box(["ModularClasses", 0]).evaluate().operator).toBe("ModularClasses");
});

test("indefinite quadratic forms, their cycles and their class numbers", () => {
  const F = (a: number, b: number, c: number): Expr => ["QuadraticForm", a, b, c];
  same(["FormDiscriminant", F(1, 1, -1)], 5);
  same(["IsIndefinite", F(1, 1, -1)], "True");
  same(["IsIndefinite", F(1, 0, 1)], "False"); // D = −4, definite
  same(["IsReducedForm", F(1, 1, -1)], "True");
  // The action preserves the discriminant, which is why classes live inside one.
  same(["FormDiscriminant", ["FormAction", F(1, 1, -1), M(1, 1, 0, 1)]], 5);
  same(["EvaluateForm", F(1, 1, -1), 2, 3], 4 + 6 - 9);
  // A class is a CYCLE of reduced forms, and the cycle length is even.
  const cycle = ce.box(["FormCycle", F(1, 1, -1)]).evaluate().json as unknown as unknown[];
  expect((cycle.length - 1) % 2).toBe(0);
  same(["FormClassNumber", 5], 1);
  same(["FormClassNumber", 12], 2);
  same(["FormClassNumber", 60], 4);
});

test("Pell's equation and the automorph that fixes a form", () => {
  const F = (a: number, b: number, c: number): Expr => ["QuadraticForm", a, b, c];
  same(["PellSolution", 5], ["List", 3, 1]); // 3² − 5·1² = 4
  same(["PellSolution", 12], ["List", 4, 1]); // 4² − 12·1² = 4
  // The automorph stabilises the form and is hyperbolic, so the class is a geodesic.
  same(["FormAction", F(1, 1, -1), ["FormAutomorph", F(1, 1, -1)]], F(1, 1, -1));
  same(["ModularTrace", ["FormAutomorph", F(1, 1, -1)]], 3);
  same(["ModularKind", ["FormAutomorph", F(1, 1, -1)]], W("Hyperbolic"));
  // …and where it lands in the positive cone it spells out as an LR word.
  same(["ModularWord", ["FormAutomorph", F(1, 1, -1)]], W("LR"));
});

test("a form with no cycle leaves the call alone", () => {
  const F = (a: number, b: number, c: number): Expr => ["QuadraticForm", a, b, c];
  expect(ce.box(["ReduceForm", F(1, 0, 1)]).evaluate().operator).toBe("ReduceForm"); // definite
  expect(ce.box(["FormCycle", F(1, 3, 2)]).evaluate().operator).toBe("FormCycle"); // D = 1
  expect(ce.box(["ReducedForms", 9]).evaluate().operator).toBe("ReducedForms"); // a square
  expect(ce.box(["PellSolution", -4]).evaluate().operator).toBe("PellSolution");
});

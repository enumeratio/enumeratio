import { expect, test } from "vite-plus/test";
import {
  discreteVariables,
  interpretSymbolicAgreement,
  leavesCall,
  stepVariables,
  symbolicAgreementSource,
} from "../src/symbolic.ts";

// `Add(x, x)` against `Multiply(2, x)`: the same identity on all three symbolic systems, to
// pin the source each one gets asked to run. Real kernels confirmed these three strings each
// evaluate to `True` (wolframscript, sympy, sage) during development of #A-72; this test
// only pins the generated source, not a live kernel result.
const expr = ["Add", "x", "x"];
const expected = ["Multiply", 2, "x"];

test("wolfram: FullSimplify of the difference, with 3 fixed-rational trials as a fallback", () => {
  expect(symbolicAgreementSource("wolfram", expr, expected, ["x"])).toBe(
    "Module[{d = Quiet[TimeConstrained[FullSimplify[(Plus[x, x]) - (Times[2, x])], 10, $Aborted]]}, " +
      "If[AllTrue[Flatten[{d}], # === 0 &], True, Module[{s = {Chop[N[(Plus[Rational[7, 3], Rational[7, 3]]) - (Times[2, Rational[7, 3]])]], " +
      "Chop[N[(Plus[Rational[-11, 5], Rational[-11, 5]]) - (Times[2, Rational[-11, 5]])]], " +
      "Chop[N[(Plus[Rational[13, 4], Rational[13, 4]]) - (Times[2, Rational[13, 4]])]]}}, " +
      "s = Flatten[s]; If[AllTrue[s, NumericQ], AllTrue[s, # == 0 &], Indeterminate]]]]",
  );
});

test("sympy: enumeratio_symbolic_agree, carrying the same 3 trials", () => {
  expect(symbolicAgreementSource("sympy", expr, expected, ["x"])).toBe(
    'enumeratio_symbolic_agree((Symbol("x") + Symbol("x")), (2 * Symbol("x")), ' +
      "[((Rational(7, 3) + Rational(7, 3)), (2 * Rational(7, 3))), " +
      "((Rational(-11, 5) + Rational(-11, 5)), (2 * Rational(-11, 5))), " +
      "((Rational(13, 4) + Rational(13, 4)), (2 * Rational(13, 4)))])",
  );
});

test("sage: the same helper, Sage's own rational literal", () => {
  expect(symbolicAgreementSource("sage", expr, expected, ["x"])).toBe(
    'enumeratio_symbolic_agree((SR.var("x") + SR.var("x")), (2 * SR.var("x")), ' +
      "[(((7/3) + (7/3)), (2 * (7/3))), (((-11/5) + (-11/5)), (2 * (-11/5))), (((13/4) + (13/4)), (2 * (13/4)))])",
  );
});

test("two free symbols get distinct trial values, not the same one repeated", () => {
  const source = symbolicAgreementSource("sympy", ["Add", "x", "y"], ["Add", "y", "x"], ["x", "y"]) as string;
  // First trial: x -> 7/3, y -> -11/5 (trialSubstitution offsets by `trial * freeSymbols.length`).
  expect(source).toContain('Symbol("x") + Symbol("y")');
  expect(source).toContain("(Rational(7, 3) + Rational(-11, 5))");
});

test("undefined when `expected` doesn't emit for the system — falls back to the ordinary verdict", () => {
  expect(symbolicAgreementSource("sympy", expr, ["RademacherSymbol", "'LRRRR'"], ["x"])).toBeUndefined();
});

// Found scanning the newly-emitting rows against real kernels (#A-72 phase 2):
// `FunctionConvexity(x^3, x)` is free in `x`, but its expected answer is the constant
// `Indeterminate` — it doesn't mention `x` at all. `FullSimplify[(theirs) - Indeterminate]`
// is not a meaningful question (arithmetic on a non-numeric marker), and wrongly disagreed
// even though Wolfram's own FunctionConvexity genuinely answers `Indeterminate` too — the
// plain structural comparison (compareTrees) gets that right without this module.
//
// `Append({a}, x)` against `List(a, x)` — a `List` of plain expressions both sides — IS a
// meaningful "is the difference zero" question (BL-25): both denote the same list, and the
// elementwise check (the `wolfram` branch's `Flatten`) proves it.
test("a List of plain expressions goes through the agreement check, not a bail", () => {
  expect(symbolicAgreementSource("wolfram", ["Append", ["List", "a"], "x"], ["List", "a", "x"], ["a", "x"])).toContain(
    "AllTrue[Flatten[{d}], # === 0 &]",
  );
});

// `Maximize`'s `{value, {x -> argmax}}` is a `List` too, but one that carries a `Rule` a level
// down — `FullSimplify[list - list]` where an element is a `Rule` isn't a question that has a
// zero/nonzero answer, so this still bails to the (correct) structural comparison, exactly as
// a bare `Rule`/`Association`/`Missing` at the top would (found scanning the newly-emitting
// rows against real kernels, #A-72 phase 2).
test("undefined when either side is a structure (Association, Rule, …) or nests one, not a scalar", () => {
  expect(
    symbolicAgreementSource(
      "wolfram",
      ["Maximize", ["Add", ["Negate", ["Power", "x", 2]], ["Multiply", 4, "x"], -1], "x"],
      ["List", 3, ["List", ["Rule", "x", 2]]],
      ["x"],
    ),
  ).toBeUndefined();
});

test("undefined when `expected` doesn't depend on any of `expr`'s free symbols", () => {
  expect(symbolicAgreementSource("wolfram", ["Add", "x", "x"], "Indeterminate", ["x"])).toBeUndefined();
  expect(symbolicAgreementSource("wolfram", ["Add", "x", "x"], 0, ["x"])).toBeUndefined();
  // Both sides free in the SAME symbol still goes through the agreement check.
  expect(symbolicAgreementSource("wolfram", expr, expected, ["x"])).toBeDefined();
});

test("interpretSymbolicAgreement reads True/False/anything-else as agree/disagree/inconclusive", () => {
  expect(interpretSymbolicAgreement("True")).toBe("agree");
  expect(interpretSymbolicAgreement("False")).toBe("disagree");
  expect(interpretSymbolicAgreement("None")).toBe("inconclusive");
  expect(interpretSymbolicAgreement("Indeterminate")).toBe("inconclusive");
});

test("an unevaluated call has no identity check: the difference of a call from itself is trivially zero", () => {
  const call = ["LaplaceTransform", ["Multiply", ["Divide", 1, "t"], ["Sin", "t"]], "t", "s"];
  // Canonicalised arguments, as the pinned value of a call we leave alone is written.
  const left = ["LaplaceTransform", ["Divide", ["Sin", "t"], "t"], "t", "s"];
  expect(symbolicAgreementSource("wolfram", call, left, ["s", "t"])).toBeUndefined();
  expect(symbolicAgreementSource("wolfram", ["Simplify", call], left, ["s", "t"])).toBeUndefined();
  expect(symbolicAgreementSource("wolfram", ["Floor", "x"], ["Floor", "x"], ["x"])).toBeUndefined();
  // An evaluated answer still gets the identity check.
  expect(symbolicAgreementSource("wolfram", ["Sin", ["Negate", "x"]], ["Negate", ["Sin", "x"]], ["x"])).toBeDefined();
});

// A part held is as little of an answer as a whole held: the kernel evaluates ours, held entry
// and all, so the difference vanishes there too.
test("a list answer that holds some entries has no identity check, whole or wrapped", () => {
  const jacobi = (argument: unknown) => ["JacobiNC", argument, "m"];
  const poles = ["List", jacobi(["EllipticK", "m"]), jacobi(["Multiply", 3, ["EllipticK", "m"]])];
  const partlyHeld = ["List", "ComplexInfinity", jacobi(["Multiply", 3, ["EllipticK", "m"]])];
  expect(leavesCall(poles as never, partlyHeld as never)).toBe(true);
  expect(symbolicAgreementSource("wolfram", poles as never, partlyHeld as never, ["m"])).toBeUndefined();
  const evaluated = ["List", ["Add", "m", 1], ["Add", "m", 2]];
  expect(leavesCall(poles as never, evaluated as never)).toBe(false);
  expect(symbolicAgreementSource("wolfram", poles as never, evaluated as never, ["m"])).toBeDefined();
  expect(leavesCall(["List", ["Sin", "x"], ["Floor", "x"]], ["List", ["Cos", ["Add", "x", 1]], 7])).toBe(false);
  expect(leavesCall(["FunctionExpand", poles] as never, partlyHeld as never)).toBe(true);
});

test("a call over a list is held where an entry's call is", () => {
  const half = ["Rational", 1, 2];
  expect(leavesCall(["BarnesG", ["List", half, 1]] as never, ["List", ["BarnesG", half], 1] as never)).toBe(true);
  expect(leavesCall(["BarnesG", ["List", half, 1]] as never, ["List", ["Sqrt", "Pi"], 1] as never)).toBe(false);
  // A call that takes the whole list is held whole.
  expect(leavesCall(["Sort", ["List", 2, 1]] as never, ["Sort", ["List", 2, 1]] as never)).toBe(true);
});

test("a held call counts however ours spells it", () => {
  // The same integral, held as `Function` and `Limits` rather than as written.
  const integral = ["Simplify", ["Integrate", ["EllipticPi", "n", "m"], "m"]];
  const held = [
    "Integrate",
    ["Function", ["Block", ["EllipticPi", "n", "m"]], "m"],
    ["Limits", "m", "Nothing", "Nothing"],
  ];
  expect(leavesCall(integral as never, held as never)).toBe(true);
  // An argument that is the same function written two ways, past what the simplifier reduces.
  const laplace = (argument: unknown) => ["LaplaceTransform", argument, "t", "s"];
  const sinh = [
    "Add",
    ["Multiply", "b", ["Sinh", ["Multiply", "a", "t"]]],
    ["Negate", ["Multiply", "a", ["Sinh", ["Multiply", "b", "t"]]]],
  ];
  const denominator = ["Add", ["Power", "a", 2], ["Negate", ["Power", "b", 2]]];
  const asked = ["Simplify", laplace(["Multiply", sinh, ["Power", denominator, -1]])];
  expect(leavesCall(asked as never, laplace(["Divide", sinh, denominator]) as never)).toBe(true);
  // A different transform of another function is an answer, not the call left alone.
  expect(leavesCall(["Simplify", laplace(sinh)] as never, laplace(["Sinh", "t"]) as never)).toBe(false);
});

test("a step variable is sampled at integers, and substituted after the call is read", () => {
  const delta = ["DifferenceDelta", ["QFactorial", "k", "q"], "k"];
  const next = ["Subtract", ["QFactorial", ["Add", "k", 1], "q"], ["QFactorial", "k", "q"]];
  expect(stepVariables(delta as never)).toEqual(new Set(["k"]));
  expect(discreteVariables(["Sum", ["Power", "i", "n"], ["Tuple", "i", 1, "n"]] as never)).toEqual(new Set(["i", "n"]));
  const source = symbolicAgreementSource("wolfram", delta as never, next as never, ["k", "q"]) as string;
  // `k` stays the call's own variable inside it, and is a whole number only afterwards.
  expect(source).toContain("DifferenceDelta[QFactorial[k, Rational[");
  expect(source).toMatch(/\/\. \{k -> \d+\}/);
});

test("a relation answer is compared as a statement, not by its spelling", () => {
  const source = symbolicAgreementSource(
    "wolfram",
    ["FunctionRange", ["Exp", "x"], "x", "y"] as never,
    ["Less", 0, "y"] as never,
    ["x", "y"],
  ) as string;
  expect(source).toContain("Equivalent[t, o]");
  expect(source).toContain("agree[FunctionRange[Exp[x], x, y], Less[0, y]]");
});

import { expect, test } from "vite-plus/test";
import { interpretSymbolicAgreement, symbolicAgreementSource } from "../src/symbolic.ts";

// `Add(x, x)` against `Multiply(2, x)`: the same identity on all three symbolic systems, to
// pin the source each one gets asked to run. Real kernels confirmed these three strings each
// evaluate to `True` (wolframscript, sympy, sage) during development of #A-72; this test
// only pins the generated source, not a live kernel result.
const expr = ["Add", "x", "x"];
const expected = ["Multiply", 2, "x"];

test("wolfram: FullSimplify of the difference, with 3 fixed-rational trials as a fallback", () => {
  expect(symbolicAgreementSource("wolfram", expr, expected, ["x"])).toBe(
    "Module[{d = Quiet[TimeConstrained[FullSimplify[(Plus[x, x]) - (Times[2, x])], 10, $Aborted]]}, " +
      "If[d === 0, True, Module[{s = {Chop[N[(Plus[Rational[7, 3], Rational[7, 3]]) - (Times[2, Rational[7, 3]])]], " +
      "Chop[N[(Plus[Rational[-11, 5], Rational[-11, 5]]) - (Times[2, Rational[-11, 5]])]], " +
      "Chop[N[(Plus[Rational[13, 4], Rational[13, 4]]) - (Times[2, Rational[13, 4]])]]}}, " +
      "If[AllTrue[s, NumericQ], AllTrue[s, # == 0 &], Indeterminate]]]]",
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
// Found scanning the newly-emitting rows against real kernels (#A-72 phase 2): `Append({a,b,c,d},
// x)` is free in every one of a,b,c,d,x, and its expected `List(a,b,c,d,x)` shares all of
// them — so the old gate let it through, and `FullSimplify[list - list]` (or a `Rule`,
// `Missing`, `Association`) isn't a question that has a zero/nonzero answer; every such case
// bottomed out at a false `Indeterminate` instead of falling back to the (correct) structural
// comparison. Same story for `Maximize`'s `{value, {x -> argmax}}` pair.
test("undefined when either side is a structure (List, Association, Rule, …), not a scalar", () => {
  expect(
    symbolicAgreementSource("wolfram", ["Append", ["List", "a"], "x"], ["List", "a", "x"], ["a", "x"]),
  ).toBeUndefined();
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

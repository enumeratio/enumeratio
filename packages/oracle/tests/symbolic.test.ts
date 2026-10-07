import { expect, test } from "vite-plus/test";
import {
  alignFunctions,
  boundVariables,
  derivativeVariables,
  echoesInput,
  discreteVariables,
  interpretSymbolicAgreement,
  leavesCall,
  lookThroughConditions,
  positiveVariables,
  stepVariables,
  symbolicAgreementSource,
} from "../src/symbolic.ts";

// `Add(x, x)` against `Multiply(2, x)`: the same identity on all three symbolic systems, to
// pin the source each one gets asked to run. Real kernels confirmed these three strings each
// evaluate to `True` (wolframscript, sympy, sage) during development of #A-72; this test
// only pins the generated source, not a live kernel result.
const expr = ["Add", "x", "x"];
const expected = ["Multiply", 2, "x"];

// Their side is read through any ConditionalExpression before the difference is taken.
const through = (source: string): string => `ReplaceAll[${source}, ConditionalExpression[e_, _] :> e]`;

// A difference that is a pure O-term (`O[x]^5`) at the order of Wolfram's series is zero.
const equalSeries = (theirs: string): string =>
  `pureO = MatchQ[#, SeriesData[_, _, {}, _, _, _]] &; ` +
  `If[AllTrue[Flatten[{d}], # === 0 &] || (AnyTrue[Flatten[{d}], pureO] && ` +
  `(bound = Min[Append[Map[Function[t, t[[5]]/t[[6]]], ` +
  `Cases[Quiet[TimeConstrained[${theirs}, 10, $Aborted]], _SeriesData, {0, Infinity}]], Infinity]]; ` +
  `AllTrue[Flatten[{d}], # === 0 || (pureO[#] && #[[5]]/#[[6]] >= bound) &])), `;

test("wolfram: FullSimplify of the difference, with 3 fixed-rational trials as a fallback", () => {
  expect(symbolicAgreementSource("wolfram", expr, expected, ["x"])).toBe(
    `Module[{d = Quiet[TimeConstrained[FullSimplify[(${through("Plus[x, x]")}) - (Times[2, x])], 10, $Aborted]], pureO, bound}, ` +
      `${equalSeries(through("Plus[x, x]"))}True, Module[{s = {Chop[N[(${through("Plus[Rational[7, 3], Rational[7, 3]]")}) - (Times[2, Rational[7, 3]])]], ` +
      `Chop[N[(${through("Plus[Rational[-11, 5], Rational[-11, 5]]")}) - (Times[2, Rational[-11, 5]])]], ` +
      `Chop[N[(${through("Plus[Rational[13, 4], Rational[13, 4]]")}) - (Times[2, Rational[13, 4]])]]}}, ` +
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

test("a closed call left held under arithmetic is held, a symbolic one is not", () => {
  const poly = ["Add", 1, "x", ["Power", "x", 2]];
  const asked = ["Normalize", poly, ["Function", ["Integrate", ["Power", "_1", 2], ["Limits", "x", -1, 1]]]];
  const norm = ["Integrate", ["Function", ["Block", ["Power", poly, 2]], "x"], ["Limits", "x", -1, 1]];
  const held = ["Divide", poly, norm];
  expect(leavesCall(asked as never, held as never)).toBe(true);
  expect(symbolicAgreementSource("wolfram", asked as never, held as never, ["x"])).toBeUndefined();
  // The integral evaluated: nothing left to hold.
  expect(leavesCall(asked as never, ["Divide", poly, ["Rational", 1, 2]] as never)).toBe(false);
  // Arithmetic over a closed call: held where the call is, however it sits in the sum.
  const sum = ["Add", ["Integrate", ["Sin", "x"], ["Limits", "x", 0, 1]], 1];
  expect(
    leavesCall(
      sum as never,
      ["Add", ["Integrate", ["Function", ["Sin", "x"], "x"], ["Limits", "x", 0, 1]], 1] as never,
    ),
  ).toBe(true);
  expect(leavesCall(sum as never, ["Subtract", 2, ["Cos", 1]] as never)).toBe(false);
  // A literal argument that is still there is not a call left undone.
  expect(leavesCall(["Re", ["Root", -17, 4]] as never, ["Divide", ["Root", -17, 4], 2] as never)).toBe(false);
  // `Sin(x)` has a free symbol: it can be all the answer there is.
  expect(leavesCall(["Add", ["Sin", "x"], ["Sin", "x"]] as never, ["Multiply", 2, ["Sin", "x"]] as never)).toBe(false);
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

test("DiscreteShift steps its variable like the other step heads", () => {
  const shift = ["DiscreteShift", ["Round", "k"], ["List", "k", 3]];
  expect(stepVariables(shift as never)).toEqual(new Set(["k"]));
  const source = symbolicAgreementSource("wolfram", shift as never, ["Round", ["Add", "k", 3]] as never, [
    "k",
  ]) as string;
  expect(source).toContain("DiscreteShift[Round[k], List[k, 3]]");
  expect(source).toMatch(/\/\. \{k -> \d+\}/);
});

test("a function mapped over a list is held where its body is held at an entry", () => {
  const mapped = (entries: unknown[]) => [
    "Map",
    ["Function", ["Block", ["FunctionConvexity", "_1", ["List", "x", "y"]]], "_1"],
    ["List", ...entries],
  ];
  const squares = [
    ["Power", "x", 2],
    ["Add", ["Power", "x", 2], ["Power", "y", 2]],
  ];
  const held = ["List", ...squares.map((entry) => ["FunctionConvexity", entry, ["List", "x", "y"]])];
  expect(leavesCall(mapped(squares) as never, held as never)).toBe(true);
  expect(leavesCall(mapped(squares) as never, ["List", 1, 1] as never)).toBe(false);
});

test("alignFunctions: an expression spelled another way is ours when both are one canonical form", () => {
  const ours = ["DiscreteDelta", ["Add", ["Sqrt", 2], ["Negate", "x"]]];
  const theirs = ["DiscreteDelta", ["Add", ["Power", 2, ["Rational", 1, 2]], ["Multiply", -1, "x"]]];
  expect(alignFunctions(theirs as never, ours as never)).toEqual(ours);
  const other = ["DiscreteDelta", ["Add", ["Sqrt", 3], ["Negate", "x"]]];
  expect(alignFunctions(other as never, ours as never)).toEqual(other);
});

test("a relation answer is compared as a statement, not by its spelling", () => {
  const source = symbolicAgreementSource(
    "wolfram",
    ["FunctionRange", ["Exp", "x"], "x", "y"] as never,
    ["Less", 0, "y"] as never,
    ["x", "y"],
  ) as string;
  expect(source).toContain("Equivalent[t, o]");
  expect(source).toContain(`agree[${through("FunctionRange[Exp[x], x, y]")}, Less[0, y]]`);
});

test("alignFunctions: a pure function is replaced by ours when it is the same one renamed", () => {
  const ours = ["List", ["Function", ["Block", ["Add", "x", 1]], "x"]];
  expect(alignFunctions(["List", ["Function", ["Add", "_1", 1]]], ours)).toEqual(ours);
  const other = ["List", ["Function", ["Add", "_1", 2]]];
  expect(alignFunctions(other, ours)).toEqual(other);
});

test("lookThroughConditions: a ConditionalExpression is its value", () => {
  const wrapped = ["List", ["ConditionalExpression", ["Divide", 1, "s"], ["Greater", "s", 0]]];
  expect(lookThroughConditions(wrapped)).toEqual(["List", ["Divide", 1, "s"]]);
});

test("a Wolfram answer is read through ConditionalExpression before the difference is taken", () => {
  const source = symbolicAgreementSource("wolfram", ["Divide", 1, "s"], ["Divide", 1, "s"], ["s"]) as string;
  expect(source).toContain("ConditionalExpression[e_, _] :> e");
});

test("leavesCall: a held call is held however its factors are ordered or grouped", () => {
  const call = [
    "LaplaceTransform",
    [
      "Multiply",
      ["Divide", 1, ["Sqrt", "t"]],
      ["ChebyshevT", "n", ["Multiply", ["Divide", 1, ["Add", "t", 1]], ["Add", ["Negate", "t"], 1]]],
      ["Power", ["Add", "t", 1], "n"],
    ],
    "t",
    "s",
  ] as never;
  const held = [
    "LaplaceTransform",
    [
      "Divide",
      [
        "Multiply",
        ["ChebyshevT", "n", ["Divide", ["Add", ["Negate", "t"], 1], ["Add", "t", 1]]],
        ["Power", ["Add", "t", 1], "n"],
      ],
      ["Sqrt", "t"],
    ],
    "t",
    "s",
  ] as never;
  expect(leavesCall(call, held)).toBe(true);
  // Another function is not the same call.
  expect(leavesCall(call, ["LaplaceTransform", ["Divide", ["Cos", "t"], ["Sqrt", "t"]], "t", "s"] as never)).toBe(
    false,
  );
});

test("a transform's result variable is sampled at positive values, and the one it integrates over not at all", () => {
  const transform = ["LaplaceTransform", ["Divide", 1, ["Sqrt", "t"]], "t", "s"] as never;
  expect([...positiveVariables(transform)]).toEqual(["s"]);
  expect([...boundVariables(transform)]).toEqual(["t"]);
  expect(positiveVariables(["Add", "x", "y"] as never).size).toBe(0);
  const source = symbolicAgreementSource("wolfram", transform, ["Divide", ["Sqrt", "Pi"], ["Sqrt", "s"]] as never, [
    "s",
    "t",
  ]) as string;
  expect(source).toContain("Rational[7, 3]");
  expect(source).not.toMatch(/Rational\[-\d+, \d+\]/);
  // The integration variable stays the call's own: with `t` a number it would be no transform at all.
  expect(source).toContain("LaplaceTransform[Divide[1, Sqrt[t]], t, Rational[7, 3]]");
});

test("a derivative's variable is not sampled at a number, which SymPy cannot differentiate at", () => {
  expect([...derivativeVariables(["D", ["Power", "x", 3], ["List", "x", 2]] as never)]).toEqual(["x"]);
  const source = symbolicAgreementSource(
    "sympy",
    ["D", ["Power", "x", 3], "x"] as never,
    ["Multiply", 3, ["Power", "x", 2]] as never,
    ["x"],
  );
  expect(source).not.toContain("Rational(7, 3)");
});

test("a form-transforming head that hands its input back is a rewrite not made", () => {
  const input = ["Sqrt", ["Negate", ["Power", "x", 2]]];
  expect(echoesInput(["FunctionExpand", input] as never, input as never)).toBe(true);
  expect(
    echoesInput(
      ["FunctionExpand", ["List", input, ["Ln", "y"]]] as never,
      ["List", input, ["Multiply", 2, "y"]] as never,
    ),
  ).toBe(true);
  expect(echoesInput(["FunctionExpand", input] as never, ["Multiply", "x", "i"] as never)).toBe(false);
  expect(echoesInput(["Simplify", "x"] as never, "x" as never)).toBe(false);
  expect(echoesInput(["Sin", input] as never, input as never)).toBe(false);
});

import { expect, test } from "vite-plus/test";
import { asksForDigits, sameDigits, verdictOf } from "../scripts/oracle-verdict.ts";

// An N(x, d) example is judged by Wolfram's displayed digits as well as its value: the value
// agrees within a tolerance that can't see the last digit, and Wolfram holds more digits than
// it shows (N[1/8, 2] is 0.125 at precision 2).

test("an example asks for digits when it is N with a digit count", () => {
  expect(asksForDigits(["N", "Pi", 30])).toBe(true);
  expect(asksForDigits(["N", "Pi"])).toBe(false);
  expect(asksForDigits(["Sin", 1])).toBe(false);
});

test("digits are compared significant digit for significant digit", () => {
  expect(sameDigits({ num: "1.17520119364380145688238185060" }, "1.175201193643801456882381850600")).toBe(true);
  expect(sameDigits({ num: "1.1752011936438014568823818506" }, "1.17520119364380145688238185059")).toBe(false);
  expect(sameDigits(0.12, "0.13")).toBe(false);
  // Truncated Pi/E, not Math.PI/Math.E: sameDigits compares the digits actually shown.
  expect(sameDigits(["List", 3.1416, 2.7183], "{3.1416, 2.7183}")).toBe(true);
  expect(sameDigits(["Complex", 0.25, -1.5], "0.25 - 1.5 I")).toBe(true);
  // Not lined up number for number: no digit verdict.
  expect(sameDigits(["List", 0.5, 0.25], "0.5")).toBeUndefined();
});

test("Wolfram's value agreeing is not enough for N(x, d): its displayed digits must too", () => {
  const tie = { value: "0.125`2.", numeric: "0.125`2.", shown: "0.13" };
  expect(verdictOf("wolfram", 0.12, tie, 0.05)).toBe("agree");
  expect(verdictOf("wolfram", 0.12, tie, 0.05, true)).toBe("disagree");
  expect(verdictOf("wolfram", 0.12, { ...tie, shown: "0.12" }, 0.05, true)).toBe("agree");
});

test("a lone integer answer to N(x, d) is judged by the digits Wolfram displays", () => {
  const e = { value: "2.7182818284590452354`1.", numeric: "2.7182818284590452354`1.", shown: "3." };
  expect(verdictOf("wolfram", 3, e, undefined, true)).toBe("agree");
  expect(verdictOf("wolfram", 2, e, undefined, true)).toBe("disagree");
});

test("Solve: Wolfram's rules and ours are the same solutions, in any order", () => {
  const rules = "List[List[Rule[x, -1]], List[Rule[x, 1]]]";
  const answer = { value: rules, numeric: rules };
  const solve = ["Solve", ["Equal", ["Power", "x", 2], 1], "x"];
  expect(verdictOf("wolfram", ["List", 1, -1], answer, undefined, false, solve)).toBe("agree");
  expect(verdictOf("wolfram", ["List", 1, 2], answer, undefined, false, solve)).toBe("disagree");
  const system = { value: "List[List[Rule[x, 2], Rule[y, 1]]]", numeric: "List[List[Rule[x, 2], Rule[y, 1]]]" };
  const pair = ["Solve", ["List", ["Equal", "x", 2], ["Equal", "y", 1]], ["List", "x", "y"]];
  expect(verdictOf("wolfram", ["List", ["Tuple", 2, 1]], system, undefined, false, pair)).toBe("agree");
  // Without the call, a list of values is not a list of rule lists.
  expect(verdictOf("wolfram", ["List", 1, -1], answer)).toBe("disagree");
});

test("Solve: an identity's fresh parameter is Wolfram's unconstrained {{}}", () => {
  const free = { value: "List[List[]]", numeric: "List[List[]]" };
  const identity = ["Solve", ["Equal", "x", "x"], "x"];
  expect(verdictOf("wolfram", ["List", "t"], free, undefined, false, identity)).toBe("agree");
  // The unknown itself, or a defined constant, is not a fresh parameter.
  expect(verdictOf("wolfram", ["List", "x"], free, undefined, false, identity)).toBe("disagree");
  expect(verdictOf("wolfram", ["List", "Pi"], free, undefined, false, identity)).toBe("disagree");
  expect(verdictOf("wolfram", ["List"], free, undefined, false, identity)).toBe("disagree");
});

test("a measurement agrees with a value its error bar holds", () => {
  // Mehler–Dirichlet at θ = 1/2: Gauss–Kronrod's 2.2214414411509225 ± 3.3e-8 against π/√2.
  const mehler = { value: "2.221441469079183", numeric: "2.221441469079183" };
  expect(verdictOf("wolfram", ["Measurement", 2.2214414411509225, 3.348136249957226e-8], mehler)).toBe("agree");
  expect(verdictOf("wolfram", ["Measurement", 2.2214414411509225, 1e-9], mehler)).toBe("disagree");
  // A Monte Carlo bar is too rough to widen the tolerance.
  const zero = { value: "0", numeric: "0." };
  expect(verdictOf("wolfram", ["Measurement", -0.012, 0.018], zero)).toBe("disagree");
  expect(
    verdictOf("mpmath", ["Measurement", 2.2214414411509225, 3.348136249957226e-8], { value: "2.221441469079183" }),
  ).toBe("agree");
});

test("an interval is its endpoints, and NaN is Wolfram's Indeterminate", () => {
  const interval = { value: "Interval[List[Power[E, -1], 2]]", numeric: "Interval[List[0.36787944117144233, 2.]]" };
  expect(verdictOf("wolfram", ["Interval", ["Divide", 1, "ExponentialE"], 2], interval)).toBe("agree");
  expect(verdictOf("wolfram", "NaN", { value: "Indeterminate" })).toBe("agree");
});

// A list answer that keeps a call in one entry and has a number in another matches neither of
// Wolfram's two readings whole: the exact one keeps the call (and a number as text), the
// numeric one turns the held `Sum` into an infinity.
test("a held Sum in a list agrees entry by entry, however the iterator is spelled", () => {
  const sum = ["Sum", ["Power", 2, "n"], ["Limits", "n", 0, "PositiveInfinity"]];
  const answer = {
    value: "List[Sum[Power[2, n], List[n, 0, DirectedInfinity[1]]], -1]",
    numeric: "List[DirectedInfinity[], -1.`]",
  };
  expect(verdictOf("wolfram", ["List", sum, -1] as never, answer)).toBe("agree");
  expect(verdictOf("wolfram", ["List", sum, -2] as never, answer)).toBe("disagree");
});

// A call ours holds is not agreement: the numbers agree only because our engine evaluates the call
// we left alone. A call only Wolfram holds is different: its `N` is real evidence for our closed form.
test("a call ours holds never agrees with the value Wolfram computed from it", () => {
  const eta = ["DirichletEta", ["Rational", 1, 2]];
  const closedForm = {
    value: "Times[Plus[1, Times[-1, Power[2, Rational[1, 2]]]], Zeta[Rational[1, 2]]]",
    numeric: "0.6048986434216304",
  };
  // Ours held, Wolfram's closed form.
  expect(verdictOf("wolfram", eta as never, closedForm, undefined, false, eta as never)).toBe("disagree");
  // Ours threads a held call over an array; Wolfram's entries are closed forms or numbers.
  const array = ["DirichletEta", ["List", ["Rational", 1, 2], 2]];
  const arrayAnswer = {
    value:
      "List[Times[Plus[1, Times[-1, Power[2, Rational[1, 2]]]], Zeta[Rational[1, 2]]], Times[Rational[1, 12], Power[Pi, 2]]]",
    numeric: "List[0.6048986434216304, 0.8224670334241132]",
  };
  expect(
    verdictOf(
      "wolfram",
      ["List", eta, ["Multiply", ["Rational", 1, 12], ["Power", "Pi", 2]]] as never,
      arrayAnswer,
      undefined,
      false,
      array as never,
    ),
  ).toBe("disagree");
  // Wolfram held, ours computed: Wolfram's `N` is the evidence, so a matching closed form agrees.
  const psi = ["PolyGamma", 1, ["Rational", 1, 4]];
  const held = { value: "PolyGamma[1, Rational[1, 4]]", numeric: "17.19732915450711" };
  expect(
    verdictOf(
      "wolfram",
      ["Add", ["Multiply", 8, "CatalanConstant"], ["Power", "Pi", 2]] as never,
      held,
      undefined,
      false,
      psi as never,
    ),
  ).toBe("agree");
  expect(verdictOf("wolfram", ["Multiply", 8, "CatalanConstant"] as never, held, undefined, false, psi as never)).toBe(
    "disagree",
  );
  // Both hold it, so the numbers may agree.
  expect(verdictOf("wolfram", psi as never, held, undefined, false, psi as never)).toBe("agree");
  // Neither holds it.
  expect(
    verdictOf("wolfram", ["Rational", 1, 2], { value: "Rational[1, 2]", numeric: "0.5" }, undefined, false, [
      "Sin",
      0,
    ] as never),
  ).toBe("agree");
});

test("a Wolfram real is compared within the precision it is tagged with, even past double range", () => {
  const huge = "9.9006562292958982506979236163019032507`15.95*^301029";
  const answer = { value: huge, numeric: huge };
  expect(verdictOf("wolfram", { num: "9.9006562292958982507e+301029" }, answer)).toBe("agree");
  // A different leading figure, or a different scale, is a disagreement however far out it sits.
  expect(verdictOf("wolfram", { num: "9.9106562292958982507e+301029" }, answer)).toBe("disagree");
  expect(verdictOf("wolfram", { num: "9.9006562292958982507e+301028" }, answer)).toBe("disagree");
  // A tagged value in range is read within its tag: 0.125 at precision 2 holds 0.124.
  const low = { value: "0.125`2.", numeric: "0.125`2." };
  expect(verdictOf("wolfram", 0.124, low)).toBe("agree");
  expect(verdictOf("wolfram", 0.2, low)).toBe("disagree");
});

test("an accuracy-qualified zero is zero within that accuracy, and N(x, d) rows still ask for their digits", () => {
  const zero = { value: "0``69.3", numeric: "0``69.3", shown: "0." };
  expect(verdictOf("wolfram", { num: "-2.0e-340" }, zero, undefined, true)).toBe("agree");
  // The accuracy, not the default tolerance, bounds the zero when the tolerance is tighter than it.
  expect(verdictOf("wolfram", 1e-50, zero, 1e-90, true)).toBe("disagree");
  const shown = { value: "0.125`2.", numeric: "0.125`2.", shown: "0.13" };
  expect(verdictOf("wolfram", 0.12, shown, 0.05, true)).toBe("disagree");
});

test("a pure function is the same up to renaming its bound variables", () => {
  const slots = "Function[PolyGamma[0, Slot[1]]]";
  const named = ["Function", ["Block", ["PolyGamma", 0, "z"]], "z"];
  const answer = { value: slots, numeric: slots };
  expect(verdictOf("wolfram", named, answer)).toBe("agree");
  expect(verdictOf("wolfram", ["Function", ["Block", ["PolyGamma", 0, "w"]], "w"], answer)).toBe("agree");
  expect(verdictOf("wolfram", ["Function", ["Block", ["PolyGamma", 1, "z"]], "z"], answer)).toBe("disagree");
  // Another arity is another function, and parameters are matched by position.
  expect(verdictOf("wolfram", ["Function", ["Block", ["PolyGamma", 0, "z"]], "z", "y"], answer)).toBe("disagree");
  const two = { value: "Function[Subtract[Slot[1], Slot[2]]]", numeric: "Function[Subtract[Slot[1], Slot[2]]]" };
  expect(verdictOf("wolfram", ["Function", ["Subtract", "a", "b"], "a", "b"], two)).toBe("agree");
  expect(verdictOf("wolfram", ["Function", ["Subtract", "b", "a"], "a", "b"], two)).toBe("disagree");
});

test("ConditionalExpression is compared by its value", () => {
  const wrapped = "ConditionalExpression[Power[x, 2], GreaterEqual[x, 0]]";
  expect(verdictOf("wolfram", ["Power", "x", 2], { value: wrapped, numeric: wrapped })).toBe("agree");
  expect(verdictOf("wolfram", ["Power", "x", 3], { value: wrapped, numeric: wrapped })).toBe("disagree");
});

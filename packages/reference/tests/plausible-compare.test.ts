import { expect, test } from "vite-plus/test";
import {
  agreesInNorm,
  associates,
  crateDeclines,
  hasNonAnswer,
  isStuckCall,
  outsideCrateDomain,
  overshootsPole,
  roundsTo,
  roundsToZero,
  undecidedIdentity,
} from "../scripts/plausible-compare.ts";

// What Plausible lets through without a person: N(x, d) rounding, agreement in norm, units.

test("N(x, d): their full answer rounding to ours at d figures is no finding", () => {
  expect(roundsTo(1, { num: "1.0" }, "1.1752011936438014")).toBe(true);
  expect(roundsTo(5, { num: "1.1752" }, "1.1752011936438014")).toBe(true);
  expect(roundsTo(3, ["Complex", 2, { num: "-2.15" }], "(2.0-2.1528j)")).toBe(true);
});

test("N(x, d): an exact tie may round to either neighbor", () => {
  expect(roundsTo(1, 0.4, "0.45")).toBe(true);
  expect(roundsTo(1, 0.5, "0.45")).toBe(true);
  expect(roundsTo(1, 0.4, "0.46")).toBe(false);
});

test("a 30-digit answer wrong at digit 12 stays a finding", () => {
  const ours = { num: "1.17520119364480145688238185060" };
  // To 30 figures: past what the double rounding can vouch for.
  expect(roundsTo(30, ours, "1.1752011936438014")).toBe(false);
  // Agreement in norm reads doubles only, so a bignum answer is never waved through as "precision".
  expect(agreesInNorm(ours, "1.1752011936438014")).toBe(false);
  expect(associates(ours, "1.1752011936438014")).toBe(false);
  // A wrong digit inside 15 is caught by the rounding itself.
  expect(roundsTo(14, { num: "1.1752011936448" }, "1.1752011936438014")).toBe(false);
});

test("an undecided identity is no finding only from the symbolic check", () => {
  expect(undecidedIdentity(true, "None")).toBe(true);
  expect(undecidedIdentity(false, "None")).toBe(false);
  expect(undecidedIdentity(true, "False")).toBe(false);
});

test("the Rust lane declining in its own words is only a message", () => {
  for (const theirs of [
    "panic: non-finite result: NaN",
    "panic: statrs: XInvalid",
    "panic: an integer below 2^64: the crate's parameter is a machine word",
    "panic: zero has no factorization",
    "panic: called `Result::unwrap()` on an `Err` value: ANotGreaterThanZero",
  ])
    expect(crateDeclines(theirs)).toBe(true);
  // An adapter bug is still a finding.
  expect(crateDeclines("panic: index out of bounds: the len is 2 but the index is 5")).toBe(false);
});

test("the crate's domain is judged from the sample's own arguments", () => {
  expect(outsideCrateDomain(["Log2", -9])).toBe(true);
  expect(outsideCrateDomain(["N", ["Log", 45, -7], 100])).toBe(true);
  expect(
    outsideCrateDomain([
      "Equal",
      ["Add", ["Sqrt", 0], ["Sqrt", 3]],
      ["Sqrt", ["Add", 5, ["Multiply", 8, ["Sqrt", -2]]]],
    ]),
  ).toBe(true);
  expect(outsideCrateDomain(["Log10", ["List", -1, 10, 100]])).toBe(true);
  expect(outsideCrateDomain(["Log10", ["List", 1, 10, 100]])).toBe(false);
  expect(outsideCrateDomain(["Beta", 1.219, -0.5])).toBe(true);
  expect(outsideCrateDomain(["BetaRegularized", -2.606, ["List", 0, 1], 1])).toBe(true);
  expect(outsideCrateDomain(["IsPrimePower", ["Power", 9, 40]])).toBe(true);
  expect(outsideCrateDomain(["IsSquareFree", 0])).toBe(true);
  expect(outsideCrateDomain(["FromDigits", ["List", 1, 15], 15])).toBe(true);
  expect(outsideCrateDomain(["Cos", ["Multiply", 10, ["Divide", "Pi", 0]]])).toBe(true);
  // Arguments the crate takes, or can't be read: the decline is not explained.
  expect(outsideCrateDomain(["Log2", 9])).toBe(false);
  expect(outsideCrateDomain(["Beta", 2, 3])).toBe(false);
  expect(outsideCrateDomain(["N", ["LogGamma", ["Power", 15, 300]]])).toBe(false);
  expect(outsideCrateDomain(["Log2", "x"])).toBe(false);
  expect(outsideCrateDomain(["IsPrime", ["Power", 3, 30]])).toBe(false);
});

test("a double beside an exact zero is rounding only where the zero is exact", () => {
  expect(roundsToZero(["Cos", ["Multiply", ["Rational", 1, 2], "Pi"]], 0, "6.123233995736766e-17")).toBe(true);
  expect(roundsToZero(["Tan", ["Divide", "Pi", -1]], 0, "1.2246467991473532e-16")).toBe(true);
  expect(roundsToZero(["LogGamma", ["Rational", 3, 3]], 0, "-4.440892098500626e-16")).toBe(true);
  // Ours flushing a small value to zero is not rounding.
  expect(roundsToZero(["Erf", 1e-13], 0, "1.1283791670955126e-13")).toBe(false);
  expect(roundsToZero(["Cos", 1], 0, "1e-17")).toBe(false);
  expect(roundsToZero(["Cos", ["Multiply", ["Rational", 1, 2], "Pi"]], 0, "0.001")).toBe(false);
});

test("a pole the crate overshoots is judged element by element, at the head's poles", () => {
  const gamma = ["Gamma", ["List", 2, -1]];
  expect(overshootsPole(gamma, ["List", 1, "ComplexInfinity"], "[1.0, -2.5653050788007548e16]")).toBe(true);
  // Not a pole of Gamma: ours would be wrong to say so.
  expect(overshootsPole(["Gamma", ["List", 2, 25]], ["List", 1, "ComplexInfinity"], "[1.0, 6.2e23]")).toBe(false);
  // Another element disagrees.
  expect(overshootsPole(gamma, ["List", 3, "ComplexInfinity"], "[1.0, -2.5653050788007548e16]")).toBe(false);
  // The crate's value is not huge.
  expect(overshootsPole(gamma, ["List", 1, "ComplexInfinity"], "[1.0, 12.5]")).toBe(false);
  const sec = ["Sec", ["List", ["Multiply", 3, ["Divide", "Pi", 6]], 0]];
  expect(overshootsPole(sec, ["List", "ComplexInfinity", 1], "[1.633123935319537e16, 1.0]")).toBe(true);
  expect(overshootsPole(["Sec", ["List", "Pi", 0]], ["List", "ComplexInfinity", 1], "[-1.0, 1.0]")).toBe(false);
});

test("ours' non-answers and calls left on numbers", () => {
  expect(hasNonAnswer(["List", 1, "ComplexInfinity"])).toBe(true);
  expect(hasNonAnswer(["List", 1, ["Error", "x"]])).toBe(true);
  expect(hasNonAnswer(["List", 1, 2])).toBe(false);
  expect(isStuckCall(["Log", -1, 2])).toBe(true);
  expect(isStuckCall(["ErfInv", 1.01])).toBe(true);
  expect(isStuckCall(["Complex", 1, 2])).toBe(false);
  expect(isStuckCall(["Add", ["Multiply", 2, "Pi"], ["Ln", 3]])).toBe(false);
});

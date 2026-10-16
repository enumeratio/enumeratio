import { expect, test } from "vite-plus/test";
import {
  agreesInNorm,
  associates,
  crateDeclines,
  exceedsDouble,
  hasHugeDouble,
  hasNonAnswer,
  isStuckCall,
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

test("the Rust lane declining in its own words is no disagreement", () => {
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

test("a double's rounding beside an exact zero, and a pole it overshoots", () => {
  expect(roundsToZero(0, "6.123233995736766e-17")).toBe(true);
  expect(roundsToZero(0, "0.001")).toBe(false);
  expect(roundsToZero(1, "1e-17")).toBe(false);
  expect(hasHugeDouble("[1.0, -2.5653050788007548e16]")).toBe(true);
  expect(hasHugeDouble("[1.0, 4.5]")).toBe(false);
  expect(hasNonAnswer(["List", 1, "ComplexInfinity"])).toBe(true);
  expect(hasNonAnswer(["List", 1, ["Error", "x"]])).toBe(true);
  expect(hasNonAnswer(["List", 1, 2])).toBe(false);
});

test("ours left a call on plain numbers unevaluated, or past a double", () => {
  expect(isStuckCall(["Log", -1, 2])).toBe(true);
  expect(isStuckCall(["ErfInv", 1.01])).toBe(true);
  expect(isStuckCall(["Complex", 1, 2])).toBe(false);
  expect(isStuckCall(["Add", ["Multiply", 2, "Pi"], ["Ln", 3]])).toBe(false);
  expect(exceedsDouble({ num: "5.45281521924575338242e+355" })).toBe(true);
  expect(exceedsDouble({ num: "5.4e+30" })).toBe(false);
});

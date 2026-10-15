import { expect, test } from "vite-plus/test";
import { agreesInNorm, associates, roundsTo, undecidedIdentity } from "../scripts/plausible-compare.ts";

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

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyPatch, logCombinationSign } from "../src/index.ts";

const ce = new ComputeEngine();
applyPatch(ce, logCombinationSign);

test("-Ln(2 - x) + Ln(2 + x) is left unsimplified -- the combined form is wrong at x = 3", () => {
  const simplified = ce.box(["Add", ["Negate", ["Ln", ["Subtract", 2, "x"]]], ["Ln", ["Add", 2, "x"]]]).simplify();
  // Unsimplified means: still an Add of two Ln terms, not folded into one Ln(quotient).
  expect(simplified.operator).toBe("Add");
  const atX3 = simplified.subs({ x: ce.number(3) }).N();
  const direct = ce.box(["Add", ["Negate", ["Ln", ["Subtract", 2, 3]]], ["Ln", ["Add", 2, 3]]]).N();
  expect(atX3.isEqual(direct)).toBe(true);
});

test("Ln(a) + Ln(b) with unknown-sign a, b is left unsimplified", () => {
  const simplified = ce.box(["Add", ["Ln", "a"], ["Ln", "b"]]).simplify();
  expect(simplified.operator).toBe("Add");
});

test("Ln of provably positive arguments still combines", () => {
  expect(ce.box(["Add", ["Ln", 3], ["Ln", 5]]).simplify().json).toEqual(["Ln", 15]);
});

test("a mixed sum combines only its log part when that part is safe", () => {
  const simplified = ce.box(["Add", ["Ln", 3], ["Ln", 5], "x"]).simplify();
  // The two safe logs fold; the unrelated term x is untouched.
  expect(simplified.toString()).toContain("ln(15)");
});

test("a mixed sum leaves the log part alone when it is unsafe", () => {
  const simplified = ce.box(["Add", ["Ln", "a"], ["Ln", "b"], 5]).simplify();
  expect(simplified.operator).toBe("Add");
  expect(simplified.toString()).not.toContain("ln(a * b)");
});

test("an unrelated Add still simplifies normally", () => {
  expect(ce.box(["Add", 2, 3]).simplify().json).toBe(5);
});

test("an unrelated Ln simplification still applies", () => {
  expect(
    ce
      .box(["Ln", ["Power", "x", 2]])
      .simplify()
      .toString(),
  ).toBe("2ln(|x|)");
});

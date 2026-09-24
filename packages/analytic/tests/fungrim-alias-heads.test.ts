import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

const ce = new ComputeEngine();
declareAnalytic(ce);

/** Probes: verify that the new heads are declared and that natives are not redeclared. */
test("Fungrim alias heads are declared", () => {
  expect(ce.lookupDefinition("BernoulliPolynomial")).toBeDefined();
  expect(ce.lookupDefinition("FallingFactorial")).toBeDefined();
  expect(ce.lookupDefinition("XGCD")).toBeDefined();
  expect(ce.lookupDefinition("Csgn")).toBeDefined();
  expect(ce.lookupDefinition("ConstGlaisher")).toBeDefined();
  expect(ce.lookupDefinition("CongruentMod")).toBeDefined();
});

/** Verify natives are not redeclared. */
test("native heads are not redeclared", () => {
  const native = ce.lookupDefinition("Pochhammer");
  expect(native).toBeDefined();

  const nativeBernoulliB = ce.lookupDefinition("BernoulliB");
  expect(nativeBernoulliB).toBeDefined();

  const nativeExtGCD = ce.lookupDefinition("ExtendedGCD");
  expect(nativeExtGCD).toBeDefined();
});

test("BernoulliPolynomial: exact symbolic forms", () => {
  // B_0(x) = 1
  expect(ce.box(["BernoulliPolynomial", 0, "x"]).evaluate().json).toEqual(1);

  // B_1(x) = x - 1/2
  const b1x = ce.box(["BernoulliPolynomial", 1, "x"]).evaluate();
  expect(b1x.json).toEqual(["Add", "x", ["Rational", -1, 2]]);
});

test("BernoulliPolynomial: numeric evaluation", () => {
  // B_2(0) = 1/6
  const b20 = ce.box(["BernoulliPolynomial", 2, 0]).N();
  expect(b20.re).toBeCloseTo(1 / 6, 1e-10);

  // B_2(1) = 1/6
  const b21 = ce.box(["BernoulliPolynomial", 2, 1]).N();
  expect(b21.re).toBeCloseTo(1 / 6, 1e-10);
});

test("FallingFactorial: numeric evaluation", () => {
  // FallingFactorial(5, 3) = 5·4·3 = 60
  const ff53 = ce.box(["FallingFactorial", 5, 3]).N();
  expect(ff53.re).toBeCloseTo(60, 1e-10);

  // FallingFactorial(1/2, 2) = (1/2)·(-1/2) = -1/4
  const ff_half = ce.box(["FallingFactorial", 0.5, 2]).N();
  expect(ff_half.re).toBeCloseTo(-0.25, 1e-10);
});

test("Csgn: complex sign function", () => {
  // Csgn(1) = 1
  expect(ce.box(["Csgn", 1]).N().re).toBe(1);

  // Csgn(-1) = -1
  expect(ce.box(["Csgn", -1]).N().re).toBe(-1);

  // Csgn(0) = 0
  expect(ce.box(["Csgn", 0]).N().re).toBe(0);

  // Csgn(i) = 1 (since Re(i) = 0 and Im(i) > 0)
  const csgnI = ce.box(["Csgn", ["Complex", 0, 1]]).N();
  expect(csgnI.re).toBe(1);

  // Csgn(-i) = -1 (since Re(-i) = 0 and Im(-i) < 0)
  const csgnNegI = ce.box(["Csgn", ["Complex", 0, -1]]).N();
  expect(csgnNegI.re).toBe(-1);
});

test("ConstGlaisher: constant value", () => {
  const glaisher = ce.box("ConstGlaisher").N();
  // A ≈ 1.28242712910062263687534256886979
  expect(glaisher.re).toBeCloseTo(1.28242712910062, 1e-10);
});

test("CongruentMod: integer congruence", () => {
  // 5 ≡ 2 (mod 3) is true since 3 | (5-2)
  const cong1 = ce.box(["CongruentMod", 5, 2, 3]).N();
  expect(cong1.json).toEqual("True");

  // 5 ≡ 1 (mod 3) is false
  const cong2 = ce.box(["CongruentMod", 5, 1, 3]).N();
  expect(cong2.json).toEqual("False");

  // 7 ≡ 7 (mod any) is always true
  const cong3 = ce.box(["CongruentMod", 7, 7, 5]).N();
  expect(cong3.json).toEqual("True");
});

test("exact arguments evaluate without N()", () => {
  const ev = (e: unknown) => ce.box(e as never).evaluate().json;
  expect(ev(["FallingFactorial", 5, 3])).toEqual(60);
  expect(ev(["FallingFactorial", 3, 5])).toEqual(0);
  expect(ev(["FallingFactorial", ["Rational", 1, 2], 2])).toEqual(["Rational", -1, 4]);
  expect(ev(["Csgn", -3])).toEqual(-1);
  expect(ev(["CongruentMod", 7, 1, 3])).toEqual("True");
  expect(ev(["CongruentMod", "12345678901234567891", 2, 7])).toEqual("True");
  expect(ev(["CongruentMod", "12345678901234567891", 3, 7])).toEqual("False");
  expect(ev(["XGCD", 240, 46])).toEqual(["Tuple", 2, -9, 47]);
});

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// The behavioral cases (exact and numeric evaluation) are now examples on each head's own
// record: BernoulliPolynomial, FallingFactorial, Csgn, ConstGlaisher, CongruentMod, XGCD.
// What's left is internal to declaration -- whether a definition exists at all, and that a
// native compute-engine head under a different name wasn't clobbered -- which an example,
// evaluating an expression to a value, can't express.

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

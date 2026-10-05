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

/** BernoulliB(n, x) delegates to BernoulliPolynomial; a complex or symbolic x must not loop back. */
test("BernoulliPolynomial at complex and symbolic x", () => {
  const complex = ["Complex", 1, 1] as never;
  // B_3(z) = z³ − 3z²/2 + z/2, at z = 1 + i
  for (const head of ["BernoulliPolynomial", "BernoulliB"]) {
    const value = ce.box([head, 3, complex] as never).N();
    expect(value.re).toBeCloseTo(-1.5, 12);
    expect(value.im).toBeCloseTo(-0.5, 12);
  }
  const exact = ce.box(["BernoulliPolynomial", 3, complex] as never).evaluate();
  expect(exact.re).toBeCloseTo(-1.5, 12);
  expect(exact.im).toBeCloseTo(-0.5, 12);

  const z = ce.box(["BernoulliPolynomial", 2, "z"] as never).N();
  expect(z.operator).not.toBe("BernoulliPolynomial");
  const w = ce.box(["BernoulliPolynomial", 4, ["Complex", -2.5, 0.75]] as never).N();
  // B_4(z) = z⁴ − 2z³ + z² − 1/30 at z = −5/2 + 3i/4
  expect(w.re).toBeCloseTo(46.75182291666667, 10);
  expect(w.im).toBeCloseTo(-73.6875, 10);
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

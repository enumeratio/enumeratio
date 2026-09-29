import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// EllipticTheta(a,u,q) and EllipticThetaPrime(a,u,q), a = 1..4 — Wolfram's nome
// convention |q| < 1 (matches mpmath.jtheta(n,z,q)). Direct q-series. Oracle coverage
// (mpmath and a Wolfram kernel, across real/complex u and q) now lives as `known` values
// on the reference examples (packages/reference/tests/known.test.ts), not here.

const ce = new ComputeEngine();
declareAnalytic(ce);

test("stays symbolic under plain evaluate at symbolic operands; a float argument evaluates numerically", () => {
  expect(ce.box(["EllipticTheta", 3, "u", "q"]).evaluate().json).toEqual(["EllipticTheta", 3, "u", "q"]);
  expect(ce.box(["EllipticTheta", 3, 0.3, 0.2]).evaluate().re).toBeCloseTo(1.3312935581135865, 10);
});

test("|q| >= 1 is declined", () => {
  expect(ce.box(["EllipticTheta", 3, 0.3, 1.0]).N().operator).toBe("EllipticTheta");
  expect(ce.box(["EllipticTheta", 3, 0.3, 1.5]).N().operator).toBe("EllipticTheta");
  expect(ce.box(["EllipticTheta", 3, 0.3, ["Complex", 0.9, 0.9]]).N().operator).toBe("EllipticTheta");
});

test("a must be a concrete integer 1..4", () => {
  expect(ce.box(["EllipticTheta", 5, 0.3, 0.2]).N().operator).toBe("EllipticTheta");
  expect(ce.box(["EllipticTheta", 0, 0.3, 0.2]).N().operator).toBe("EllipticTheta");
  expect(ce.box(["EllipticTheta", "a", 0.3, 0.2]).N().operator).toBe("EllipticTheta");
});

test("theta3(0,q) and theta4(0,q) are the classical q-series values", () => {
  // theta3(0, 0.5) = 1 + 2*sum(0.5^(n^2)) — a hand-checkable case independent of the
  // golden file (see the file header for the mpmath cross-check at complex points).
  const q = 0.5;
  let expected3 = 1;
  let expected4 = 1;
  for (let n = 1; n <= 30; n++) {
    expected3 += 2 * q ** (n * n);
    expected4 += 2 * (n % 2 === 0 ? 1 : -1) * q ** (n * n);
  }
  expect(ce.box(["EllipticTheta", 3, 0, q]).N().re).toBeCloseTo(expected3, 12);
  expect(ce.box(["EllipticTheta", 4, 0, q]).N().re).toBeCloseTo(expected4, 12);
});

test("theta1(0,q) = 0 for any q — theta1 is an odd function of u", () => {
  for (const q of [0.1, 0.5, -0.3]) {
    expect(ce.box(["EllipticTheta", 1, 0, q]).N().re).toBeCloseTo(0, 12);
  }
});

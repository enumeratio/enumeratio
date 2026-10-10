import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// Hypergeometric0F1, Hypergeometric0F1Regularized, Hypergeometric1F1Regularized,
// Hypergeometric2F1Regularized, Hypergeometric3F2Regularized and HypergeometricU — see
// hypergeometric.ts and hypergeometric-ustar.ts. mpmath (its own arbitrary-precision
// regularized series for the *Regularized heads, hyp0f1/hyperu natively for the other two)
// and, independently, a Wolfram kernel, are pinned as examples on each head's record.

const ce = new ComputeEngine();
declareAnalytic(ce);

test("Hypergeometric0F1 declines a pole (b a non-positive integer)", () => {
  expect(ce.box(["Hypergeometric0F1", 0, 0.5]).N().operator).toBe("Hypergeometric0F1");
  expect(ce.box(["Hypergeometric0F1", -1, 0.5]).N().operator).toBe("Hypergeometric0F1");
});

test("the regularized heads stay finite at non-positive-integer lower parameters", () => {
  // 1/Γ(non-positive integer) = 0, so these are finite (and generally non-zero once the
  // series clears the pole zone) rather than a symbolic bounce.
  expect(ce.box(["Hypergeometric0F1Regularized", -1, 0.5]).N().re).toBeCloseTo(0.1471797367221067, 9);
  expect(ce.box(["Hypergeometric1F1Regularized", 1, -1, 0.7]).N().re).toBeCloseTo(0.9867388266605335, 8);
  expect(ce.box(["Hypergeometric2F1Regularized", 1, 1, -1, 0.3]).N().re).toBeCloseTo(0.5247813411078718, 8);
});

test("1F1Regularized(a; a − 1; z) is its closed form e^z (1 + z/(a − 1))/Γ(a − 1) (DLMF 13.6)", () => {
  // a = 1/2, b = −1/2, z = 1/2: the bracket is 1 − 1 = 0, so the value is exactly 0 on both routes.
  const exact = ["Hypergeometric1F1Regularized", ["Rational", 1, 2], ["Rational", -1, 2], ["Rational", 1, 2]] as never;
  expect(ce.box(exact).evaluate().json).toEqual(0);
  expect(ce.box(exact).N().re).toBe(0);
  const closed = (Math.exp(0.3) * (1 + 0.3 / 1.5)) / (Math.sqrt(Math.PI) / 2);
  const numeric = ce.box(["Hypergeometric1F1Regularized", 2.5, 1.5, 0.3]).N().re as number;
  expect(Math.abs(numeric - closed)).toBeLessThan(1e-14);
  // not contiguous (b − a = −2): the series answers as before
  expect(ce.box(["Hypergeometric1F1Regularized", 1, 2, 0.5]).N().re).toBeCloseTo(1.2974425414002555, 13);
});

test("1F1Regularized(a; a; z) is e^z/Γ(a), so the contiguous sum cancels exactly", () => {
  const half = (n: number) => ["Rational", n, 2];
  expect(ce.box(["Hypergeometric1F1Regularized", 1.5, 1.5, 0.3]).N().re).toBeCloseTo(
    Math.exp(0.3) / (Math.sqrt(Math.PI) / 2),
    14,
  );
  // −½·M(3/2; ½; ½) + M(½; −½; ½) + M(½; ½; ½) = −√e/√π + 0 + √e/√π
  const row = [
    "Add",
    ["Multiply", half(-1), ["Hypergeometric1F1Regularized", half(3), half(1), half(1)]],
    ["Hypergeometric1F1Regularized", half(1), half(-1), half(1)],
    ["Hypergeometric1F1Regularized", half(1), half(1), half(1)],
  ];
  expect(ce.box(row as never).evaluate().json).toEqual(0);
  expect(ce.box(["N", row] as never).evaluate().re).toBe(0);
});

test("Hypergeometric2F1Regularized and Hypergeometric3F2Regularized decline |z| >= 1", () => {
  expect(ce.box(["Hypergeometric2F1Regularized", 1, 1, 2, 1.5]).N().operator).toBe("Hypergeometric2F1Regularized");
  expect(ce.box(["Hypergeometric2F1Regularized", 1, 1, 2, ["Complex", 1, 0.5]]).N().operator).toBe(
    "Hypergeometric2F1Regularized",
  );
  expect(ce.box(["Hypergeometric3F2Regularized", 1, 1, 1, 2, 3, 1.2]).N().operator).toBe(
    "Hypergeometric3F2Regularized",
  );
});

test("Hypergeometric2F1Regularized(a, b, b, z) is (1 - z)^-a / Gamma(b), exactly and past |z| = 1", () => {
  expect(
    ce.box(["Hypergeometric2F1Regularized", ["Rational", 1, 2], 1, 1, ["Rational", 1, 2]]).evaluate().json,
  ).toEqual(["Sqrt", 2]);
  expect(ce.box(["Hypergeometric2F1Regularized", 1, 2, 2, -3]).N().re).toBeCloseTo(0.25, 12);
  // a pole of Gamma and the cut [1, oo) are left alone
  expect(ce.box(["Hypergeometric2F1Regularized", 1, 0, 0, 0.5]).N().re).toBe(0);
  expect(ce.box(["Hypergeometric2F1Regularized", 1, 2, 2, 3]).N().operator).toBe("Hypergeometric2F1Regularized");
});

test("HypergeometricU agrees with HypergeometricUStar via z^a · U = U*", () => {
  const a = 1;
  const b = 2.5;
  const z = 3;
  const u = ce.box(["HypergeometricU", a, b, z]).N();
  const uStar = ce.box(["HypergeometricUStar", a, b, z]).N();
  expect(u.re * Math.pow(z, a)).toBeCloseTo(uStar.re, 9);
});

test("HypergeometricU declines z = 0 and (near-)integer b, like HypergeometricUStar", () => {
  expect(ce.box(["HypergeometricU", 1, 2, 0]).N().operator).toBe("HypergeometricU");
  expect(ce.box(["HypergeometricU", 1, 2, 3]).N().operator).toBe("HypergeometricU");
});

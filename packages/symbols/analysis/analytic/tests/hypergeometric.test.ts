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

test("Hypergeometric2F1Regularized and Hypergeometric3F2Regularized decline |z| >= 1", () => {
  expect(ce.box(["Hypergeometric2F1Regularized", 1, 1, 2, 1.5]).N().operator).toBe("Hypergeometric2F1Regularized");
  expect(ce.box(["Hypergeometric2F1Regularized", 1, 1, 2, ["Complex", 1, 0.5]]).N().operator).toBe(
    "Hypergeometric2F1Regularized",
  );
  expect(ce.box(["Hypergeometric3F2Regularized", 1, 1, 1, 2, 3, 1.2]).N().operator).toBe(
    "Hypergeometric3F2Regularized",
  );
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

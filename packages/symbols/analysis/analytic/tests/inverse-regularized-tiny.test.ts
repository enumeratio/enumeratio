import { ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// Roots too small (or too close to 1) for the solver to step to: the leading term
// x^a/(a·B(a, b)) inverts in log space. Expected values are mpmath's, solving the forward
// function itself (not the leading term) from that start.

const ce = new ComputeEngine();
declareAnalytic(ce);

const beta = (s: number, a: number, b: number) => ce.box(["InverseBetaRegularized", s, a, b]).N();
const gamma = (a: number, s: number) => ce.box(["InverseGammaRegularized", a, s]).N();
const near = (actual: number, expected: number, rel: number) =>
  expect(Math.abs(actual / expected - 1)).toBeLessThan(rel);

test("a root below the smallest double is 0, one within a double of 1 is 1", () => {
  expect(beta(0.3, 2.5e-6, 1.5e-6).re).toBe(0); // e^-89257
  expect(gamma(1e-6, 0.5).re).toBe(0);
  expect(beta(0.9, 1.5e-6, 2.5e-6).re).toBe(1);
  expect(beta(0.99, 3, 1e-6).re).toBe(1);
});

test("a tiny root keeps its own relative accuracy", () => {
  near(beta(0.3, 0.01, 1.5).re, 2.7998013587355e-53, 1e-12);
  near(beta(0.3, 0.02, 3).re, 1.6217557960865e-27, 1e-12);
  near(beta(0.3, 0.05, 0.5).re, 1.2917722717722e-10, 1e-13); // solver, not the leading term
  near(gamma(0.01, 0.5).re, 4.4655350189104e-31, 1e-12);
  near(gamma(0.03, 0.6).re, 3.127618263958e-14, 1e-13); // solver, not the leading term
});

test("past a double's digits the root is the true one, however far below a double", () => {
  const exact = new ComputeEngine();
  declareAnalytic(exact);
  exact.precision = 40;
  const num = (e: unknown) => String((exact.box(e as never).N().json as { num: string }).num);
  expect(num(["InverseBetaRegularized", 0.3, 2.5e-6, 1.5e-6])).toMatch(/^9\.88088184046674545511523461541\d*e-38765$/);
  expect(num(["InverseGammaRegularized", 1e-6, 0.5])).toMatch(/^5\.67093667677718270527848567603\d*e-301031$/);
  // 1 − y rounds to 1 at 40 digits
  expect(exact.box(["InverseBetaRegularized", 0.9, 1.5e-6, 2.5e-6]).N().re).toBe(1);
});

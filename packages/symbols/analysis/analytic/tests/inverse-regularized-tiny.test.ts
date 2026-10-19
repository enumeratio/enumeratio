// unstable: a bare ComputeEngine with only the analytic declarations
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

// s a hair under 1: Q = 1 − P has lost the digits of z, so P(a, z) = 1 − s is solved instead.
// Values are mpmath's, solving gammainc(a, 0, z, regularized=True) = 1 − s for the double s.
test("a root for s near 1 keeps its digits", () => {
  near(gamma(1.5, 1 - 1e-8).re, 5.611665505323225e-6, 1e-14);
  near(gamma(3, 1 - 1e-8).re, 0.003918704453152248, 1e-14);
  near(gamma(10, 1 - 1e-8).re, 0.7696086534273731, 1e-14);
  near(gamma(0.5, 1 - 1e-6).re, 7.853981634430288e-13, 1e-14);
  near(gamma(0.25, 1 - 1e-3).re, 6.749697893115399e-13, 1e-14);
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
  // s within 1e-30 of 1 (which no double holds): the series' subtraction needs the extra digits
  expect(num(["InverseGammaRegularized", 10, { num: "0.999999999999999999999999999999" }])).toMatch(
    /^0\.0045305942977519932066095081584329\d*$/,
  );
  expect(num(["InverseGammaRegularized", 0.7, { num: "0.9999999999999999999999999" }])).toMatch(
    /^1\.683732939061499141338880230655\d*e-36$/,
  );
});

// Q(500, z) in compute-engine is the rounding of 1 − P there (−7e-43 at z = 911.6), so the tail is
// solved on Q's continued fraction. Values are mpmath's.
test("an upper-tail root keeps its digits where the forward Q has none", () => {
  near(gamma(500, 1e-50).re, 911.5750573285015, 1e-14);
  near(gamma(1000, 1e-100).re, 1830.8469620466365, 1e-14);
  const exact = new ComputeEngine();
  declareAnalytic(exact);
  exact.precision = 40;
  const num = String((exact.box(["InverseGammaRegularized", 100, 1e-100]).N().json as { num: string }).num);
  expect(num).toMatch(/^483\.21953022256192661224358332\d*$/);
});

// An exact s a hair under 1 rounds to 1 (or its 1 − s to the wrong tail) as a double; the
// complement comes from the exact value. Values are mpmath's, for s = 1 − 1e-20 and 1 − 3e-17.
test("an exact s near 1 keeps its tail", () => {
  const under = (n: number, d: string) => ["Subtract", 1, ["Rational", n, { num: d }]];
  for (const [n, d, z, x] of [
    [1, "100000000000000000000", 1.4142135624397617e-10, 0.9999998642791146],
    [3, "100000000000000000", 7.745966712414834e-9, 0.9999980425652215],
  ] as const) {
    const s = under(n, d);
    near(ce.box(["InverseGammaRegularized", 2, s] as never).N().re, z, 1e-14);
    near(ce.box(["InverseBetaRegularized", s, 2, 3] as never).N().re, x, 1e-14);
  }
});

// Past a double's digits the beta has no bignum solve, so it declines rather than answer a double.
test("a beta root declines where it cannot give the digits asked", () => {
  const exact = new ComputeEngine();
  declareAnalytic(exact);
  exact.precision = 40;
  expect(exact.box(["InverseBetaRegularized", 0.3, 2.5, 1.5]).N().operator).toBe("InverseBetaRegularized");
});

// A target within 1e-14 of 1 is judged against the upper tail 1 − s, not against s itself.
test("a beta root for s near 1 is the upper tail's", () => {
  near(beta(0.99999999999999, 3, 1000).re, 0.03813328897427346, 1e-14);
  near(beta(0.9999999999, 30, 3).re, 0.9999727776780752, 1e-14);
});

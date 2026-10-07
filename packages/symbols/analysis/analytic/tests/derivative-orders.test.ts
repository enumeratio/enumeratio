// unstable: BigDecimal, the class compute-engine's boxed numbers hold; no /numerics subpath yet
import { BigDecimal, ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";
import { ellipticPiBig, incompleteEllipticEBig } from "../src/elliptic-pi-big.ts";
import { pfqBig } from "../src/hypergeometric-big.ts";

// Higher-order derivatives (so Series coefficients) for the heads with a closed first-derivative
// rule, against Wolfram's series, and the bignum kernels behind N(..., 50), against Wolfram's
// 50 digits (45 compared: the last few carry the guard).

const ce = new ComputeEngine();
declareAnalytic(ce);

/** The k-th derivative of `head` in its first (or `at`-th) argument at the point, as a float. */
const derivative = (head: string, orders: number[], point: unknown[]): number =>
  ce.box(["Apply", ["Derivative", head, ...orders], ...point] as never).N().re;

test("Jacobi cn, dn, nc, nd and zn: u-derivatives at 0 are the polynomials in m", () => {
  const m = 1 / 3;
  expect(derivative("JacobiCN", [4, 0], [0, ["Rational", 1, 3]])).toBeCloseTo(1 + 4 * m, 12);
  expect(derivative("JacobiCN", [6, 0], [0, ["Rational", 1, 3]])).toBeCloseTo(-(1 + 44 * m + 16 * m * m), 12);
  expect(derivative("JacobiDN", [4, 0], [0, ["Rational", 1, 3]])).toBeCloseTo(24 * ((m * (4 + m)) / 24), 12);
  expect(derivative("JacobiNC", [4, 0], [0, ["Rational", 1, 3]])).toBeCloseTo(5 - 4 * m, 12);
  expect(derivative("JacobiND", [2, 0], [0, ["Rational", 1, 3]])).toBeCloseTo(m, 12);
  expect(derivative("JacobiZN", [3, 0], [0, ["Rational", 1, 3]])).toBeCloseTo(-2 * m, 12);
});

test("ErfInv: Taylor coefficients, including the two-argument form", () => {
  expect(derivative("ErfInv", [3], [0])).toBeCloseTo(Math.PI ** 1.5 / 4, 12);
  expect(derivative("ErfInv", [5], [0])).toBeCloseTo((7 * 120 * Math.PI ** 2.5) / 960, 10);
  // ErfInv(z0, s) = ErfInv(s + Erf(z0)): ∂²/∂z0² at z0 = 0 is 2·y·e^(2y²) with y = ErfInv(s).
  const y = ce.box(["ErfInv", ["Rational", 1, 2]]).N().re;
  expect(derivative("ErfInv", [2, 0], [0, ["Rational", 1, 2]])).toBeCloseTo(2 * y * Math.exp(2 * y * y), 10);
});

test("Hypergeometric0F1 and EllipticE: derivatives at 0", () => {
  expect(derivative("Hypergeometric0F1", [0, 2], [2, 0])).toBeCloseTo(1 / (2 * 3), 12);
  expect(derivative("EllipticE", [2], [0])).toBeCloseTo((-3 * Math.PI) / 64, 12);
});

const COMPARED = 45;
const agrees = (ours: BigDecimal | undefined, wolfram: string): void => {
  expect(ours?.toPrecision(COMPARED).toString()).toBe(new BigDecimal(wolfram).toPrecision(COMPARED).toString());
};
const d = (x: string | number) => new BigDecimal(x);

test("EllipticPi, EllipticE(φ, m) and Hypergeometric0F1 past a double", () => {
  const saved = BigDecimal.precision;
  BigDecimal.precision = 60;
  try {
    agrees(ellipticPiBig(d("0.3"), undefined, d("0.4"), 50), "2.1487954158664566359360227863754503502433007322701");
    agrees(ellipticPiBig(d("0.3"), d("2"), d("0.4"), 50), "2.9069282158995094765661591577858774162815622496102");
    agrees(
      incompleteEllipticEBig(d("0.6666666666666666666666666666666666666666666666667"), d("2"), 50),
      "0.56057572978869155243343718013153078328208745860975",
    );
    agrees(pfqBig([], d(1), d(-2), 50), "-0.19654809527046820004079337208793223132588978731089");
  } finally {
    BigDecimal.precision = saved;
  }
});

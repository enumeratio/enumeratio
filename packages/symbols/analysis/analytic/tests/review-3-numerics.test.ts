import { createEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// Fast regressions for the review batch 3 numerics; each value is mpmath's (dps 30).

const ce = createEngine(declareAnalytic);
const N = (expr: unknown, digits?: number) => {
  const precision = ce.precision;
  try {
    return digits ? ce.box(["N", expr, digits] as never).evaluate() : ce.box(expr as never).N();
  } finally {
    ce.precision = precision;
  }
};

test("LogGamma at a negative real is correctly rounded", () => {
  expect(N(["LogGamma", -1.5]).re).toBeCloseTo(0.860047015376481, 15);
  expect(N(["LogGamma", -2.5]).re).toBeCloseTo(-0.05624371649767405, 16);
  expect(N(["LogGamma", -10.3]).re).toBeCloseTo(-14.457515440024205, 14);
});

test("a float operand answers with a double, not a bignum's digits", () => {
  const plain = (expr: unknown) => ce.box(expr as never).evaluate();
  expect(String(plain(["LogGamma", 100.5]).re)).toBe("361.4355404677776");
  expect(String(plain(["LerchPhi", 0.5, 2, 3.5]).re)).toBe("0.11938622686982048");
  expect(String(plain(["JacobiSN", 0.7, 1]).re)).toBe("0.6043677771171635");
  // Exact input under N() keeps the engine's digits.
  expect(String(N(["LogGamma", ["Rational", 7, 2]]).bignumRe)).toMatch(/^1\.2009736023470742248/);
});

test("BesselJZero carries the digits asked for", () => {
  expect(String(N(["BesselJZero", 0, 3], 30).bignumRe)).toMatch(/^8\.65372791291101221695419871266/);
  expect(N(["BesselJZero", 0, 3]).re).toBeCloseTo(8.65372791291101, 13);
  expect(String(N(["BesselJZero", 0, 100], 20).bignumRe)).toMatch(/^313\.3742660775278447/);
});

test("HypergeometricU is real for real input and declines where its terms cancel", () => {
  // b = 1.001 loses ~3 digits to the 1/(b − 1) pole of each term: real, and good to 1e-11.
  const near = N(["HypergeometricU", ["Rational", 1, 3], 1.001, 2]);
  expect(near.im).toBe(0);
  expect(Math.abs(near.re - 0.7610286058670256)).toBeLessThan(1e-11);
  expect(N(["HypergeometricU", ["Rational", 1, 3], 1.00001, 2]).operator).toBe("HypergeometricU");
  const u = N(["HypergeometricU", ["Rational", 1, 3], 1.5, 2]);
  expect(u.im).toBe(0);
  expect(Math.abs(u.re - 0.8118412930119827)).toBeLessThan(1e-12);
});

test("complex Zeta is correct to the last digit of the double pair", () => {
  const z = N(["Zeta", ["Complex", 0.5, 14]]);
  expect(z.re).toBe(0.02224114260999359);
  expect(z.im).toBe(-0.10325812326645006);
});

test("HurwitzZeta at the 0^(-s) winding stays unevaluated instead of NaN", () => {
  expect(N(["HurwitzZeta", ["Complex", 0, -1], 0]).operator).toBe("HurwitzZeta");
  expect(N(["HurwitzZeta", ["Complex", 0, 2], -1]).operator).toBe("HurwitzZeta");
});

test("EllipticTheta at q = 0 is the constant term", () => {
  expect(ce.box(["EllipticTheta", 3, 0.5, 0]).evaluate().json).toBe(1);
  expect(ce.box(["EllipticTheta", 1, "u", 0]).evaluate().json).toBe(0);
});

test("hyperbolics at x + i·kπ/2 leave no stray part", () => {
  const z = ["Add", ["Rational", 1, 2], ["Multiply", ["Rational", 1, 2], "Pi", "ImaginaryUnit"]];
  expect(N(["Coth", z]).im).toBe(0);
  expect(N(["Power", ["Csch", z], 2]).im).toBe(0);
  expect(N(["Coth", z]).re).toBeCloseTo(Math.tanh(0.5), 15);
});

test("RiemannZetaZero is the double nearest the zero", () => {
  expect(N(["RiemannZetaZero", 1]).im).toBe(14.134725141734695);
  expect(N(["RiemannZetaZero", 2]).im).toBe(21.022039638771556);
});

test("an Interval divided across zero is a union of rays", () => {
  expect(ce.box(["Divide", ["Interval", 1, 2], ["Interval", -1, 1]]).evaluate().json).toEqual([
    "Union",
    ["Interval", "NegativeInfinity", -1],
    ["Interval", 1, "PositiveInfinity"],
  ]);
});

test("FullSimplify keeps e^x and recognizes e^LogGamma", () => {
  expect(ce.box(["FullSimplify", ["Power", "ExponentialE", "x"]]).evaluate().json).toEqual([
    "Power",
    "ExponentialE",
    "x",
  ]);
  expect(ce.box(["FullSimplify", ["Power", "ExponentialE", ["LogGamma", "x"]]]).evaluate().json).toEqual([
    "Gamma",
    "x",
  ]);
  expect(
    ce
      .box(["Assuming", ["Greater", ["Re", "x"], 0], ["FullSimplify", ["Power", "ExponentialE", ["GammaLn", "x"]]]])
      .evaluate().json,
  ).toEqual(["Gamma", "x"]);
});

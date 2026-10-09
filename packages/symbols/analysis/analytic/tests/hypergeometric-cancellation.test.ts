import { ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// The double series declines when cancellation leaves its sum without trustworthy digits: the terms
// of 1F1(1/2; 3/2; −x²) and 0F1(; 1; −x²/4) grow far past the sum before they shrink.
// 1F1(1/2; 3/2; −x²) = √π·erf(x)/(2x) (DLMF 13.6.7) and 0F1(; 1; −x²/4) = J₀(x).
// Reference values are an 80-digit sum of the series (the committed oracle has no row for these).

const ce = new ComputeEngine();
declareAnalytic(ce);

// 1F1(1/2; 3/2; −40)/Γ(3/2) = erf(√40)/√40 = 1/√40, since erf(√40) = 1 to 1e-17.
const REG_1F1_AT_40 = 1 / Math.sqrt(40);
// 0F1(; 1; −200) = J₀(2√200) = −0.10666039222562551777…
const BESSEL_0F1_AT_200 = -0.10666039222562552;

/** The value matches `want` to `digits` significant digits, or the head stays unevaluated. */
function matchesOrDeclines(expr: unknown[], want: number, digits: number): void {
  const head = expr[0] as string;
  const got = ce.box(expr as never).N();
  if (got.operator === head) return;
  expect(Math.abs((got.re as number) - want) / Math.abs(want)).toBeLessThan(10 ** -digits);
}

test("1F1(1/2; 3/2; −40) regularized matches erf(√40)/√40 or declines", () => {
  matchesOrDeclines(["Hypergeometric1F1Regularized", ["Rational", 1, 2], ["Rational", 3, 2], -40], REG_1F1_AT_40, 12);
});

test("0F1(; 1; −200) matches J₀(2√200) or declines", () => {
  matchesOrDeclines(["Hypergeometric0F1", 1, -200], BESSEL_0F1_AT_200, 12);
  matchesOrDeclines(["Hypergeometric0F1Regularized", 1, -200], BESSEL_0F1_AT_200, 12);
  matchesOrDeclines(["HypergeometricPFQ", ["List"], ["List", 1], -200], BESSEL_0F1_AT_200, 12);
});

test("the cancelling cases decline rather than vouch for noise", () => {
  expect(ce.box(["Hypergeometric1F1Regularized", ["Rational", 1, 2], ["Rational", 3, 2], -40]).N().operator).toBe(
    "Hypergeometric1F1Regularized",
  );
  expect(ce.box(["Hypergeometric0F1", 1, -200]).N().operator).toBe("Hypergeometric0F1");
});

test("ordinary arguments keep their answers", () => {
  // 1F1(1/2; 3/2; −4)/Γ(3/2) = erf(2)/2; 0F1(; 1; −1) = J₀(2).
  const erf = ce.box(["Hypergeometric1F1Regularized", ["Rational", 1, 2], ["Rational", 3, 2], -4]).N().re as number;
  expect(Math.abs(erf - 0.49766113250947636)).toBeLessThan(1e-14);
  const j0 = ce.box(["Hypergeometric0F1", 1, -1]).N().re as number;
  expect(Math.abs(j0 - 0.22389077914123567)).toBeLessThan(1e-14);
});

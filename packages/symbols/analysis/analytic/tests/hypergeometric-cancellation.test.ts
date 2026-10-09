import { ComputeEngine } from "@enumeratio/engine/unstable"; // unstable: the same engine the other analytic tests use
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
  // Every route onto the double series, so none can answer where another declines.
  const declines = (expr: unknown[]) => expect(ce.box(expr as never).N().operator).toBe(expr[0]);
  declines(["Hypergeometric1F1Regularized", ["Rational", 1, 2], ["Rational", 3, 2], -40]);
  declines(["Hypergeometric0F1", 1, -200]);
  declines(["Hypergeometric0F1Regularized", 1, -200]);
  declines(["HypergeometricPFQ", ["List"], ["List", 1], -200]);
});

test("ordinary arguments keep their answers", () => {
  // 1F1(1/2; 3/2; −4)/Γ(3/2) = erf(2)/2; 0F1(; 1; −1) = J₀(2).
  const erf = ce.box(["Hypergeometric1F1Regularized", ["Rational", 1, 2], ["Rational", 3, 2], -4]).N().re as number;
  expect(Math.abs(erf - 0.49766113250947636)).toBeLessThan(1e-14);
  const j0 = ce.box(["Hypergeometric0F1", 1, -1]).N().re as number;
  expect(Math.abs(j0 - 0.22389077914123567)).toBeLessThan(1e-14);
});

// Where the threshold sits (`CANCELLATION_TOL`), against mpmath 1.3.0: [head, a, b, z, mpmath value].
// A value row has peak/|sum| · EPS under 3e-14 and keeps its digits; a null row has it from 1e-11 up and
// declines. 1F1 rows are the regularized 1F1(a; b; z)/Γ(b).
type Row = [head: string, a: number | null, b: number, z: number, value: number | null];
const GRID: Row[] = [
  ["0F1", null, 1, -1, 0.22389077914123567],
  ["0F1", null, 1, -5, -0.3268752818235339],
  ["0F1", null, 1, -10, 0.22884381861489356],
  ["0F1", null, 1, -50, null],
  ["0F1", null, 1, -200, null],
  ["0F1", null, 2.5, -3, 0.21423710771131335],
  ["0F1", null, 2.5, -8, -0.08566930250395267],
  ["0F1", null, 2.5, -30, null],
  ["0F1", null, 2.5, -100, null],
  ["1F1", 0.5, 1.5, -2, 0.674933236039655],
  ["1F1", 0.5, 1.5, -8, 0.35353099564340495],
  ["1F1", 0.5, 1.5, -15, null],
  ["1F1", 0.5, 1.5, -40, null],
  ["1F1", 1, 2, -5, 0.1986524106001829],
  ["1F1", 1, 2, -15, null],
  ["1F1", 1, 3, -8, 0.10938024160356098],
  ["1F1", 1, 3, -20, null],
  ["1F1", 2, 5, -8, 0.004637770974387957],
  ["1F1", 2, 5, -15, null],
];

test.skipIf(process.env["DEEP_TESTS"] !== "1")(
  "the double series keeps about 13 digits or declines, over a grid at negative z",
  () => {
    for (const [head, a, b, z, value] of GRID) {
      const expr = head === "0F1" ? ["Hypergeometric0F1", b, z] : ["Hypergeometric1F1Regularized", a, b, z];
      const got = ce.box(expr as never).N();
      const where = JSON.stringify(expr);
      if (value === null) {
        expect(got.operator, where).toBe(expr[0]);
        continue;
      }
      expect(got.operator, where).not.toBe(expr[0]);
      expect(Math.abs((got.re as number) - value) / Math.abs(value), where).toBeLessThan(3e-13);
    }
  },
);

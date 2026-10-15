// unstable: a bare engine to declare the analytic library against
import { operandsOf } from "@enumeratio/engine";
import { ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// `Series(f, x, ∞, n)` for Airy, Bessel, Ei, EllipticK and the generic ₁F₁/₂F₁ is the asymptotic
// expansion, cut as Wolfram cuts it. The values are mpmath's at x = 30.

const ce = new ComputeEngine();
declareAnalytic(ce);

const at30 = (f: unknown, order: number): { re: number; im: number } => {
  const normal = ce.box(["Normal", ["Series", f, "x", "PositiveInfinity", order]] as never).evaluate();
  const value = normal.subs({ x: 30, a: 0.3, b: 0.55, c: 1.4 } as never).N();
  return { re: value.re, im: value.im };
};
const relativeError = (value: { re: number; im: number }, exact: readonly [number, number]): number =>
  Math.hypot(value.re - exact[0], value.im - exact[1]) / Math.hypot(...exact);

const cases: [string, unknown, readonly [number, number], number][] = [
  ["AiryAi", ["AiryAi", "x"], [3.2082175915505e-49, 0], 5e-6],
  ["AiryBi", ["AiryBi", "x"], [9.057288512151307e46, 0], 5e-6],
  ["BesselJ(0)", ["BesselJ", 0, "x"], [-0.0863679835810402, 0], 1e-4],
  ["BesselY(0)", ["BesselY", 0, "x"], [-0.117295731686664, 0], 1e-4],
  ["BesselI(0)", ["BesselI", 0, "x"], [781672297823.977, 0], 1e-4],
  ["BesselK(0)", ["BesselK", 0, "x"], [2.13247749646306e-14, 0], 1e-4],
  ["BesselK(1/3)", ["BesselK", ["Rational", 1, 3], "x"], [2.13636647366112e-14, 0], 1e-4],
  ["ExpIntegralEi", ["ExpIntegralEi", "x"], [368973209407.2742, 0], 3e-3],
  ["EllipticK", ["EllipticK", "x"], [0.289222625914649, -0.566818126577825], 2e-4],
  ["Hypergeometric1F1", ["Hypergeometric1F1", "a", "c", "x"], [77246068305.9434, 0], 3e-4],
  ["Hypergeometric2F1", ["Hypergeometric2F1", "a", "b", "c", "x"], [0.474261640259218, -0.41009256080602], 5e-5],
];

test.each(cases)("%s: the expansion agrees with mpmath at x = 30, closer with more terms", (_, f, exact, tolerance) => {
  const error = relativeError(at30(f, 2), exact);
  expect(error).toBeLessThan(tolerance);
  expect(relativeError(at30(f, 6), exact)).toBeLessThan(error / 20);
});

const series = (f: unknown, order: number) => ce.box(["Series", f, "x", "PositiveInfinity", order] as never).evaluate();
/** The terms of every O-bearing sum in `Series(f, x, ∞, order)`: what each component keeps. */
const termsOf = (f: unknown, order: number): number => {
  const count = (e: ReturnType<typeof series>): number =>
    e.operator === "Add" && operandsOf(e).some((op) => op.operator === "BigO")
      ? operandsOf(e).length - 1
      : operandsOf(e).reduce((total, op) => total + count(op), 0);
  return count(series(f, order));
};

test("an expansion is a factor times a sum and an O-term, which Normal drops", () => {
  const ai = series(["AiryAi", "x"], 2);
  expect(ai.operator).toBe("Multiply");
  expect(operandsOf(operandsOf(ai).find((op) => op.operator === "Add")!).some((op) => op.operator === "BigO")).toBe(
    true,
  );
  expect(
    JSON.stringify(
      ce.box(["Normal", ["Series", ["AiryAi", "x"], "x", "PositiveInfinity", 2]] as never).evaluate().json,
    ),
  ).not.toContain("BigO");
});

test("terms are cut at x^−n as Wolfram cuts them, keeping a leading term at order 0", () => {
  expect([0, 1, 2, 3, 4].map((n) => termsOf(["AiryAi", "x"], n))).toEqual([1, 1, 2, 2, 3]);
  expect([0, 1, 2, 3, 4].map((n) => termsOf(["BesselK", 0, "x"], n))).toEqual([1, 1, 2, 3, 4]);
  // J has a cos series (x^−1/2, x^−5/2, …) and a sin series (x^−3/2, …), the latter absent at order 0
  expect([0, 1, 2, 3].map((n) => termsOf(["BesselJ", 0, "x"], n))).toEqual([1, 2, 2, 3]);
  expect(termsOf(["ExpIntegralEi", "x"], 6)).toBe(6);
});

test("a symbolic order keeps its polynomial coefficient", () => {
  const normal = ce.box(["Normal", ["Series", ["BesselK", "n", "x"], "x", "PositiveInfinity", 2]] as never).evaluate();
  const n = 0.7;
  const exact = Math.sqrt(Math.PI / 2) * Math.exp(-30) * (1 / Math.sqrt(30) + (4 * n * n - 1) / (8 * 30 ** 1.5));
  expect(normal.subs({ x: 30, n } as never).N().re).toBeCloseTo(exact, 20);
});

test("a half-integer order terminates, and what has no expansion here stays held", () => {
  // K_(3/2)(x) = √(π/2x) e^−x (1 + 1/x) exactly
  const normal = ce
    .box(["Normal", ["Series", ["BesselK", ["Rational", 3, 2], "x"], "x", "PositiveInfinity", 6]] as never)
    .evaluate();
  expect(normal.subs({ x: 30 } as never).N().re).toBeCloseTo(
    Math.sqrt(Math.PI / 60) * Math.exp(-30) * (1 + 1 / 30),
    20,
  );

  for (const held of [
    ["Series", ["AiryAi", ["Multiply", 2, "x"]], "x", "PositiveInfinity", 2],
    ["Series", ["BesselJ", "x", "x"], "x", "PositiveInfinity", 2],
    ["Series", ["Hypergeometric1F1", ["Rational", 1, 3], ["Rational", 7, 5], "x"], "x", "PositiveInfinity", 2],
    ["Series", ["AiryAi", "x"], "x", "NegativeInfinity", 2],
    ["Series", ["AiryAi", "x"], "x", "PositiveInfinity", -1],
  ]) {
    expect(ce.box(held as never).evaluate().operator, JSON.stringify(held)).toBe("Series");
  }
});

// ₂F₁ with positive integer parameters: m power terms, then a series with ln(−x); mpmath at x = −60.
test.each([
  [2, 3, 4, 0.0007328035948476449],
  [1, 1, 2, 0.06851456440288851],
  [2, 2, 5, 0.006127859500016699],
  [3, 1, 2, 0.0083310937919914],
  [1, 2, 1, 0.0002687449610319806],
  [4, 4, 3, -0.0000000224959545495334],
])("Hypergeometric2F1(%i, %i; %i) at infinity agrees with mpmath", (a, b, c, exact) => {
  const normal = ce.box([
    "Normal",
    ["Series", ["Hypergeometric2F1", a, b, c, "x"], "x", "PositiveInfinity", 14],
  ] as never);
  const value = normal
    .evaluate()
    .subs({ x: -60 } as never)
    .N().re;
  expect(Math.abs(value - exact) / Math.abs(exact)).toBeLessThan(1e-9);
});

test("Hypergeometric2F1(2, 3; 4; x) at infinity is cut at x^-n, with the logarithm in the x^-3 term", () => {
  const normal = ce.box([
    "Normal",
    ["Series", ["Hypergeometric2F1", 2, 3, 4, "x"], "x", "PositiveInfinity", 5],
  ] as never);
  // 3/x² + 3(2 ln(−x) − 1)/x³ − 9/x⁴ − 6/x⁵, at x = −10
  const x = -10;
  expect(
    normal
      .evaluate()
      .subs({ x } as never)
      .N().re,
  ).toBeCloseTo(3 / x ** 2 + (3 * (2 * Math.log(-x) - 1)) / x ** 3 - 9 / x ** 4 - 6 / x ** 5, 12);
  // order 2 keeps only 3/x²: the logarithm term starts at x⁻³
  const short = ce.box([
    "Normal",
    ["Series", ["Hypergeometric2F1", 2, 3, 4, "x"], "x", "PositiveInfinity", 2],
  ] as never);
  expect(
    short
      .evaluate()
      .subs({ x } as never)
      .N().re,
  ).toBeCloseTo(3 / x ** 2, 12);
});

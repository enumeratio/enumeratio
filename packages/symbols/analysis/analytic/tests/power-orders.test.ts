// unstable: ComputeEngine, the class under test
import { ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// Symbolic-order D and SeriesCoefficient for c·(bx+d)^a (the falling-factorial power rule and the
// binomial series), and the Fourier coefficients of an odd real root. Numbers are wolframscript's.

const ce = new ComputeEngine();
declareAnalytic(ce);

const value = (json: unknown, at: Record<string, number> = {}): { re: number; im: number } => {
  const n = ce
    .box(json as never)
    .evaluate()
    .subs(at as never)
    .N();
  return { re: n.re, im: n.im };
};

test("D at a symbolic order: the power rule, real at a negative x for a real root", () => {
  const d = ["D", ["CubeRoot", "x"], ["List", "x", "k"]];
  expect(ce.box(d as never).evaluate().operator).toBe("Multiply");
  for (const [k, x, expected] of [
    [3, 7 / 3, 0.038669166257496515],
    [3, -11 / 5, 0.045238592775252065],
    [4, 7 / 3, -0.044193332865710304],
    [4, -11 / 5, 0.05483465790939644],
  ] as const) {
    expect(value(d, { k, x }).re).toBeCloseTo(expected, 12);
  }
});

test("D at a symbolic order: a linear base and a constant factor", () => {
  const d = ["D", ["Multiply", 3, ["Power", ["Add", ["Multiply", 2, "x"], 1], "a"]], ["List", "x", "k"]];
  // d²/dx² 3(2x+1)^a = 12 a (a-1) (2x+1)^(a-2)
  expect(value(d, { k: 2, a: 5 / 2, x: 1 }).re).toBeCloseTo(12 * 2.5 * 1.5 * 3 ** 0.5, 10);
  // a numeric order and an order the rule does not cover are left to compute-engine's D
  expect(ce.box(["D", ["Sin", "x"], ["List", "x", "k"]] as never).evaluate().operator).toBe("D");
});

test("SeriesCoefficient at a symbolic n: binomial coefficients of a power", () => {
  const c = ["SeriesCoefficient", ["CubeRoot", "x"], ["List", "x", 1, "n"]];
  expect(ce.box(c as never).evaluate().operator).toBe("Piecewise");
  expect(value(c, { n: 3 }).re).toBeCloseTo(5 / 81, 14);
  expect(value(c, { n: 4 }).re).toBeCloseTo(-10 / 243, 14);
  expect(value(c, { n: -2 }).re).toBe(0);
  // about a negative x0 the real root's coefficients are real, as Wolfram's are
  const negative = ["SeriesCoefficient", ["CubeRoot", "x"], ["List", "x", -2, "n"]];
  expect(value(negative, { n: 3 }).re).toBeCloseTo(0.009721613039312293, 14);
  expect(value(negative, { n: 3 }).im).toBe(0);
  expect(value(["SeriesCoefficient", ["CubeRoot", "x"], ["List", "x", -2, 3]]).re).toBeCloseTo(
    0.009721613039312293,
    14,
  );
  // 1/(1-2x) = Σ 2^n x^n
  const geometric = ["SeriesCoefficient", ["Divide", 1, ["Subtract", 1, ["Multiply", 2, "x"]]], ["List", "x", 0, "n"]];
  expect(value(geometric, { n: 5 }).re).toBeCloseTo(32, 12);
  // a branch point at x0 is no Taylor series
  expect(ce.box(["SeriesCoefficient", ["Sqrt", "x"], ["List", "x", 0, "n"]] as never).evaluate().operator).toBe(
    "SeriesCoefficient",
  );
});

test("FourierCoefficient and FourierSeries of an odd real root", () => {
  const coefficient = (f: unknown, k: number) => value(["FourierCoefficient", f, "x", k]).im;
  expect(coefficient(["CubeRoot", "x"], 1)).toBeCloseTo(-0.7205451094670882, 12);
  expect(coefficient(["CubeRoot", "x"], 2)).toBeCloseTo(0.13660878796714362, 12);
  expect(coefficient(["CubeRoot", "x"], -2)).toBeCloseTo(-0.13660878796714362, 12);
  expect(coefficient(["Root", "x", 5], 3)).toBeCloseTo(-0.2080057329619797, 12);
  expect(value(["FourierCoefficient", ["CubeRoot", "x"], "x", 0]).re).toBe(0);
  const series = ["FourierSeries", ["CubeRoot", "x"], "x", 2];
  expect(value(series, { x: 1.3 }).re).toBeCloseTo(1.24773024117882, 12);
  expect(value(series, { x: -1.3 }).re).toBeCloseTo(-1.24773024117882, 12);
});

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);

const evalMJ = (mathjson: unknown) =>
  ce.box(mathjson as Parameters<ComputeEngine["box"]>[0]).evaluate();

// ─── independent cross-checks shared by the GF/EGF tests below ────────────────────────────

/** Σ termFn(k)·x^k for k = 0..upTo, evaluated in plain floating point — an independent way
 *  to check a returned generating function's value at `x`, without going through the same
 *  Berlekamp–Massey/partial-fraction code that produced it. */
function numericPartialSum(termFn: (k: number) => number, x: number, upTo: number): number {
  let sum = 0;
  for (let k = 0; k <= upTo; k++) sum += termFn(k) * x ** k;
  return sum;
}

const catalanTerm = (k: number) => evalMJ(["CatalanNumber", k]).N().re;
const fibonacciTerm = (k: number) => evalMJ(["Fibonacci", k]).N().re;
const binomial3Term = (k: number) => evalMJ(["Binomial", k, 3]).N().re;

/** The Taylor coefficients of `expr` (a function of `xName`) at 0, up to `upTo`, by repeated
 *  symbolic differentiation — independent of the closed-form construction under test. */
function taylorCoefficients(
  expr: ReturnType<typeof evalMJ>,
  xName: string,
  upTo: number,
): number[] {
  const coeffs: number[] = [];
  let derivative = expr;
  let factorial = 1n;
  for (let k = 0; k <= upTo; k++) {
    const at0 = derivative.subs({ [xName]: ce.Zero }).evaluate();
    coeffs.push(
      ce
        .function("Divide", [at0, ce.number(factorial)])
        .evaluate()
        .N().re,
    );
    derivative = ce.function("D", [derivative, xName]).evaluate();
    factorial *= BigInt(k + 1);
  }
  return coeffs;
}

// ─── DiscreteRatio ──────────────────────────────────────────────────────────────────────────

test("DiscreteRatio(n!, n) simplifies to n + 1", () => {
  expect(evalMJ(["DiscreteRatio", ["Factorial", "n"], "n"]).toString()).toBe("n + 1");
});

test("DiscreteRatio(2^n, n) simplifies to the constant ratio 2", () => {
  expect(evalMJ(["DiscreteRatio", ["Power", 2, "n"], "n"]).toString()).toBe("2");
});

test("DiscreteRatio(Binomial(n,2), n) simplifies to a rational function of n", () => {
  const r = evalMJ(["DiscreteRatio", ["Binomial", "n", 2], "n"]);
  // Binomial(n+1,2)/Binomial(n,2) = (n+1)/(n-1) for n > 1 — check numerically instead of by
  // string form, since compute-engine's normal form for the ratio isn't fixed here.
  for (const n of [3, 4, 10, 25]) {
    const got = r
      .subs({ n: ce.number(n) })
      .evaluate()
      .N().re;
    const expected = ((n + 1) * n) / 2 / ((n * (n - 1)) / 2);
    expect(got).toBeCloseTo(expected, 9);
  }
});

// ─── DifferenceDelta ────────────────────────────────────────────────────────────────────────

test("DifferenceDelta(n^2, n) simplifies to 2n + 1", () => {
  expect(evalMJ(["DifferenceDelta", ["Power", "n", 2], "n"]).toString()).toBe("2n + 1");
});

test("DifferenceDelta(2^n, n) is 2^n at every n — checked numerically, since simplify doesn't fold 2^(n+1) - 2^n on its own", () => {
  const r = evalMJ(["DifferenceDelta", ["Power", 2, "n"], "n"]);
  for (const n of [1, 2, 5, 10]) {
    expect(
      r
        .subs({ n: ce.number(n) })
        .evaluate()
        .N().re,
    ).toBeCloseTo(2 ** n, 9);
  }
});

// ─── GeneratingFunction ─────────────────────────────────────────────────────────────────────

test("GeneratingFunction(Fibonacci(n), n, x) is x/(1-x-x^2) — checked against the sequence's first 20 terms", () => {
  const gf = evalMJ(["GeneratingFunction", ["Fibonacci", "n"], "n", "x"]);
  const x = 0.05;
  const direct = gf
    .subs({ x: ce.number(x) })
    .evaluate()
    .N().re;
  const independent = numericPartialSum(fibonacciTerm, x, 40);
  expect(direct).toBeCloseTo(independent, 9);
  // and the textbook closed form directly, at a second point
  const x2 = 0.1;
  const expected = x2 / (1 - x2 - x2 * x2);
  expect(
    gf
      .subs({ x: ce.number(x2) })
      .evaluate()
      .N().re,
  ).toBeCloseTo(expected, 9);
});

test("GeneratingFunction(CatalanNumber(n), n, x) is (1-sqrt(1-4x))/(2x) — not C-finite, matched by name", () => {
  const gf = evalMJ(["GeneratingFunction", ["CatalanNumber", "n"], "n", "x"]);
  const x = 0.01;
  const direct = gf
    .subs({ x: ce.number(x) })
    .evaluate()
    .N().re;
  const independent = numericPartialSum(catalanTerm, x, 40);
  expect(direct).toBeCloseTo(independent, 9);
  const expected = (1 - Math.sqrt(1 - 4 * x)) / (2 * x);
  expect(direct).toBeCloseTo(expected, 9);
});

test("GeneratingFunction(Count(DyckPaths(n)), n, x) recognises the Catalan sequence through Count, unnamed", () => {
  const gf = evalMJ(["GeneratingFunction", ["Count", ["DyckPaths", "n"]], "n", "x"]);
  const direct = gf
    .subs({ x: ce.number(0.01) })
    .evaluate()
    .N().re;
  const expected = (1 - Math.sqrt(1 - 4 * 0.01)) / (2 * 0.01);
  expect(direct).toBeCloseTo(expected, 9);
});

test("GeneratingFunction(Binomial(n,3), n, x) is x^3/(1-x)^4 (a fixed-k binomial, C-finite)", () => {
  const gf = evalMJ(["GeneratingFunction", ["Binomial", "n", 3], "n", "x"]);
  const x = 0.02;
  const direct = gf
    .subs({ x: ce.number(x) })
    .evaluate()
    .N().re;
  const independent = numericPartialSum(binomial3Term, x, 40);
  expect(direct).toBeCloseTo(independent, 9);
  expect(direct).toBeCloseTo(x ** 3 / (1 - x) ** 4, 9);
});

test("GeneratingFunction(2^n, n, x) is the geometric series 1/(1-2x)", () => {
  const gf = evalMJ(["GeneratingFunction", ["Power", 2, "n"], "n", "x"]);
  expect(
    gf
      .subs({ x: ce.number(0.1) })
      .evaluate()
      .N().re,
  ).toBeCloseTo(1 / (1 - 0.2), 9);
});

test("GeneratingFunction(n^2, n, x) is a rational GF of a polynomial sequence", () => {
  const gf = evalMJ(["GeneratingFunction", ["Power", "n", 2], "n", "x"]);
  const x = 0.1;
  let independent = 0;
  for (let k = 0; k <= 40; k++) independent += k * k * x ** k;
  expect(
    gf
      .subs({ x: ce.number(x) })
      .evaluate()
      .N().re,
  ).toBeCloseTo(independent, 6);
});

test("GeneratingFunction(n!, n, x) has no closed form and stays unevaluated, same as Wolfram", () => {
  const gf = evalMJ(["GeneratingFunction", ["Factorial", "n"], "n", "x"]);
  expect(gf.operator).toBe("GeneratingFunction");
});

// ─── ExponentialGeneratingFunction ──────────────────────────────────────────────────────────

test("ExponentialGeneratingFunction(n!, n, x) is 1/(1-x)", () => {
  const egf = evalMJ(["ExponentialGeneratingFunction", ["Factorial", "n"], "n", "x"]);
  const x = 0.3;
  expect(
    egf
      .subs({ x: ce.number(x) })
      .evaluate()
      .N().re,
  ).toBeCloseTo(1 / (1 - x), 9);
  const taylor = taylorCoefficients(egf, "x", 6).map((c, k) => Math.round(c * factorialNumber(k)));
  expect(taylor).toEqual([1, 1, 2, 6, 24, 120, 720]);
});

test("ExponentialGeneratingFunction(Subfactorial(n), n, x) is exp(-x)/(1-x) — the derangement EGF", () => {
  const egf = evalMJ(["ExponentialGeneratingFunction", ["Subfactorial", "n"], "n", "x"]);
  const x = 0.2;
  const expected = Math.exp(-x) / (1 - x);
  expect(
    egf
      .subs({ x: ce.number(x) })
      .evaluate()
      .N().re,
  ).toBeCloseTo(expected, 9);
});

test("ExponentialGeneratingFunction(BellNumber(n), n, x) is exp(exp(x) - 1)", () => {
  const egf = evalMJ(["ExponentialGeneratingFunction", ["BellNumber", "n"], "n", "x"]);
  const x = 0.15;
  const expected = Math.exp(Math.exp(x) - 1);
  expect(
    egf
      .subs({ x: ce.number(x) })
      .evaluate()
      .N().re,
  ).toBeCloseTo(expected, 9);
});

test("ExponentialGeneratingFunction(Fibonacci(n), n, x) reproduces the sequence's Taylor coefficients", () => {
  const egf = evalMJ(["ExponentialGeneratingFunction", ["Fibonacci", "n"], "n", "x"]);
  const taylor = taylorCoefficients(egf, "x", 8).map((c, k) => Math.round(c * factorialNumber(k)));
  expect(taylor).toEqual([0, 1, 1, 2, 3, 5, 8, 13, 21]);
});

function factorialNumber(k: number): number {
  let r = 1;
  for (let i = 2; i <= k; i++) r *= i;
  return r;
}

// ─── FindSequenceFunction ───────────────────────────────────────────────────────────────────

test("FindSequenceFunction([1,2,4,8,16], n) finds the geometric closed form 2^n", () => {
  const found = evalMJ(["FindSequenceFunction", ["List", 1, 2, 4, 8, 16], "n"]);
  for (const n of [0, 1, 5, 10]) {
    expect(
      found
        .subs({ n: ce.number(n) })
        .evaluate()
        .N().re,
    ).toBeCloseTo(2 ** n, 9);
  }
});

test("FindSequenceFunction([1,4,9,16,25], n) finds the polynomial closed form (n+1)^2", () => {
  const found = evalMJ(["FindSequenceFunction", ["List", 1, 4, 9, 16, 25], "n"]);
  for (const n of [0, 1, 2, 3, 4, 10]) {
    expect(
      found
        .subs({ n: ce.number(n) })
        .evaluate()
        .N().re,
    ).toBeCloseTo((n + 1) ** 2, 9);
  }
});

test("FindSequenceFunction on the first ten Fibonacci numbers finds a closed form matching Fibonacci(n)", () => {
  const found = evalMJ(["FindSequenceFunction", ["List", 0, 1, 1, 2, 3, 5, 8, 13, 21, 34], "n"]);
  for (let n = 0; n < 12; n++) {
    expect(
      found
        .subs({ n: ce.number(n) })
        .evaluate()
        .N().re,
    ).toBeCloseTo(fibonacciTerm(n), 6);
  }
});

test("FindSequenceFunction on the first Catalan numbers recognises CatalanNumber(n)", () => {
  const found = evalMJ(["FindSequenceFunction", ["List", 1, 1, 2, 5, 14, 42, 132], "n"]);
  expect(found.operator).toBe("CatalanNumber");
});

test("FindSequenceFunction on factorials recognises n!", () => {
  const found = evalMJ(["FindSequenceFunction", ["List", 1, 1, 2, 6, 24, 120], "n"]);
  expect(found.operator).toBe("Factorial");
});

test("FindSequenceFunction re-evaluates its closed form to reproduce the input exactly", () => {
  const input = [1, 3, 9, 27, 81, 243];
  const found = evalMJ(["FindSequenceFunction", ["List", ...input], "n"]);
  const got = input.map(
    (_, n) =>
      found
        .subs({ n: ce.number(n) })
        .evaluate()
        .N().re,
  );
  input.forEach((v, i) => expect(got[i]).toBeCloseTo(v, 9));
});

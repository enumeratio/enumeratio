// unstable: a bare engine to declare the analytic library against
import { ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";
import { qSeries } from "../src/series-q-binomial.ts";

// Series of QBinomial/QFactorial at q = 0 for a non-integer rational argument is a series in
// q^(1/d). Truncation and coefficients are Wolfram's (checked against wolframscript).

const ce = new ComputeEngine();
declareAnalytic(ce);

const series = (f: unknown, order?: number) =>
  ce.box(["Series", f, "q", 0, ...(order === undefined ? [] : [order])] as never).evaluate();
const qbinomial = (n: unknown, k: unknown) => ["QBinomial", n, k, "q"];
const half = ["Rational", 1, 2];
const power = (e: unknown) => ["Power", "q", e];

test("symbolic q-analogs are canonical, so a difference of them is a plain Add", () => {
  for (const f of [["QFactorial", "k", "q"], qbinomial("n", "k"), qbinomial(half, 1), ["QFactorial", -2, "q"]]) {
    expect(ce.box(f as never).isCanonical, JSON.stringify(f)).toBe(true);
  }
  const difference = ce.box(["Subtract", ["QFactorial", ["Add", "k", 1], "q"], ["QFactorial", "k", "q"]] as never);
  expect(difference.isCanonical).toBe(true);
  expect(difference.operator).toBe("Add");
});

test("the series of QBinomial(1/2, 1, q) is 1/(1 + sqrt(q)), cut as Wolfram cuts it", () => {
  expect(series(qbinomial(half, 1), 2).json).toEqual([
    "Add",
    power(2),
    "q",
    ["Negate", ["Sqrt", "q"]],
    ["Negate", power(["Rational", 3, 2])],
    ["BigO", power(["Rational", 5, 2])],
    1,
  ]);
  const normal = ce.box(["Normal", ["Series", qbinomial(half, 1), "q", 0, 3]] as never).evaluate();
  const q = 0.01;
  expect(normal.subs({ q: ce.number(q) }).N().re).toBeCloseTo(1 / (1 + Math.sqrt(q)), 6);
});

test("QBinomial(5, 5/2, q) matches Wolfram term for term, including the order-0 and order-1 cuts", () => {
  const n = ["Rational", 5, 2];
  expect(series(qbinomial(5, n), 4).json).toEqual([
    "Add",
    ["Multiply", 5, power(4)],
    ["Multiply", 3, power(3)],
    ["Multiply", 2, power(2)],
    "q",
    ["Multiply", -4, power(["Rational", 9, 2])],
    ["Multiply", -2, power(["Rational", 7, 2])],
    ["BigO", power(5)],
    1,
  ]);
  expect(series(qbinomial(5, n), 1).json).toEqual(["Add", "q", ["BigO", power(2)], 1]);
  expect(series(qbinomial(5, n), 0).json).toEqual(["Add", ["BigO", ["Sqrt", "q"]], 1]);
});

test("an exponent below 1 on a numerator factor sets the remainder", () => {
  // (3/4, 1): (q^(3/4);q)∞ stands alone, so the series stops at q^(2 + 3/4) rather than q^3.
  expect(series(qbinomial(["Rational", 3, 4], 1), 2).json).toEqual([
    "Add",
    power(2),
    "q",
    ["Negate", power(["Rational", 3, 4])],
    ["Negate", power(["Rational", 7, 4])],
    ["BigO", power(["Rational", 11, 4])],
    1,
  ]);
});

test("a vanishing factor gives 0; shapes outside the products are held, not answered with Derivative terms", () => {
  expect(series(qbinomial(half, ["Rational", 3, 2]), 2).json).toBe(0);
  const held = [
    qbinomial(-1, half), // a pole: (q^0;q)∞ in the denominator
    ["QFactorial", -2, "q"],
    ["QFactorial", ["Rational", -5, 2], "q"], // two reflected factors
    qbinomial(["Rational", -7, 6], ["Rational", -1, 3]), // only the denominator reflects
  ];
  for (const f of held) expect(series(f, 2).operator, JSON.stringify(f)).toBe("Series");
});

// [n, k, order, nmin, nmax, den, coefficients]: Wolfram's SeriesData[q, 0, coefficients, nmin, nmax, den].
const wolfram: [string, string | undefined, number, number, number, number, string][] = [
  ["0", "3/2", 3, -1, 5, 2, "-1,2,-3,5,-9,15"],
  ["0", "3/2", 0, -1, 1, 2, "-1,2"],
  ["1/2", "2", 3, -1, 5, 2, "-1,2,-2,2,-3,4"],
  ["0", "5/2", 2, -4, 0, 2, "1,-2,3,-6"],
  ["-1/2", "1", 2, -1, 3, 2, "-1,1,-1,1"],
  ["0", "4/3", 2, -1, 5, 3, "-1,1,1,-3,2,3"],
  ["-1/3", "2", 2, -5, 1, 3, "1,-1,0,1,-2,1"],
  ["-3/2", undefined, 3, 1, 7, 2, "-1,-2,-1/2,0,-3/8,3/4"],
  ["-11/6", undefined, 2, 5, 17, 6, "-1,-1,-1,-1,-1,-2,5/6,-1/6,-1/6,-1/6,-7/6,5/3"],
];
const fraction = (s: string): [bigint, bigint] => {
  const [a, b = "1"] = s.split("/");
  return [BigInt(a!), BigInt(b)];
};

test("negative exponents: the Laurent–Puiseux series has Wolfram's terms and remainder", () => {
  for (const [n, k, order, nmin, nmax, den, coefficients] of wolfram) {
    const label = `n=${n} k=${k} o=${order}`;
    const result = qSeries(fraction(n), k === undefined ? undefined : fraction(k), order);
    if (result === undefined || result === "zero") throw new Error(`${label}: ${String(result)}`);
    const { unit, terms, bound } = result;
    const expected = coefficients
      .split(",")
      .map((c, i) => [i, fraction(c)] as const)
      .filter(([, [num]]) => num !== 0n);
    expect(terms.length, label).toBe(expected.length);
    terms.forEach(([exponent, [num, d]], i) => {
      const [m, [en, ed]] = expected[i]!;
      expect(exponent * BigInt(den), label).toBe(BigInt(nmin + m) * unit);
      expect(num * ed, label).toBe(en * d);
    });
    expect(bound * BigInt(den), label).toBe(BigInt(nmax) * unit);
  }
});

test("the Laurent series agrees with the infinite product", () => {
  // QBinomial(0, 3/2, q) = (q^(5/2);q)∞ (q^(-1/2);q)∞ / (q;q)∞².
  const pochhammer = (a: number, q: number) => {
    let product = 1;
    for (let j = 0; j < 4000; j++) product *= 1 - q ** (a + j);
    return product;
  };
  const q = 1e-4;
  const exact = (pochhammer(2.5, q) * pochhammer(-0.5, q)) / pochhammer(1, q) ** 2;
  const normal = ce.box(["Normal", ["Series", qbinomial(0, ["Rational", 3, 2]), "q", 0, 3]] as never).evaluate();
  expect(normal.subs({ q: ce.number(q) }).N().re / exact).toBeCloseTo(1, 6);
});

test("QFactorial at a non-integer n carries rational coefficients", () => {
  expect(series(["QFactorial", half, "q"], 2).json).toEqual([
    "Add",
    ["Multiply", ["Rational", -9, 8], power(2)],
    ["Multiply", ["Rational", -1, 2], "q"],
    ["Multiply", half, power(["Rational", 5, 2])],
    ["BigO", power(3)],
    power(["Rational", 3, 2]),
    1,
  ]);
});

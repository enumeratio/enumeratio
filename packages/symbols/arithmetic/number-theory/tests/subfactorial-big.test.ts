import { createEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareNumerals } from "@enumeratio/numerals";
import { declareNumberTheory } from "../src/declare.ts";

const ce = createEngine(declareNumerals, declareNumberTheory);
const digitsOf = (n: unknown, digits: number) => {
  const precision = ce.precision;
  try {
    return ce.box(["N", ["Subfactorial", n], digits] as never).evaluate();
  } finally {
    ce.precision = precision;
  }
};
const num = (part: unknown): string => (part as { num: string }).num;

// D_n = Γ(n+1, −1)/e at a real, non-integer n: the series Γ(a) − e^{iπa}Σ 1/(k!(a+k)) past a double's
// digits. Reference values: mpmath.gammainc(n + 1, -1, inf)/e at 80 digits.
const GOLDEN: [[number, number], string, string][] = [
  [
    [1, 3],
    "0.58167927999813154630823316823950969578696464488207",
    "0.43850412793578685003530615994275265411075001253862",
  ],
  [
    [-7, 3],
    "0.59077119384743799157321130359822030255487111233471",
    "0.91811015569196054037736314502659987600966593709871",
  ],
  [
    [2001, 1000],
    "1.0006048265528003474720649267015926632964028863251",
    "0.00082990638752074541208620696671231715158603630904",
  ],
];

test("Subfactorial of a non-integer real keeps 50 digits", () => {
  for (const [[n, d], re, im] of GOLDEN) {
    const value = digitsOf(["Rational", n, d], 50).json as unknown as unknown[];
    expect(value[0], `${n}/${d}`).toBe("Complex");
    // All but the last two digits: the reference rounds at 52.
    expect(num(value[1]).slice(0, 49), `re ${n}/${d}`).toBe(re.slice(0, 49));
    expect(num(value[2]).slice(0, 49), `im ${n}/${d}`).toBe(im.slice(0, 49));
  }
});

test("a float operand takes the same series past a double's digits", () => {
  const value = digitsOf(0.5, 60).json as unknown as unknown[];
  expect(num(value[1]).slice(0, 54)).toBe("0.3260246660866460915295793066235336245925203488097141".slice(0, 54));
  expect(num(value[2]).slice(0, 54)).toBe("0.4619204930872315808636125795924432452080249982460666".slice(0, 54));
});

test("an integer operand stays on the exact route", () => {
  expect(ce.box(["N", ["Subfactorial", 5], 50] as never).evaluate().re).toBe(44);
});

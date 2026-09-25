import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// Sinh/Cosh/Tanh at a purely imaginary argument, Ln(i), Arccot's special-value table, and
// the Arccsc(0)/Arcsec(0) poles -- all from elementary-special-values.ts. Exact symbolic
// identities throughout, not a golden file.

const ce = new ComputeEngine();
declareAnalytic(ce);

const evalJson = (expr: unknown) => ce.box(expr as never).evaluate().json;

test("hyperbolic functions at an imaginary argument rewrite through the circular ones", () => {
  expect(evalJson(["Sinh", ["Multiply", "ImaginaryUnit", ["Divide", "Pi", 2]]])).toEqual([
    "Complex",
    0,
    1,
  ]);
  expect(evalJson(["Cosh", ["Multiply", "ImaginaryUnit", "Pi"]])).toEqual(-1);
  expect(evalJson(["Tanh", ["Multiply", "ImaginaryUnit", ["Divide", "Pi", 4]]])).toEqual([
    "Complex",
    0,
    1,
  ]);
  // A real argument is untouched.
  expect(evalJson(["Sinh", "x"])).toEqual(["Sinh", "x"]);
});

test("N() decimalizes the imaginary-argument rewrites, not just evaluate()", () => {
  // Regression for #107's bug: a wrapper that hands back an exact symbolic expression
  // (i*Sin(pi/2) here) without checking `options.numericApproximation` leaves N() with
  // the exact form instead of a decimal.
  const n = ce.box(["N", ["Sinh", ["Multiply", "ImaginaryUnit", ["Divide", "Pi", 2]]]]).evaluate();
  expect(n.im).toBeCloseTo(1, 9);
  expect(n.re).toBeCloseTo(0, 9);
});

test("Ln(i) = i*pi/2", () => {
  expect(evalJson(["Ln", "ImaginaryUnit"])).toEqual([
    "Multiply",
    ["Complex", 0, ["Rational", 1, 2]],
    "Pi",
  ]);
  // Unrelated arguments are untouched.
  expect(evalJson(["Ln", 1])).toEqual(0);
  // N() must decimalize, not hand back the exact 1/2*i*Pi (issue #107's bug).
  const n = ce.box(["N", ["Ln", "ImaginaryUnit"]]).evaluate();
  expect(n.im).toBeCloseTo(Math.PI / 2, 9);
  expect(n.re).toBeCloseTo(0, 9);
});

test("Arccot's special-value table follows compute-engine's own (0, pi) range", () => {
  // Arccot(x) = pi/2 - Arctan(x) -- the same formula our N(Arccot(x)) already uses, and
  // what the Wolfram mapping (PR #88) assumes when it emits Pi/2 - ArcTan[x] for ArcCot.
  expect(evalJson(["Arccot", 1])).toEqual(["Multiply", ["Rational", 1, 4], "Pi"]);
  expect(evalJson(["Arccot", 0])).toEqual(["Multiply", ["Rational", 1, 2], "Pi"]);
  expect(evalJson(["Arccot", ["Sqrt", 3]])).toEqual(["Multiply", ["Rational", 1, 6], "Pi"]);
  // Negative arguments land past pi/2, not mirrored through 0 -- Wolfram's own ArcCot
  // convention (ArcTan(1/x), range (-pi/2, pi/2]) would give -pi/4 and -5pi/6 here.
  expect(evalJson(["Arccot", -1])).toEqual(["Multiply", ["Rational", 3, 4], "Pi"]);
  expect(evalJson(["Arccot", ["Negate", ["Sqrt", 3]]])).toEqual([
    "Multiply",
    ["Rational", 5, 6],
    "Pi",
  ]);
  // PositiveInfinity is native's own case -- untouched.
  expect(evalJson(["Arccot", "PositiveInfinity"])).toEqual(0);
  // A generic rational with no exact Arctan fold stays symbolic, same as native.
  expect(evalJson(["Arccot", 2])).toEqual(["Arccot", 2]);
  // A float argument is native's own case -- untouched.
  expect(ce.box(["Arccot", 0.5]).evaluate().re).toBeCloseTo(1.1071487177940904, 9);
});

test("Arccot's exact table and N() agree at every point", () => {
  for (const x of [1, 0, ["Sqrt", 3], -1, ["Negate", ["Sqrt", 3]]] as const) {
    const exact = ce.box(["Arccot", x] as never).evaluate();
    const numeric = ce.box(["N", ["Arccot", x]] as never).evaluate();
    expect(exact.N().re, JSON.stringify(x)).toBeCloseTo(numeric.re, 9);
  }
});

test("Arccsc(0) and Arcsec(0) are ComplexInfinity", () => {
  expect(evalJson(["Arccsc", 0])).toEqual("ComplexInfinity");
  expect(evalJson(["Arcsec", 0])).toEqual("ComplexInfinity");
  // Elsewhere, both are untouched.
  expect(evalJson(["Arccsc", 2])).toEqual(["Multiply", ["Rational", 1, 6], "Pi"]);
});

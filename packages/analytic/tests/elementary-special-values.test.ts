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

test("Ln(i) = i*pi/2", () => {
  expect(evalJson(["Ln", "ImaginaryUnit"])).toEqual([
    "Multiply",
    ["Complex", 0, ["Rational", 1, 2]],
    "Pi",
  ]);
  // Unrelated arguments are untouched.
  expect(evalJson(["Ln", 1])).toEqual(0);
});

test("Arccot's special-value table follows Wolfram's Arctan(1/x) convention", () => {
  expect(evalJson(["Arccot", 1])).toEqual(["Multiply", ["Rational", 1, 4], "Pi"]);
  expect(evalJson(["Arccot", 0])).toEqual(["Multiply", ["Rational", 1, 2], "Pi"]);
  expect(evalJson(["Arccot", ["Sqrt", 3]])).toEqual(["Multiply", ["Rational", 1, 6], "Pi"]);
  expect(evalJson(["Arccot", -1])).toEqual(["Multiply", ["Rational", -1, 4], "Pi"]);
  // PositiveInfinity is native's own case -- untouched.
  expect(evalJson(["Arccot", "PositiveInfinity"])).toEqual(0);
  // A generic rational with no exact Arctan fold stays symbolic, same as native.
  expect(evalJson(["Arccot", 2])).toEqual(["Arccot", 2]);
  // A float argument is native's own case -- untouched.
  expect(ce.box(["Arccot", 0.5]).evaluate().re).toBeCloseTo(1.1071487177940904, 9);
});

test("Arccsc(0) and Arcsec(0) are ComplexInfinity", () => {
  expect(evalJson(["Arccsc", 0])).toEqual("ComplexInfinity");
  expect(evalJson(["Arcsec", 0])).toEqual("ComplexInfinity");
  // Elsewhere, both are untouched.
  expect(evalJson(["Arccsc", 2])).toEqual(["Multiply", ["Rational", 1, 6], "Pi"]);
});

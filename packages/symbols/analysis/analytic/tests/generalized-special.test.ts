import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// Issue #113: the incomplete gamma/beta closed forms and the Hurwitz-zeta, Lerch, and
// generalized-arity (one-argument PolyGamma, Nielsen PolyLog) identities. Every value here
// was checked against `wolframscript` before being pinned (see the reference entries this
// closes in packages/reference/src/entries/special-functions.ts for the identities
// themselves).

const ce = new ComputeEngine();
declareAnalytic(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const evalJson = (expr: Expr): unknown => ce.box(expr as never).evaluate().json;
const numAt = (expr: Expr): number => ce.box(expr as never).N().re;

test("Gamma(2, z) = (1+z)e^-z, and Gamma(1/2, z) = sqrt(pi)*Erfc(sqrt(z))", () => {
  expect(evalJson(["Gamma", 2, "x"])).toEqual([
    "Multiply",
    ["Add", "x", 1],
    ["Power", "ExponentialE", ["Negate", "x"]],
  ]);
  expect(evalJson(["Gamma", 2, 1])).toEqual(["Divide", 2, "ExponentialE"]);
  expect(evalJson(["Gamma", ["Rational", 1, 2], "x"])).toEqual(["Multiply", ["Erfc", ["Sqrt", "x"]], ["Sqrt", "Pi"]]);
  // The three-argument difference now reduces too, through the same closed form.
  expect(evalJson(["Gamma", 2, 0, "z"])).toEqual([
    "Add",
    ["Negate", ["Multiply", ["Add", "z", 1], ["Power", "ExponentialE", ["Negate", "z"]]]],
    1,
  ]);
});

test("Beta: B(a,1) = 1/a, and the incomplete/generalized-incomplete arities", () => {
  expect(evalJson(["Beta", "a", 1])).toEqual(["Divide", 1, "a"]);
  expect(evalJson(["Beta", ["Rational", 1, 2], 2, 3])).toEqual(["Rational", 11, 192]);
  expect(evalJson(["Beta", ["Rational", 1, 4], ["Rational", 1, 2], 2, 3])).toEqual(["Rational", 109, 3072]);
  // The four-argument generalized form, at floats: B_{0.5}(2,3) - B_{0.2}(2,3).
  expect(numAt(["Beta", 0.2, 0.5, 2, 3])).toBeCloseTo(0.04222500000000001, 12);
  // Still threads over a list, unaffected by the widened arity.
  expect(evalJson(["Beta", ["List", 1, 2], 2])).toEqual(["List", ["Rational", 1, 2], ["Rational", 1, 6]]);
});

test("HurwitzZeta(s, 1/2) = (2^s - 1) Zeta(s)", () => {
  expect(evalJson(["HurwitzZeta", "s", ["Rational", 1, 2]])).toEqual([
    "Multiply",
    ["Add", ["Power", 2, "s"], -1],
    ["Zeta", "s"],
  ]);
  // s = 2 instance: pi^2/2.
  expect(evalJson(["HurwitzZeta", 2, ["Rational", 1, 2]])).toEqual([
    "Multiply",
    ["Rational", 1, 2],
    ["Power", "Pi", 2],
  ]);
  // Untouched: a = 1/4 is a different identity, not this one.
  expect(evalJson(["HurwitzZeta", 2, ["Rational", 1, 4]])).not.toEqual([
    "Add",
    ["Power", "Pi", 2],
    ["Multiply", 8, "Catalan"],
  ]);
});

test("LerchPhi(z, s, 1) = PolyLog(s, z) / z", () => {
  expect(evalJson(["LerchPhi", "z", "s", 1])).toEqual(["Divide", ["PolyLog", "s", "z"], "z"]);
  expect(evalJson(["LerchPhi", "z", 1, 1])).toEqual(["Divide", ["Negate", ["Ln", ["Add", ["Negate", "z"], 1]]], "z"]);
  expect(evalJson(["LerchPhi", -1, 1, 1])).toEqual(["Ln", 2]);
});

test("PolyGamma(z): the one-argument digamma", () => {
  expect(evalJson(["PolyGamma", 5])).toEqual(["Add", ["Rational", 25, 12], ["Negate", "EulerGamma"]]);
  expect(numAt(["PolyGamma", 100.5])).toBeCloseTo(4.605174352581845, 12);
  const c = ce.box(["PolyGamma", ["Complex", 2.5, 3]]).evaluate();
  expect(c.re).toBeCloseTo(1.2812739190662314, 9);
  expect(c.im).toBeCloseTo(0.9798053153445596, 9);
  // PolyGamma(3, 5): now closed (special-functions-remaining.ts) via
  // psi^(m)(n) = (-1)^(m+1) m! (zeta(m+1) - sum_{k<n} k^-(m+1)) at integer order/argument.
  expect(evalJson(["PolyGamma", 3, 5])).toEqual([
    "Multiply",
    ["Rational", 1, 17280],
    ["Add", -111845, ["Multiply", 1152, ["Power", "Pi", 4]]],
  ]);
});

test("PolyLog(n, p, z): the Nielsen generalized polylogarithm", () => {
  expect(evalJson(["PolyLog", 1, 2, 1])).toEqual(["Zeta", 3]);
  expect(evalJson(["PolyLog", 2, 2, 1])).toEqual(["Multiply", ["Rational", 1, 360], ["Power", "Pi", 4]]);
  expect(numAt(["PolyLog", 1, 2, 0.5])).toBeCloseTo(0.09475300423012771, 12);
  // S_{n,1}(z) = Li_{n+1}(z), the general p = 1 identity, at a non-special z.
  expect(evalJson(["PolyLog", 3, 1, ["Rational", 1, 2]])).toEqual(evalJson(["PolyLog", 4, ["Rational", 1, 2]]));
});

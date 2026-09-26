import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// Issue #113: the Hurwitz-zeta, Lerch, and Nielsen-polylogarithm identities. Every value
// here was checked against `wolframscript` before being pinned (see the reference entries
// this closes in packages/reference/src/entries/special-functions.ts for the identities
// themselves).

const ce = new ComputeEngine();
declareAnalytic(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const evalJson = (expr: Expr): unknown => ce.box(expr as never).evaluate().json;
const numAt = (expr: Expr): number => ce.box(expr as never).N().re;

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

test("PolyLog(n, p, z): the Nielsen generalized polylogarithm", () => {
  expect(evalJson(["PolyLog", 1, 2, 1])).toEqual(["Zeta", 3]);
  expect(evalJson(["PolyLog", 2, 2, 1])).toEqual(["Multiply", ["Rational", 1, 360], ["Power", "Pi", 4]]);
  expect(numAt(["PolyLog", 1, 2, 0.5])).toBeCloseTo(0.09475300423012771, 12);
  // S_{n,1}(z) = Li_{n+1}(z), the general p = 1 identity, at a non-special z.
  expect(evalJson(["PolyLog", 3, 1, ["Rational", 1, 2]])).toEqual(evalJson(["PolyLog", 4, ["Rational", 1, 2]]));
});

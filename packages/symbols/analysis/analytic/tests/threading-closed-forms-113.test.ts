import { ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// #113: threading gaps (§1) and exact closed forms (§3) for HurwitzZeta, Gamma, PolyLog,
// PolyGamma, and LogGamma, plus FromContinuedFraction and Binomial's threading. Every
// non-obvious identity here was checked against `wolframscript` before being wired up (see
// threading-113.ts and closed-forms-113.ts for the derivations); `toEqual` pins the exact
// symbolic form, since these are meant to reduce, not just evaluate numerically close.

const ce = new ComputeEngine();
declareAnalytic(ce);

const evalOf = (expr: unknown) => ce.box(expr as never).evaluate().json;

test("threading: HurwitzZeta over a list of orders, including a float a", () => {
  const r = ce.box(["HurwitzZeta", ["List", 2, 3, 4], 0.5]).N();
  const want = [4.934802200544679, 8.41439832211716, 16.234848505667074];
  operandsOf(r).forEach((el, i) => expect(el.re).toBeCloseTo(want[i], 9));
});

test("threading: Gamma threads over a matrix, and every entry reduces", () => {
  expect(evalOf(["Gamma", 2, ["List", ["List", ["Rational", 7, 2], 0], ["List", 0, ["Rational", 13, 2]]]])).toEqual([
    "List",
    ["List", ["Divide", 9, ["Multiply", 2, ["Power", "ExponentialE", ["Rational", 7, 2]]]], 1],
    ["List", 1, ["Divide", 15, ["Multiply", 2, ["Power", "ExponentialE", ["Rational", 13, 2]]]]],
  ]);
});

test("closed form: HurwitzZeta(2, 1/2) = π²/2 and HurwitzZeta(2, 1/4) = π² + 8G", () => {
  expect(evalOf(["HurwitzZeta", 2, ["Rational", 1, 2]])).toEqual(["Multiply", ["Rational", 1, 2], ["Power", "Pi", 2]]);
  expect(evalOf(["HurwitzZeta", 2, ["Rational", 1, 4]])).toEqual([
    "Add",
    ["Multiply", 8, "Catalan"],
    ["Power", "Pi", 2],
  ]);
  // symbolic s reduces through ζ(s, 1/2) = (2^s − 1)ζ(s) (generalized-special.ts)
  expect(JSON.stringify(evalOf(["HurwitzZeta", "s", ["Rational", 1, 2]]))).toMatch(/^\["Multiply"/);
});

test("closed form: Li3(1/2) and Li2(2)", () => {
  const li3 = ce
    .box(["PolyLog", 3, ["Rational", 1, 2]])
    .evaluate()
    .N().re;
  expect(li3).toBeCloseTo(0.5372131936080402, 12);
  const li2 = ce.box(["PolyLog", 2, 2]).evaluate().N();
  expect(li2.re).toBeCloseTo(Math.PI ** 2 / 4, 12);
  expect(li2.im).toBeCloseTo(-Math.PI * Math.log(2), 12);
});

test("closed form: trigamma at 1/4 is π² + 8G", () => {
  const g = 0.915965594177219015; // Catalan's constant, double precision
  expect(
    ce
      .box(["PolyGamma", 1, ["Rational", 1, 4]])
      .evaluate()
      .N().re,
  ).toBeCloseTo(Math.PI ** 2 + 8 * g, 9);
});

test("closed form: LogGamma at exact half-integers, positive and negative", () => {
  expect(evalOf(["LogGamma", ["Rational", 3, 2]])).toEqual(["Ln", ["Multiply", ["Rational", 1, 2], ["Sqrt", "Pi"]]]);
  expect(evalOf(["LogGamma", ["Rational", -3, 2]])).toEqual([
    "Add",
    ["Multiply", ["Complex", 0, -2], "Pi"],
    ["Ln", ["Multiply", ["Rational", 4, 3], ["Sqrt", "Pi"]]],
  ]);
});

test("closed form: FromContinuedFraction of plain symbols builds the nested fraction", () => {
  expect(evalOf(["FromContinuedFraction", ["List", "a", "b", "c"]])).toEqual([
    "Add",
    "a",
    ["Divide", 1, ["Add", "b", ["Divide", 1, "c"]]],
  ]);
  // a periodic tail (nested List) is a different, unrelated item and must stay untouched
  expect(evalOf(["FromContinuedFraction", ["List", 1, ["List", 2]]])).toEqual([
    "FromContinuedFraction",
    ["List", 1, ["List", 2]],
  ]);
});

// Lane B-35 regression: notatio's editor flagged `Binomial([2,3,5,7,11], 3)` as a type
// error (the native signature rejects a list first argument). The `threadOverLists(ce,
// ["Binomial", ...])` call above already covers it — this pins that boxing produces no
// `Error` node (what notatio's type check marks red) and that it evaluates correctly.
test("Binomial threads over a list first argument without a type error", () => {
  const boxed = ce.box(["Binomial", ["List", 2, 3, 5, 7, 11], 3]);
  expect(JSON.stringify(boxed.json)).not.toContain("Error");
  expect(boxed.evaluate().json).toEqual(["List", 0, 1, 10, 35, 165]);
});

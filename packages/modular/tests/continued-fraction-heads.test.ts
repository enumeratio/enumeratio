import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareModular } from "../src/declare.ts";

const ce = new ComputeEngine();
declareModular(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const value = (input: Expr) => ce.box(input).evaluate().json;
const same = (input: Expr, expected: Expr) => expect(value(input)).toEqual(value(expected));
const L = (...xs: Expr[]): Expr => ["List", ...xs];

// OEIS A001203: the regular continued fraction of π.
const PI_20 = [3, 7, 15, 1, 292, 1, 1, 1, 2, 1, 3, 1, 14, 2, 1, 1, 2, 2, 2, 2];
// OEIS A002945: the regular continued fraction of 2^(1/3).
const CBRT2_10 = [1, 3, 1, 5, 1, 1, 4, 1, 1, 8];

test("ContinuedFraction: quadratic irrationals, the nested [a0, [period]] shape", () => {
  same(["ContinuedFraction", ["Sqrt", 13]], L(3, L(1, 1, 1, 1, 6)));
  same(["ContinuedFraction", ["Divide", ["Add", 1, ["Sqrt", 5]], 2]], L(1, L(1)));
  same(["ContinuedFraction", ["Sqrt", 2]], L(1, L(2)));
});

test("ContinuedFraction: still exact and flat for the two-arg truncated form", () => {
  same(
    ["ContinuedFraction", ["Sqrt", 13], 20],
    L(3, 1, 1, 1, 1, 6, 1, 1, 1, 1, 6, 1, 1, 1, 1, 6, 1, 1, 1, 1),
  );
  same(["ContinuedFraction", ["Add", 1, ["Sqrt", 2]], 5], L(2, 2, 2, 2, 2));
});

test("ContinuedFraction: GoldenRatio, unfolded to its closed form first", () => {
  same(["ContinuedFraction", "GoldenRatio", 10], L(1, 1, 1, 1, 1, 1, 1, 1, 1, 1));
  // Past the 13-term double-precision wall the old native path hit.
  same(["ContinuedFraction", "GoldenRatio", 25], L(...Array<number>(25).fill(1)));
});

test("ContinuedFraction: Pi to 20 certified terms, OEIS A001203", () => {
  same(["ContinuedFraction", "Pi", 20], L(...PI_20));
});

test("ContinuedFraction: a cube root — algebraic degree 3, not periodic, still certified", () => {
  same(["ContinuedFraction", ["Power", 2, ["Rational", 1, 3]], 10], L(...CBRT2_10));
});

test("ContinuedFraction: E and EulerGamma keep working (regression against the native path)", () => {
  same(["ContinuedFraction", "ExponentialE", 10], L(2, 1, 2, 1, 1, 4, 1, 1, 6, 1));
  same(["ContinuedFraction", "EulerGamma", 10], L(0, 1, 1, 2, 1, 2, 1, 4, 3, 13));
});

test("ContinuedFraction: rationals and floats still go through the native, unwrapped path", () => {
  same(["ContinuedFraction", ["Rational", 355, 113]], L(3, 7, 16));
  same(["ContinuedFraction", ["Rational", 47, 17]], L(2, 1, 3, 4));
  same(["ContinuedFraction", 3.245], L(3, 4, 12, 4));
  same(["ContinuedFraction", ["Rational", -47, 17]], L(-3, 4, 4));
});

test("FromContinuedFraction: a periodic tail rebuilds the quadratic irrational", () => {
  same(["FromContinuedFraction", L(3, L(1, 1, 1, 1, 6))], ["Sqrt", 13]);
  same(["FromContinuedFraction", L(1, L(2))], ["Sqrt", 2]);
});

test("FromContinuedFraction: a plain finite list still inverts ContinuedFraction", () => {
  same(
    ["FromContinuedFraction", ["ContinuedFraction", ["Rational", 47, 17]]],
    ["Rational", 47, 17],
  );
});

test("FromContinuedFraction: a multi-term pre-period folds too (not just a bare a0)", () => {
  // 2 - sqrt(3): a negative radical coefficient produces more than one leading term
  // before the period locks in — exercises the general fold, not just the `a0 + 1/y` case.
  const cf = ce.box(["ContinuedFraction", ["Subtract", 2, ["Sqrt", 3]]]).evaluate();
  const back = ce.box(["FromContinuedFraction", cf]).evaluate();
  expect(back.N().re).toBeCloseTo(2 - Math.sqrt(3), 9);
});

test("round trip: ContinuedFraction then FromContinuedFraction recovers the quadratic irrational", () => {
  const cases: Expr[] = [
    ["Sqrt", 2],
    ["Sqrt", 13],
    ["Divide", ["Add", 1, ["Sqrt", 5]], 2],
    ["Divide", ["Add", 3, ["Sqrt", 7]], 2],
    ["Subtract", 1, ["Sqrt", 3]],
  ];
  for (const x of cases) {
    const cf = ce.box(["ContinuedFraction", x]).evaluate();
    const back = ce.box(["FromContinuedFraction", cf]).evaluate();
    // Compare numerically — compute-engine doesn't always hand back the same syntactic
    // shape it was given (e.g. `1 - Sqrt(3)` round-trips to an algebraically equal but
    // differently-written value), so the exact check is on the value, not the JSON.
    expect(back.N().re).toBeCloseTo(ce.box(x).N().re!, 9);
  }
});

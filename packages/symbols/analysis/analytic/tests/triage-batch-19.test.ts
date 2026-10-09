// unstable: a bare engine to declare the analytic library against
import { ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// Transform pairs, a series coefficient, equal-argument Carlson values and bignum Bessel functions.
// Each pair is pinned against a mpmath quadrature of its defining integral and the oscillatory
// ones against wolframscript, so the test fixes the value and not how it is spelled.

const ce = new ComputeEngine();
declareAnalytic(ce);

const at = (mj: unknown, point: Record<string, number>): number =>
  ce
    .box(mj as never)
    .evaluate()
    .subs(point as never)
    .N().re;
const closeTo = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 10);
const json = (mj: unknown) => ce.box(mj as never).evaluate().json;
/** The value's digits, cut to the length of `expected`. */
const startsWith = (mj: unknown, expected: string) =>
  String((ce.box(mj as never).evaluate().json as { num: string }).num).slice(0, expected.length);

const L = (f: unknown) => ["LaplaceTransform", f, "t", "s"];
const IL = (F: unknown) => ["InverseLaplaceTransform", F, "s", "t"];
const sqrt = (x: unknown) => ["Sqrt", x];

test("InverseLaplace: s^(-ν/2) K_ν(b√s) is 2^(ν-1) b^(-ν) t^(ν-1) e^(-b²/4t)", () => {
  closeTo(at(IL(["Multiply", ["BesselK", 4, sqrt("s")], ["Power", "s", -2]]), { t: 0.9 }), 4.417536628811108);
  closeTo(at(IL(["BesselK", 0, ["Multiply", 2, sqrt("s")]]), { t: 0.7 }), Math.exp(-1 / 0.7) / 1.4);
  // negative ν: s^(3/2) K_3(√s) inverts to t^-4 e^(-1/4t)/16
  closeTo(
    at(IL(["Multiply", ["BesselK", 3, sqrt("s")], ["Power", "s", ["Rational", 3, 2]]]), { t: 1.3 }),
    Math.exp(-1 / 5.2) / (16 * 1.3 ** 4),
  );
});

test("InverseLaplace: a Bessel K whose order does not match the power of s, or a non-positive scale, declines", () => {
  const held = (F: unknown) => expect(ce.box(IL(F) as never).evaluate().operator).toBe("InverseLaplaceTransform");
  held(["Multiply", ["BesselK", 4, sqrt("s")], ["Power", "s", -1]]);
  held(["Multiply", ["BesselK", 4, ["Negate", sqrt("s")]], ["Power", "s", -2]]);
});

test("Laplace: Fresnel integrals of c√t", () => {
  closeTo(at(L(["FresnelS", ["Multiply", 2, sqrt("t")]]), { s: 1.5 }), 0.28805988011691275);
  closeTo(at(L(["FresnelC", ["Multiply", 2, sqrt("t")]]), { s: 1.5 }), 0.3649240916320307);
  expect(ce.box(L(["FresnelC", "t"]) as never).evaluate().operator).toBe("LaplaceTransform");
});

test("Laplace: cos(c√t)/√t and sin(c√t)", () => {
  closeTo(
    at(L(["Divide", ["Cos", ["Multiply", ["Rational", 5, 2], sqrt("t")]], sqrt("t")]), { s: 1.3 }),
    0.4673203574537034,
  );
  closeTo(at(L(["Sin", ["Multiply", ["Rational", 5, 2], sqrt("t")]]), { s: 1.3 }), 0.4493464975516379);
});

test("Laplace: a function of x·y is transformed one variable at a time", () => {
  const f = ["Multiply", ["Divide", 1, sqrt(["Multiply", "x", "y"])], ["Cos", sqrt(["Multiply", "x", "y"])]];
  const value = ce.box(["LaplaceTransform", f, ["List", "x", "y"], ["List", "p", "q"]] as never).evaluate();
  closeTo(value.subs({ p: 0.9, q: 1.1 } as never).N().re, (2 * Math.PI) / Math.sqrt(1 + 4 * 0.9 * 1.1));
});

test("InverseMellin: erfc and the duplicated Beta pair", () => {
  const IM = (F: unknown) => ["InverseMellinTransform", F, "s", "x"];
  const erfc = ["Divide", ["Gamma", ["Multiply", ["Rational", 1, 2], "s"]], ["Add", ["Negate", "s"], 1]];
  closeTo(at(IM(erfc), { x: 0.7 }), -0.8158321639143251);
  const dup = [
    "Divide",
    ["Multiply", ["Gamma", ["Multiply", ["Rational", 1, 2], "s"]], ["Gamma", ["Add", ["Negate", "s"], 1]]],
    ["Gamma", ["Add", ["Multiply", ["Rational", -1, 2], "s"], 1]],
  ];
  closeTo(at(IM(dup), { x: 0.7 }), 2 / Math.sqrt(1 + 4 * 0.49));
  // a denominator with another root is not the erfc pair
  const other = ["Divide", ["Gamma", ["Multiply", ["Rational", 1, 2], "s"]], ["Add", "s", 2]];
  expect(ce.box(IM(other) as never).evaluate().operator).toBe("InverseMellinTransform");
});

test("SeriesCoefficient: a Bessel function at a symbolic index is a Piecewise", () => {
  const f = ["Multiply", ["BesselI", 3, ["Multiply", 2, "x"]], ["Power", "x", -7]];
  expect(ce.box(["SeriesCoefficient", f, ["List", "x", 0, "n"]] as never).evaluate().operator).toBe("Piecewise");
  expect(json(["SeriesCoefficient", f, ["List", "x", 0, -4]])).toEqual(["Rational", 1, 6]);
  expect(json(["SeriesCoefficient", f, ["List", "x", 0, -2]])).toEqual(["Rational", 1, 24]);
  expect(json(["SeriesCoefficient", f, ["List", "x", 0, -3]])).toBe(0);
  // J_1(a x) = a x/2 - (a x)^3/16 + ...
  expect(json(["SeriesCoefficient", ["BesselJ", 1, ["Multiply", "a", "x"]], ["List", "x", 0, 3]])).toEqual([
    "Multiply",
    ["Rational", -1, 16],
    ["Power", "a", 3],
  ]);
});

test("Carlson: equal positive constant arguments are a power", () => {
  expect(json(["ReplaceAll", ["CarlsonRJ", "x", "x", "x", "x"], ["Rule", "x", "EulerGamma"]])).toEqual([
    "Power",
    "EulerGamma",
    ["Rational", -3, 2],
  ]);
  expect(json(["CarlsonRG", 3, 3, 3])).toEqual(["Sqrt", 3]);
  // a bare symbol stays, as in Wolfram
  expect(ce.box(["CarlsonRF", "x", "x", "x"] as never).evaluate().operator).toBe("CarlsonRF");
});

test("BesselI and BesselJ keep their digits past a double", () => {
  expect(startsWith(["N", ["BesselI", 1, 1], 40], "0.56515910399248502720769602760986")).toBe(
    "0.56515910399248502720769602760986",
  );
  expect(startsWith(["N", ["BesselJ", ["Negate", 3], 2], 25], "-0.1289432494744020510987933")).toBe(
    "-0.1289432494744020510987933",
  );
  expect(startsWith(["N", ["BesselJ", 1, 300], 25], "-0.03188743137749995031400127")).toBe(
    "-0.03188743137749995031400127",
  );
  expect(startsWith(["N", ["BesselI", 0, 20], 25], "43558282.55955353327210666")).toBe("43558282.55955353327210666");
  // a double stays a double
  expect(ce.box(["N", ["BesselI", 1, 1]] as never).evaluate().re).toBeCloseTo(0.565159103992485, 14);
});

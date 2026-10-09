// unstable: a bare engine to declare the analytic library against
import { ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// ComplexExpand of Ln, higher UnitBox derivatives, numeric QBinomial, Solve through CubeRoot and
// InverseErfc, more PiecewiseExpand heads, and the Bessel closed forms of regularized
// hypergeometrics. Values are pinned against mpmath and wolframscript.

const ce = new ComputeEngine();
declareAnalytic(ce);

const run = (mj: unknown) => ce.box(mj as never).evaluate();
const json = (mj: unknown) => run(mj).json;
const raw = (mj: unknown) => json(mj) as unknown as unknown[];
const number = (mj: unknown, point: Record<string, number> = {}) =>
  ce
    .box(mj as never)
    .evaluate()
    .subs(point as never)
    .N().re;
const closeTo = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 10);
const digits = (mj: unknown, expected: string) =>
  String((run(["N", mj, 40]).json as { num: string }).num).slice(0, expected.length);

test("ComplexExpand: the real and imaginary parts of Ln", () => {
  const z = ["Add", "x", ["Multiply", ["Complex", 0, 1], "y"]];
  const at = { x: 0.7, y: -1.3 };
  closeTo(number(["ComplexExpand", ["Real", ["Ln", z]]], at), Math.log(Math.hypot(0.7, -1.3)));
  closeTo(number(["ComplexExpand", ["Imaginary", ["Ln", z]]], at), Math.atan2(-1.3, 0.7));
  // a real argument keeps its Ln
  expect(json(["ComplexExpand", ["Ln", "x"]])).toEqual(["Ln", "x"]);
});

test("ComplexExpand: Re ln sin e^(2z) is half the log of |sin|²", () => {
  const z = ["Add", "x", ["Multiply", ["Complex", 0, 1], "y"]];
  const at = { x: 0.3, y: 0.2 };
  const w = [Math.exp(0.6) * Math.cos(0.4), Math.exp(0.6) * Math.sin(0.4)] as const; // e^(2z)
  const modulus = Math.hypot(Math.sin(w[0]) * Math.cosh(w[1]), Math.cos(w[0]) * Math.sinh(w[1]));
  closeTo(
    number(["ComplexExpand", ["Real", ["Ln", ["Sin", ["Power", "ExponentialE", ["Multiply", 2, z]]]]]], at),
    Math.log(modulus),
  );
});

test("UnitBox: every derivative order past the first is the same function", () => {
  const nth = (n: number) => json(["Apply", ["Derivative", "UnitBox", n], "x"]);
  expect(nth(1)).toEqual(nth(2));
  expect(nth(1)).toEqual(nth(7));
  expect(nth(3)).toEqual(json(["D", ["UnitBox", "x"], "x"]));
  expect(json(["Apply", ["Derivative", "UnitBox", 2], ["Rational", 1, 3]])).toBe(0);
});

test("QBinomial: N at a non-integer n", () => {
  // q = 1 is Binomial(n, k); the digits are wolframscript's
  expect(digits(["QBinomial", ["Rational", 15, 17], 5, 1], "0.00638303716501027920417337802327980916")).toBe(
    "0.00638303716501027920417337802327980916",
  );
  // an integer k at another q is the finite product
  closeTo(number(["N", ["QBinomial", ["Rational", 15, 17], 5, 2]]) * 1e6, 2.482994193468756);
  // a complex k at a real q > 1: the q-Gamma ratio, as wolframscript
  const value = run(["N", ["QBinomial", ["Rational", 23, 47], ["Complex", 5, -1], 2]]);
  closeTo(value.re * 1e5, -7.180162183878611);
  closeTo(value.im * 1e5, -6.572425975527427);
  // symbolic and at a root of unity it stays held
  expect(raw(["QBinomial", ["Rational", 15, 17], 5, 1])[0]).toBe("QBinomial");
  expect(run(["N", ["QBinomial", ["Rational", 15, 17], 3, -1]]).operator).toBe("QBinomial");
});

test("Solve: through CubeRoot and InverseErfc", () => {
  expect(json(["Solve", ["Equal", ["CubeRoot", "x"], ["Rational", 3, 2]], "x"])).toEqual(["List", ["Rational", 27, 8]]);
  expect(json(["Solve", ["Equal", ["CubeRoot", "x"], -2], "x"])).toEqual(["List", -8]);
  // y^2 + y = 1 for y = InverseErfc(x): x = Erfc(y), the smaller root first
  const roots = run(["Solve", ["Equal", ["Add", ["Power", ["InverseErfc", "x"], 2], ["InverseErfc", "x"]], 1], "x"]);
  expect(roots.operator).toBe("List");
  expect(roots.json).toEqual([
    "List",
    ["Erfc", ["Add", ["Rational", -1, 2], ["Negate", ["Divide", ["Sqrt", 5], 2]]]],
    ["Erfc", ["Add", ["Rational", -1, 2], ["Divide", ["Sqrt", 5], 2]]],
  ]);
  // complex roots of the substituted equation decline
  const complex = ["Solve", ["Equal", ["Add", ["Power", ["InverseErfc", "x"], 2], 1], 0], "x"];
  expect(run(complex).operator).toBe("Solve");
});

test("PiecewiseExpand: If, Boole and the deltas are conditional values", () => {
  expect(json(["PiecewiseExpand", ["If", "a", "b", "c"]])).toEqual(["Piecewise", ["List", ["List", "b", "a"]], "c"]);
  expect(json(["PiecewiseExpand", ["Boole", "a"]])).toEqual(["Piecewise", ["List", ["List", 1, "a"]], 0]);
  const kronecker = raw(["PiecewiseExpand", ["KroneckerDelta", "x", "y"]]);
  expect(kronecker[0]).toBe("Piecewise");
  const discrete = raw(["PiecewiseExpand", ["DiscreteDelta", "x", "y"]]) as unknown[][];
  expect(discrete[1]![1]).toEqual(["List", 1, ["And", ["Equal", "x", 0], ["Equal", "y", 0]]]);
  // composed through a sum: 1 off the open interval, 2 inside it
  const sum = ["PiecewiseExpand", ["Add", ["Boole", ["Greater", "x", 1]], ["Boole", ["Less", "x", 5]]]];
  expect([0, 3, 6].map((x) => number(sum, { x }))).toEqual([1, 2, 1]);
});

test("PiecewiseExpand: PrimePi on a bounded interval is the prime-counting staircase", () => {
  const expand = ["PiecewiseExpand", ["PrimePi", "x"], ["Less", 0, "x", 20]];
  const counts = [0.5, 2, 2.9, 3, 4.99, 5, 11, 12.5, 19, 19.5].map((x) => number(expand, { x }));
  expect(counts).toEqual([0, 1, 1, 2, 2, 3, 5, 5, 8, 8]);
  // unbounded, it stays
  expect(json(["PiecewiseExpand", ["PrimePi", "x"]])).toEqual(["PrimePi", "x"]);
});

test("PiecewiseExpand: the real cube root, and a floor of it", () => {
  const root = ["PiecewiseExpand", ["CubeRoot", "x"]];
  expect([-8, -1, 0, 27].map((x) => number(root, { x }))).toEqual([-2, -1, 0, 3]);
  expect(json(["PiecewiseExpand", ["CubeRoot", "x"], ["Greater", "x", 0]])).toEqual(["Root", "x", 3]);
  const floor = ["PiecewiseExpand", ["Floor", ["CubeRoot", "x"]], ["Less", 0, "x", 10]];
  expect([0.5, 1, 7.9, 8, 9.9].map((x) => number(floor, { x }))).toEqual([0, 1, 1, 2, 2]);
});

test("Bessel I and J take a non-integer order", () => {
  closeTo(number(["N", ["BesselI", ["Rational", 1, 2], 2]]), Math.sqrt(1 / Math.PI) * Math.sinh(2));
  closeTo(number(["N", ["BesselJ", ["Rational", 1, 2], 2]]), Math.sqrt(1 / Math.PI) * Math.sin(2));
  expect(digits(["BesselI", ["Rational", -1, 2], ["Sqrt", 2]], "1.4614267006035160938606154087710")).toBe(
    "1.4614267006035160938606154087710",
  );
});

test("Regularized hypergeometrics at exact arguments are Wolfram's Bessel forms", () => {
  const f0 = raw(["Hypergeometric0F1Regularized", ["Rational", 1, 2], ["Rational", 1, 2]]);
  expect(JSON.stringify(f0)).toContain("BesselI");
  closeTo(
    number(["Hypergeometric0F1Regularized", ["Rational", 1, 2], ["Rational", 1, 2]]),
    Math.cosh(Math.SQRT2) / Math.sqrt(Math.PI),
  );
  // 1F1(1/2; 1; 1/2) = e^(1/4) I_0(1/4)
  const f1 = ["Hypergeometric1F1Regularized", ["Rational", 1, 2], 1, ["Rational", 1, 2]];
  expect(JSON.stringify(json(f1))).toContain("BesselI");
  closeTo(number(["N", f1]), Math.exp(0.25) * 1.015686141223608);
  // N is still the series; other shapes are untouched
  expect(number(["N", ["Hypergeometric0F1Regularized", ["Rational", 3, 2], 2]])).toBeCloseTo(3.3630281567133915, 10);
  expect(raw(["Hypergeometric0F1Regularized", ["Rational", 1, 3], 2])[0]).toBe("Hypergeometric0F1Regularized");
  expect(raw(["Hypergeometric0F1Regularized", 2, 3])[0]).toBe("Hypergeometric0F1Regularized");
});

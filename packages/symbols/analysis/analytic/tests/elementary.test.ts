import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// Gudermannian and Hyperfactorial — the two backlog-elementary heads that carry a real
// numeric kernel of our own. mpmath and Wolfram oracle values (originally gathered by
// scripts/collect-elementary-goldens.ts) are pinned as examples on their records. Exact
// special values (0, ±∞, integers) are checked directly.
//
// The other backlog-elementary heads (CubeRoot, IntegerPart, FractionalPart, RealAbs,
// RealSign, UnitStep) reduce to a native compute-engine head or exact arithmetic and have
// no independent kernel of their own to golden-test; they are covered by the reference
// examples in packages/reference/src/entries/analytic-elementary.ts instead.

const ce = new ComputeEngine();
declareAnalytic(ce);

test("Gudermannian: exact at 0 and at the horizontal asymptotes", () => {
  expect(ce.box(["Gudermannian", 0]).evaluate().isSame(0)).toBe(true);
  const atPosInf = ce.box(["Gudermannian", "PositiveInfinity"]).evaluate();
  expect(atPosInf.N().re).toBeCloseTo(Math.PI / 2, 12);
  const atNegInf = ce.box(["Gudermannian", "NegativeInfinity"]).evaluate();
  expect(atNegInf.N().re).toBeCloseTo(-Math.PI / 2, 12);
});

test("Gudermannian: odd, symbolically", () => {
  const r = ce.box(["Gudermannian", ["Negate", "x"]]).evaluate();
  expect(r.json).toEqual(["Negate", ["Gudermannian", "x"]]);
});

test("Gudermannian: gd'(x) = sech(x)", () => {
  const r = ce.box(["D", ["Gudermannian", "x"], "x"]).evaluate();
  expect(r.json).toEqual(["Sech", "x"]);
});

test("Hyperfactorial: exact at nonnegative integers, arbitrarily large", () => {
  expect(ce.box(["Hyperfactorial", 0]).evaluate().json).toEqual(1);
  expect(ce.box(["Hyperfactorial", 4]).evaluate().json).toEqual(27648);
  // H(10) = 215779412229418562091680268288000000000000000 — well past double range,
  // exact bigint arithmetic only.
  const r = ce.box(["Hyperfactorial", 10]).evaluate();
  expect(r.isInteger).toBe(true);
  expect(r.json).toEqual({ num: "215779412229418562091680268288e+15" });
});

test("Hyperfactorial: Listable", () => {
  const r = ce.box(["Hyperfactorial", ["List", 1, 2, 3, 4, 5, 6]]).evaluate();
  expect(r.json).toEqual(["List", 1, 4, 108, 27648, 86400000, 4031078400000]);
});

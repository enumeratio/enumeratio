import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// HankelTransform — see hankel-transform.ts for the rule table and its scope. Expected
// values are each verified against `wolframscript` directly (see the head's
// reference/*.yaml `details`), so they're inlined here rather than in a golden JSON file.

const ce = new ComputeEngine();
declareAnalytic(ce);
ce.assume(ce.box(["Greater", "a", 0]));

const evalOf = (mj: unknown) => ce.box(mj as never).evaluate().json;

test("HankelTransform: order 0 (default)", () => {
  expect(evalOf(["HankelTransform", ["Exp", ["Negate", ["Multiply", "a", "r"]]], "r", "s"])).toEqual([
    "Divide",
    "a",
    ["Power", ["Add", ["Power", "a", 2], ["Power", "s", 2]], ["Rational", 3, 2]],
  ]);
  expect(evalOf(["HankelTransform", ["Divide", 1, "r"], "r", "s"])).toEqual(["Divide", 1, "s"]);
  expect(
    evalOf(["HankelTransform", ["Divide", 1, ["Sqrt", ["Add", ["Power", "r", 2], ["Power", "a", 2]]]], "r", "s"]),
  ).toEqual(["Divide", ["Power", "ExponentialE", ["Negate", ["Multiply", "a", "s"]]], "s"]);
});

test("HankelTransform: order 1's stated form for e^(-ar)", () => {
  expect(evalOf(["HankelTransform", ["Exp", ["Negate", ["Multiply", "a", "r"]]], "r", "s", 1])).toEqual([
    "Divide",
    "s",
    ["Power", ["Add", ["Power", "a", 2], ["Power", "s", 2]], ["Rational", 3, 2]],
  ]);
});

test("HankelTransform: 1/r -> 1/s at any order (n > -1/2)", () => {
  const ce2 = new ComputeEngine();
  declareAnalytic(ce2);
  ce2.assume(ce2.box(["GreaterEqual", "n", 0]));
  const evalOf2 = (mj: unknown) => ce2.box(mj as never).evaluate().json;
  expect(evalOf2(["HankelTransform", ["Divide", 1, "r"], "r", "s", "n"])).toEqual(["Divide", 1, "s"]);
});

test("HankelTransform: declines an unsupported order for e^(-ar^2)", () => {
  expect(evalOf(["HankelTransform", ["Exp", ["Negate", ["Multiply", "a", ["Power", "r", 2]]]], "r", "s", 2])).toEqual([
    "HankelTransform",
    ["Power", "ExponentialE", ["Negate", ["Multiply", "a", ["Power", "r", 2]]]],
    "r",
    "s",
    2,
  ]);
});

test("HankelTransform: sin(ar)/r and cos(ar)/r jump at s = a", () => {
  const trigOverR = (head: string, a: unknown, s: unknown) =>
    ce.box(["HankelTransform", ["Divide", [head, ["Multiply", a, "r"]], "r"], "r", s] as never).evaluate();
  const value = (x: ReturnType<typeof trigOverR>) => x.N().re;
  // Verified against NIntegrate (Method -> "Oscillatory") and an Abel-damped mpmath integral.
  expect(value(trigOverR("Sin", 1, ["Rational", 1, 3]))).toBeCloseTo(3 / (2 * Math.SQRT2), 12);
  expect(value(trigOverR("Sin", 3, 1))).toBeCloseTo(1 / (2 * Math.SQRT2), 12);
  expect(value(trigOverR("Sin", -3, 1))).toBeCloseTo(-1 / (2 * Math.SQRT2), 12);
  expect(trigOverR("Sin", 1, 2).json).toBe(0);
  expect(value(trigOverR("Cos", 1, 3))).toBeCloseTo(1 / (2 * Math.SQRT2), 12);
  expect(trigOverR("Cos", 1, ["Rational", 1, 3]).json).toBe(0);
  // s = a diverges: the call is held, as Wolfram holds it.
  expect(trigOverR("Sin", 2, 2).operator).toBe("HankelTransform");
  expect(trigOverR("Cos", 2, 2).operator).toBe("HankelTransform");
});

test("HankelTransform: a symbolic s leaves a Piecewise that settles once s is known", () => {
  const symbolic = ce.box(["HankelTransform", ["Divide", ["Sin", "r"], "r"], "r", "s"] as never).evaluate();
  expect(symbolic.operator).toBe("Piecewise");
  expect(
    symbolic
      .subs({ s: ce.number([1, 3]) })
      .evaluate()
      .N().re,
  ).toBeCloseTo(3 / (2 * Math.SQRT2), 12);
  expect(symbolic.subs({ s: ce.number(2) }).evaluate().json).toBe(0);
  // An unknown-sign a, and any order but 0, are declined.
  const held = (expr: unknown) => ce.box(expr as never).evaluate().operator;
  expect(held(["HankelTransform", ["Divide", ["Sin", ["Multiply", "b", "r"]], "r"], "r", "s"])).toBe("HankelTransform");
  expect(held(["HankelTransform", ["Divide", ["Sin", "r"], "r"], "r", ["Rational", 1, 3], 1])).toBe("HankelTransform");
});

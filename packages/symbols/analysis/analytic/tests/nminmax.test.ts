import { ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// NMinimize/NMaximize -- numeric univariate optimization on a BOUNDED interval, via dense
// sampling plus golden-section refinement. Not a golden file -- see nminmax.ts.

const ce = new ComputeEngine();
declareAnalytic(ce);
const evalJson = (expr: unknown) => ce.box(expr as never).evaluate().json;

const TOL = 1e-8;
const closeTo = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThan(TOL);

test("a quartic with two symmetric minima on a bounded interval (wolframscript: {-0.25, {x -> -0.707...}})", () => {
  const cons = ["And", ["GreaterEqual", "x", -2], ["LessEqual", "x", 2]];
  const result = ce
    .box(["NMinimize", ["List", ["Subtract", ["Power", "x", 4], ["Power", "x", 2]], cons], "x"] as never)
    .evaluate();
  const [value, rules] = operandsOf(result);
  closeTo(value!.re, -0.25);
  closeTo(operandsOf(operandsOf(rules)[0])[1]!.re, -1 / Math.sqrt(2));
});

test("two trig terms on a bounded interval (wolframscript value: 1.125)", () => {
  const cons = ["And", ["GreaterEqual", "x", 0], ["LessEqual", "x", 6]];
  const result = ce
    .box(["NMaximize", ["List", ["Add", ["Sin", "x"], ["Cos", ["Multiply", 2, "x"]]], cons], "x"] as never)
    .evaluate();
  const [value] = operandsOf(result);
  closeTo(value!.re, 1.125);
});

test("declines without a bounded constraint", () => {
  const expr = ["NMinimize", ["Power", "x", 2], "x"];
  expect(evalJson(expr)).toEqual(expr);
});

test("declines an unbounded-side constraint", () => {
  const expr = ["NMaximize", ["List", ["Negate", ["Power", "x", 2]], ["GreaterEqual", "x", 0]], "x"];
  expect(evalJson(expr)).toEqual(expr);
});

test("declines more than one variable", () => {
  const cons = ["And", ["GreaterEqual", "x", 0], ["LessEqual", "x", 1]];
  const expr = ["NMaximize", ["List", ["Add", "x", "y"], cons], ["List", "x", "y"]];
  expect(evalJson(expr)).toEqual(expr);
});

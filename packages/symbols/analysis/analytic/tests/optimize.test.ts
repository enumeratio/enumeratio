import { ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// Minimize/Maximize/MinValue/MaxValue -- exact global optimization over the scope
// optimize-core.ts documents. Every case here is either verified against wolframscript
// (noted inline) or checks a decline this package's own scope narrows to. Not a golden
// file -- see optimize-core.ts and optimize.ts.

const ce = new ComputeEngine();
declareAnalytic(ce);

const evalJson = (expr: unknown) => ce.box(expr as never).evaluate().json;

test("a quadratic's vertex is its global minimum (wolframscript: {0, {x -> 0}})", () => {
  expect(evalJson(["Minimize", ["Power", "x", 2], "x"])).toEqual(["List", 0, ["List", ["Rule", "x", 0]]]);
});

test("a downward parabola's vertex is its global maximum (wolframscript: {3, {x -> 2}})", () => {
  expect(evalJson(["Maximize", ["Add", ["Negate", ["Power", "x", 2]], ["Multiply", 4, "x"], -1], "x"])).toEqual([
    "List",
    3,
    ["List", ["Rule", "x", 2]],
  ]);
});

test("an odd-degree polynomial is unbounded below (wolframscript: {-Infinity, {x -> -Infinity}})", () => {
  expect(evalJson(["Minimize", ["Power", "x", 3], "x"])).toEqual([
    "List",
    "NegativeInfinity",
    ["List", ["Rule", "x", "NegativeInfinity"]],
  ]);
});

test("and unbounded above the other way round (wolframscript: {Infinity, {x -> Infinity}})", () => {
  expect(evalJson(["Maximize", ["Power", "x", 3], "x"])).toEqual([
    "List",
    "PositiveInfinity",
    ["List", ["Rule", "x", "PositiveInfinity"]],
  ]);
});

test("a rational function's exact irrational critical point (wolframscript verified)", () => {
  const expr = ["Minimize", ["Divide", ["Subtract", "x", 1], ["Add", ["Power", "x", 2], 1]], "x"];
  expect(evalJson(expr)).toEqual([
    "List",
    ["Divide", ["Negate", ["Sqrt", 2]], ["Add", 1, ["Power", ["Add", 1, ["Negate", ["Sqrt", 2]]], 2]]],
    ["List", ["Rule", "x", ["Add", 1, ["Negate", ["Sqrt", 2]]]]],
  ]);
});

test("a simple interval constraint moves the answer to the boundary (wolframscript: {1, {x -> 1}})", () => {
  expect(evalJson(["Minimize", ["List", ["Power", "x", 2], ["GreaterEqual", "x", 1]], "x"])).toEqual([
    "List",
    1,
    ["List", ["Rule", "x", 1]],
  ]);
});

test("a bounded interval constraint on the downward parabola (wolframscript: {2, {x -> 1}})", () => {
  const cons = ["And", ["GreaterEqual", "x", 0], ["LessEqual", "x", 1]];
  const expr = ["Maximize", ["List", ["Add", ["Negate", ["Power", "x", 2]], ["Multiply", 4, "x"], -1], cons], "x"];
  expect(evalJson(expr)).toEqual(["List", 2, ["List", ["Rule", "x", 1]]]);
});

test("Log's minimum is at its domain edge, not at infinity (wolframscript: {-Infinity, {x -> 0}})", () => {
  expect(evalJson(["Minimize", ["Ln", "x"], "x"])).toEqual(["List", "NegativeInfinity", ["List", ["Rule", "x", 0]]]);
});

test("Exp's infimum is 0, never attained (wolframscript: {0, {x -> -Infinity}})", () => {
  expect(evalJson(["Minimize", ["Exp", "x"], "x"])).toEqual(["List", 0, ["List", ["Rule", "x", "NegativeInfinity"]]]);
});

test("Exp of a negated argument is unbounded the other way (wolframscript: {0, {x -> Infinity}})", () => {
  expect(evalJson(["Minimize", ["Exp", ["Negate", "x"]], "x"])).toEqual([
    "List",
    0,
    ["List", ["Rule", "x", "PositiveInfinity"]],
  ]);
});

test("a downward quadratic radicand's own domain is the constraint (wolframscript: {2, {x -> 0}})", () => {
  expect(evalJson(["Maximize", ["Sqrt", ["Subtract", 4, ["Power", "x", 2]]], "x"])).toEqual([
    "List",
    2,
    ["List", ["Rule", "x", 0]],
  ]);
});

test("the variable spelled as a one-element list", () => {
  expect(evalJson(["Minimize", ["Power", "x", 2], ["List", "x"]])).toEqual(["List", 0, ["List", ["Rule", "x", 0]]]);
});

test("MinValue projects Minimize onto just the value", () => {
  expect(evalJson(["MinValue", ["Add", ["Power", "x", 2], ["Multiply", -4, "x"], 3], "x"])).toBe(-1);
});

test("MaxValue projects Maximize onto just the value", () => {
  expect(evalJson(["MaxValue", ["Add", ["Negate", ["Power", "x", 2]], ["Multiply", 4, "x"], -1], "x"])).toBe(3);
});

test("MinValue/MaxValue give Sin/Cos's exact amplitude even though Minimize/Maximize decline it", () => {
  expect(evalJson(["MinValue", ["Sin", "x"], "x"])).toBe(-1);
  expect(evalJson(["MaxValue", ["Cos", ["Add", ["Multiply", 2, "x"], 1]], "x"])).toBe(1);
});

test("declines a quartic whose critical points Solve can't produce exactly", () => {
  const expr = ["Minimize", ["Subtract", ["Power", "x", 4], ["Multiply", 4, ["Power", "x", 2]]], "x"];
  expect(evalJson(expr)).toEqual(expr);
});

test("declines a rational function's real pole strictly inside the constrained interval", () => {
  const cons = ["And", ["GreaterEqual", "x", -2], ["LessEqual", "x", 2]];
  const expr = ["Minimize", ["List", ["Divide", 1, ["Subtract", "x", 1]], cons], "x"];
  expect(evalJson(expr)).toEqual(expr);
});

test("declines an unconstrained Sqrt whose domain splits into two disjoint rays", () => {
  const expr = ["Minimize", ["Sqrt", ["Subtract", ["Power", "x", 2], 4]], "x"];
  expect(evalJson(expr)).toEqual(expr);
});

test("declines more than one variable", () => {
  const expr = ["Minimize", ["Add", ["Power", "x", 2], ["Power", "y", 2]], ["List", "x", "y"]];
  expect(evalJson(expr)).toEqual(expr);
});

test("declines a constant -- every x is an equally valid minimizer", () => {
  const expr = ["Minimize", 5, "x"];
  expect(evalJson(expr)).toEqual(expr);
});

test("declines Sin's point even though MinValue reports its exact value", () => {
  const expr = ["Minimize", ["Sin", "x"], "x"];
  expect(evalJson(expr)).toEqual(expr);
});

test("every attained answer actually is the reported value at the reported point", () => {
  const result = ce
    .box(["Minimize", ["Divide", ["Subtract", "x", 1], ["Add", ["Power", "x", 2], 1]], "x"] as never)
    .evaluate();
  const [value, rules] = operandsOf(result);
  const point = operandsOf(operandsOf(rules)[0])[1]!;
  const atPoint = ce
    .box(["Divide", ["Subtract", point.json, 1], ["Add", ["Power", point.json, 2], 1]] as never)
    .evaluate();
  expect(atPoint.isEqual(value!)).toBe(true);
});

import { ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// FindInstance(expr, vars, [domain], [n]) -- scoped to a provably correct core. Every case
// here checks EITHER an exact returned instance (re-verifiable by hand) or a decline/proven-
// empty result; not a golden file -- see find-instance.ts.

const ce = new ComputeEngine();
declareAnalytic(ce);

const evalJson = (expr: unknown) => ce.box(expr as never).evaluate().json;

test("a quadratic with two real roots returns one instance by default", () => {
  expect(evalJson(["FindInstance", ["Equal", ["Power", "x", 2], 4], "x", "Reals"])).toEqual([
    "List",
    ["List", ["Rule", "x", 2]],
  ]);
});

test("an explicit count returns up to that many instances", () => {
  expect(evalJson(["FindInstance", ["Equal", ["Power", "x", 2], 4], "x", "Reals", 2])).toEqual([
    "List",
    ["List", ["Rule", "x", 2]],
    ["List", ["Rule", "x", -2]],
  ]);
});

test("an irrational root comes back exact", () => {
  expect(evalJson(["FindInstance", ["Equal", ["Power", "x", 2], 2], "x", "Reals"])).toEqual([
    "List",
    ["List", ["Rule", "x", ["Sqrt", 2]]],
  ]);
});

test("a linear equation", () => {
  expect(evalJson(["FindInstance", ["Equal", ["Add", ["Multiply", 2, "x"], 3], 7], "x", "Reals"])).toEqual([
    "List",
    ["List", ["Rule", "x", 2]],
  ]);
});

test("no real root is a proven empty result, not a decline", () => {
  expect(evalJson(["FindInstance", ["Equal", ["Power", "x", 2], -1], "x", "Reals"])).toEqual(["List"]);
});

test("a real-but-non-integer root is also a proven empty result over Integers", () => {
  expect(evalJson(["FindInstance", ["Equal", ["Power", "x", 2], 2], "x", "Integers"])).toEqual(["List"]);
});

test("an equation that reduces to a false constant declines rather than guesses", () => {
  // Add(x, 1) - x - 0 reduces to the constant 1 -- degree 0, no x term left to solve, so
  // this falls past the quadratic route (which needs degree 1 or 2) to the Solve fallback,
  // which can't prove absence either -- a decline, not a wrong "found" or an unproven "[]".
  const expr = ["FindInstance", ["Equal", ["Subtract", ["Add", "x", 1], "x"], 0], "x", "Reals"];
  expect(evalJson(expr)).toEqual(expr);
});

test("a bounded integer search needs no equation at all", () => {
  expect(evalJson(["FindInstance", ["And", ["Greater", "x", 0], ["Less", "x", 10]], "x", "Integers", 3])).toEqual([
    "List",
    ["List", ["Rule", "x", 1]],
    ["List", ["Rule", "x", 2]],
    ["List", ["Rule", "x", 3]],
  ]);
});

test("NotEqual excludes a point from a bounded search", () => {
  const result = evalJson([
    "FindInstance",
    ["And", ["NotEqual", "x", 1], ["Greater", "x", 0], ["Less", "x", 4]],
    "x",
    "Integers",
    10,
  ]);
  expect(result).toEqual(["List", ["List", ["Rule", "x", 2]], ["List", ["Rule", "x", 3]]]);
});

test("a multivariate bounded integer search", () => {
  const result = evalJson([
    "FindInstance",
    [
      "And",
      ["Equal", ["Add", "x", "y"], 5],
      ["Greater", "x", 0],
      ["Less", "x", 10],
      ["Greater", "y", 0],
      ["Less", "y", 10],
    ],
    ["List", "x", "y"],
    "Integers",
    3,
  ]);
  expect(result).toEqual([
    "List",
    ["List", ["Rule", "x", 1], ["Rule", "y", 4]],
    ["List", ["Rule", "x", 2], ["Rule", "y", 3]],
    ["List", ["Rule", "x", 3], ["Rule", "y", 2]],
  ]);
});

test("declines without an explicit domain -- the default is Complexes", () => {
  const expr = ["FindInstance", ["Greater", "x", 0], "x"];
  expect(evalJson(expr)).toEqual(expr);
});

test("declines on a domain other than Reals or Integers", () => {
  const expr = ["FindInstance", ["Equal", "x", 2], "x", "Booleans"];
  expect(evalJson(expr)).toEqual(expr);
});

test("declines on a pure inequality over Reals -- no provable canonical witness", () => {
  const expr = ["FindInstance", ["Greater", "x", 0], "x", "Reals"];
  expect(evalJson(expr)).toEqual(expr);
});

test("declines on Or -- out of scope", () => {
  const expr = ["FindInstance", ["Or", ["Equal", "x", 1], ["Equal", "x", 2]], "x", "Reals"];
  expect(evalJson(expr)).toEqual(expr);
});

test("declines an unbounded integer search", () => {
  const expr = ["FindInstance", ["NotEqual", "x", 0], "x", "Integers"];
  expect(evalJson(expr)).toEqual(expr);
});

test("declines a multivariate search where one variable is unbounded", () => {
  const expr = [
    "FindInstance",
    ["And", ["Equal", ["Add", "x", "y"], 5], ["Greater", "x", 0], ["Less", "x", 10]],
    ["List", "x", "y"],
    "Integers",
    1,
  ];
  expect(evalJson(expr)).toEqual(expr);
});

test("every returned instance actually satisfies the equation it solved", () => {
  const result = ce.box(["FindInstance", ["Equal", ["Power", "x", 2], 4], "x", "Reals", 2] as never).evaluate();
  for (const instance of operandsOf(result)) {
    for (const rule of operandsOf(instance)) {
      const value = operandsOf(rule)[1];
      expect(symbolNameOf(ce.box(["Equal", ["Power", value?.json, 2], 4] as never).evaluate())).toBe("True");
    }
  }
});

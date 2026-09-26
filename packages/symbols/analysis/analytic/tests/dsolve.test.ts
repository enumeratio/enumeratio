import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// DSolveValue — see dsolve.ts for scope and the verification every solution goes
// through before being returned. Expected values are each verified against
// `wolframscript`'s own `DSolveValue` (up to relabeling which root gets C(1) vs C(2)),
// so they're inlined here rather than a golden JSON file.
//
// The unknown function is named `Y` (capitalized), not `y` -- see DSolveValue.yaml's
// `details` for why a lowercase `y` here would poison an unrelated, repo-wide
// provenance check that reuses one shared compute-engine instance across every
// reference example.

const ce = new ComputeEngine();
declareAnalytic(ce);

const evalOf = (mj: unknown) => ce.box(mj as never).evaluate().json;
const D1 = (order: number, point: unknown) => ["Apply", ["Derivative", "Y", order], point];

test("DSolveValue: complex-conjugate roots (harmonic oscillator)", () => {
  expect(evalOf(["DSolveValue", ["Equal", ["Add", D1(2, "x"), ["Y", "x"]], 0], ["Y", "x"], "x"])).toEqual([
    "Add",
    ["Multiply", ["Sin", "x"], ["C", 2]],
    ["Multiply", ["Cos", "x"], ["C", 1]],
  ]);
});

test("DSolveValue: distinct real roots", () => {
  expect(
    evalOf([
      "DSolveValue",
      ["Equal", ["Add", D1(2, "x"), ["Negate", ["Multiply", 3, D1(1, "x")]], ["Multiply", 2, ["Y", "x"]]], 0],
      ["Y", "x"],
      "x",
    ]),
  ).toEqual([
    "Add",
    ["Multiply", ["C", 1], ["Power", "ExponentialE", ["Multiply", 2, "x"]]],
    ["Multiply", ["C", 2], ["Power", "ExponentialE", "x"]],
  ]);
});

test("DSolveValue: repeated root", () => {
  expect(
    evalOf([
      "DSolveValue",
      ["Equal", ["Add", D1(2, "x"), ["Negate", ["Multiply", 4, D1(1, "x")]], ["Multiply", 4, ["Y", "x"]]], 0],
      ["Y", "x"],
      "x",
    ]),
  ).toEqual([
    "Multiply",
    ["Add", ["Multiply", "x", ["C", 2]], ["C", 1]],
    ["Power", "ExponentialE", ["Multiply", 2, "x"]],
  ]);
});

test("DSolveValue: order 1", () => {
  expect(
    evalOf(["DSolveValue", ["Equal", ["Add", D1(1, "x"), ["Multiply", 2, ["Y", "x"]]], 0], ["Y", "x"], "x"]),
  ).toEqual(["Multiply", ["C", 1], ["Power", "ExponentialE", ["Multiply", -2, "x"]]]);
});

test("DSolveValue: polynomial forcing", () => {
  expect(
    evalOf(["DSolveValue", ["Equal", ["Subtract", D1(2, "x"), ["Y", "x"]], ["Power", "x", 2]], ["Y", "x"], "x"]),
  ).toEqual([
    "Add",
    ["Negate", ["Power", "x", 2]],
    ["Multiply", ["C", 1], ["Power", "ExponentialE", "x"]],
    ["Multiply", ["C", 2], ["Power", "ExponentialE", ["Negate", "x"]]],
    -2,
  ]);
});

test("DSolveValue: resonance, sine forcing at the homogeneous frequency", () => {
  expect(evalOf(["DSolveValue", ["Equal", ["Add", D1(2, "x"), ["Y", "x"]], ["Sin", "x"]], ["Y", "x"], "x"])).toEqual([
    "Add",
    ["Multiply", ["Rational", -1, 2], "x", ["Cos", "x"]],
    ["Multiply", ["Sin", "x"], ["C", 2]],
    ["Multiply", ["Cos", "x"], ["C", 1]],
  ]);
});

test("DSolveValue: initial conditions solve the arbitrary constants", () => {
  expect(
    evalOf([
      "DSolveValue",
      ["List", ["Equal", ["Add", D1(2, "x"), ["Y", "x"]], 0], ["Equal", ["Y", 0], 1], ["Equal", D1(1, 0), 0]],
      ["Y", "x"],
      "x",
    ]),
  ).toEqual(["Cos", "x"]);
});

test("DSolveValue: declines a nonlinear equation and an order above 2", () => {
  expect(evalOf(["DSolveValue", ["Equal", ["Power", ["Y", "x"], 2], 0], ["Y", "x"], "x"])).toEqual([
    "DSolveValue",
    ["Equal", ["Power", ["Y", "x"], 2], 0],
    ["Y", "x"],
    "x",
  ]);
  const order3 = ["Equal", ["Add", ["Apply", ["Derivative", "Y", 3], "x"], ["Y", "x"]], 0];
  expect(evalOf(["DSolveValue", order3, ["Y", "x"], "x"])).toEqual(["DSolveValue", order3, ["Y", "x"], "x"]);
});

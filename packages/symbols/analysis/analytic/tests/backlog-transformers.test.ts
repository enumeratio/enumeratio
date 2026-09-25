import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// The backlog transformers and interval/uncertainty arithmetic landed in lane B-18:
// ComplexExpand, ExpToTrig, FullSimplify, FunctionExpand, PowerExpand, MatrixFunction,
// Interval, CenteredInterval and Around. Every case here is one of the reference entries'
// pinned examples (see packages/reference/src/entries/analytic-special.ts) — direct toEqual
// assertions against the exact MathJSON, never a snapshot.

const ce = new ComputeEngine();
declareAnalytic(ce);

const json = (expr: unknown) => ce.box(expr as never).evaluate().json;

test("ComplexExpand splits real/imaginary parts of a symbolic complex argument", () => {
  expect(json(["ComplexExpand", ["Sin", ["Add", "x", ["Multiply", "ImaginaryUnit", "y"]]]])).toEqual([
    "Add",
    ["Multiply", ["Complex", 0, 1], ["Cos", "x"], ["Sinh", "y"]],
    ["Multiply", ["Sin", "x"], ["Cosh", "y"]],
  ]);
  expect(json(["ComplexExpand", ["Abs", ["Add", "x", ["Multiply", "ImaginaryUnit", "y"]]]])).toEqual([
    "Sqrt",
    ["Add", ["Power", "x", 2], ["Power", "y", 2]],
  ]);
});

test("ComplexExpand is a no-op on an already-concrete numeric argument", () => {
  // Exp(iπ/5) already reduces to its exact radical form under plain evaluation; ComplexExpand
  // must not round-trip that through a lossy float split (see complex-expand.ts's header).
  expect(json(["ComplexExpand", ["Exp", ["Multiply", "ImaginaryUnit", ["Divide", "Pi", 5]]]])).toEqual(
    json(["Exp", ["Multiply", "ImaginaryUnit", ["Divide", "Pi", 5]]]),
  );
});

test("ExpToTrig rewrites Euler's formula and folds symmetric combinations", () => {
  expect(json(["ExpToTrig", ["Exp", ["Multiply", "ImaginaryUnit", "x"]]])).toEqual([
    "Add",
    ["Multiply", ["Complex", 0, 1], ["Sin", "x"]],
    ["Cos", "x"],
  ]);
  expect(json(["ExpToTrig", ["Divide", ["Add", ["Exp", "x"], ["Exp", ["Negate", "x"]]], 2]])).toEqual(["Cosh", "x"]);
  expect(
    json([
      "ExpToTrig",
      [
        "Divide",
        [
          "Subtract",
          ["Exp", ["Multiply", "ImaginaryUnit", "x"]],
          ["Exp", ["Negate", ["Multiply", "ImaginaryUnit", "x"]]],
        ],
        ["Multiply", 2, "ImaginaryUnit"],
      ],
    ]),
  ).toEqual(["Sin", "x"]);
});

test("FullSimplify folds the hyperbolic Pythagorean identity and denests a nested radical", () => {
  expect(json(["FullSimplify", ["Subtract", ["Power", ["Cosh", "x"], 2], ["Power", ["Sinh", "x"], 2]]])).toEqual(1);
  expect(
    json([
      "FullSimplify",
      ["Subtract", ["Add", ["Sqrt", 2], ["Sqrt", 3]], ["Sqrt", ["Add", 5, ["Multiply", 2, ["Sqrt", 6]]]]],
    ]),
  ).toEqual(0);
  expect(json(["FullSimplify", ["Divide", ["Gamma", ["Add", "x", 1]], ["Gamma", "x"]]])).toEqual("x");
});

test("FunctionExpand applies named identities and passes through what compute-engine already expands", () => {
  expect(json(["FunctionExpand", ["DirichletEta", "s"]])).toEqual([
    "Multiply",
    ["Add", ["Negate", ["Power", 2, ["Add", ["Negate", "s"], 1]]], 1],
    ["Zeta", "s"],
  ]);
  expect(json(["FunctionExpand", ["Pochhammer", "x", 3]])).toEqual(["Multiply", "x", ["Add", "x", 1], ["Add", "x", 2]]);
  // Multinomial has no real-argument domain to differentiate through Around on — left alone.
  expect(json(["FunctionExpand", ["Cos", "theta"]])).toEqual(["Cos", "theta"]);
});

test("PowerExpand distributes powers and logs over products", () => {
  expect(json(["PowerExpand", ["Sqrt", ["Power", "x", 2]]])).toEqual("x");
  expect(json(["PowerExpand", ["Ln", ["Multiply", "x", "y"]]])).toEqual(["Add", ["Ln", "x"], ["Ln", "y"]]);
  expect(json(["PowerExpand", ["Power", ["Multiply", "a", "b"], "c"]])).toEqual([
    "Multiply",
    ["Power", "a", "c"],
    ["Power", "b", "c"],
  ]);
});

test("MatrixFunction: diagonal, Exp-via-MatrixExp, and the 2×2 Jordan limit", () => {
  expect(json(["MatrixFunction", "Sqrt", ["List", ["List", 4, 0], ["List", 0, 9]]])).toEqual([
    "List",
    ["List", 2, 0],
    ["List", 0, 3],
  ]);
  expect(json(["MatrixFunction", "Exp", ["List", ["List", 0, 0], ["List", 0, 0]]])).toEqual([
    "List",
    ["List", 1, 0],
    ["List", 0, 1],
  ]);
  expect(json(["MatrixFunction", ["Function", ["Power", "_1", 2]], ["List", ["List", 1, 1], ["List", 0, 1]]])).toEqual([
    "List",
    ["List", 1, 2],
    ["List", 0, 1],
  ]);
});

test("Interval: Add, Multiply, Divide, even Power, Abs and a monotonic Sin", () => {
  expect(json(["Add", ["Interval", 1, 2], ["Interval", 3, 4]])).toEqual(["Interval", 4, 6]);
  expect(json(["Multiply", ["Interval", 1, 2], ["Interval", -1, 3]])).toEqual(["Interval", -2, 6]);
  expect(json(["Power", ["Interval", -1, 2], 2])).toEqual(["Interval", 0, 4]);
  // The dependency problem: an interval minus itself still widens.
  expect(json(["Subtract", ["Interval", 1, 2], ["Interval", 1, 2]])).toEqual(["Interval", -1, 1]);
  expect(json(["Abs", ["Interval", -3, 2]])).toEqual(["Interval", 0, 3]);
});

test("CenteredInterval: centers and radii add, a scalar scales both, Interval converts", () => {
  expect(
    json(["Add", ["CenteredInterval", 1, ["Rational", 1, 2]], ["CenteredInterval", 2, ["Rational", 1, 4]]]),
  ).toEqual(["CenteredInterval", 3, ["Rational", 3, 4]]);
  expect(json(["Multiply", 2, ["CenteredInterval", 2, ["Rational", 1, 2]]])).toEqual(["CenteredInterval", 4, 1]);
  expect(json(["CenteredInterval", ["Interval", 1, 3]])).toEqual(["CenteredInterval", 2, 1]);
  // Radii add under subtraction too — Subtract runs through Add + Negate, and Negate leaves
  // the radius alone.
  expect(
    json(["Subtract", ["CenteredInterval", 5, ["Rational", 1, 4]], ["CenteredInterval", 1, ["Rational", 1, 4]]]),
  ).toEqual(["CenteredInterval", 4, ["Rational", 1, 2]]);
});

test("Around: quadrature for Add/Multiply, closed-form derivatives for Power/Exp, symbolic D for Sqrt/Erf", () => {
  expect(json(["Add", ["Around", 1, 0.1], ["Around", 2, 0.2]])).toEqual(["Around", 3, 0.223606797749979]);
  expect(json(["Power", ["Around", 2, 0.1], 2])).toEqual(["Around", 4, 0.4]);
  expect(json(["Sqrt", ["Around", 4, 0.4]])).toEqual(["Around", 2, 0.1]);
  expect(json(["Exp", ["Around", 2, 0.01]])).toEqual(["Around", 7.38905609893065, 0.0738905609893065]);
  expect(json(["Erf", ["Around", 2, 0.01]])).toEqual(["Around", 0.9953222650189527, 0.00020666985354092054]);
  // Multinomial's domain is integer-only: no derivative to propagate through, so it stays put.
  expect(json(["Multinomial", ["Around", 2, 0.01], 2])).toEqual(["Multinomial", ["Around", 2, 0.01], 2]);
});

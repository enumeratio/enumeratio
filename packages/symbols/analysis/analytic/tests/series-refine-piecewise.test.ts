import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// SeriesCoefficient, Refine/Assuming, and Piecewise/PiecewiseExpand — see each head's
// reference entry (packages/symbols/analysis/analytic/reference/*.yaml) for what's covered
// and what's declined. Every value here was checked against `wolframscript` before being
// pinned.

const ce = new ComputeEngine();
declareAnalytic(ce);

type Expr = number | string | readonly unknown[];
const evalJson = (expr: Expr): unknown => ce.box(expr as never).evaluate().json;

test("SeriesCoefficient: ordinary-point Taylor coefficients, matching wolframscript", () => {
  expect(evalJson(["SeriesCoefficient", ["Exp", "x"], ["List", "x", 1, 2]])).toEqual([
    "Multiply",
    ["Rational", 1, 2],
    "ExponentialE",
  ]); // wolframscript: SeriesCoefficient[Exp[x],{x,1,2}] -> E/2
  expect(evalJson(["SeriesCoefficient", ["Sin", "x"], ["List", "x", 0, 5]])).toEqual(["Rational", 1, 120]); // wolframscript: 1/120
  expect(evalJson(["SeriesCoefficient", ["Divide", 1, ["Subtract", 1, "x"]], ["List", "x", 0, 10]])).toEqual(1); // wolframscript: 1
  expect(evalJson(["SeriesCoefficient", ["Ln", ["Add", 1, "x"]], ["List", "x", 0, 4]])).toEqual(["Rational", -1, 4]); // wolframscript: -1/4
});

test("SeriesCoefficient declines negative/non-integer order and a removable singularity", () => {
  const laurent = ["SeriesCoefficient", ["Divide", 1, "x"], ["List", "x", 0, -1]] as const;
  expect(evalJson(laurent)).toEqual(laurent); // a residue, not a derivative-at-a-point value
  const puiseux = ["SeriesCoefficient", ["Sqrt", "x"], ["List", "x", 0, ["Rational", 1, 2]]] as const;
  expect(evalJson(puiseux)).toEqual(puiseux);
  const removable = ["SeriesCoefficient", ["Divide", ["Sin", "x"], "x"], ["List", "x", 0, 0]] as const;
  expect(evalJson(removable)).toEqual(removable); // D at the singularity itself is unsafe
});

test("Assuming scopes ce.assume for the duration of the call, and never leaks", () => {
  expect(evalJson(["Assuming", ["Greater", "x", 0], ["Abs", "x"]])).toEqual("x");
  expect(
    evalJson(["Assuming", ["List", ["Greater", "x", 0], ["Less", "y", 0]], ["Add", ["Sign", "x"], ["Sign", "y"]]]),
  ).toEqual(0);
  // The assumption on z is gone as soon as Assuming returns.
  expect(evalJson(["List", ["Assuming", ["Greater", "z", 0], ["Sign", "z"]], ["Sign", "z"]])).toEqual([
    "List",
    1,
    ["Sign", "z"],
  ]);
});

test("Refine simplifies under a stated (or already-assumed) condition", () => {
  expect(evalJson(["Refine", ["Sqrt", ["Power", "x", 2]], ["Greater", "x", 0]])).toEqual("x");
  expect(evalJson(["Refine", ["Sqrt", ["Power", "x", 2]], ["Less", "x", 0]])).toEqual(["Negate", "x"]);
  expect(evalJson(["Refine", ["Sign", "x"], ["Greater", "x", 0]])).toEqual(1);
  expect(evalJson(["Refine", ["Ln", ["Exp", "x"]], ["Element", "x", "RealNumbers"]])).toEqual("x");
  // No assumption available: x^2 > 0 fails at x = 0, so it's left alone (canonical form
  // flips Greater(x^2, 0) to Less(0, x^2)).
  expect(evalJson(["Refine", ["Greater", ["Power", "x", 2], 0]])).toEqual(["Less", 0, ["Power", "x", 2]]);
});

test("Piecewise: ordered clauses, elimination, and the numeric-substitution case", () => {
  const pw = ["Piecewise", ["List", ["List", 1, ["Less", "x", 0]], ["List", 2, ["GreaterEqual", "x", 0]]]] as const;
  expect(evalJson(["ReplaceAll", pw, ["Rule", "x", -5]])).toEqual(1);
  expect(evalJson(["ReplaceAll", pw, ["Rule", "x", 5]])).toEqual(2);
  // Both clauses undecided with x symbolic: stays as-is (canonical GreaterEqual flips).
  expect(evalJson(pw)).toEqual([
    "Piecewise",
    ["List", ["List", 1, ["Less", "x", 0]], ["List", 2, ["LessEqual", 0, "x"]]],
  ]);
  // Falls through to the explicit default when every clause is eliminated.
  expect(evalJson(["Piecewise", ["List", ["List", 1, ["Greater", 2, 3]]], 99])).toEqual(99);
});

test("PiecewiseExpand rewrites Abs/Sign/Clip/Max only once realness is established", () => {
  const realX = ["Element", "x", "RealNumbers"] as const;
  expect(evalJson(["PiecewiseExpand", ["Abs", "x"], realX])).toEqual([
    "Piecewise",
    ["List", ["List", ["Negate", "x"], ["Less", "x", 0]]],
    "x",
  ]);
  expect(evalJson(["PiecewiseExpand", ["Sign", "x"], realX])).toEqual([
    "Piecewise",
    ["List", ["List", -1, ["Less", "x", 0]], ["List", 1, ["Less", 0, "x"]]],
    0,
  ]);
  expect(evalJson(["PiecewiseExpand", ["Clip", "x", ["List", -1, 1]], realX])).toEqual([
    "Piecewise",
    ["List", ["List", -1, ["Less", "x", -1]], ["List", 1, ["Less", 1, "x"]]],
    "x",
  ]);
  expect(
    evalJson([
      "PiecewiseExpand",
      ["Max", "x", "y"],
      ["And", ["Element", "x", "RealNumbers"], ["Element", "y", "RealNumbers"]],
    ]),
  ).toEqual(["Piecewise", ["List", ["List", "x", ["LessEqual", "y", "x"]]], "y"]);
  // Without a realness assumption, Abs is left alone — same as Wolfram's own PiecewiseExpand.
  expect(evalJson(["PiecewiseExpand", ["Abs", "x"]])).toEqual(["Abs", "x"]);
});

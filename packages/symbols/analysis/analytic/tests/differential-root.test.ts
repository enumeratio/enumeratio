import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// DifferentialRootReduce / DifferentialRoot (differential-root.ts): the holonomic (D-finite)
// reduction of a function, and its Taylor-series evaluator. Every case below is checked
// against the ORIGINAL function's own numeric evaluation at several points inside the radius
// of convergence — this is the one head in this package whose evaluator is numeric-only by
// design (see the module header).

const ce = new ComputeEngine();
declareAnalytic(ce);

/** Reduce `expr` (in terms of `x`) and check it reproduces `expr`'s own `.N()` at every
 * point in `points`, to `tol` absolute error. */
function checkReduction(exprJson: unknown, points: readonly number[], tol = 1e-9): void {
  const expr = ce.box(exprJson as never);
  const reduced = ce.box(["DifferentialRootReduce", expr.json as never, "x"] as never).evaluate();
  expect(reduced.operator, "reduction declined").toBe("Apply");
  for (const x of points) {
    const native = expr.subs({ x }).N();
    const viaOde = reduced.subs({ x }).evaluate();
    expect(viaOde.operator, `x=${x} did not evaluate: ${viaOde.toString()}`).not.toBe("Apply");
    expect(Math.abs(native.re - viaOde.re), `x=${x}`).toBeLessThan(tol);
  }
}

const points = [0, 0.3, 0.7, 1, -0.5, -1];

test("exp(2x): order 1", () => {
  checkReduction(["Exp", ["Multiply", 2, "x"]], points);
});

test("sin(3x): order 2, constant coefficients", () => {
  checkReduction(["Sin", ["Multiply", 3, "x"]], points);
});

test("cos(x): order 2, constant coefficients", () => {
  checkReduction(["Cos", "x"], points);
});

test("polynomial x^2 + 3x + 1: the ODE terminates at the polynomial's own degree", () => {
  checkReduction(["Add", ["Power", "x", 2], ["Multiply", 3, "x"], 1], [0, 1, 2, -3, 5]);
});

test("1/(x-2): a single-pole rational function, order 1", () => {
  checkReduction(["Divide", 1, ["Subtract", "x", 2]], [0, 0.5, 1, -1, 1.5]);
});

test("log(1+x): order 2, radius 1", () => {
  checkReduction(["Ln", ["Add", 1, "x"]], [0, 0.3, 0.9, -0.5, -0.9]);
});

test("arctan(x): order 2, radius 1", () => {
  checkReduction(["Arctan", "x"], [0, 0.3, 0.9, -0.9]);
});

test("erf(x): order 2, entire", () => {
  checkReduction(["Erf", "x"], [0, 0.3, 1, -1, 2]);
});

test("AiryAi(x) / AiryBi(x): order 2, x = 0 is an ordinary point", () => {
  checkReduction(["AiryAi", "x"], [0, 0.5, 1, -1]);
  checkReduction(["AiryBi", "x"], [0, 0.5, -1]);
});

test("BesselJ(2, x): anchored at x0 = 1 (x = 0 is singular)", () => {
  checkReduction(["BesselJ", 2, "x"], [1, 1.2, 0.6, 1.8]);
});

test("DifferentialRootReduce declines a two-term sum", () => {
  const call = ce
    .box(["DifferentialRootReduce", ["Add", ["Exp", "x"], ["Sin", "x"]] as never, "x"] as never)
    .evaluate();
  expect(call.operator).toBe("DifferentialRootReduce"); // unevaluated
});

test("DifferentialRoot declines outside the radius of convergence rather than guessing", () => {
  // log(1+x)'s series has radius 1; x = 5 is well outside it.
  const reduced = ce.box(["DifferentialRootReduce", ["Ln", ["Add", 1, "x"]] as never, "x"] as never).evaluate();
  const farOut = reduced.subs({ x: 5 }).evaluate();
  expect(farOut.operator).toBe("Apply"); // stays inert
});

test("DifferentialRoot declines a symbolic target rather than dropping the argument", () => {
  const reduced = ce.box(["DifferentialRootReduce", ["Exp", "x"] as never, "x"] as never).evaluate();
  const symbolic = reduced.subs({ x: "t" }).evaluate();
  expect(symbolic.operator).toBe("Apply");
  expect(symbolic.toString()).toContain("t");
});

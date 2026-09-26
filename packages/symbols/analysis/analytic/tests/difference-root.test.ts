import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// DifferenceRootReduce / DifferenceRoot (difference-root.ts): the holonomic (P-recursive)
// reduction of a hypergeometric-type sequence, and its evaluator. Every case below is
// checked against the ORIGINAL expression's own native evaluation at ~20 integer points —
// the recurrence must reproduce the closed form it was derived from, not just "look right".

const ce = new ComputeEngine();
declareAnalytic(ce);

/** Reduce `expr` (in terms of `n`) and check the recurrence reproduces the native value at
 * every point in `points`, both exactly (string comparison of the exact rational/integer). */
function checkReduction(exprJson: unknown, points: readonly number[]): void {
  const expr = ce.box(exprJson as never);
  const reduced = ce.box(["DifferenceRootReduce", expr.json as never, "n"] as never).evaluate();
  expect(reduced.operator, "reduction declined").toBe("Apply");
  for (const n of points) {
    const native = expr.subs({ n }).evaluate();
    const viaRecurrence = reduced.subs({ n }).evaluate();
    expect(viaRecurrence.toString(), `n=${n}`).toBe(native.toString());
  }
}

const POINTS_0_19 = Array.from({ length: 20 }, (_, i) => i);

test("Factorial(n): order 1, y(n+1) = (n+1) y(n)", () => {
  checkReduction(["Factorial", "n"], POINTS_0_19);
});

test("3^n: order 1, y(n+1) = 3 y(n)", () => {
  checkReduction(["Power", 3, "n"], POINTS_0_19);
});

test("CatalanNumber(n): order 1", () => {
  checkReduction(["CatalanNumber", "n"], POINTS_0_19);
});

test("Fibonacci(n): order 2, constant coefficients", () => {
  checkReduction(["Fibonacci", "n"], POINTS_0_19);
});

test("LucasL(n): order 2, constant coefficients", () => {
  checkReduction(["LucasL", "n"], POINTS_0_19);
});

test("monomial n^3: order 1, anchored past its own zero", () => {
  checkReduction(["Power", "n", 3], POINTS_0_19);
});

test("polynomial n^2 + 3n + 1", () => {
  checkReduction(["Add", ["Power", "n", 2], ["Multiply", 3, "n"], 1], POINTS_0_19);
});

test("Binomial(n, 3): the pole at n = 2 is straddled by two anchors", () => {
  checkReduction(["Binomial", "n", 3], POINTS_0_19);
});

test("Binomial(n, 0): no pole, a single anchor", () => {
  checkReduction(["Binomial", "n", 0], POINTS_0_19);
});

test("n! * 2^n: product of two hypergeometric factors folds into one order-1 term", () => {
  checkReduction(
    ["Multiply", ["Factorial", "n"], ["Power", 2, "n"]],
    Array.from({ length: 10 }, (_, i) => i),
  );
});

test("n! / 2^n: quotient of two hypergeometric factors", () => {
  checkReduction(
    ["Divide", ["Factorial", "n"], ["Power", 2, "n"]],
    Array.from({ length: 10 }, (_, i) => i),
  );
});

test("2^n + 3^n: sum-of-two-hypergeometric-terms closure, order 2", () => {
  checkReduction(["Add", ["Power", 2, "n"], ["Power", 3, "n"]], POINTS_0_19);
});

test("HarmonicNumber(n): order 1 with a constant inhomogeneous term", () => {
  const expr = ce.box(["HarmonicNumber", "n"]);
  const reduced = ce.box(["DifferenceRootReduce", expr.json as never, "n"] as never).evaluate();
  expect(reduced.operator).toBe("Apply");
  for (let n = 0; n <= 15; n++) {
    // HarmonicNumber(n) does not auto-evaluate under plain evaluate() (see harmonic.ts), so
    // compare numerically instead of by exact string.
    const native = ce.box(["N", ["HarmonicNumber", n]] as never).evaluate();
    const viaRecurrence = ce.box(["N", reduced.subs({ n }).json as never] as never).evaluate();
    expect(Math.abs(native.re - viaRecurrence.re), `n=${n}`).toBeLessThan(1e-9);
  }
});

test("DifferenceRoot declines a symbolic or negative target rather than dropping the argument", () => {
  const reduced = ce.box(["DifferenceRootReduce", ["Fibonacci", "n"] as never, "n"] as never).evaluate();
  const symbolic = reduced.subs({ n: "m" }).evaluate();
  expect(symbolic.operator).toBe("Apply"); // stays applied, not dropped to bare DifferenceRoot(fn)
  expect(symbolic.toString()).toContain("m");

  const negative = reduced.subs({ n: -1 }).evaluate();
  expect(negative.operator).toBe("Apply"); // declines rather than guessing
});

test("DifferenceRootReduce declines a symbolic Binomial order", () => {
  const call = ce.box(["DifferenceRootReduce", ["Binomial", "n", "k"] as never, "n"] as never).evaluate();
  expect(call.operator).toBe("DifferenceRootReduce"); // unevaluated
});

test("DifferenceRootReduce declines a three-term sum", () => {
  const call = ce
    .box([
      "DifferenceRootReduce",
      ["Add", ["Power", 2, "n"], ["Power", 3, "n"], ["Power", 5, "n"]] as never,
      "n",
    ] as never)
    .evaluate();
  expect(call.operator).toBe("DifferenceRootReduce"); // unevaluated
});

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// enumeratio/enumeratio#113 §2: images of an Interval. Here: a decline case. See
// tagged-calculus.ts for the shared derivative-sign-and-bisection rule both directions of
// this file share.

const ce = new ComputeEngine();
declareAnalytic(ce);

test("Interval: a trig head declines rather than guess across a pole it straddles", () => {
  // Cot has a pole at 0, inside [-π/4, π/4] — Wolfram's own answer is a Union of two
  // unbounded intervals, out of scope for a rule that returns one Interval (see interval.ts's
  // `hasPoleBetween`). The point of this test is only that it is NOT a wrong bounded
  // Interval answer -- whatever compute-engine's own native Cot does with a set argument
  // otherwise (declines to a plain unevaluated call, or its own type error) is out of scope
  // here.
  const result = ce.box(["Cot", ["Interval", ["Negate", ["Divide", "Pi", 4]], ["Divide", "Pi", 4]]]).evaluate();
  expect(result.operator).not.toBe("Interval");
});

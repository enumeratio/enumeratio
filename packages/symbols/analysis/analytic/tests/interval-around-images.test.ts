import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// enumeratio/enumeratio#113 §2: images of an Interval, and first-order Around propagation.
// Here: a decline case, and Gamma/Binomial, which have no examples for this yet. See tagged-calculus.ts for the shared
// derivative-sign-and-bisection rule both directions of this file share.

const ce = new ComputeEngine();
declareAnalytic(ce);

const json = (expr: unknown) => ce.box(expr as never).evaluate().json;

/** A plain double for one numeric leaf of an N()'d expression -- `.N()` on an out-of-range
 * or high-precision value serializes as `{num: "…"}`, not a bare JS number. */
const numAt = (expr: unknown, path: readonly number[]): number => {
  let node: unknown = ce.box(expr as never).N().json;
  for (const i of path) node = (node as readonly unknown[])[i];
  if (typeof node === "number") return node;
  if (typeof node === "object" && node !== null && typeof (node as { num?: unknown }).num === "string") {
    return Number((node as { num: string }).num);
  }
  throw new Error(`not a numeric leaf: ${JSON.stringify(node)}`);
};

/** Two floats agree up to the last-digit platform noise `settled()` also tolerates in the
 * reference test suite (packages/reference/tests/entries.test.ts). */
const closeTo = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(expected)));

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

test("Interval: Γ's interior extremum", () => {
  // Γ's minimum at x₀ ≈ 1.4616 sits inside [1.4, 1.5]: the lower endpoint is Γ(x₀), not
  // min(Γ(1.4), Γ(1.5)) — this is `imageOverArg`'s bisected-extremum path, not just a sorted
  // pair of endpoint evaluations.
  const gamma = ["Gamma", ["Interval", 1.4, 1.5]];
  expect(ce.box(gamma as never).evaluate().operator).toBe("Interval");
  closeTo(numAt(gamma, [1]), 0.8856031944108887);
  closeTo(numAt(gamma, [2]), 0.8872638175030753);
});

test("Interval: Binomial images over one fixed argument position", () => {
  const binomial = ["Binomial", ["Rational", 1, 2], ["Interval", 0.5, 0.6]];
  closeTo(numAt(binomial, [1]), 0.9281455538507054);
  closeTo(numAt(binomial, [2]), 1);
});

test("Around: propagation across Γ", () => {
  const gammaAround = json(["Gamma", ["Around", 2.5, 0.01]]) as [string, number, number];
  expect(gammaAround[0]).toBe("Around");
  closeTo(gammaAround[1], 1.329340388179137);
  closeTo(gammaAround[2], 0.009347345216260856);
});

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";

// XGCD(a, b) — Fungrim's name for native ExtendedGCD, which already returns Fungrim's
// shape: Tuple(g, s, t) with g = s·a + t·b.

export function evaluateXGCD(
  ce: ComputeEngine,
  a: BoxedExpression,
  b: BoxedExpression,
): BoxedExpression | undefined {
  return ce.box(["ExtendedGCD", a.json, b.json] as never).evaluate();
}

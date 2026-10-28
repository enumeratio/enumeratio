import type { Expression, ComputeEngine } from "@cortex-js/compute-engine";

// XGCD(a, b) — Fungrim's name for native ExtendedGCD, which already returns Fungrim's
// shape: Tuple(g, s, t) with g = s·a + t·b.

export function evaluateXGCD(ce: ComputeEngine, a: Expression, b: Expression): Expression | undefined {
  return ce.box(["ExtendedGCD", a.json, b.json] as never).evaluate();
}

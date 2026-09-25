import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { isRealInt } from "./box.ts";

// CongruentMod(a, b, m) — a ≡ b (mod m) for integers; m = 0 is equality. Goes through
// Mod so bigints stay exact.

export function evaluateCongruentMod(
  ce: ComputeEngine,
  a: BoxedExpression,
  b: BoxedExpression,
  m: BoxedExpression,
): BoxedExpression | undefined {
  if (!isRealInt(a) || !isRealInt(b) || !isRealInt(m)) return undefined;
  const test = m.re === 0 ? ["Equal", a.json, b.json] : ["Equal", ["Mod", ["Subtract", a.json, b.json], m.json], 0];
  return ce.box(test as never).evaluate();
}

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { isFiniteNum } from "./box.ts";

// Csgn(z) — the sign of Re z, falling back to the sign of Im z on the imaginary axis.

export function evaluateCsgn(ce: ComputeEngine, z: BoxedExpression): BoxedExpression | undefined {
  if (!isFiniteNum(z)) return undefined;
  const s = Math.sign(z.re) || Math.sign(z.im);
  return ce.number(s);
}

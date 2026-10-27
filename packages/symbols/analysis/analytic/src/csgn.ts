import type { Expression, ComputeEngine } from "@cortex-js/compute-engine";
import { isFiniteNum } from "@enumeratio/ce-patches";

// Csgn(z) — the sign of Re z, falling back to the sign of Im z on the imaginary axis.

export function evaluateCsgn(ce: ComputeEngine, z: Expression): Expression | undefined {
  if (!isFiniteNum(z)) return undefined;
  const s = Math.sign(z.re) || Math.sign(z.im);
  return ce.number(s);
}

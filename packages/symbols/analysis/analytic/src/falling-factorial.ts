import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { isRealInt } from "./box.ts";

// FallingFactorial(x, n) = x(x−1)…(x−n+1). Integer n: (−1)^n·Pochhammer(−x, n), exact and
// zero past a pole. Otherwise Γ(x+1)/Γ(x+1−n), numeric only.

export function evaluateFallingFactorial(
  ce: ComputeEngine,
  x: BoxedExpression,
  n: BoxedExpression,
  numeric: boolean,
): BoxedExpression | undefined {
  if (isRealInt(n)) {
    const r = ce.box(["Multiply", ["Power", -1, n.json], ["Pochhammer", ["Negate", x.json], n.json]] as never);
    return numeric ? r.N() : r.evaluate();
  }
  if (!numeric) return undefined;
  return ce
    .box(["Divide", ["Gamma", ["Add", x.json, 1]], ["Gamma", ["Subtract", ["Add", x.json, 1], n.json]]] as never)
    .N();
}

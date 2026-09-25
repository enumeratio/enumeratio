import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigRationalAt, operandsOf } from "@enumeratio/boxed";
import { isFiniteNum } from "./box.ts";

// UnitStep(x1, x2, …) — 0 where any argument is negative, 1 otherwise (1 at exactly 0,
// unlike Heaviside's ½ there). Wolfram's UnitStep is Listable, but a single list
// argument (thread element-wise) and several scalar arguments (the AND of their steps)
// are different shapes, so both are handled explicitly rather than via `broadcastable`,
// which only knows the first.

const isConcretelyComplex = (x: BoxedExpression): boolean => Number.isFinite(x.im) && x.im !== 0;

/** 0 or 1 for a single real argument, or `undefined` to decline (stay symbolic). */
function unitStepOf(x: BoxedExpression): 0 | 1 | undefined {
  if (isConcretelyComplex(x)) return undefined;
  const q = bigRationalAt(x);
  if (q !== undefined) return q[0] < 0n ? 0 : 1;
  const approx = isFiniteNum(x) ? x : x.N();
  if (!isFiniteNum(approx) || isConcretelyComplex(approx)) return undefined;
  return approx.re < 0 ? 0 : 1;
}

function evaluateUnitStep(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  if (ops.length === 1 && ops[0]?.operator === "List") {
    const elements = operandsOf(ops[0]);
    const mapped: BoxedExpression[] = [];
    for (const el of elements) {
      const v = unitStepOf(el);
      if (v === undefined) return undefined;
      mapped.push(ce.number(v));
    }
    return ce.function("List", mapped);
  }
  let zero = false;
  for (const op of ops) {
    const v = unitStepOf(op);
    if (v === undefined) return undefined;
    if (v === 0) zero = true;
  }
  return ce.number(zero ? 0 : 1);
}

export function declareUnitStep(ce: ComputeEngine): void {
  ce.declare("UnitStep", {
    signature: "(number | list<number>, number*) -> number | list<number>",
    evaluate: (ops: readonly BoxedExpression[]) => evaluateUnitStep(ce, ops),
  });
}

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigRationalAt } from "@enumeratio/boxed";
import { isFiniteNum } from "./box.ts";

// IntegerPart(x) and FractionalPart(x) — truncation toward 0, split into its two halves.
// Both are new heads: compute-engine's own `Fract` keeps its result in [0, 1) regardless
// of x's sign, where Wolfram's FractionalPart keeps x's sign (FractionalPart(-7/2) is
// -1/2, not 1/2), and there is no native IntegerPart at all.
//
// An exact rational truncates exactly, via BigInt division (which already truncates
// toward 0). A genuine float truncates as a float. A symbolic exact real with a finite
// `.re` already on it (Pi, E, …) truncates to an exact integer and — for FractionalPart —
// keeps the remainder symbolic (`FractionalPart(Pi)` is `Pi - 3`, not a decimal): Wolfram's
// own IntegerPart/FractionalPart stay exact there too. A concretely complex operand,
// finite, truncates component-wise (IntegerPart only — Wolfram doesn't extend
// FractionalPart's sign convention to the complex plane, and neither example calls for it).

const isConcretelyComplex = (x: BoxedExpression): boolean => Number.isFinite(x.im) && x.im !== 0;

function evaluateIntegerPart(
  ce: ComputeEngine,
  x: BoxedExpression | undefined,
): BoxedExpression | undefined {
  if (x === undefined) return undefined;
  if (x.im === 0) {
    const q = bigRationalAt(x);
    if (q !== undefined) return ce.number(q[0] / q[1]); // BigInt division truncates toward 0
  }
  const approx = isFiniteNum(x) ? x : x.N();
  if (!isFiniteNum(approx)) return undefined; // no numeric handle — stay symbolic
  if (approx.im !== 0) return ce.number(ce.complex(Math.trunc(approx.re), Math.trunc(approx.im)));
  return ce.number(Math.trunc(approx.re));
}

function evaluateFractionalPart(
  ce: ComputeEngine,
  x: BoxedExpression | undefined,
): BoxedExpression | undefined {
  if (x === undefined) return undefined;
  if (isConcretelyComplex(x)) return undefined; // real domain only
  const q = bigRationalAt(x);
  if (q !== undefined) {
    const [p, d] = q;
    const n = p / d; // truncated toward 0
    return ce.number([p - n * d, d]);
  }
  if ((x as { isExact?: boolean }).isExact === false) return ce.number(x.re - Math.trunc(x.re));
  if (!Number.isFinite(x.re)) return undefined; // a compound exact expression: no handle
  return ce.function("Subtract", [x, ce.number(Math.trunc(x.re))]).evaluate();
}

export function declareIntegerFractionalPart(ce: ComputeEngine): void {
  ce.declare("IntegerPart", {
    signature: "(number) -> number",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => evaluateIntegerPart(ce, ops[0]),
  });

  ce.declare("FractionalPart", {
    signature: "(number) -> number",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => evaluateFractionalPart(ce, ops[0]),
  });
}

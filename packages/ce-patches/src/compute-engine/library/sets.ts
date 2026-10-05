import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, operandsOf, symbolNameOf, wrapOperator } from "@enumeratio/engine";

// cortex-js/compute-engine: `QuotientRing(Integers, m)` counts its m residue classes, but the
// `count` handler answers a double, so `Count` of ℤ/(2^61 − 1)ℤ stays unevaluated.

/** `m` of `QuotientRing(Integers, m)`, for an integer `m ≥ 1`. */
export function integerQuotientModulus(expr: BoxedExpression): bigint | undefined {
  if (expr.operator !== "QuotientRing") return undefined;
  const [base, m] = operandsOf(expr);
  if (base === undefined || symbolNameOf(base) !== "Integers") return undefined;
  const modulus = bigIntegerAt(m);
  return modulus !== undefined && modulus >= 1n ? modulus : undefined;
}

/** The largest count a collection's `count` handler, a double, holds exactly. */
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/** `Count(QuotientRing(Integers, m))` is the exact integer m past 2^53, not the nearest double. */
export function quotientRingExactCount(ce: ComputeEngine): void {
  const exactCount = (ops: readonly BoxedExpression[]): bigint | undefined => {
    const m = ops.length === 1 ? integerQuotientModulus(ops[0] as BoxedExpression) : undefined;
    return m !== undefined && m > MAX_SAFE ? m : undefined;
  };
  wrapOperator(
    ce,
    ["Count", ["QuotientRing", "Integers", 1]],
    (ops) => exactCount(ops) !== undefined,
    () => (ops) => ce.number(exactCount(ops) as bigint),
    1,
  );
}

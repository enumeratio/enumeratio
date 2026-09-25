import { type BoxedExpression, type ComputeEngine, isNumber } from "@cortex-js/compute-engine";

/** Above this many digits a double is no longer the limiting factor — and neither should we be. */
export const DOUBLE_DIGITS = 15;

/**
 * `value` rounded to the digits the engine was actually asked for, or undefined if it is not
 * a number at all.
 *
 * compute-engine lets a bignum product carry more digits than its operands had — real for
 * `Sin(1)·Cos(1)`, and worse for anything we assemble out of natives, where the tail is the
 * truncation error rather than merely unwarranted. A head should hand back the precision it
 * claims and no more, so every routed result goes through here.
 */
export function atEnginePrecision(
  ce: ComputeEngine,
  value: BoxedExpression,
): BoxedExpression | undefined {
  if (!isNumber(value)) return undefined;
  const big = value.bignumRe;
  return big === undefined ? value : ce.number(big.toPrecision(ce.precision));
}

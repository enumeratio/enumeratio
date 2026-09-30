import { type BigDecimal, type BoxedExpression, type ComputeEngine, isNumber } from "@cortex-js/compute-engine";

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
export function atEnginePrecision(ce: ComputeEngine, value: BoxedExpression): BoxedExpression | undefined {
  if (!isNumber(value)) return undefined;
  const big = value.bignumRe;
  return big === undefined ? value : ce.number(big.toPrecision(ce.precision));
}

/**
 * `compute()` run with `guard` extra digits of working precision, its result rounded back
 * to the caller's — for a formula whose own arithmetic loses the last few.
 */
export function withGuardDigits(ce: ComputeEngine, compute: () => BoxedExpression, guard = 10): BoxedExpression {
  const precision = ce.precision;
  ce.precision = precision + guard;
  let value: BoxedExpression;
  try {
    value = compute();
  } finally {
    ce.precision = precision;
  }
  return atEnginePrecision(ce, value) ?? value;
}

/**
 * A real operand as a decimal to the engine's precision, for an arbitrary-precision kernel --
 * or undefined when the engine asks for no more than a double (the double kernel is then the
 * better trade) or `x` is not a finite real number.
 */
export function bigRealOperand(ce: ComputeEngine, x: BoxedExpression): BigDecimal | undefined {
  if (ce.precision <= DOUBLE_DIGITS || x.im !== 0 || !Number.isFinite(x.re)) return undefined;
  return x.bignumRe ?? ce.bignum(x.re);
}

/** An arbitrary-precision kernel's value, boxed at the engine's precision. */
export const bigResult = (ce: ComputeEngine, value: BigDecimal): BoxedExpression =>
  ce.number(value.toPrecision(ce.precision));

/**
 * Does `ce` evaluate `expr` numerically to more than a double's digits? Asked at precision
 * 30, restoring the engine's own precision after: a patch's `fixed` runs on the live engine.
 */
export function answersPastDouble(ce: ComputeEngine, expr: unknown): boolean {
  const saved = ce.precision;
  try {
    ce.precision = 30;
    const json = ce.box(expr as never).N().json as unknown;
    const text = typeof json === "object" && json !== null && "num" in json ? String(json.num) : "";
    return text.replace(/^-?0*\.?0*/, "").replace(/\D/g, "").length > DOUBLE_DIGITS + 2;
  } finally {
    ce.precision = saved;
  }
}

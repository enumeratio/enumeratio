import { type BoxedExpression, type ComputeEngine, isNumber } from "@cortex-js/compute-engine";
import { wrapOperator } from "@enumeratio/engine";
import { DOUBLE_DIGITS } from "../../support/precise.ts";

/**
 * `Argument` of a complex number literal runs in doubles: `N(Argument(e + i pi), 20)` answers
 * 0.85751178635584627029, of which the last three digits are noise (atan2(pi, e) is
 * 0.85751178635584626501). `Arctan2` is bignum-backed, so a numeric request past a double's
 * digits sends a finite literal whose parts are bignums through it: Arg(x + iy) = atan2(y, x).
 * A machine float (0.1 + 0.2i) stays a machine float.
 */
export function evaluateArgumentDigits(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Argument"],
    (ops) => ops.length === 1 && isComplexLiteral(ops[0]!),
    (native) => (ops, options) => {
      const [z] = ops as [BoxedExpression];
      if (!options.numericApproximation || ce.precision <= DOUBLE_DIGITS || !hasBignumPart(z))
        return native?.(ops, options);
      const part = (big: unknown, double: number): BoxedExpression =>
        big === undefined ? ce.number(double) : ce.number(big as never);
      return ce.function("Arctan2", [part(z.bignumIm, z.im), part(z.bignumRe, z.re)]).N();
    },
    { arity: 1, compile: "builtin" },
  );
}

/** A finite number literal with an imaginary part. */
const isComplexLiteral = (z: BoxedExpression): boolean =>
  isNumber(z) && z.im !== 0 && Number.isFinite(z.re) && Number.isFinite(z.im);

/** Either part carries more digits than a machine double holds: a literal `N` already widened. */
const hasBignumPart = (z: BoxedExpression): boolean =>
  isNumber(z) &&
  [z.bignumRe, z.bignumIm].some((part) => part !== undefined && !part.toPrecision(DOUBLE_DIGITS + 2).eq(part));

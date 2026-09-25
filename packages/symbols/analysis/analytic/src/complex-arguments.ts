import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { wrapOperator } from "@enumeratio/boxed";
import { isFiniteNum, numberResult, wantsNumber } from "./box.ts";
import { add, cexp, sub } from "./complex.ts";
import { logGamma } from "./loggamma.ts";
import { digamma } from "./polygamma.ts";

// Complex arguments that native Digamma and Beta decline, in double precision on the
// package's complex kernels: ψ(z) directly, and B(a, b) = exp(lnΓ(a) + lnΓ(b) − lnΓ(a + b)).
// Numeric only, as for real arguments: a float in, or N() asked.

const isComplexValue = (op: BoxedExpression | undefined): boolean => op !== undefined && isFiniteNum(op) && op.im !== 0;

export function declareComplexArguments(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Digamma", 1],
    (ops) => isComplexValue(ops[0]),
    (native) => (ops, options) =>
      wantsNumber(ops, options)
        ? numberResult(ce, digamma({ re: ops[0]!.re, im: ops[0]!.im }))
        : native?.(ops, options),
    1,
  );

  wrapOperator(
    ce,
    ["Beta", 1, 1],
    (ops) => ops.every(isFiniteNum) && ops.some(isComplexValue),
    (native) => (ops, options) => {
      if (!wantsNumber(ops, options)) return native?.(ops, options);
      const [a, b] = ops as [BoxedExpression, BoxedExpression];
      const [x, y] = [
        { re: a.re, im: a.im },
        { re: b.re, im: b.im },
      ];
      return numberResult(ce, cexp(sub(add(logGamma(x), logGamma(y)), logGamma(add(x, y)))));
    },
    2,
  );
}

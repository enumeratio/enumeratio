import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { wrapOperator } from "@enumeratio/engine";
import { isFiniteNum, numberResult, wantsNumber, add, cexp, sub, logGamma, digamma } from "@enumeratio/ce-patches";

// Complex arguments that native Digamma and Beta decline, in double precision on the
// package's complex kernels: ψ(z) directly, and B(a, b) = exp(lnΓ(a) + lnΓ(b) − lnΓ(a + b)).
// Numeric only, as for real arguments: a float in, or N() asked.

const isComplexValue = (op: BoxedExpression | undefined): boolean => op !== undefined && isFiniteNum(op) && op.im !== 0;

export function declareComplexArguments(ce: ComputeEngine): void {
  // compile builtin: complex operands only, which the built-in lowering handles or refuses itself
  wrapOperator(
    ce,
    ["Digamma", 1],
    (ops) => isComplexValue(ops[0]),
    (native) => (ops, options) =>
      wantsNumber(ops, options)
        ? numberResult(ce, digamma({ re: ops[0]!.re, im: ops[0]!.im }))
        : native?.(ops, options),
    { arity: 1, compile: "builtin" },
  );

  // compile builtin: complex operands only, which the built-in lowering handles or refuses itself
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
    { arity: 2, compile: "builtin" },
  );
}

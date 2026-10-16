// Binary splitting for Factorial(n), tracked at
// https://github.com/enumeratio/enumeratio/issues/205: native Factorial is a sequential
// `result *= k` loop over bigints (same O(n · digits) shape as the native Fibonacci/LucasL
// loops fast-recurrence.ts replaces); a balanced product tree does the same exact
// multiplication in far fewer, far-better-balanced bigint multiplications.
//
// `Mod(Factorial(n), p)` never builds n!: declare-modular-kernels.ts answers it modulo p.
import { bigIntegerAt, wrapOperator, type Engine, type Expr } from "@enumeratio/engine";
import { factorial } from "./fast-factorial.ts";

/** Above this, n! would run past ~1M decimal digits; native Factorial (or a documented
 *  Gamma-function extension) still answers past here, just slower. */
const FAST_FACTORIAL_LIMIT = 200_000n;

export function declareFastFactorial(ce: Engine): void {
  const fitsFastRange = (op: Expr): bigint | undefined => {
    const n = bigIntegerAt(op);
    return n !== undefined && n >= 0n && n <= FAST_FACTORIAL_LIMIT ? n : undefined;
  };

  // compile builtin: an exact integer's exact value: where a double can hold it the lowering gives the same
  wrapOperator(
    ce,
    ["Factorial", 100000],
    (ops) => fitsFastRange(ops[0]) !== undefined,
    () => (ops) => ce.number(factorial(fitsFastRange(ops[0])!)),
    { arity: 1, compile: "builtin" },
  );
}

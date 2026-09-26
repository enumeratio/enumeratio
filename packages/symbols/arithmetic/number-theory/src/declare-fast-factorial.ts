// Binary splitting for Factorial(n), tracked at
// https://github.com/enumeratio/enumeratio/issues/205: native Factorial is a sequential
// `result *= k` loop over bigints (same O(n · digits) shape as the native Fibonacci/LucasL
// loops fast-recurrence.ts replaces); a balanced product tree does the same exact
// multiplication in far fewer, far-better-balanced bigint multiplications.
//
// `Mod(Factorial(n), p)` was the actual bench case, but reducing mod p *during* the
// splitting (skipping the exact value) would need a `canonical` hook on `Mod` itself, which
// declare-fast-recurrence.ts found unsafe to attach to a native head with no canonical of
// its own (see that file's comment). Not needed here either: Factorial(100000) alone drops
// from ~2.8s to ~30ms, and Mod's own reduction of that value is a single cheap division.
import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, wrapOperator } from "@enumeratio/boxed";
import { factorial } from "./fast-factorial.ts";

/** Above this, n! would run past ~1M decimal digits; native Factorial (or a documented
 *  Gamma-function extension) still answers past here, just slower. */
const FAST_FACTORIAL_LIMIT = 200_000n;

export function declareFastFactorial(ce: ComputeEngine): void {
  const fitsFastRange = (op: BoxedExpression): bigint | undefined => {
    const n = bigIntegerAt(op);
    return n !== undefined && n >= 0n && n <= FAST_FACTORIAL_LIMIT ? n : undefined;
  };

  wrapOperator(
    ce,
    ["Factorial", 100000],
    (ops) => fitsFastRange(ops[0]) !== undefined,
    () => (ops) => ce.number(factorial(fitsFastRange(ops[0])!)),
    1,
  );
}

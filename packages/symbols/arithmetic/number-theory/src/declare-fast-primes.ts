// Segmented-sieve PrimePi/NthPrime, tracked at
// https://github.com/enumeratio/enumeratio/issues/205: native PrimePi is an O(n) trial-
// division loop, and native NthPrime the same past an ever-growing candidate; a segmented
// sieve answers both exactly in O(n log log n). Exact, never approximate; declines past
// `PRIME_SIEVE_LIMIT` (see sieve.ts) rather than sieve for minutes.
//
// compute-engine's own "Prime" head is derivative notation (f′, f''), unrelated to nth-
// prime -- an earlier version of this file widened it to answer a plain positive-integer
// argument as a Wolfram-style nth-prime shortcut, but that overloads a head compute-engine
// already owns for something else entirely. NthPrime is (and stays) the only head name for
// it on our side; the crosswalk already maps NthPrime <-> Wolfram's Prime.
import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, wrapOperator } from "@enumeratio/boxed";
import { nthPrime, PRIME_SIEVE_LIMIT, primeCountUpTo } from "@enumeratio/residues";

export function declareFastPrimes(ce: ComputeEngine): void {
  /** A plain, non-negative, safe-integer real — the only shape π/nth-prime answer exactly. */
  const nonNegativeSafeInteger = (op: BoxedExpression): number | undefined => {
    const n = integerAt(op);
    return n !== undefined && n >= 0 ? n : undefined;
  };

  wrapOperator(
    ce,
    ["PrimePi", 10000000],
    (ops) => {
      const n = nonNegativeSafeInteger(ops[0]);
      return n !== undefined && n <= PRIME_SIEVE_LIMIT;
    },
    () => (ops) => ce.number(primeCountUpTo(nonNegativeSafeInteger(ops[0])!)),
    1,
  );

  const positiveIndex = (op: BoxedExpression): number | undefined => {
    const n = integerAt(op);
    return n !== undefined && n >= 1 ? n : undefined;
  };

  wrapOperator(
    ce,
    ["NthPrime", 100000],
    (ops) => {
      const n = positiveIndex(ops[0]);
      return n !== undefined && nthPrime(n) !== undefined;
    },
    () => (ops) => ce.number(nthPrime(positiveIndex(ops[0])!)!),
    1,
  );
}

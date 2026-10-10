// PrimePi/NthPrime, tracked at https://github.com/enumeratio/enumeratio/issues/205: native
// PrimePi is an O(n) trial-division loop, and native NthPrime the same past an ever-growing
// candidate. Below `PRIME_SIEVE_LIMIT` a segmented sieve answers both exactly in
// O(n log log n); past it, the Lucy_Hedgehog method counts (and, for NthPrime, brackets and
// locates) in O(x^(3/4)) — see sieve.ts — up to `PRIME_PI_LIMIT` for NthPrime; PrimePi from
// 10^11 on uses the combinatorial count in O(x^(2/3)) (prime-count.ts), up to
// `PRIME_COUNT_LIMIT`. Exact, never approximate, on every tier; each declines past its limit
// rather than run for minutes.
//
// compute-engine's own "Prime" head is derivative notation (f′, f''), unrelated to nth-
// prime -- an earlier version of this file widened it to answer a plain positive-integer
// argument as a Wolfram-style nth-prime shortcut, but that overloads a head compute-engine
// already owns for something else entirely. NthPrime is (and stays) the only head name for
// it on our side; the crosswalk already maps NthPrime <-> Wolfram's Prime.
import { integerAt, isNumber, wrapOperator, type Engine, type Expr } from "@enumeratio/engine";
import { nthPrime, primeCount } from "@enumeratio/residues";

export function declareFastPrimes(ce: Engine): void {
  /** A plain, non-negative, safe-integer real — the only shape π/nth-prime answer exactly. */
  const nonNegativeSafeInteger = (op: Expr): number | undefined => {
    const n = integerAt(op);
    return n !== undefined && n >= 0 ? n : undefined;
  };

  wrapOperator(
    ce,
    ["PrimePi", 10000000],
    // Any literal non-negative integer: past the limit the handler declines, since the native
    // fallback is an O(n) loop that grinds to its iteration cap.
    (ops) => isNumber(ops[0]) && ops[0].isInteger === true && ops[0].isNegative !== true,
    () => (ops) => {
      const n = nonNegativeSafeInteger(ops[0]);
      const count = n === undefined ? undefined : primeCount(n);
      return count === undefined ? undefined : ce.number(count);
    },
    1,
  );

  const positiveIndex = (op: Expr): number | undefined => {
    const n = integerAt(op);
    return n !== undefined && n >= 1 ? n : undefined;
  };

  wrapOperator(
    ce,
    ["NthPrime", 100000],
    (ops) => isNumber(ops[0]) && ops[0].isInteger === true && ops[0].isPositive === true,
    () => (ops) => {
      const n = positiveIndex(ops[0]);
      const p = n === undefined ? undefined : nthPrime(n);
      return p === undefined ? undefined : ce.number(p);
    },
    1,
  );
}

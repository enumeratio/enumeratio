// GCD for real bigints, tracked at https://github.com/enumeratio/enumeratio/issues/205:
// compute-engine's native GCD folds a plain Euclidean algorithm (`x, y = y, x % y`) over its
// operands. `declare-gaussian.ts` already carries GCD into ℤ[i] when an operand is genuinely
// complex, but a call where every operand is a real integer — the common case, and the
// bench's 10000-bit pair — still falls through to that native Euclid. Below
// `LEHMER_THRESHOLD_BITS` this uses @enumeratio/residues' Stein binary `gcd` (shifts and
// subtraction beat a bigint division at these sizes too, and it's already well exercised);
// above it, Lehmer's algorithm (leading-digit simulation, HAC 14.4) wins by turning most of
// Euclid's O(log n) full-width divisions into a handful of them.
import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, wrapOperator } from "@enumeratio/boxed";
import { gcd, lehmerGcd } from "@enumeratio/residues";

// Chosen well above Lehmer's own internal small-number cutoff (2^32) so the hybrid only
// pays for the leading-digit simulation once operands are large enough for it to pay off.
const LEHMER_THRESHOLD_BITS = 512;

function hybridGcd(a: bigint, b: bigint): bigint {
  const bits = (n: bigint): number => (n < 0n ? -n : n).toString(2).length;
  return Math.max(bits(a), bits(b)) >= LEHMER_THRESHOLD_BITS ? lehmerGcd(a, b) : gcd(a, b);
}

export function declareFastGcd(ce: ComputeEngine): void {
  /** Every operand a plain real bigint (so genuinely-Gaussian calls fall through to
   *  declare-gaussian.ts's wrapper, attached ahead of this one). */
  const allRealIntegers = (ops: readonly BoxedExpression[]): bigint[] | undefined => {
    const values: bigint[] = [];
    for (const op of ops) {
      const n = bigIntegerAt(op);
      if (n === undefined) return undefined;
      values.push(n);
    }
    return values;
  };

  wrapOperator(
    ce,
    ["GCD", 100000, 100000],
    (ops) => allRealIntegers(ops) !== undefined,
    // Folds from 0n (gcd(0, x) = |x|), so a single operand or an empty call both take the
    // same path as two-or-more, rather than needing a special case for either.
    () => (ops) => ce.number(allRealIntegers(ops)!.reduce((a, b) => hybridGcd(a, b), 0n)),
  );
}

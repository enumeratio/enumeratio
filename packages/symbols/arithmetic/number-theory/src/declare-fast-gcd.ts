// Binary GCD for real bigints, tracked at
// https://github.com/enumeratio/enumeratio/issues/205: compute-engine's native GCD folds a
// plain Euclidean algorithm (`x, y = y, x % y`) over its operands. `declare-gaussian.ts`
// already carries GCD into ℤ[i] when an operand is genuinely complex, but a call where every
// operand is a real integer — the common case, and the bench's 10000-bit pair — still falls
// through to that native Euclid. @enumeratio/residues' own `gcd` is Stein's binary GCD
// (shifts and subtraction, no division): about 2x faster on large, balanced bigints
// (measured at 10000 bits), since a full-size division costs more than a shift.
import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, wrapOperator } from "@enumeratio/boxed";
import { gcd } from "@enumeratio/residues";

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
    () => (ops) => ce.number(allRealIntegers(ops)!.reduce((a, b) => gcd(a, b), 0n)),
  );
}

// Rational reconstruction: the fraction n/d that a residue a (mod m) is the image of.
//
// ℤ/m sees a fraction n/d with gcd(d, m) = 1 as n·d⁻¹. Going back is not unique — every
// residue is the image of infinitely many fractions — but it is when the fraction is
// SMALL: if 2·N·D < m there is at most one n/d with |n| ≤ N, 0 < d ≤ D and n ≡ a·d (mod m).
// Wang's algorithm finds it by running the extended Euclidean algorithm on (m, a) and
// stopping at the first remainder no larger than N. That is what makes multi-modular
// computation work: compute an exact rational answer modulo several primes, glue the
// images with ChineseRemainder, and read the fraction back once the product of the primes
// is large enough.

import { gcd, isqrt, mod } from "@enumeratio/residues";

/**
 * The fraction n/d with n ≡ a·d (mod m), |n| ≤ N, 0 < d ≤ D and gcd(n, d) = 1, as [n, d];
 * undefined when there is none. N defaults to ⌊√((m − 1)/2)⌋ and D to the largest bound
 * keeping 2·N·D < m, under which the answer is unique.
 */
export function rationalReconstruction(
  a: bigint,
  m: bigint,
  numeratorBound?: bigint,
  denominatorBound?: bigint,
): [bigint, bigint] | undefined {
  if (m < 1n) return undefined;
  const balanced = isqrt((m - 1n) / 2n);
  const bound = numeratorBound ?? balanced;
  const denominatorLimit =
    denominatorBound ??
    (numeratorBound === undefined || bound === 0n ? balanced : (m - 1n) / (2n * bound));
  let [r0, r1] = [m, mod(a, m)];
  let [t0, t1] = [0n, 1n];
  while (r1 > bound) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [t0, t1] = [t1, t0 - q * t1];
  }
  if (t1 === 0n) return undefined;
  const [n, d] = t1 < 0n ? [-r1, -t1] : [r1, t1];
  if (d > denominatorLimit || gcd(n, d) !== 1n) return undefined;
  return [n, d];
}

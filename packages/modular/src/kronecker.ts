// The Kronecker symbol (a/n): the full extension of the Jacobi symbol to every integer
// n (odd or even, positive, negative, or zero). compute-engine 0.128 ships JacobiSymbol
// natively (odd n > 0 only) and LegendreSymbol (odd prime p) — this fills the gap above
// them rather than re-deriving what they already do.
//
// Standard definition (see e.g. Wikipedia, "Kronecker symbol"):
//   (a/0)  = 1 if a = ±1, else 0
//   (a/-1) = 1 if a ≥ 0, -1 if a < 0
//   (a/2)  = 0 if a even; 1 if a ≡ ±1 (mod 8); -1 if a ≡ ±3 (mod 8)
//   (a/n) is completely multiplicative in n: factor n = u·2^e·m (u = ±1 the sign, m odd
//   positive) and (a/n) = (a/u)·(a/2)^e·(a/m).
//
// The odd part (a/m) for m odd positive coincides exactly with the Jacobi symbol — Jacobi
// is already multiplicative over m's factorization with multiplicity, prime or not — so it
// is computed by the same reciprocity recursion CE's own JacobiSymbol uses, in bigint
// throughout for exactness past the double-precision range.

/** (a/2): 0 if a is even, else ±1 by a mod 8. */
function kroneckerTwo(a: bigint): bigint {
  const r = ((a % 8n) + 8n) % 8n;
  if (r % 2n === 0n) return 0n;
  return r === 1n || r === 7n ? 1n : -1n;
}

/** The Jacobi symbol (a/m) for odd m > 0, by quadratic-reciprocity recursion. */
function jacobiOddPositive(a: bigint, m: bigint): bigint {
  let aa = a % m;
  if (aa < 0n) aa += m;
  let mm = m;
  let result = 1n;
  while (aa !== 0n) {
    while (aa % 2n === 0n) {
      aa /= 2n;
      const r = mm % 8n;
      if (r === 3n || r === 5n) result = -result;
    }
    [aa, mm] = [mm, aa];
    if (aa % 4n === 3n && mm % 4n === 3n) result = -result;
    aa %= mm;
  }
  return mm === 1n ? result : 0n;
}

/** The Kronecker symbol (a/n), for any integers a and n. */
export function kroneckerSymbol(a: bigint, n: bigint): bigint {
  if (n === 0n) return a === 1n || a === -1n ? 1n : 0n;

  let result = 1n;
  let m = n;
  if (m < 0n) {
    m = -m;
    if (a < 0n) result = -result;
  }

  let e = 0n;
  while (m % 2n === 0n) {
    m /= 2n;
    e += 1n;
  }
  if (e > 0n) {
    const two = kroneckerTwo(a);
    if (two === 0n) return 0n;
    if (e % 2n === 1n) result *= two;
  }

  return m === 1n ? result : result * jacobiOddPositive(a, m);
}

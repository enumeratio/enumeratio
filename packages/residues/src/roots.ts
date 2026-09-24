// Every r-th root of a residue: all x in [0, m) with xʳ ≡ b (mod m).
//
// By CRT the problem splits over the prime powers of m, and a root mod m is one root per
// channel, every combination. Within a channel p^e:
//
//   mod p     (ℤ/p)* is cyclic of order n = p − 1, so xʳ = b is solvable iff b^(n/d) = 1,
//             d = gcd(r, n), and then there are exactly d roots: one root times the d-th
//             roots of unity. One root is assembled Sylow subgroup by Sylow subgroup — only
//             the primes q dividing r need a discrete log, and that happens inside the
//             q-part of the group, whose order is a power of q. So p − 1 is never factored,
//             and a 30-digit p costs a handful of exponentiations.
//   mod p^e   Hensel: a root x mod p^k with f'(x) = r·x^(r−1) ≢ 0 (mod p) lifts to exactly
//             one root mod p^(k+1); a singular one (p | r, or p | x) lifts to all p of its
//             lifts or to none, by whether f(x) ≡ 0 already holds mod p^(k+1).
//
// The only thing that can make this slow is the SIZE of the answer — x² ≡ 0 mod p^(2k) has
// p^k roots — so the enumeration is capped at `MAX_ROOTS` and answers undefined past it.
// And the only thing that can make it impossible is factoring m.

import { invMod, mod, powMod } from "./arith.ts";
import { type Group, rootsInCyclicGroup } from "./cyclic.ts";
import { factorInteger } from "./primes.ts";

/** The most roots `powerModRoots` will list. */
export const MAX_ROOTS = 100_000;

/** Below this a prime's roots are found by scanning [0, p). */
const SCAN_PRIME = 64n;

/** (ℤ/m)* as a group — or any subgroup of it, which is how the discrete logs use it. */
export const unitsMod = (m: bigint): Group<bigint> => ({
  one: 1n % m,
  mul: (a, b) => (a * b) % m,
  pow: (a, e) => powMod(a, e, m),
  inverse: (a) => invMod(a, m) ?? 0n,
  equal: (a, b) => a === b,
  key: (a) => a,
});

function* from2(p: bigint): Iterable<bigint> {
  for (let c = 2n; c < p; c++) yield c;
}

/** Every x in [0, p) with xʳ ≡ b (mod p), p prime and b ≢ 0, ascending; undefined past the cap. */
function rootsModPrimeUnit(b: bigint, r: bigint, p: bigint): bigint[] | undefined {
  return rootsInCyclicGroup(unitsMod(p), p - 1n, b, r, () => from2(p), MAX_ROOTS)?.sort((x, y) =>
    x < y ? -1 : x > y ? 1 : 0,
  );
}

/** Every x in [0, p^e) with xʳ ≡ b, ascending; undefined past the cap. */
function rootsModPrimePower(b: bigint, r: bigint, p: bigint, e: number): bigint[] | undefined {
  const target = mod(b, p ** BigInt(e));
  let roots: bigint[] | undefined;
  if (p <= SCAN_PRIME) {
    roots = [];
    for (let x = 0n; x < p; x++) if (powMod(x, r, p) === target % p) roots.push(x);
  } else {
    roots = target % p === 0n ? [0n] : rootsModPrimeUnit(target, r, p);
  }
  if (roots === undefined) return undefined;
  let modulus = p;
  for (let k = 1; k < e && roots.length > 0; k++) {
    const next = modulus * p;
    const lifted: bigint[] = [];
    for (const x of roots) {
      const value = mod(powMod(x, r, next) - target, next); // ≡ 0 mod p^k
      const slope = mod(r * powMod(x, r - 1n, p), p);
      if (slope !== 0n) {
        const t = mod(-(value / modulus) * invMod(slope, p)!, p);
        lifted.push(x + t * modulus);
      } else if (value === 0n) {
        if (lifted.length + Number(p) > MAX_ROOTS) return undefined;
        for (let t = 0n; t < p; t++) lifted.push(x + t * modulus);
      }
    }
    roots = lifted;
    modulus = next;
  }
  return roots.sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
}

/**
 * Every x in [0, m) with xʳ ≡ b (mod m), ascending, for r ≥ 1 and m ≥ 1. Undefined when m
 * cannot be factored within budget or there would be more than `MAX_ROOTS` roots.
 */
export function powerModRoots(b: bigint, r: bigint, m: bigint): bigint[] | undefined {
  if (r < 1n || m < 1n) return undefined;
  if (m === 1n) return [0n];
  const factors = factorInteger(m);
  if (factors === undefined) return undefined;
  const channels: { modulus: bigint; roots: bigint[] }[] = [];
  let count = 1;
  for (const [p, e] of factors) {
    const roots = rootsModPrimePower(b, r, p, e);
    if (roots === undefined) return undefined;
    if (roots.length === 0) return [];
    count *= roots.length;
    if (count > MAX_ROOTS) return undefined;
    channels.push({ modulus: p ** BigInt(e), roots });
  }
  // Glue channel by channel: a root y mod M·q from x mod M and c mod q is x + M·((c − x)·M⁻¹
  // mod q) — one inverse per channel rather than a full CRT per combination.
  let glued = [0n];
  let combined = 1n;
  for (const { modulus, roots } of channels) {
    const inverse = invMod(combined, modulus) ?? 0n;
    glued = glued.flatMap((x) => roots.map((c) => x + combined * mod((c - x) * inverse, modulus)));
    combined *= modulus;
  }
  return glued.sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
}

/**
 * Wolfram's `PowerModList[a, s/r, m]`: every x in [0, m) with xʳ ≡ aˢ (mod m). A rational
 * a = u/v is read in ℤ/m as u·v⁻¹; a negative s inverts. Where aˢ does not exist in ℤ/m —
 * a non-unit raised to a negative power, or a denominator sharing a factor with m — there
 * is no such x, and the answer is empty, as for Wolfram's `PowerModList[a, -1, m]`.
 */
export function powerModList(
  a: readonly [bigint, bigint],
  s: bigint,
  r: bigint,
  m: bigint,
): bigint[] | undefined {
  if (r < 1n || m < 1n) return undefined;
  const [numerator, denominator] = a;
  const denominatorInverse = invMod(denominator, m);
  if (denominatorInverse === undefined) return [];
  let base = mod(numerator * denominatorInverse, m);
  if (s < 0n) {
    const inverse = invMod(base, m);
    if (inverse === undefined) return [];
    base = inverse;
  }
  return powerModRoots(powMod(base, s < 0n ? -s : s, m), r, m);
}

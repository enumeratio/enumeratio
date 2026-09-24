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

import { gcd, invMod, isqrt, mod, powMod, valuation } from "./arith.ts";
import { factorInteger } from "./primes.ts";

/** The most roots `powerModRoots` will list. */
export const MAX_ROOTS = 100_000;

/** The largest prime order a discrete log is attempted in: baby-step giant-step keeps √q steps. */
export const BSGS_LIMIT = 1n << 40n;

/** Below this a prime's roots are found by scanning [0, p). */
const SCAN_PRIME = 64n;

/** Distinct prime factors of a small positive integer, ascending. */
function smallPrimeFactors(n: bigint): bigint[] {
  const primes: bigint[] = [];
  let rest = n;
  for (let q = 2n; q * q <= rest; q++) {
    if (rest % q !== 0n) continue;
    primes.push(q);
    while (rest % q === 0n) rest /= q;
  }
  if (rest > 1n) primes.push(rest);
  return primes;
}

/**
 * x with γˣ = h in a group of prime order q, by baby-step giant-step; undefined if none, or
 * if q is past `BSGS_LIMIT`.
 */
export function discreteLogPrimeOrder(
  gamma: bigint,
  h: bigint,
  q: bigint,
  p: bigint,
): bigint | undefined {
  if (h === 1n) return 0n;
  if (q > BSGS_LIMIT) return undefined;
  if (q <= 64n) {
    let power = 1n;
    for (let x = 0n; x < q; x++, power = (power * gamma) % p) if (power === h) return x;
    return undefined;
  }
  const step = isqrt(q - 1n) + 1n;
  const baby = new Map<bigint, bigint>();
  let power = 1n;
  for (let j = 0n; j < step; j++, power = (power * gamma) % p) {
    if (!baby.has(power)) baby.set(power, j);
  }
  const giant = invMod(powMod(gamma, step, p), p)!;
  let target = h;
  for (let i = 0n; i < step; i++, target = (target * giant) % p) {
    const j = baby.get(target);
    if (j !== undefined) return i * step + j;
  }
  return undefined;
}

/**
 * x with aˣ = h, where a has order q^s modulo p (p need not be prime — any modulus in which
 * a and h are units), by Pohlig–Hellman digit by digit; undefined when h ∉ ⟨a⟩.
 */
export function discreteLogPrimePower(
  a: bigint,
  h: bigint,
  q: bigint,
  s: number,
  p: bigint,
): bigint | undefined {
  const gamma = powMod(a, q ** BigInt(s - 1), p); // order q
  const aInverse = invMod(a, p)!;
  let x = 0n;
  for (let i = 0; i < s; i++) {
    const residual = (powMod(aInverse, x, p) * h) % p;
    const digit = discreteLogPrimeOrder(gamma, powMod(residual, q ** BigInt(s - 1 - i), p), q, p);
    if (digit === undefined) return undefined;
    x += digit * q ** BigInt(i);
  }
  return powMod(a, x, p) === mod(h, p) ? x : undefined;
}

/** Every x in [0, p) with xʳ ≡ b (mod p), p prime and b ≢ 0, ascending; undefined past the cap. */
function rootsModPrimeUnit(b: bigint, r: bigint, p: bigint): bigint[] | undefined {
  const n = p - 1n;
  const d = gcd(r, n);
  if (powMod(b, n / d, p) !== 1n) return [];
  if (d > BigInt(MAX_ROOTS)) return undefined;

  // Split the group order: n = (∏ over q | r of q^s_q) · rest, with rest coprime to r.
  let rest = n;
  const sylow: { q: bigint; s: number }[] = [];
  for (const q of smallPrimeFactors(r)) {
    const [s, left] = valuation(rest, q);
    if (s > 0 && q > BSGS_LIMIT) return undefined;
    rest = left;
    if (s > 0) sylow.push({ q, s });
  }

  // The rest-component: r is invertible modulo its order, so its root is a plain power.
  const projectionExponent = (order: bigint): bigint => {
    // e ≡ 1 (mod order), e ≡ 0 (mod n/order) — the idempotent onto that component.
    const cofactor = n / order;
    return cofactor * (invMod(cofactor, order) ?? 0n);
  };
  let root = powMod(powMod(b, projectionExponent(rest), p), invMod(r, rest) ?? 0n, p);
  let unity = 1n; // a generator of the d-th roots of unity, built alongside
  for (const { q, s } of sylow) {
    const order = q ** BigInt(s);
    // A generator of the q-Sylow subgroup, from any q-th power non-residue.
    let generator = 0n;
    for (let c = 2n; ; c++) {
      if (powMod(c, n / q, p) !== 1n) {
        generator = powMod(c, n / order, p);
        break;
      }
    }
    const component = powMod(b, projectionExponent(order), p);
    const log = discreteLogPrimePower(generator, component, q, s, p);
    if (log === undefined) return []; // unreachable: the residue test above guarantees a log
    // Solve r·X ≡ log (mod q^s) with r = q^v·r₁.
    const [v, r1] = valuation(r, q);
    const shift = Math.min(v, s);
    const scale = q ** BigInt(shift);
    if (log % scale !== 0n) return [];
    const reduced = order / scale;
    const x = reduced === 1n ? 0n : mod((log / scale) * (invMod(r1, reduced) ?? 0n), reduced);
    root = (root * powMod(generator, x, p)) % p;
    unity = (unity * powMod(generator, q ** BigInt(s - shift), p)) % p;
  }
  const roots: bigint[] = [];
  for (let k = 0n, x = root; k < d; k++, x = (x * unity) % p) roots.push(x);
  return roots.sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
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

// Discrete logs and r-th roots in a cyclic group, for any representation of its elements.
//
// The same two algorithms serve (ℤ/p)*, the subgroup ⟨k⟩ of (ℤ/n)*, and 𝔽_{p²}* — the
// residue field of an inert Gaussian prime — so they are written once against the few
// operations a group needs.

import { gcd, invMod, isqrt, mod, valuation } from "./arith.ts";

export interface Group<T> {
  readonly one: T;
  mul(a: T, b: T): T;
  pow(a: T, e: bigint): T;
  inverse(a: T): T;
  equal(a: T, b: T): boolean;
  /** A hashable key, for baby-step giant-step. */
  key(a: T): string | bigint;
}

/** The largest prime order a discrete log is attempted in: baby-step giant-step keeps √q steps. */
export const BSGS_LIMIT = 1n << 40n;

/**
 * x with γˣ = h in a subgroup of prime order q, by baby-step giant-step; undefined if none, or
 * if q is past `BSGS_LIMIT`.
 */
export function discreteLogPrimeOrder<T>(
  group: Group<T>,
  gamma: T,
  h: T,
  q: bigint,
): bigint | undefined {
  if (group.equal(h, group.one)) return 0n;
  if (q > BSGS_LIMIT) return undefined;
  if (q <= 64n) {
    let power = group.one;
    for (let x = 0n; x < q; x++, power = group.mul(power, gamma)) {
      if (group.equal(power, h)) return x;
    }
    return undefined;
  }
  const step = isqrt(q - 1n) + 1n;
  const baby = new Map<string | bigint, bigint>();
  let power = group.one;
  for (let j = 0n; j < step; j++, power = group.mul(power, gamma)) {
    const k = group.key(power);
    if (!baby.has(k)) baby.set(k, j);
  }
  const giant = group.inverse(group.pow(gamma, step));
  let target = h;
  for (let i = 0n; i < step; i++, target = group.mul(target, giant)) {
    const j = baby.get(group.key(target));
    if (j !== undefined) return i * step + j;
  }
  return undefined;
}

/**
 * x with aˣ = h, where a has order q^s, by Pohlig–Hellman digit by digit; undefined when
 * h ∉ ⟨a⟩.
 */
export function discreteLogPrimePower<T>(
  group: Group<T>,
  a: T,
  h: T,
  q: bigint,
  s: number,
): bigint | undefined {
  const gamma = group.pow(a, q ** BigInt(s - 1)); // order q
  const aInverse = group.inverse(a);
  let x = 0n;
  for (let i = 0; i < s; i++) {
    const residual = group.mul(group.pow(aInverse, x), h);
    const digit = discreteLogPrimeOrder(
      group,
      gamma,
      group.pow(residual, q ** BigInt(s - 1 - i)),
      q,
    );
    if (digit === undefined) return undefined;
    x += digit * q ** BigInt(i);
  }
  return group.equal(group.pow(a, x), h) ? x : undefined;
}

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
 * Every x with xʳ = b in a cyclic group of order n, or undefined past `limit` roots (or a
 * prime of r past `BSGS_LIMIT`). `elements` yields candidates for a non-residue search.
 *
 * xʳ = b is solvable iff b^(n/d) = 1, d = gcd(r, n), and then there are exactly d roots:
 * one root times the d-th roots of unity. One root is assembled Sylow subgroup by Sylow
 * subgroup — only the primes q dividing r need a discrete log, inside the q-part of the
 * group, whose order is a power of q — so n is never factored.
 */
export function rootsInCyclicGroup<T>(
  group: Group<T>,
  n: bigint,
  b: T,
  r: bigint,
  elements: () => Iterable<T>,
  limit: number,
): T[] | undefined {
  const d = gcd(r, n);
  if (!group.equal(group.pow(b, n / d), group.one)) return [];
  if (d > BigInt(limit)) return undefined;

  // n = (∏ over q | r of q^s_q) · rest, with rest coprime to r.
  let rest = n;
  const sylow: { q: bigint; s: number }[] = [];
  for (const q of smallPrimeFactors(r)) {
    const [s, left] = valuation(rest, q);
    rest = left;
    if (s > 0 && q > BSGS_LIMIT) return undefined;
    if (s > 0) sylow.push({ q, s });
  }

  // e ≡ 1 (mod order), e ≡ 0 (mod n/order): the idempotent onto that component.
  const projection = (order: bigint): bigint => {
    const cofactor = n / order;
    return cofactor * (invMod(cofactor, order) ?? 0n);
  };
  // On the part coprime to r, r is invertible, so the root is a plain power.
  let root = group.pow(group.pow(b, projection(rest)), invMod(r, rest) ?? 0n);
  let unity = group.one; // generates the d-th roots of unity, built alongside
  for (const { q, s } of sylow) {
    const order = q ** BigInt(s);
    let generator: T | undefined;
    for (const c of elements()) {
      if (!group.equal(group.pow(c, n / q), group.one)) {
        generator = group.pow(c, n / order);
        break;
      }
    }
    if (generator === undefined) return undefined;
    const log = discreteLogPrimePower(group, generator, group.pow(b, projection(order)), q, s);
    if (log === undefined) return []; // unreachable: the residue test guarantees a log
    // r·X ≡ log (mod q^s), r = q^v·r₁
    const [v, r1] = valuation(r, q);
    const shift = Math.min(v, s);
    const scale = q ** BigInt(shift);
    if (log % scale !== 0n) return [];
    const reduced = order / scale;
    const x = reduced === 1n ? 0n : mod((log / scale) * (invMod(r1, reduced) ?? 0n), reduced);
    root = group.mul(root, group.pow(generator, x));
    unity = group.mul(unity, group.pow(generator, q ** BigInt(s - shift)));
  }
  const roots: T[] = [];
  for (let k = 0n, x = root; k < d; k++, x = group.mul(x, unity)) roots.push(x);
  return roots;
}

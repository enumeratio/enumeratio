// Orders, discrete logarithms and primitive roots in (ℤ/n)*.
//
// Everything here reduces to the order of the group — Carmichael's λ(n), from the
// factorisation of n and of each p − 1 — and then works one prime of λ at a time: the
// order of k strips primes off λ, and a discrete log in ⟨k⟩ is Pohlig–Hellman over that
// order, baby-step giant-step inside each prime. So the cost is set by the LARGEST prime
// dividing the order of k, as √q — cheap for smooth orders, and exactly as hard as the
// cryptographers need it to be for a safe prime.

import { checkpoint } from "@enumeratio/boxed";
import { crt, gcd, mod, powMod } from "./arith.ts";
import { factorInteger } from "./primes.ts";
import { discreteLogPrimePower } from "./cyclic.ts";
import { unitsMod } from "./roots.ts";

type Factors = [bigint, number][];

const lcm = (a: bigint, b: bigint): bigint => (a / gcd(a, b)) * b;

/** Carmichael's λ(n) from n's factorisation. */
function carmichaelOf(factors: Factors): bigint {
  return factors.reduce((l, [p, e]) => {
    const phi = (p - 1n) * p ** BigInt(e - 1);
    return lcm(l, p === 2n && e >= 3 ? phi / 2n : phi);
  }, 1n);
}

/** The order of k in (ℤ/n)* and its factorisation, or undefined (non-unit, or unfactorable). */
function orderWithFactors(k: bigint, n: bigint): { order: bigint; factors: Factors } | undefined {
  if (n < 1n || gcd(k, n) !== 1n) return undefined;
  if (n === 1n) return { order: 1n, factors: [] };
  const nFactors = factorInteger(n);
  if (nFactors === undefined) return undefined;
  const lambda = carmichaelOf(nFactors);
  const lambdaFactors = factorInteger(lambda);
  if (lambdaFactors === undefined) return undefined;
  let order = lambda;
  const factors: Factors = [];
  for (const [q, e] of lambdaFactors) {
    let kept = e;
    while (kept > 0 && powMod(k, order / q, n) === 1n) {
      order /= q;
      kept--;
    }
    if (kept > 0) factors.push([q, kept]);
  }
  return { order, factors };
}

/** The least m > 0 with kᵐ ≡ 1 (mod n), or undefined unless gcd(k, n) = 1. */
export const multiplicativeOrder = (k: bigint, n: bigint): bigint | undefined =>
  orderWithFactors(k, n)?.order;

/**
 * Wolfram's `MultiplicativeOrder[k, n, {r₁, r₂, …}]`: the least m > 0 with kᵐ ≡ rᵢ (mod n)
 * for some i — a discrete logarithm — or undefined when no rᵢ lies in ⟨k⟩.
 */
export function discreteLog(k: bigint, n: bigint, targets: readonly bigint[]): bigint | undefined {
  const found = orderWithFactors(k, n);
  if (found === undefined) return undefined;
  const { order, factors } = found;
  let best: bigint | undefined;
  for (const target of targets) {
    const h = mod(target, n);
    if (gcd(h, n) !== 1n && n !== 1n) continue;
    const channels: [bigint, bigint][] = [];
    let ok = true;
    for (const [q, e] of factors) {
      const prime = q ** BigInt(e);
      const cofactor = order / prime;
      const x = discreteLogPrimePower(
        unitsMod(n),
        powMod(k, cofactor, n),
        powMod(h, cofactor, n),
        q,
        e,
      );
      if (x === undefined) {
        ok = false;
        break;
      }
      channels.push([x, prime]);
    }
    if (!ok) continue;
    const log = crt(channels);
    if (powMod(k, log, n) !== h % n) continue; // h was outside ⟨k⟩ after all
    const m = log === 0n ? order : log;
    if (best === undefined || m < best) best = m;
  }
  return best;
}

/** The most primitive roots `primitiveRootList` will list. */
export const MAX_PRIMITIVE_ROOTS = 100_000;

/**
 * Every primitive root of n, ascending: the generators of (ℤ/n)*, which is cyclic exactly
 * for n = 1, 2, 4, p^e and 2p^e. Empty otherwise; undefined when n cannot be factored or
 * there would be more than `MAX_PRIMITIVE_ROOTS` of them (there are φ(φ(n))).
 */
export function primitiveRootList(n: bigint): bigint[] | undefined {
  if (n < 1n) return undefined;
  if (n <= 2n) return [n - 1n];
  if (n === 4n) return [3n];
  const factors = factorInteger(n);
  if (factors === undefined) return undefined;
  const odd = factors.filter(([p]) => p !== 2n);
  const twos = factors.find(([p]) => p === 2n)?.[1] ?? 0;
  if (odd.length !== 1 || twos > 1) return [];
  const phi = carmichaelOf(factors); // = φ(n) here, the group being cyclic
  const phiFactors = factorInteger(phi);
  if (phiFactors === undefined) return undefined;
  const isGenerator = (g: bigint): boolean =>
    gcd(g, n) === 1n && phiFactors.every(([q]) => powMod(g, phi / q, n) !== 1n);
  let g = 2n;
  while (!isGenerator(g)) {
    g++;
    checkpoint();
  }
  // The rest are gᵏ for k coprime to φ(n): φ(φ(n)) of them.
  const count = phiFactors.reduce((t, [q, e]) => t * (q - 1n) * q ** BigInt(e - 1), 1n);
  if (count > BigInt(MAX_PRIMITIVE_ROOTS)) return undefined;
  const roots: bigint[] = [];
  let power = 1n;
  for (let k = 1n; k <= phi; k++) {
    power = (power * g) % n;
    if (gcd(k, phi) === 1n) roots.push(power);
  }
  return roots.sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
}

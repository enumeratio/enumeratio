// Primality and factorisation over bigints.
//
// Primality is Baillie–PSW (a strong base-2 Miller–Rabin plus a strong Lucas test): no
// composite is known to pass it, and every one below 2⁶⁴ is proved not to. Factorisation is
// trial division by small primes, then Pollard's rho in Brent's form — fast whenever the
// second-largest prime factor is modest, and hopeless for a product of two large primes,
// which is exactly the case RSA relies on. So it is budgeted: past `RHO_BUDGET` steps it
// gives up and says so, rather than hanging.

import { checkpoint } from "@enumeratio/boxed";
import { gcd, isqrt, mod, powMod, valuation } from "./arith.ts";

const SMALL_PRIMES: readonly bigint[] = (() => {
  const limit = 1000;
  const sieve = new Uint8Array(limit + 1);
  const primes: bigint[] = [];
  for (let i = 2; i <= limit; i++) {
    if (sieve[i]) continue;
    primes.push(BigInt(i));
    for (let j = i * i; j <= limit; j += i) sieve[j] = 1;
  }
  return primes;
})();

function strongProbablePrime(n: bigint, base: bigint): boolean {
  const [s, d] = valuation(n - 1n, 2n);
  let x = powMod(base, d, n);
  if (x === 1n || x === n - 1n) return true;
  for (let i = 1; i < s; i++) {
    x = (x * x) % n;
    if (x === n - 1n) return true;
  }
  return false;
}

/** The Jacobi symbol (a/n) for odd n > 0. */
function jacobi(a: bigint, n: bigint): number {
  let [x, y] = [mod(a, n), n];
  let sign = 1;
  while (x !== 0n) {
    while (x % 2n === 0n) {
      x /= 2n;
      const r = y % 8n;
      if (r === 3n || r === 5n) sign = -sign;
    }
    [x, y] = [y, x];
    if (x % 4n === 3n && y % 4n === 3n) sign = -sign;
    x %= y;
  }
  return y === 1n ? sign : 0;
}

/** Strong Lucas probable-prime test with Selfridge's parameters (n odd, not a square). */
function strongLucasProbablePrime(n: bigint): boolean {
  let d = 5n;
  while (jacobi(d, n) !== -1) d = d > 0n ? -(d + 2n) : -(d - 2n);
  const q = mod((1n - d) / 4n, n);
  const [s, k] = valuation(n + 1n, 2n);
  // U, V and Qᵏ by binary ladder over k, halving with the inverse of 2.
  const half = (x: bigint): bigint => (x % 2n === 0n ? x / 2n : (x + n) / 2n);
  let [u, v, qk] = [0n, 2n, 1n];
  for (const bit of k.toString(2)) {
    [u, v] = [(u * v) % n, mod(v * v - 2n * qk, n)];
    qk = (qk * qk) % n;
    if (bit === "1") {
      [u, v] = [half(mod(u + v, n)), half(mod(d * u + v, n))];
      qk = (qk * q) % n;
    }
  }
  if (u === 0n || v === 0n) return true;
  for (let r = 1; r < s; r++) {
    v = mod(v * v - 2n * qk, n);
    qk = (qk * qk) % n;
    if (v === 0n) return true;
  }
  return false;
}

export function isPrime(n: bigint): boolean {
  if (n < 2n) return false;
  for (const p of SMALL_PRIMES) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  if (n < 1_000_000n) return true;
  if (!strongProbablePrime(n, 2n)) return false;
  const root = isqrt(n);
  if (root * root === n) return false;
  return strongLucasProbablePrime(n);
}

/** ⌊n^(1/k)⌋ for n ≥ 0, k ≥ 1, by Newton's method from above. */
function integerRoot(n: bigint, k: bigint): bigint {
  if (n < 2n) return n;
  let x = 1n << (BigInt(n.toString(2).length) / k + 1n);
  for (;;) {
    const y = ((k - 1n) * x + n / x ** (k - 1n)) / k;
    if (y >= x) return x;
    x = y;
  }
}

/** [r, k] with rᵏ = n and k ≥ 2 as large as possible, or undefined when n is no perfect power. */
function perfectPower(n: bigint): [bigint, bigint] | undefined {
  for (let k = BigInt(n.toString(2).length); k >= 2n; k--) {
    const r = integerRoot(n, k);
    if (r > 1n && r ** k === n) return [r, k];
  }
  return undefined;
}

/** Steps of Pollard's rho before `factorInteger` gives up on a cofactor. */
export const RHO_BUDGET = 1 << 20;

/** A non-trivial factor of the odd composite n by Brent's rho, or undefined within budget. */
function rho(n: bigint, budget: { steps: number }): bigint | undefined {
  for (let c = 1n; budget.steps > 0; c++) {
    const f = (x: bigint): bigint => (x * x + c) % n;
    let [y, r, q, g] = [2n, 1, 1n, 1n];
    let [x, ys] = [0n, 0n];
    const batch = 128;
    while (g === 1n && budget.steps > 0) {
      x = y;
      for (let i = 0; i < r; i++) y = f(y);
      for (let k = 0; k < r && g === 1n; k += batch) {
        ys = y;
        for (let i = 0; i < Math.min(batch, r - k); i++) {
          y = f(y);
          q = (q * (x > y ? x - y : y - x)) % n;
        }
        budget.steps -= batch;
        g = gcd(q, n);
        checkpoint();
      }
      r *= 2;
    }
    if (g === n) {
      // The batch overshot; replay it one step at a time.
      do {
        ys = f(ys);
        g = gcd(x > ys ? x - ys : ys - x, n);
      } while (g === 1n);
    }
    if (g !== n && g !== 1n) return g;
  }
  return undefined;
}

/**
 * The prime factorisation of |n| as ascending [prime, exponent] pairs, or undefined when a
 * cofactor resists rho within the budget. factorInteger(1) is [].
 */
export function factorInteger(n: bigint): [bigint, number][] | undefined {
  const counts = new Map<bigint, number>();
  const add = (p: bigint, e: number): void => void counts.set(p, (counts.get(p) ?? 0) + e);
  let rest = n < 0n ? -n : n;
  if (rest === 0n) return undefined;
  for (const p of SMALL_PRIMES) {
    if (rest % p !== 0n) continue;
    const [e, left] = valuation(rest, p);
    add(p, e);
    rest = left;
  }
  const budget = { steps: RHO_BUDGET };
  const pending: [bigint, number][] = rest > 1n ? [[rest, 1]] : [];
  while (pending.length > 0) {
    const [m, multiplicity] = pending.pop()!;
    if (isPrime(m)) {
      add(m, multiplicity);
      continue;
    }
    // Rho cannot split p² for a large prime p within budget; a root can.
    const power = perfectPower(m);
    if (power !== undefined) {
      pending.push([power[0], multiplicity * Number(power[1])]);
      continue;
    }
    const factor = rho(m, budget);
    if (factor === undefined) return undefined;
    pending.push([factor, multiplicity], [m / factor, multiplicity]);
  }
  return [...counts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Euler's φ from a factorisation. */
export const totientOf = (factors: readonly (readonly [bigint, number])[]): bigint =>
  factors.reduce((t, [p, e]) => t * (p - 1n) * p ** BigInt(e - 1), 1n);

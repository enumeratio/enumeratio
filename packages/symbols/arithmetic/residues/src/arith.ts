// Residue arithmetic over bigints. Every function here reduces into [0, m).

/** a mod m, in [0, m). */
export const mod = (a: bigint, m: bigint): bigint => {
  const r = a % m;
  return r < 0n ? r + m : r;
};

/** aᵉ mod m by repeated squaring, for e ≥ 0. */
export function powMod(a: bigint, e: bigint, m: bigint): bigint {
  if (m === 1n) return 0n;
  let result = 1n;
  let base = mod(a, m);
  for (let k = e; k > 0n; k >>= 1n) {
    if (k & 1n) result = (result * base) % m;
    base = (base * base) % m;
  }
  return result;
}

export function gcd(a: bigint, b: bigint): bigint {
  let [x, y] = [a < 0n ? -a : a, b < 0n ? -b : b];
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

/** [g, u, v] with u·a + v·b = g = gcd(a, b). */
export function extendedGcd(a: bigint, b: bigint): [bigint, bigint, bigint] {
  let [oldR, r] = [a, b];
  let [oldU, u] = [1n, 0n];
  let [oldV, v] = [0n, 1n];
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldU, u] = [u, oldU - q * u];
    [oldV, v] = [v, oldV - q * v];
  }
  return oldR < 0n ? [-oldR, -oldU, -oldV] : [oldR, oldU, oldV];
}

/** a⁻¹ mod m, or undefined when gcd(a, m) ≠ 1. */
export function invMod(a: bigint, m: bigint): bigint | undefined {
  if (m === 1n) return 0n;
  const [g, u] = extendedGcd(mod(a, m), m);
  return g === 1n ? mod(u, m) : undefined;
}

/** The residue mod ∏ moduli agreeing with each (residue, modulus); moduli pairwise coprime. */
export function crt(channels: readonly (readonly [bigint, bigint])[]): bigint {
  let result = 0n;
  let combined = 1n;
  for (const [residue, modulus] of channels) {
    const inverse = invMod(combined, modulus) ?? 0n;
    result += combined * mod((residue - result) * inverse, modulus);
    combined *= modulus;
  }
  return result;
}

/**
 * The x mod lcm(mᵢ) agreeing with every (residue, modulus), as [x, lcm], for moduli that need
 * not be coprime — or undefined when two channels disagree on a shared factor.
 */
export function crtSolve(channels: readonly (readonly [bigint, bigint])[]): [bigint, bigint] | undefined {
  let [x, m] = [0n, 1n];
  for (const [residue, modulus] of channels) {
    const g = gcd(m, modulus);
    const gap = residue - x;
    if (mod(gap, g) !== 0n) return undefined;
    const step = modulus / g;
    x = mod(x + m * mod((gap / g) * (invMod(m / g, step) ?? 0n), step), m * step);
    m *= step;
  }
  return [x, m];
}

/** ⌊√n⌋ by Newton's method. */
export function isqrt(n: bigint): bigint {
  if (n < 2n) return n;
  // Start above the root; Newton then decreases monotonically onto ⌊√n⌋.
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
}

/** The exponent of p in n (n ≠ 0), and what is left. */
export function valuation(n: bigint, p: bigint): [number, bigint] {
  let count = 0;
  let rest = n;
  while (rest % p === 0n) {
    rest /= p;
    count++;
  }
  return [count, rest];
}

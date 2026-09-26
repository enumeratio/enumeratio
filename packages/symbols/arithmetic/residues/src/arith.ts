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

/** How many factors of 2 divide `x` (x ≠ 0). */
const twos = (x: bigint): bigint => {
  let n = 0n;
  while ((x & 1n) === 0n) {
    x >>= 1n;
    n++;
  }
  return n;
};

/**
 * Stein's binary GCD: shifts and subtractions only, no division. ~2x faster than plain
 * Euclid (`x, y = y, x % y`) on balanced, large bigints in measurements at 10000 bits
 * (issue #205) — division of two same-size bigints is expensive relative to a shift.
 */
export function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  if (x === 0n) return y;
  if (y === 0n) return x;
  const xTwos = twos(x);
  const yTwos = twos(y);
  x >>= xTwos;
  y >>= yTwos;
  const shift = xTwos < yTwos ? xTwos : yTwos;
  while (x !== y) {
    if (x < y) [x, y] = [y, x];
    x -= y;
    x >>= twos(x);
  }
  return x << shift;
}

// Leading-digit window for Lehmer's algorithm: two ~26-bit numbers multiply to ~52 bits,
// safely inside float64's 53-bit mantissa, with room left for the small (A, B, C, D)
// cofactors added in.
const LEHMER_WORD_BITS = 26n;
// Below this, x and y already fit comfortably in a machine word — a plain bigint `%` is as
// fast as simulating one, so Lehmer only kicks in once division itself gets expensive.
const LEHMER_SMALL = 1n << 32n;

/**
 * Lehmer's GCD (HAC Algorithm 14.4): simulates many Euclidean steps at once over the leading
 * ~26 bits of x and y using plain (non-bigint) arithmetic, then applies the accumulated 2×2
 * cofactor matrix to the full bigints in one shot — trading most of the O(log n) bigint
 * divisions Euclid needs for a handful of full-width reductions. When the single-precision
 * simulation can't agree on a quotient (small y relative to x, or it exhausts its digits) it
 * falls back to one ordinary `x mod y` step, so it is always at least as correct as Euclid,
 * and degrades to it gracefully for small inputs (issue #205: measured faster than Stein's
 * binary `gcd` above on 10000-bit pairs, where full-width division dominates the cost).
 */
export function lehmerGcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  if (x < y) [x, y] = [y, x];
  while (y > 0n) {
    if (y < LEHMER_SMALL) {
      [x, y] = [y, x % y];
      continue;
    }
    const totalBits = BigInt(x.toString(2).length);
    const shift = totalBits > LEHMER_WORD_BITS ? totalBits - LEHMER_WORD_BITS : 0n;
    let xHat = Number(x >> shift);
    let yHat = Number(y >> shift);
    let A = 1;
    let B = 0;
    let C = 0;
    let D = 1;
    for (;;) {
      const yC = yHat + C;
      const yD = yHat + D;
      if (yC === 0 || yD === 0) break;
      const q = Math.floor((xHat + A) / yC);
      if (q !== Math.floor((xHat + B) / yD)) break;
      [A, B, xHat, C, D, yHat] = [C, D, yHat, A - q * C, B - q * D, xHat - q * yHat];
    }
    if (B === 0) {
      // The simulation made no progress (y too small relative to x's leading digits to pin
      // down a shared quotient) — fall back to one full-precision step.
      [x, y] = [y, x % y];
    } else {
      const nx = BigInt(A) * x + BigInt(B) * y;
      const ny = BigInt(C) * x + BigInt(D) * y;
      x = nx < 0n ? -nx : nx;
      y = ny < 0n ? -ny : ny;
    }
  }
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

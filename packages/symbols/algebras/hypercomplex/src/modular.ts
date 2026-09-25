// Where these units already live: inside ℤ/m.
//
// A split unit is an x with x² = 1 and x ≠ ±1 — and ℤ/m is full of them. By CRT,
// ℤ/m ≅ ∏ ℤ/p_i^{a_i}, a square root of 1 is a root in every channel independently,
// and an odd prime power has exactly the two roots ±1. So for ODD m the roots of 1 are
// the 2^ω(m) sign vectors over the CRT channels, ω(m) = the number of distinct primes:
// exactly the ±1 spectral basis. Each non-trivial one is a concrete split unit, and
// sending j_1 ↦ x is a ring homomorphism ℝ[j]/(j²−1) → ℤ/m — so the identities the
// symbolic algebra proves (say (1+j_1)(1−j_1) = 0) come back as facts about ℤ/m.
//
// The 2-adic channel is the exception, and the reason the clean 2^ω(m) law is stated
// for odd m: ℤ/2 has one root, ℤ/4 has two, and ℤ/2^a for a ≥ 3 has four (±1, ±1+2^{a−1}).
//
// Square roots of −1 are rarer: a channel has one only for p ≡ 1 (mod 4), or p^a = 2.
// So i_1 ↦ x is available exactly when every odd prime factor of m is ≡ 1 (mod 4) and
// 4 ∤ m — the classical condition, and the reason the split units are the generic case.

/** Prime factorisation as [prime, exponent] pairs, ascending. */
export function factorize(n: number): [number, number][] {
  const factors: [number, number][] = [];
  let rest = n;
  for (let p = 2; p * p <= rest; p += p === 2 ? 1 : 2) {
    let exponent = 0;
    while (rest % p === 0) {
      rest /= p;
      exponent++;
    }
    if (exponent > 0) factors.push([p, exponent]);
  }
  if (rest > 1) factors.push([rest, 1]);
  return factors;
}

/** ω(m) — the number of DISTINCT prime factors. */
export const distinctPrimeCount = (m: number): number => factorize(m).length;

const mulMod = (a: number, b: number, m: number): number => Number((BigInt(a) * BigInt(b)) % BigInt(m));

/** Modular inverse by extended Euclid, or undefined when gcd(a, m) ≠ 1. */
function invMod(a: number, m: number): number | undefined {
  let [old, cur] = [((a % m) + m) % m, m];
  let [s, sNext] = [1, 0];
  while (cur !== 0) {
    const q = Math.floor(old / cur);
    [old, cur] = [cur, old - q * cur];
    [s, sNext] = [sNext, s - q * sNext];
  }
  return old === 1 ? ((s % m) + m) % m : undefined;
}

/** Combine per-channel residues into one residue mod ∏ moduli. */
function crt(channels: readonly { residue: number; modulus: number }[]): number {
  let result = 0;
  let combined = 1;
  for (const { residue, modulus } of channels) {
    // Lift `result` (mod combined) to satisfy `residue` (mod modulus).
    const inverse = invMod(combined % modulus, modulus);
    if (inverse === undefined) return result; // coprime by construction; defensive
    const shift = mulMod((((residue - result) % modulus) + modulus) % modulus, inverse, modulus);
    result += combined * shift;
    combined *= modulus;
  }
  return result;
}

/** The roots of x² ≡ 1 in one prime-power channel. */
function rootsOfOne(p: number, a: number): number[] {
  const q = p ** a;
  if (p !== 2) return [1, q - 1]; // ±1, and nothing else: ℤ/p^a is cyclic
  if (a === 1) return [1];
  if (a === 2) return [1, 3];
  const half = 2 ** (a - 1);
  return [1, half - 1, half + 1, q - 1];
}

/** The roots of x² ≡ −1 in one prime-power channel — none unless p ≡ 1 (mod 4) or p^a = 2. */
function rootsOfMinusOne(p: number, a: number): number[] {
  const q = p ** a;
  if (p === 2) return a === 1 ? [1] : []; // 1² ≡ −1 (mod 2); nothing mod 4 or beyond
  if (p % 4 !== 1) return [];
  // A root mod p by search, then Hensel-lifted through p², p³, … : the correction
  // r ← r − (r²+1)/(2r) doubles the number of correct digits each time, and 2r is
  // invertible because p is odd and r ≢ 0.
  let root = 0;
  for (let x = 2; x < p; x++) {
    if (mulMod(x, x, p) === p - 1) {
      root = x;
      break;
    }
  }
  if (root === 0) return [];
  let modulus = p;
  while (modulus < q) {
    modulus *= p;
    const inverse = invMod(mulMod(2, root, modulus), modulus);
    if (inverse === undefined) return [];
    const excess = (mulMod(root, root, modulus) + 1) % modulus;
    root = (((root - mulMod(excess, inverse, modulus)) % modulus) + modulus) % modulus;
  }
  return [root, q - root];
}

/** Every root of x² ≡ target (mod m), ascending. `target` is 1 or −1. */
function rootsOf(target: 1 | -1, m: number): number[] {
  if (!Number.isInteger(m) || m < 1) return [];
  if (m === 1) return [0];
  const channels = factorize(m).map(([p, a]) => ({
    modulus: p ** a,
    roots: target === 1 ? rootsOfOne(p, a) : rootsOfMinusOne(p, a),
  }));
  if (channels.some((c) => c.roots.length === 0)) return [];
  // One root per channel, every combination — the spectral sign vectors when target = 1.
  let combinations: { residue: number; modulus: number }[][] = [[]];
  for (const channel of channels) {
    combinations = combinations.flatMap((prefix) =>
      channel.roots.map((residue) => [...prefix, { residue, modulus: channel.modulus }]),
    );
  }
  return combinations.map(crt).sort((a, b) => a - b);
}

/**
 * The split units of ℤ/m: every x with x² ≡ 1. For odd m there are exactly 2^ω(m) of
 * them — one per ±1 choice across the CRT channels — of which 1 and m−1 are the trivial
 * pair, so a genuinely new split unit exists as soon as m has two distinct odd primes.
 */
export const splitUnitsMod = (m: number): number[] => rootsOf(1, m);

/**
 * The imaginary units of ℤ/m: every x with x² ≡ −1. Non-empty exactly when every odd
 * prime factor of m is ≡ 1 (mod 4) and 4 ∤ m.
 */
export const imaginaryUnitsMod = (m: number): number[] => rootsOf(-1, m);

/**
 * How many split units ℤ/m has, from the factorisation alone — 2 per odd prime power,
 * and 1 / 2 / 4 for 2, 4, 2^(a≥3). A closed form, independent of the enumeration above.
 */
export function splitUnitCountMod(m: number): number {
  if (!Number.isInteger(m) || m < 1) return 0;
  if (m === 1) return 1;
  return factorize(m).reduce((total, [p, a]) => total * (p !== 2 ? 2 : a === 1 ? 1 : a === 2 ? 2 : 4), 1);
}

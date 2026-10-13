// Exact bigint counts for the families whose count is a product of factorials (binomials, Catalan
// numbers, MacMahon's box formula). They are the `count` of a `fast` kernel or a family's `fastCount`,
// so a fiber past 2^53 is answered here instead of by the interpreter. Epsil stays the meaning:
// tests/fast-kernels.test.ts holds each of these to it.

/** The largest integer a product reaches, and the most bits an answer takes (512 KB): past either, the
 *  tables are too big and the count too large to be one anyone asks for, so the kernel leaves the
 *  question to Epsil. */
export const EXACT_TOP_LIMIT = 1_000_000;
export const EXACT_BITS_LIMIT = 4_000_000;

// The smallest prime factor of each integer up to a point, kept between calls and grown by doubling.
let smallestFactors = new Uint32Array(0);
function sieveTo(top: number): Uint32Array {
  if (smallestFactors.length > top) return smallestFactors;
  const size = Math.min(EXACT_TOP_LIMIT, Math.max(top, 1024, 2 * smallestFactors.length)) + 1;
  const smallest = new Uint32Array(size);
  for (let i = 2; i < size; i++) if (smallest[i] === 0) for (let j = i; j < size; j += i) smallest[j] ||= i;
  return (smallestFactors = smallest);
}

/**
 * Π m^weights[m] over m = 2 … weights.length − 1, exact, or undefined past the limit. The weights are
 * taken to net out to non-negative prime exponents (a ratio that is an integer), so the product is
 * built from prime powers: nothing is divided, and no intermediate outgrows the answer.
 */
export function powerProduct(weights: ArrayLike<number>): bigint | undefined {
  const top = weights.length - 1;
  if (top > EXACT_TOP_LIMIT) return undefined;
  const smallest = sieveTo(top);
  const exponent = new Float64Array(top + 1);
  for (let m = 2; m <= top; m++) {
    const weight = weights[m];
    if (weight !== 0) for (let n = m; n > 1; n /= smallest[n]) exponent[smallest[n]] += weight;
  }
  let bits = 0;
  for (let q = 2; q <= top; q++) {
    if (exponent[q] < 0) return undefined;
    bits += exponent[q] * Math.log2(q);
  }
  if (bits > EXACT_BITS_LIMIT) return undefined;
  let powers: bigint[] = [];
  for (let q = 2; q <= top; q++) if (exponent[q] > 0) powers.push(BigInt(q) ** BigInt(exponent[q]));
  // A balanced product: multiplications stay between operands of like size.
  while (powers.length > 1) {
    const rest = powers;
    powers = Array.from({ length: Math.ceil(rest.length / 2) }, (_, i) =>
      i * 2 + 1 < rest.length ? rest[i * 2] * rest[i * 2 + 1] : rest[i * 2],
    );
  }
  return powers[0] ?? 1n;
}

const natural = (x: number): boolean => Number.isSafeInteger(x) && x >= 0;

/** Π up! / Π down!, exact: the ratio is taken to be an integer. Undefined past the limit, and for an
 *  argument that is no natural number. */
export function factorialRatio(up: readonly number[], down: readonly number[]): bigint | undefined {
  if (!up.every(natural) || !down.every(natural)) return undefined;
  const top = [...up, ...down].reduce((most, x) => Math.max(most, x), 0);
  if (top > EXACT_TOP_LIMIT) return undefined;
  // `weights[m]` is how many factorials of the numerator, less the denominator, reach m: a difference
  // array over the ranges 2 … x, summed once at the end.
  const steps = new Float64Array(top + 2);
  const count = (factorials: readonly number[], by: number): void => {
    for (const x of factorials) {
      if (x < 2) continue;
      steps[2] += by;
      steps[x + 1] -= by;
    }
  };
  count(up, 1);
  count(down, -1);
  const weights = new Float64Array(top + 1);
  for (let m = 2, running = 0; m <= top; m++) weights[m] = running += steps[m];
  return powerProduct(weights);
}

/** C(n, k) for natural n and integer k: 0 outside 0 ≤ k ≤ n. */
export const binomialExact = (n: number, k: number): bigint | undefined =>
  !natural(n) || !Number.isSafeInteger(k) ? undefined : k < 0 || k > n ? 0n : factorialRatio([n], [k, n - k]);

/** The Catalan number C(2n, n)/(n + 1), and 0 for a negative n. */
export const catalanExact = (n: number): bigint | undefined =>
  !Number.isSafeInteger(n) ? undefined : n < 0 ? 0n : factorialRatio([2 * n], [n, n + 1]);

/** The Fuss–Catalan number C(kn, n)/((k − 1)n + 1) of the full k-ary trees with n internal nodes,
 *  and 0 for a negative n or where no node has a child (k < 1). */
export const fussCatalanExact = (n: number, k: number): bigint | undefined =>
  !Number.isSafeInteger(n) || !Number.isSafeInteger(k)
    ? undefined
    : n < 0 || k < 1
      ? 0n
      : factorialRatio([k * n], [n, (k - 1) * n + 1]);

/** The alternating sign matrices of order n: Π (3j + 1)!/(n + j)! over j = 0 … n − 1. */
export const alternatingSignMatricesExact = (n: number): bigint | undefined =>
  !natural(n) || 3 * n > EXACT_TOP_LIMIT
    ? undefined
    : factorialRatio(
        Array.from({ length: n }, (_, j) => 3 * j + 1),
        Array.from({ length: n }, (_, j) => n + j),
      );

/** The divisors of n with φ of each, from n's prime factorization: undefined past the limit. */
function divisorsWithPhi(n: number): [number, number][] | undefined {
  if (n > EXACT_TOP_LIMIT) return undefined;
  const smallest = sieveTo(n);
  let divisors: [number, number][] = [[1, 1]];
  for (let rest = n; rest > 1;) {
    const p = smallest[rest];
    let power = 0;
    while (rest % p === 0) {
      rest /= p;
      power++;
    }
    divisors = divisors.flatMap(([d, phi]) =>
      Array.from({ length: power + 1 }, (_, e): [number, number] => [
        d * p ** e,
        e === 0 ? phi : phi * p ** (e - 1) * (p - 1),
      ]),
    );
  }
  return divisors;
}

/** Burnside's rotation sum Σ_{d | n} φ(d) k^(n/d) over the cyclic group C_n; undefined past the limits. */
function rotationSum(n: number, k: number): bigint | undefined {
  if (n * Math.log2(k) > EXACT_BITS_LIMIT) return undefined;
  const divisors = divisorsWithPhi(n);
  return divisors?.reduce((sum, [d, phi]) => sum + BigInt(phi) * BigInt(k) ** BigInt(n / d), 0n);
}

/** The necklaces of n beads in k colors up to rotation, (1/n) Σ_{d | n} φ(d) k^(n/d) (A000031 at k = 2);
 *  0 for no colors or a negative n, 1 for n = 0. */
export const necklaceCountExact = (n: number, k: number): bigint | undefined => {
  if (!natural(n) || !natural(k)) return undefined;
  if (k === 0) return 0n;
  if (n === 0) return 1n;
  const sum = rotationSum(n, k);
  return sum === undefined ? undefined : sum / BigInt(n);
};

/** The bracelets of n beads in k colors up to rotation and reflection (A000029 at k = 2): Burnside over the
 *  dihedral group D_n, whose n reflections fix k^((n+1)/2) words each for odd n, and for even n half of them
 *  k^(n/2+1) and half k^(n/2). */
export const braceletCountExact = (n: number, k: number): bigint | undefined => {
  if (!natural(n) || !natural(k)) return undefined;
  if (k === 0) return 0n;
  if (n === 0) return 1n;
  const rotations = rotationSum(n, k);
  if (rotations === undefined) return undefined;
  const [bn, bk] = [BigInt(n), BigInt(k)];
  const reflections =
    n % 2 === 1 ? bn * bk ** BigInt((n + 1) / 2) : (bn / 2n) * (bk ** BigInt(n / 2 + 1) + bk ** BigInt(n / 2));
  return (rotations + reflections) / (2n * bn);
};

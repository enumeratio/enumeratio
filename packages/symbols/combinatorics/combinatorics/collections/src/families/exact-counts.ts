// Exact bigint counts for the families whose count is a product of factorials (binomials, Catalan
// numbers, MacMahon's box formula). They are the `count` of a `fast` kernel or a family's `fastCount`,
// so a fiber past 2^53 is answered here instead of by the interpreter. Epsil stays the meaning:
// tests/fast-kernels.test.ts holds each of these to it.

/** The largest integer a product reaches, and the most bits an answer takes (about 2 MB): past either,
 *  the tables are too big and the count too large to be one anyone asks for, so the kernel leaves
 *  the question to Epsil. */
export const EXACT_TOP_LIMIT = 4_000_000;
export const EXACT_BITS_LIMIT = 16_000_000;

/**
 * Π m^weights[m] over m = 2 … weights.length − 1, exact, or undefined past the limit. The weights are
 * taken to net out to non-negative prime exponents (a ratio that is an integer), so the product is
 * built from prime powers: nothing is divided, and no intermediate outgrows the answer.
 */
export function powerProduct(weights: ArrayLike<number>): bigint | undefined {
  const top = weights.length - 1;
  if (top > EXACT_TOP_LIMIT) return undefined;
  const smallest = new Uint32Array(top + 1);
  for (let i = 2; i <= top; i++) if (smallest[i] === 0) for (let j = i; j <= top; j += i) smallest[j] ||= i;
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

/** Π up! / Π down!, exact: the ratio is taken to be an integer. Undefined past the limit. */
export function factorialRatio(up: readonly number[], down: readonly number[]): bigint | undefined {
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

/** C(n, k) for integers 0 ≤ k ≤ n, and 0 above. */
export const binomialExact = (n: number, k: number): bigint | undefined =>
  k < 0 || k > n ? 0n : factorialRatio([n], [k, n - k]);

/** The Catalan number C(2n, n)/(n + 1). */
export const catalanExact = (n: number): bigint | undefined => factorialRatio([2 * n], [n, n + 1]);

/** The Fuss–Catalan number C(kn, n)/((k − 1)n + 1) of the full k-ary trees with n internal nodes
 *  (k ≥ 1), and 0 where no node has a child. */
export const fussCatalanExact = (n: number, k: number): bigint | undefined =>
  k < 1 ? 0n : factorialRatio([k * n], [n, (k - 1) * n + 1]);

/** The alternating sign matrices of order n: Π (3j + 1)!/(n + j)! over j = 0 … n − 1. */
export const alternatingSignMatricesExact = (n: number): bigint | undefined =>
  3 * n > EXACT_TOP_LIMIT
    ? undefined
    : factorialRatio(
        Array.from({ length: n }, (_, j) => 3 * j + 1),
        Array.from({ length: n }, (_, j) => n + j),
      );

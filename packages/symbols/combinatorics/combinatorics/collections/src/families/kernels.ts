// PascalCase kernels backing this library's MathJSON heads — a kernel's name IS its AST head, no
// mapping table. These are the certified permutation rank/unrank primitives, inlined from
// @enumeratio/math (permutations.ts / combinat.ts / notation.ts) so the package is a standalone,
// zero-runtime-dependency compute-engine library. The SQL target (sql-target.ts) owns snake_case
// emission; nothing here knows about SQL.

export type Permutation = number[]; // 1-indexed one-line notation

// Exact integer helpers for kernels whose ranks and counts run to 2^53. JS `%` is exact on
// doubles; `/` and `+` on values past 2^52 round, so a quotient is `(a - a % b) / b` and a
// reduction never adds the modulus to a rank.

/** `rank` reduced into 0..total-1, exactly. */
export function modRank(rank: number, total: number): number {
  const r = rank % total;
  return r < 0 ? r + total : r;
}

/** floor(a / b) for a >= 0 and b > 0, exact where `Math.floor(a / b)` rounds up near 2^52. */
export const floorDiv = (a: number, b: number): number => (a - (a % b)) / b;

// Bit kernels read a safe integer as two words, the low 32 bits and the rest: `>>` and `<<` on
// the whole number would truncate it to 32 bits.
const TWO32 = 4294967296;

/** The part of `r` above its low 32 bits (exact: the divisor is a power of two). */
export const highWord = (r: number): number => Math.floor(r / TWO32);
/** The low 32 bits of `r`, whose high word is `hi`. */
export const lowWord = (r: number, hi: number): number => r - hi * TWO32;
/** Bit b of the number whose words are `lo` and `hi`. */
export const bitOf = (lo: number, hi: number, b: number): number => (b < 32 ? (lo >>> b) & 1 : (hi >>> (b - 32)) & 1);
/** The number whose low word has bit b set for each b in `bits` (0-based), and the high word's. */
export function wordsOfBits(bits: Iterable<number>): [number, number] {
  let lo = 0;
  let hi = 0;
  for (const b of bits) {
    if (b < 32) lo |= 1 << b;
    else hi |= 1 << (b - 32);
  }
  return [lo, hi];
}
/** `lo` and `hi` as one number. */
export const joinWords = (lo: number, hi: number): number => (hi >>> 0) * TWO32 + (lo >>> 0);

/** n!  (exact JS number up to n = 18). SQL twin: factorial(n int). */
export function Factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

/** The r-th permutation of [n] in lex order (0-based rank), by Lehmer decode.
 *  SQL twin: permutation_unrank_lex(n int, ord bigint). */
export function PermutationUnrank(n: number, rank: number): Permutation {
  const N = Factorial(n);
  let rem = N ? modRank(Math.trunc(rank), N) : 0;
  const avail = Array.from({ length: n }, (_, i) => i + 1);
  const res: number[] = [];
  for (let k = n - 1; k >= 0; k--) {
    const f = Factorial(k);
    const idx = floorDiv(rem, f);
    rem = rem % f;
    res.push(avail[idx]);
    avail.splice(idx, 1);
  }
  return res;
}

/** Exact inverse of PermutationUnrank: the 0-based lex rank of a permutation word. */
export function PermutationRank(perm: Permutation): number {
  const n = perm.length;
  const avail = Array.from({ length: n }, (_, i) => i + 1);
  let rank = 0;
  let f = Factorial(Math.max(0, n - 1));
  for (let i = 0; i < n; i++) {
    const idx = avail.indexOf(perm[i]);
    rank += idx * f;
    avail.splice(idx, 1);
    const rem = n - 1 - i;
    if (rem > 0) f /= rem;
  }
  return rank;
}

/** Is `perm` a permutation of [n] (each of 1..n exactly once)? */
export function IsPermutationOf(perm: Permutation, n: number): boolean {
  if (perm.length !== n) return false;
  const seen = Array.from({ length: n + 1 }, () => false);
  for (const x of perm) {
    if (!Number.isInteger(x) || x < 1 || x > n || seen[x]) return false;
    seen[x] = true;
  }
  return true;
}

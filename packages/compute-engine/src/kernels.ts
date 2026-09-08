// PascalCase kernels backing this library's MathJSON heads — a kernel's name IS its AST head, no
// mapping table. These are the certified permutation rank/unrank primitives, inlined from
// @enumeratio/math (permutations.ts / combinat.ts / notation.ts) so the package is a standalone,
// zero-runtime-dependency compute-engine library. The SQL target (sql-target.ts) owns snake_case
// emission; nothing here knows about SQL.

export type Permutation = number[]; // 1-indexed one-line notation

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
  let rem = N ? (((Math.trunc(rank) % N) + N) % N) : 0;
  const avail = Array.from({ length: n }, (_, i) => i + 1);
  const res: number[] = [];
  for (let k = n - 1; k >= 0; k--) {
    const f = Factorial(k);
    const idx = Math.floor(rem / f);
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

/** Lehmer code L[i] = #{ j > i : perm[j] < perm[i] }, positions 0..n-2 (the always-0 tail dropped). */
export function LehmerCode(perm: Permutation): number[] {
  const avail = perm.map((_, i) => i + 1);
  return perm.slice(0, -1).map((x) => {
    const idx = avail.indexOf(x);
    avail.splice(idx, 1);
    return idx;
  });
}

/** Inversions (Coxeter length) = sum of the Lehmer code. SQL twin: perm_inversions(p permutation). */
export function Inversions(perm: Permutation): number {
  return LehmerCode(perm).reduce((a, b) => a + b, 0);
}

/** Is `perm` a permutation of [n] (each of 1..n exactly once)? */
export function IsPermutationOf(perm: Permutation, n: number): boolean {
  if (perm.length !== n) return false;
  const seen = new Array(n + 1).fill(false);
  for (const x of perm) {
    if (!Number.isInteger(x) || x < 1 || x > n || seen[x]) return false;
    seen[x] = true;
  }
  return true;
}

/** Canonical one-line text: digits run together up to n = 9, space-separated beyond.
 *  SQL twin: one_line(p permutation) / notation(p permutation). */
export function NotationPermutation(image: number[]): string {
  return (image?.length ?? 0) <= 9 ? (image ?? []).join("") : image.join(" ");
}

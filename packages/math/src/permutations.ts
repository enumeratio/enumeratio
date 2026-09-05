// Permutation rank/unrank + Lehmer-code primitives. Ported from ~/Playground/ideas/numbers/src/combinat.ts
// (permutationUnrank/permutationRank/lehmerCode/inversions), renamed to match their SQL twins:
//   numbers-repo name      →  SQL name (file)
//   permutationUnrank      →  permutation_unrank_lex (permutations.sql) — a bare-callable SQL fn, twinned directly
//   permutationRank        →  no bare SQL fn; twinned by round-tripping permutation_unrank_lex's own output
//   lehmerCode             →  to_inversion(p).code (lehmer_codes.sql) — SQL drops the trailing 0, TS keeps it
//                              (see header note in lehmer_codes.sql); slice(0,-1) to compare
//   inversions             →  perm_inversions(p) (statistics.sql) — direct stat, same value as sum(lehmerCode)

import { factorial } from "./combinat.js";

export type Permutation = number[]; // 1-indexed one-line notation

/** SQL twin: permutation_unrank_lex(n int, ord bigint) — Lehmer decode; the r-th permutation of [n] in lex order. */
export function permutation_unrank(n: number, rank: number): Permutation {
  const N = factorial(n);
  let rem = N ? (((Math.trunc(rank) % N) + N) % N) : 0;
  const avail = Array.from({ length: n }, (_, i) => i + 1);
  const res: number[] = [];
  for (let k = n - 1; k >= 0; k--) {
    const f = factorial(k);
    const idx = Math.floor(rem / f);
    rem = rem % f;
    res.push(avail[idx]);
    avail.splice(idx, 1);
  }
  return res;
}

/** No bare SQL fn — the exact inverse of permutation_unrank_lex (round-trips against it in selfcert-math.mts). */
export function permutation_rank(perm: Permutation): number {
  const n = perm.length;
  const avail = Array.from({ length: n }, (_, i) => i + 1);
  let rank = 0;
  let f = factorial(Math.max(0, n - 1));
  for (let i = 0; i < n; i++) {
    const idx = avail.indexOf(perm[i]);
    rank += idx * f;
    avail.splice(idx, 1);
    const rem = n - 1 - i;
    if (rem > 0) f /= rem;
  }
  return rank;
}

/**
 * Lehmer code: L[i] = #{ j > i : perm[j] < perm[i] } for every position (length n, last entry always 0).
 * SQL twin: to_inversion(p permutation).code (lehmer_codes.sql) — same formula, but the array there is length
 * n-1 (the always-0 trailing entry is dropped from the stored `permutation_inversion` carrier).
 */
export function lehmer_code(perm: Permutation): number[] {
  const avail = perm.map((_, i) => i + 1);
  return perm.map((x) => {
    const idx = avail.indexOf(x);
    avail.splice(idx, 1);
    return idx;
  });
}

/** SQL twin: perm_inversions(p permutation) — statistics.sql. Coxeter length = sum of the Lehmer code. */
export function inversions(perm: Permutation): number {
  return lehmer_code(perm).reduce((a, b) => a + b, 0);
}

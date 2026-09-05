// Integer composition rank/unrank via the gap-cut bijection: a composition of n ↔ a subset of the n-1 gaps
// between n unit cells (bit i-1 cuts gap i). Ported from ~/Playground/ideas/numbers/src/combinat.ts's
// compositionFromMask/integerCompositionRank, renamed to match packages/data/sqlsrc/integer_compositions.sql.

/** SQL twin: composition_from_mask(n int, mask bigint) — integer_compositions.sql. mask IS the rank. */
export function composition_from_mask(n: number, mask: number): number[] {
  if (n === 0) return [];
  const parts: number[] = [];
  let run = 1;
  for (let i = 1; i <= n - 1; i++) {
    if ((mask >> (i - 1)) & 1) {
      parts.push(run);
      run = 1;
    } else {
      run++;
    }
  }
  parts.push(run);
  return parts;
}

/**
 * No standalone SQL twin — the rank of a composition IS the gap-cut mask that composition_from_mask decodes, so
 * this is its exact inverse (not a separately-named SQL primitive, just the read direction of the same bijection).
 */
export function composition_rank(parts: number[]): number {
  let mask = 0;
  let cum = 0;
  for (let i = 0; i < parts.length - 1; i++) {
    cum += parts[i];
    mask |= 1 << (cum - 1);
  }
  return mask;
}

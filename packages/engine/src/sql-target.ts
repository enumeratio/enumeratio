// The SQL target: snake_case emission for a subset of this library's heads, over the enumeratio
// SQL core. It owns ALL casing translation — the MathJSON heads and TS kernels stay PascalCase; the
// snake_case lives here and nowhere else. Wave 1 emits the permutations vertical:
//
//   SymmetricGroup(n)          -> permutation_unrank_lex over its fibre (via At)
//   At(coll, r)                -> the r-th element      (CE 1-based → SQL ord = r-1)
//   Inversions(perm)           -> perm_inversions(perm)
//
// Emitting a scalar composite like Inversions(At(SymmetricGroup(n), r)) yields a single SQL
// expression: perm_inversions(permutation_unrank_lex(n::int, (r-1)::bigint)).

import type { Expression } from "@cortex-js/compute-engine";

const intOf = (x: any): number => Math.trunc(Number(x?.re ?? x?.value ?? x?.json));

/** SQL for the r-th (1-based) permutation of [n]: permutation_unrank_lex(n, r-1). */
export function sqlPermutationAt(n: number, r1based: number): string {
  return `permutation_unrank_lex(${n}::int, ${r1based - 1}::bigint)`;
}

/** SQL wrapping a permutation-valued fragment in the inversions stat. */
export function sqlInversions(permSql: string): string {
  return `perm_inversions(${permSql})`;
}

/**
 * Emit a single SQL scalar expression for a supported boxed head. Recognizes
 * Inversions(At(SymmetricGroup(n), r)) and its inner forms; returns undefined for anything else
 * (the target declines cleanly rather than emitting wrong SQL).
 */
export function emitScalarSql(expr: Expression): string | undefined {
  const head = (expr as any).operator as string | undefined;
  const ops = (expr as any).ops as Expression[] | undefined;
  if (!head || !ops) return undefined;

  if (head === "At") {
    const inner = ops[0] as any;
    if (inner?.operator === "SymmetricGroup") {
      return sqlPermutationAt(intOf(inner.ops[0]), intOf(ops[1]));
    }
    return undefined;
  }
  if (head === "Inversions") {
    const permSql = emitScalarSql(ops[0]);
    if (permSql) return sqlInversions(permSql);
    return undefined;
  }
  return undefined;
}

// The SQL target: snake_case emission for a subset of this library's heads, over the enumeratio
// SQL core. It owns ALL casing translation — the MathJSON heads and TS kernels stay PascalCase; the
// snake_case lives here and nowhere else. Wave 1 emits the permutations vertical:
//
//   Permutations(n)            -> permutation_unrank_lex over its fibre (via At)
//   At(coll, r)                -> the r-th element      (CE 1-based → SQL ord = r-1)
//   Inversions(perm)           -> perm_inversions(perm)
//
// Emitting a scalar composite like Inversions(At(Permutations(n), r)) yields a single SQL
// expression: perm_inversions(permutation_unrank_lex(n::int, (r-1)::bigint)).
//
// SymmetricGroup (the Coxeter/cycle-notation sibling, #406) has NO SQL twin here yet — it declines
// cleanly via sqlCollectionAt returning undefined, same as any other untwinned head.

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

// The heads with a certified SQL twin, mapped to their SQL collection name (the realizer's generic
// `unrank(<collection>(params), ord)` dispatch). Permutations has its own bare fn and is handled apart.
const SQL_COLLECTION: Record<string, string> = {
  IntegerCompositions: "integer_compositions",
  IntegerPartitions: "integer_partitions",
  PartitionsIntoKParts: "k_part_partitions",
  SetPartitions: "set_partitions",
  SetPartitionsIntoKBlocks: "set_partitions_into_k_blocks",
  SetCompositions: "set_compositions",
};

/** SQL for the r-th (1-based) element of a SQL-twinned family; undefined if the head has no twin.
 *  Permutations → the permutation composite (permutation_unrank_lex); the rest → the generic
 *  `(unrank(<collection>(params), ord)).value` the SQL realizer dispatches (ord is 0-based = r-1). */
export function sqlCollectionAt(head: string, params: number[], r1based: number): string | undefined {
  if (head === "Permutations") return sqlPermutationAt(params[0], r1based);
  const coll = SQL_COLLECTION[head];
  if (!coll) return undefined;
  const args = params.map((p) => `${p}::int`).join(", ");
  return `(unrank(${coll}(${args}), ${r1based - 1}::bigint)).value`;
}

/**
 * Emit a single SQL scalar expression for a supported boxed head. Recognizes `At(<family>(params), r)` for
 * every SQL-twinned family, and the Inversions stat over a permutation. Returns undefined for anything else
 * (the target declines cleanly rather than emitting wrong SQL).
 */
export function emitScalarSql(expr: Expression): string | undefined {
  const head = (expr as any).operator as string | undefined;
  const ops = (expr as any).ops as Expression[] | undefined;
  if (!head || !ops) return undefined;

  if (head === "At") {
    const inner = ops[0] as any;
    if (!inner?.operator || !inner.ops) return undefined;
    return sqlCollectionAt(inner.operator, inner.ops.map(intOf), intOf(ops[1]));
  }
  if (head === "Inversions") {
    const permSql = emitScalarSql(ops[0]);
    return permSql ? sqlInversions(permSql) : undefined;
  }
  return undefined;
}

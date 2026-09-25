import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf, wrapOperator } from "@enumeratio/boxed";

// #113: MatrixRank of a square matrix whose entries are pairwise-distinct symbols is n,
// its full size — Wolfram's documented "generic rank" answer, and provably so: the
// determinant of an n×n matrix of n² independent indeterminates is, by the Leibniz
// formula, a sum of n! monomials, one per permutation, each the product of the n entries
// at that permutation's positions. Two different permutations pick at least one different
// position each, so — since every entry is a DIFFERENT symbol — they can never produce the
// same monomial, and so can never cancel. The polynomial is therefore not identically
// zero, and a square matrix whose determinant isn't identically zero has full rank.
//
// This does NOT extend to a matrix with a repeated symbol (`[[x, 1], [1, x]]`): the
// determinant `x² − 1` is still generically nonzero, but "generically" now depends on a
// relation between entries that this argument doesn't settle, so compute-engine's own
// unevaluated answer stands there (see that entry's own divergence note).
const isDistinctSymbolMatrix = (op: BoxedExpression): number | undefined => {
  if (op.operator !== "List") return undefined;
  const rows = operandsOf(op);
  const n = rows.length;
  if (n === 0) return undefined;
  const names: string[] = [];
  for (const row of rows) {
    if (row.operator !== "List") return undefined;
    const entries = operandsOf(row);
    if (entries.length !== n) return undefined; // square only
    for (const entry of entries) {
      const name = symbolNameOf(entry);
      if (name === undefined) return undefined;
      names.push(name);
    }
  }
  return new Set(names).size === names.length ? n : undefined;
};

export function declareLinearAlgebra113(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["MatrixRank", 1],
    (ops) => isDistinctSymbolMatrix(ops[0]) !== undefined,
    () => (ops) => ce.number(isDistinctSymbolMatrix(ops[0]) as number),
    1,
  );
}

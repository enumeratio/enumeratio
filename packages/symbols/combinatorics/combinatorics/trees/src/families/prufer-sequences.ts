// PruferSequences split out of collections/src/families/tableaux-trees.ts (§4 step 5,
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible):
// it now carries "PruferSequence" -- a word, counted in its own right (n^(n-2)), not the edge
// list the Prüfer bijection decodes to (that's LabeledTree's job: see
// ../prufer-conversion.ts, a LabeledTree(...) constructor overload built with structures'
// attachConversion). Defined in Epsil (Tuples(n, n − 2)); the TS functions below are the
// independent reading its agreement test checks it against.
import { pruferSequences } from "../../../collections/src/families/closed-forms.ts";
import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import { TupleCount, TupleUnrank, TupleRank, IsTupleOf } from "../../../collections/src/families/kernels-extra.ts";

export function PruferSequenceCount(n: number): number {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  return TupleCount(n, n - 2);
}
export function PruferSequenceUnrank(n: number, rank: number): number[] {
  if (n <= 2) return [];
  return TupleUnrank(n, n - 2, rank);
}
export function PruferSequenceRank(seq: number[], n: number): number {
  if (n <= 2) return 0;
  return TupleRank(seq, n);
}
export function IsPruferSequenceOf(seq: unknown, n: number): boolean {
  if (n <= 2) return Array.isArray(seq) && seq.length === 0;
  return Array.isArray(seq) && IsTupleOf(seq as number[], n, n - 2);
}

export const entries: (NumberKernel | EpsilFamily)[] = [
  pruferSequences({
    head: "PruferSequences",
    params: ["_n"],
    carrier: "PruferSequence",
    fast: {
      count: ([n]) => PruferSequenceCount(n),
      unrank: ([n], r) => PruferSequenceUnrank(n, r),
      rank: (x, [n]) => PruferSequenceRank(x as number[], n),
      valid: (x, [n]) => IsPruferSequenceOf(x, n),
    },
  }),
];

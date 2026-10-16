// Moved out of the runtime by BL-225: kernels only tests/readings and the agreement tests use.
import { IsTupleOf, TupleCount, TupleRank, TupleUnrank } from "./collections-kernels-extra.ts";

export function IsPruferSequenceOf(seq: unknown, n: number): boolean {
  if (n <= 2) return Array.isArray(seq) && seq.length === 0;
  return Array.isArray(seq) && IsTupleOf(seq as number[], n, n - 2);
}

export function PruferSequenceRank(seq: number[], n: number): number {
  if (n <= 2) return 0;
  return TupleRank(seq, n);
}

export function PruferSequenceUnrank(n: number, rank: number): number[] {
  if (n <= 2) return [];
  return TupleUnrank(n, n - 2, rank);
}

export function PruferSequenceCount(n: number): number {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  return TupleCount(n, n - 2);
}

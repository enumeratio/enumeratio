import type { BoxedExpression } from "@cortex-js/compute-engine";
import { integerAt } from "@enumeratio/boxed";

// The one collection contract, shared by every family. A FamilyKernel is a pure kernel
// (count / unrank / rank / valid) over plain JS values, with NO compute-engine
// dependency. The engine wiring (MathJSON boxing, CE collection handlers) is declare.ts.
//
// element shape (`kind`):
//   "ints"   -> number[]     (words, parts, subsets, step sequences)
//   "blocks" -> number[][]   (set partitions, matchings)
//   "nested" -> NestedTree   (recursively nested trees; leaf = a number)
//   "scalar" -> number       (a single integer; a term of a numeric sequence/set)

/** A leaf is a number (0 for trees, a label for groupings). */
export type NestedTree = number | NestedTree[];

/** A boxed MathJSON expression, as the CE collection handlers see it: the decoders
 *  below walk `ops`, and `intOf` reads the leaves through @enumeratio/boxed. */
export interface Boxed {
  readonly ops?: readonly Boxed[];
}

type Element = number[] | number[][] | NestedTree | number;

/** A pure combinatorial family: closed-form count + rank/unrank/valid kernels.
 *  `paramCount: 0` is a value (`Primes`), otherwise an operator (`SmoothNumbers(k)`);
 *  `p` is the (possibly empty) parameter tuple. */
export interface FamilyKernel {
  readonly head: string;
  readonly paramCount: 0 | 1 | 2 | 3;
  readonly kind: "ints" | "blocks" | "nested" | "scalar";
  readonly count: (p: number[]) => number;
  readonly unrank: (p: number[], r: number) => Element;
  readonly rank: (element: unknown, p: number[]) => number;
  readonly valid: (element: unknown, p: number[]) => boolean;
}

/** Boxed integer -> JS number, `NaN` when the expression is not one.
 *  The decoders below are total, and `NaN` is an invalid element every family's
 *  `valid()` already rejects — which is why this rejects rather than truncates. */
export const intOf = (x: Boxed | undefined): number =>
  integerAt(x as unknown as BoxedExpression | undefined) ?? Number.NaN;

// MathJSON encoders (element -> boxed MathJSON expression input).
export const listMJ = (xs: number[]): unknown => ["List", ...xs];
export const blocksMJ = (bs: number[][]): unknown => ["List", ...bs.map((b) => ["List", ...b])];
export const nestMJ = (t: NestedTree): unknown =>
  Array.isArray(t) ? ["List", ...t.map(nestMJ)] : t;

// boxed MathJSON -> JS element (the inverse, for membership/rank).
export const asIntList = (t: Boxed): number[] => (t.ops ?? []).map(intOf);
export const asBlockList = (t: Boxed): number[][] =>
  (t.ops ?? []).map((b) => (b.ops ?? []).map(intOf));
export const denest = (x: Boxed): NestedTree =>
  x.ops ? (x.ops.map(denest) as NestedTree[]) : intOf(x);

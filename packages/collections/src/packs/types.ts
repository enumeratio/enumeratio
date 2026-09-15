import type { BoxedExpression } from "@cortex-js/compute-engine";
import { integerAt } from "@enumeratio/boxed";

// The one collection contract, shared by every pack. A PackEntry is a pure kernel
// (count / unrank / rank / valid) over plain JS values, with NO compute-engine
// dependency. The engine wiring (MathJSON boxing, CE CollectionHandlers) lives in
// ../library.ts via `adaptEntry` + `gradedHandlers`.
//
// element shape (`kind`):
//   "ints"   -> number[]     (words, parts, subsets, step sequences)
//   "blocks" -> number[][]   (set partitions, matchings)
//   "nested" -> NestedTree   (recursively nested trees; leaf = a number)

/** A leaf is a number (0 for trees, a label for groupings). */
export type NestedTree = number | NestedTree[];

/** A boxed MathJSON expression, as the CE collection handlers see it: the decoders
 *  below walk `ops`, and `intOf` reads the leaves through @enumeratio/boxed. */
export interface Boxed {
  readonly ops?: readonly Boxed[];
}

type Element = number[] | number[][] | NestedTree;

/** A pure combinatorial family: closed-form count + rank/unrank/valid kernels. */
export interface PackEntry {
  readonly head: string;
  readonly paramCount: 1 | 2;
  readonly kind: "ints" | "blocks" | "nested";
  readonly count: (p: number[]) => number;
  readonly unrank: (p: number[], r: number) => Element;
  readonly rank: (element: unknown, p: number[]) => number;
  readonly valid: (element: unknown, p: number[]) => boolean;
}

/** A CE-facing family: count, `elt` (index -> MathJSON), and membership-gated rank. */
export interface FamilySpec {
  readonly paramCount: 1 | 2;
  readonly signature: string;
  readonly count: (p: number[]) => number;
  readonly elt: (p: number[], rank0: number) => unknown;
  readonly rank: (target: Boxed, p: number[]) => number | undefined;
}

/** Boxed integer -> JS number, `NaN` when the expression is not one.
 *  The decoders below are total, and `NaN` is an invalid element every pack's
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

const signatureFor = (kind: PackEntry["kind"], pc: 1 | 2): string => {
  if (kind === "nested") {
    return pc === 1 ? "(integer) -> collection" : "(integer, integer) -> collection";
  }
  const inner = kind === "ints" ? "list<list<integer>>" : "list<list<list<integer>>>";
  return pc === 1 ? `(integer) -> ${inner}` : `(integer, integer) -> ${inner}`;
};

/** Adapt a pure PackEntry into a CE-facing FamilySpec (boxing + membership-gated rank). */
export function adaptEntry(e: PackEntry): FamilySpec {
  const encode = e.kind === "ints" ? listMJ : e.kind === "blocks" ? blocksMJ : nestMJ;
  const decode = e.kind === "ints" ? asIntList : e.kind === "blocks" ? asBlockList : denest;
  return {
    paramCount: e.paramCount,
    signature: signatureFor(e.kind, e.paramCount),
    count: e.count,
    elt: (p, r) => encode(e.unrank(p, r) as never),
    rank: (t, p) => {
      const element = decode(t);
      return e.valid(element, p) ? e.rank(element, p) : undefined;
    },
  };
}

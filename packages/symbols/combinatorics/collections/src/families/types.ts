import type { BoxedExpression } from "@cortex-js/compute-engine";
import { integerAt } from "@enumeratio/boxed";

// The one collection contract, shared by every family. A FamilyKernel is a pure kernel
// (count / unrank / rank / valid) over plain JS values, with NO compute-engine
// dependency. The engine wiring (MathJSON boxing, CE collection handlers) is declare.ts.
// Counts and ranks are bigint (design/plausible.md §3.4); most families are still written
// as a NumberKernel and lifted by `numberKernel`, which refuses rather than rounds past 2^53.
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

export type Element = number[] | number[][] | NestedTree | number;

/** A count: bigint when finite. The only numbers allowed are `Infinity` (known infinite)
 *  and `NaN` (unknown — a declared open problem, e.g. TwinPrimes). */
export type Count = bigint | number;

interface Family {
  readonly head: string;
  readonly paramCount: 0 | 1 | 2 | 3;
  readonly kind: "ints" | "blocks" | "nested" | "scalar";
  readonly valid: (element: unknown, p: number[]) => boolean;
}

/** A pure combinatorial family: count + rank/unrank/valid kernels, positions in bigint.
 *  `paramCount: 0` is a value (`Primes`), otherwise an operator (`SmoothNumbers(k)`);
 *  `p` is the (possibly empty) parameter tuple. `rank` is the 0-based place in the fiber
 *  (the family at `p`), `-1n` for a non-member. */
export interface FamilyKernel extends Family {
  readonly count: (p: number[]) => Count;
  readonly unrank: (p: number[], r: bigint) => Element;
  readonly rank: (element: unknown, p: number[]) => bigint;
}

/** A family written in plain numbers — exact only below 2^53. */
export interface NumberKernel extends Family {
  readonly count: (p: number[]) => number;
  readonly unrank: (p: number[], r: number) => Element;
  readonly rank: (element: unknown, p: number[]) => number;
}

const exact = (head: string, what: string, n: number, p: number[]): bigint => {
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(`${head}(${p.join(", ")}): ${what} ${n} exceeds 2^53; its kernel is not bigint yet`);
  }
  return BigInt(n);
};

/** Lift a NumberKernel into the bigint contract, refusing (RangeError) rather than
 *  converting a value a double has already rounded. */
export function numberKernel(k: NumberKernel): FamilyKernel {
  return {
    head: k.head,
    paramCount: k.paramCount,
    kind: k.kind,
    valid: k.valid,
    count: (p) => {
      const c = k.count(p);
      return Number.isNaN(c) || c === Number.POSITIVE_INFINITY ? c : exact(k.head, "count", c, p);
    },
    unrank: (p, r) => {
      if (r > BigInt(Number.MAX_SAFE_INTEGER)) exact(k.head, "rank", Number(r), p);
      return k.unrank(p, Number(r));
    },
    rank: (element, p) => {
      const r = k.rank(element, p);
      return r < 0 ? -1n : exact(k.head, "rank", r, p);
    },
  };
}

/** A count as a plain number for casual use: exact below 2^53, `undefined` past it
 *  (never a rounded wrong number); `Infinity` and `NaN` pass through. */
export const countNumber = (c: Count): number | undefined =>
  typeof c === "number" ? c : c <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(c) : undefined;

/** Boxed integer -> JS number, `NaN` when the expression is not one.
 *  The decoders below are total, and `NaN` is an invalid element every family's
 *  `valid()` already rejects — which is why this rejects rather than truncates. */
export const intOf = (x: Boxed | undefined): number =>
  integerAt(x as unknown as BoxedExpression | undefined) ?? Number.NaN;

// MathJSON encoders (element -> boxed MathJSON expression input).
export const listMJ = (xs: number[]): unknown => ["List", ...xs];
export const blocksMJ = (bs: number[][]): unknown => ["List", ...bs.map((b) => ["List", ...b])];
export const nestMJ = (t: NestedTree): unknown => (Array.isArray(t) ? ["List", ...t.map(nestMJ)] : t);

// boxed MathJSON -> JS element (the inverse, for membership/rank).
export const asIntList = (t: Boxed): number[] => (t.ops ?? []).map(intOf);
export const asBlockList = (t: Boxed): number[][] => (t.ops ?? []).map((b) => (b.ops ?? []).map(intOf));
export const denest = (x: Boxed): NestedTree => (x.ops ? (x.ops.map(denest) as NestedTree[]) : intOf(x));

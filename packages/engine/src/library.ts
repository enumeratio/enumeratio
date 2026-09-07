// The compute-engine LibraryDefinition for enumeratio. It publishes enumeratio's rank/unrank catalog as
// loadable CE operators. This is the "extend" posture: install it into any ComputeEngine and CE's WHOLE
// standard library stays live (Add, Factorial, Fibonacci, Totient, Sum, Map, …) — we declare our heads ON
// TOP, reimplementing nothing, and CE's operators compose over our handlers. (See interop.test.ts.)
//
// The thesis in one line: CE's combinatorial collections have closed-form counts but SCAN-based random
// access (its `at` is a linear walk), and NO rank (element → index) anywhere. Every collection here supplies
// an O(1) `at` (via unrank) AND `Rank` (its inverse) — the half CE lacks entirely.
//
// Heads as a family of siblings (D2): CE ships `Permutations(list)` / `Combinations(list,k)` — arrangements of
// a *given* collection. Ours are graded families indexed by SIZE — siblings keyed by domain (a concrete list
// vs a size), the way enumeratio hangs carrier/domain and grading-axis/family configs off distinct heads.
// (Absorbing both onto one head isn't viable: CE's are signature-locked overloads pinned to collection args.)
// Head/package names still provisional.

import type { LibraryDefinition, Expression, ComputeEngine, CollectionHandlers } from "@cortex-js/compute-engine";
import { Factorial, PermutationUnrank, PermutationRank, IsPermutationOf, Inversions } from "./kernels.js";
import {
  CompositionCount, CompositionFromMask, CompositionRank, IsCompositionOf,
  PartitionNumber, IntegerPartitionUnrank, IntegerPartitionRank, IsPartitionOf,
  KPartPartitionCount, IntegerPartitionKUnrank, IntegerPartitionKRank,
  Bell, RgsUnrank, RgsRank, RgsToBlocks, BlocksToRgs, IsSetPartitionOf,
  StirlingSecond, SetPartitionsIntoKBlocksUnrank, SetPartitionsIntoKBlocksRank,
  Fubini, SetCompositionUnrank, SetCompositionRank, LabelsToOrderedBlocks, BlocksToLabels,
} from "./kernels-combinatorics.js";
import {
  SubsetCount, SubsetUnrank, SubsetRank, IsSubsetOf,
  KSubsetCount, KSubsetUnrank, KSubsetRank, IsKSubsetOf,
  TupleCount, TupleUnrank, TupleRank, IsTupleOf,
  CompositionsIntoKPartsCount, CompositionsIntoKPartsUnrank, CompositionsIntoKPartsRank, IsCompositionIntoKParts,
  WeakCompositionCount, WeakCompositionUnrank, WeakCompositionRank, IsWeakCompositionOf,
  MultisetCount, MultisetUnrank, MultisetRank, IsMultisetOf,
  LatticePathCount, LatticePathUnrank, LatticePathRank, IsLatticePathOf,
  KPermutationCount, KPermutationUnrank, KPermutationRank, IsKPermutationOf,
  SignedPermutationCount, SignedPermutationUnrank, SignedPermutationRank, IsSignedPermutationOf,
  ColoredPermutationCount, ColoredPermutationUnrank, ColoredPermutationRank, IsColoredPermutationOf,
  DyckPathCount, DyckPathUnrank, DyckPathRank, IsDyckPath,
} from "./kernels-extra.js";

const intOf = (x: any): number => Math.trunc(Number(x?.re ?? x?.value ?? x?.json));
const engineOf = (e: any): ComputeEngine => e.engine;

type MathJson = any;
const asIntList = (t: any): number[] => (t?.ops ?? []).map(intOf);
const asBlockList = (t: any): number[][] => (t?.ops ?? []).map((b: any) => (b?.ops ?? []).map(intOf));
const listMJ = (xs: number[]): MathJson => ["List", ...xs];
const blocksMJ = (bs: number[][]): MathJson => ["List", ...bs.map((b) => ["List", ...b])];

// ─── one spec per family: the single source of truth handlers, Rank and RandomElement share. count/elt/rank
// agree on the SAME order; `rank` returns a 0-based index or undefined when the target is not a member.
interface FamilySpec {
  paramCount: 1 | 2;
  signature: string;
  count: (p: number[]) => number;
  elt: (p: number[], rank0: number) => MathJson;
  rank: (target: Expression, p: number[]) => number | undefined;
}

// helpers for the two element shapes
const intListSpec = (
  paramCount: 1 | 2,
  count: (p: number[]) => number,
  unrank: (p: number[], r: number) => number[],
  isMember: (a: number[], p: number[]) => boolean,
  rankFn: (a: number[], p: number[]) => number,
): FamilySpec => ({
  paramCount,
  signature: paramCount === 1 ? "(integer) -> list<list<integer>>" : "(integer, integer) -> list<list<integer>>",
  count,
  elt: (p, r) => listMJ(unrank(p, r)),
  rank: (t, p) => { const a = asIntList(t); return isMember(a, p) ? rankFn(a, p) : undefined; },
});

const FAMILIES: Record<string, FamilySpec> = {
  // ── permutations (element = one-line word) ──
  SymmetricGroup: intListSpec(1, ([n]) => Factorial(n), ([n], r) => PermutationUnrank(n, r),
    (a, [n]) => IsPermutationOf(a, n), (a) => PermutationRank(a)),
  KPermutations: intListSpec(2, ([n, k]) => KPermutationCount(n, k), ([n, k], r) => KPermutationUnrank(n, k, r),
    (a, [n, k]) => IsKPermutationOf(a, n, k), (a, [n]) => KPermutationRank(a, n)),
  SignedPermutations: intListSpec(1, ([n]) => SignedPermutationCount(n), ([n], r) => SignedPermutationUnrank(n, r),
    (a, [n]) => IsSignedPermutationOf(a, n), (a) => SignedPermutationRank(a)),

  // ── compositions / partitions (element = parts) ──
  IntegerCompositions: intListSpec(1, ([n]) => CompositionCount(n), ([n], r) => CompositionFromMask(n, r),
    (a, [n]) => IsCompositionOf(a, n), (a) => CompositionRank(a)),
  CompositionsIntoKParts: intListSpec(2, ([n, k]) => CompositionsIntoKPartsCount(n, k), ([n, k], r) => CompositionsIntoKPartsUnrank(n, k, r),
    (a, [n, k]) => IsCompositionIntoKParts(a, n, k), (a) => CompositionsIntoKPartsRank(a)),
  WeakCompositions: intListSpec(2, ([n, k]) => WeakCompositionCount(n, k), ([n, k], r) => WeakCompositionUnrank(n, k, r),
    (a, [n, k]) => IsWeakCompositionOf(a, n, k), (a) => WeakCompositionRank(a)),
  IntegerPartitions: intListSpec(1, ([n]) => PartitionNumber(n), ([n], r) => IntegerPartitionUnrank(n, r),
    (a, [n]) => IsPartitionOf(a, n), (a, [n]) => IntegerPartitionRank(a, n)),
  PartitionsIntoKParts: intListSpec(2, ([n, k]) => KPartPartitionCount(n, k), ([n, k], r) => IntegerPartitionKUnrank(n, k, r),
    (a, [n, k]) => IsPartitionOf(a, n, k), (a, [n]) => IntegerPartitionKRank(a, n)),

  // ── subsets / multisets / tuples / lattice paths / dyck (element = a list) ──
  Subsets: intListSpec(1, ([n]) => SubsetCount(n), ([n], r) => SubsetUnrank(n, r),
    (a, [n]) => IsSubsetOf(a, n), (a) => SubsetRank(a)),
  KSubsets: intListSpec(2, ([n, k]) => KSubsetCount(n, k), ([n, k], r) => KSubsetUnrank(n, k, r),
    (a, [n, k]) => IsKSubsetOf(a, n, k), (a) => KSubsetRank(a)),
  Multisets: intListSpec(2, ([n, k]) => MultisetCount(n, k), ([n, k], r) => MultisetUnrank(n, k, r),
    (a, [n, k]) => IsMultisetOf(a, n, k), (a) => MultisetRank(a)),
  Tuples: intListSpec(2, ([n, k]) => TupleCount(n, k), ([n, k], r) => TupleUnrank(n, k, r),
    (a, [n, k]) => IsTupleOf(a, n, k), (a, [n]) => TupleRank(a, n)),
  LatticePaths: intListSpec(2, ([a, b]) => LatticePathCount(a, b), ([a, b], r) => LatticePathUnrank(a, b, r),
    (x, [a, b]) => IsLatticePathOf(x, a, b), (x) => LatticePathRank(x)),
  DyckPaths: intListSpec(1, ([n]) => DyckPathCount(n), ([n], r) => DyckPathUnrank(n, r),
    (a, [n]) => IsDyckPath(a, n), (a) => DyckPathRank(a)),

  // ── set partitions / compositions (element = blocks) ──
  SetPartitions: {
    paramCount: 1, signature: "(integer) -> list<list<list<integer>>>",
    count: ([n]) => Bell(n), elt: ([n], r) => blocksMJ(RgsToBlocks(RgsUnrank(n, r))),
    rank: (t, [n]) => { const b = asBlockList(t); return IsSetPartitionOf(b, n) ? RgsRank(BlocksToRgs(b, n)) : undefined; },
  },
  SetPartitionsIntoKBlocks: {
    paramCount: 2, signature: "(integer, integer) -> list<list<list<integer>>>",
    count: ([n, k]) => StirlingSecond(n, k), elt: ([n, k], r) => blocksMJ(RgsToBlocks(SetPartitionsIntoKBlocksUnrank(n, k, r))),
    rank: (t, [n, k]) => { const b = asBlockList(t); return IsSetPartitionOf(b, n, k) ? SetPartitionsIntoKBlocksRank(BlocksToRgs(b, n), k) : undefined; },
  },
  SetCompositions: {
    paramCount: 1, signature: "(integer) -> list<list<list<integer>>>",
    count: ([n]) => Fubini(n), elt: ([n], r) => blocksMJ(LabelsToOrderedBlocks(SetCompositionUnrank(n, r))),
    rank: (t, [n]) => { const b = asBlockList(t); return IsSetPartitionOf(b, n) ? SetCompositionRank(BlocksToLabels(b), n) : undefined; },
  },

  // ── colored permutations (element = [image, colors]) ──
  ColoredPermutations: {
    paramCount: 2, signature: "(integer, integer) -> list<list<list<integer>>>",
    count: ([n, k]) => ColoredPermutationCount(n, k),
    elt: ([n, k], r) => { const [img, cols] = ColoredPermutationUnrank(n, k, r); return blocksMJ([img, cols]); },
    rank: (t, [n, k]) => {
      const b = asBlockList(t);
      const img = b[0] ?? [], cols = b[1] ?? [];
      return IsColoredPermutationOf(img, cols, n, k) ? ColoredPermutationRank(img, cols, k) : undefined;
    },
  },
};

const readParams = (coll: any, pc: 1 | 2): number[] =>
  pc === 1 ? [intOf(coll.op1)] : [intOf(coll.op1), intOf(coll.op2)];

// ─── rankOf: element → 0-based index over ANY of our heads (families, views, combinators). Recursive, so a
// Product of two Reversed collections still ranks. Returns undefined for a non-member. Backs both Rank and
// membership for the views/combinators.
function rankOf(coll: any, elt: any): number | undefined {
  const head = coll?.operator as string | undefined;
  if (!head) return undefined;
  const spec = FAMILIES[head];
  if (spec) return spec.rank(elt, readParams(coll, spec.paramCount));
  if (head === "Reversed") {
    const src = coll.op1; const r = rankOf(src, elt);
    return r === undefined ? undefined : (src.count as number) - 1 - r;
  }
  if (head === "Rotated") {
    const src = coll.op1; const k = intOf(coll.op2); const r = rankOf(src, elt);
    if (r === undefined) return undefined;
    const N = src.count as number; return (((r - k) % N) + N) % N;
  }
  if (head === "Window") {
    const src = coll.op1; const start = intOf(coll.op2); const len = intOf(coll.op3);
    const r = rankOf(src, elt);
    if (r === undefined) return undefined;
    const local = r - (start - 1);
    const cnt = Math.max(0, Math.min(len, (src.count as number) - start + 1));
    return local >= 0 && local < cnt ? local : undefined;
  }
  if (head === "Concat") {
    const a = coll.op1, b = coll.op2;
    const ra = rankOf(a, elt); if (ra !== undefined) return ra;
    const rb = rankOf(b, elt); return rb === undefined ? undefined : (a.count as number) + rb;
  }
  if (head === "Product") {
    const a = coll.op1, b = coll.op2;
    const pair = elt?.ops; if (!pair || pair.length !== 2) return undefined;
    const ra = rankOf(a, pair[0]); const rb = rankOf(b, pair[1]);
    if (ra === undefined || rb === undefined) return undefined;
    return ra * (b.count as number) + rb;
  }
  return undefined;
}

// walk a collection of known length via a 1-based `at`
const walkIterator = (N: number, at: (i: number) => any) => {
  let i = 1;
  return { next() { if (i > N) return { value: undefined as any, done: true as const }; const v = at(i); i++; return { value: v, done: false as const }; } };
};

// Full CollectionHandlers from a spec.
function gradedHandlers(spec: FamilySpec): CollectionHandlers {
  return {
    count: (c: Expression) => spec.count(readParams(c, spec.paramCount)),
    isFinite: () => true,
    isLazy: () => true,
    isEnumerable: () => true,
    isEmpty: (c: Expression) => spec.count(readParams(c, spec.paramCount)) === 0,
    iterator: (c: Expression) => {
      const ce = engineOf(c);
      const p = readParams(c, spec.paramCount);
      return walkIterator(spec.count(p), (i) => ce.box(spec.elt(p, i - 1)));
    },
    at: (c: Expression, index: number | string) => {
      if (typeof index !== "number") return undefined;
      const p = readParams(c, spec.paramCount);
      const N = spec.count(p);
      const i = index < 0 ? N + index + 1 : index;
      if (i < 1 || i > N) return undefined;
      return engineOf(c).box(spec.elt(p, i - 1));
    },
    contains: (c: Expression, target: Expression) => spec.rank(target, readParams(c, spec.paramCount)) !== undefined,
  };
}

const collectionDefs = Object.fromEntries(
  Object.entries(FAMILIES).map(([head, spec]) => [head, { signature: spec.signature, collection: gradedHandlers(spec) }]),
);

// ─── lazy view / combinator accelerators ───────────────────────────────────────────────────────────────
// Views over ANY collection with an O(1) `at`, staying O(1) — they reindex (or compose) the source(s) via
// their `.count`/`.at` instead of materializing. CE's own Reverse/RotateLeft/CartesianProduct/Take
// materialize and refuse past maxCollectionSize; these lift them past the cap and stay random-access.
const sourceContains = (c: Expression, target: Expression): boolean =>
  rankOf(c, target) !== undefined; // rankOf validates, so undefined ⇒ definitively not a member

// single-source reindexers (Reversed, Rotated, Window)
function reindexView(
  countOf: (src: any, c: any) => number | undefined,
  transform: (idx: number, srcN: number, c: any) => number,
): CollectionHandlers {
  return {
    count: (c: any) => countOf(c.op1, c),
    isFinite: () => true,
    isLazy: () => true,
    isEnumerable: () => true,
    isEmpty: (c: any) => (countOf(c.op1, c) ?? 0) === 0,
    iterator: (c: any) => { const N = countOf(c.op1, c) ?? 0; return walkIterator(N, (i) => handlerAt(c, i)); },
    at: (c: any, index: number | string) => (typeof index === "number" ? handlerAt(c, normIndex(index, countOf(c.op1, c))) : undefined),
    contains: sourceContains,
  };
  function handlerAt(c: any, idx: number | undefined): any {
    if (idx === undefined) return undefined;
    const N = countOf(c.op1, c);
    if (N == null || idx < 1 || idx > N) return undefined;
    return c.op1.at(transform(idx, c.op1.count as number, c));
  }
}
const normIndex = (index: number, N: number | undefined): number | undefined =>
  N == null ? undefined : index < 0 ? N + index + 1 : index;

const viewDefs = {
  Reversed: {
    signature: "(collection) -> collection",
    collection: reindexView((src) => src.count, (i, N) => N - i + 1),
  },
  Rotated: {
    signature: "(collection, integer) -> collection",
    collection: reindexView((src) => src.count, (i, N, c) => (((i - 1 + intOf(c.op2)) % N) + N) % N + 1),
  },
  Window: {
    // Window(c, start, len): the length-`len` slice from 1-based `start`. O(1) Take/Drop/Slice.
    signature: "(collection, integer, integer) -> collection",
    collection: reindexView(
      (src, c) => { const N = src.count; return N == null ? undefined : Math.max(0, Math.min(intOf(c.op3), N - intOf(c.op2) + 1)); },
      (i, _N, c) => intOf(c.op2) - 1 + i,
    ),
  },
  Concat: {
    signature: "(collection, collection) -> collection",
    collection: {
      count: (c: any) => { const a = c.op1.count, b = c.op2.count; return a == null || b == null ? undefined : a + b; },
      isFinite: () => true, isLazy: () => true, isEnumerable: () => true,
      isEmpty: (c: any) => ((c.op1.count ?? 0) + (c.op2.count ?? 0)) === 0,
      iterator: (c: any) => { const na = c.op1.count ?? 0, nb = c.op2.count ?? 0; return walkIterator(na + nb, (i) => (i <= na ? c.op1.at(i) : c.op2.at(i - na))); },
      at: (c: any, index: number | string) => {
        if (typeof index !== "number") return undefined;
        const na = c.op1.count, nb = c.op2.count; if (na == null || nb == null) return undefined;
        const N = na + nb; const i = index < 0 ? N + index + 1 : index;
        if (i < 1 || i > N) return undefined;
        return i <= na ? c.op1.at(i) : c.op2.at(i - na);
      },
      contains: sourceContains,
    } as CollectionHandlers,
  },
  Product: {
    // Cartesian product with O(1) random access via mixed-radix indexing. Element = [aElt, bElt].
    signature: "(collection, collection) -> collection",
    collection: {
      count: (c: any) => { const a = c.op1.count, b = c.op2.count; return a == null || b == null ? undefined : a * b; },
      isFinite: () => true, isLazy: () => true, isEnumerable: () => true,
      isEmpty: (c: any) => ((c.op1.count ?? 0) * (c.op2.count ?? 0)) === 0,
      iterator: (c: any) => { const na = c.op1.count ?? 0, nb = c.op2.count ?? 0; return walkIterator(na * nb, (i) => productAt(c, i, nb)); },
      at: (c: any, index: number | string) => {
        if (typeof index !== "number") return undefined;
        const na = c.op1.count, nb = c.op2.count; if (na == null || nb == null) return undefined;
        const N = na * nb; const i = index < 0 ? N + index + 1 : index;
        if (i < 1 || i > N) return undefined;
        return productAt(c, i, nb);
      },
      contains: sourceContains,
    } as CollectionHandlers,
  },
};
function productAt(c: any, i: number, nb: number): any {
  const i0 = i - 1;
  const ea = c.op1.at(Math.floor(i0 / nb) + 1);
  const eb = c.op2.at((i0 % nb) + 1);
  if (ea == null || eb == null) return undefined;
  return engineOf(c).box(["List", ea, eb]);
}

/**
 * The enumeratio library. Sync collection handlers + Rank/RandomElement/Inversions back everything with no
 * engine, no database — the offline rung of the degradation ladder. The SQL/async rungs live in sql-target.ts.
 */
export const enumeratioLibrary: LibraryDefinition = {
  name: "enumeratio",
  definitions: {
    ...collectionDefs,
    ...viewDefs,

    // Rank — element → 1-based index, the inverse of At and the half CE lacks entirely. Works over every
    // head (families, views, combinators) via rankOf; undefined (stays symbolic) for a non-member.
    Rank: {
      signature: "(collection, collection) -> integer",
      evaluate: (ops: ReadonlyArray<Expression>) => {
        const r = rankOf(ops[0], ops[1]);
        return r === undefined ? undefined : engineOf(ops[0]).number(r + 1);
      },
    },

    // RandomElement — a uniform draw. Generic: reads the collection's own .count/.at, so it works over any of
    // our collections, views and combinators. O(1) at any size (beats CE's materialize-and-cap RandomShuffle).
    RandomElement: {
      signature: "(collection) -> collection",
      evaluate: (ops: ReadonlyArray<Expression>) => {
        const c: any = ops[0];
        const N = c.count;
        if (N == null || N <= 0) return undefined;
        return c.at(Math.floor(Math.random() * N) + 1) ?? undefined;
      },
    },

    // Scalar stat over a permutation word. Composes with At: Inversions(At(SymmetricGroup(9), 5)).
    Inversions: {
      signature: "(list<integer>) -> integer",
      evaluate: (ops: ReadonlyArray<Expression>) => engineOf(ops[0]).number(Inversions(asIntList(ops[0]))),
    },
  },
};

/** Declare the enumeratio definitions into an existing engine (which keeps its standard library). */
export function installEnumeratio(ce: ComputeEngine): ComputeEngine {
  const defs = enumeratioLibrary.definitions as Record<string, unknown>;
  for (const [name, def] of Object.entries(defs)) ce.declare(name, def as any);
  return ce;
}

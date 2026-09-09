// The compute-engine LibraryDefinition for enumeratio: enumeratio's rank/unrank catalog as loadable CE
// operators. The "extend" posture — install it into any ComputeEngine and CE's whole standard library stays
// live; we declare our heads on top, reimplementing nothing, and CE's operators compose over our handlers.
//
// Thesis: CE's combinatorial collections have closed-form counts but SCAN-based random access and NO rank.
// Every collection here supplies an O(1) `at` (via unrank) AND `Rank` (its inverse) — the half CE lacks.
//
// Every collection is a `PackEntry` (pure count/unrank/rank/valid) registered through `packs/` — one
// mechanism for the hand-authored `core` and the parallel-authored packs alike. This file owns only the CE
// wiring: turning specs into CollectionHandlers, the view/combinator accelerators, and Rank/RandomElement.
import type { LibraryDefinition, Expression, ComputeEngine, CollectionHandlers } from "@cortex-js/compute-engine";
import { Inversions } from "./kernels.js";
import { BellNumber, FubiniNumber, PartitionNumber } from "./kernels-combinatorics.js";
import {
  CatalanNumber, PartitionsQ, PolygonalNumber, Factorial2, IntegerDigitsKernel, FromDigitsKernel, RealDigitsKernel,
  IntegerLengthKernel, IntegerReverseKernel, DigitSumKernel, DigitCountKernel, DigitCountOfKernel,
} from "./kernels-extra.js";
import { allEntries, adaptEntry, asIntList, type FamilySpec } from "./packs/index.js";

const intOf = (x: any): number => Math.trunc(Number(x?.re ?? x?.value ?? x?.json));
const engineOf = (e: any): ComputeEngine => e.engine;

// ── seeded randomness ─────────────────────────────────────────────────────────────────────────────────────────
// A module-level RNG behind every random operator — our own (RandomElement, RandomSample) and, via `seedCeRandom`,
// CE's native ones (RandomShuffle, Random) too — so randomness is reproducible and controllable from OUTSIDE the
// library — a host (the notebook's reshuffle button) calls
// `seedRandom(n)` to pin a deterministic stream, or `seedRandom()` to go back to Math.random. One module, one
// stream: reseeding affects every random op on every engine that loaded this library.
let rng: () => number = Math.random;
export function seedRandom(seed?: number): void {
  if (seed === undefined) { rng = Math.random; return; }
  let s = seed >>> 0;
  rng = () => { // mulberry32
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A uniform integer in [0, n). */
const randInt = (n: number): number => Math.floor(rng() * n);

/** `n` ranks drawn from [0, N): distinct (a random n-subset) while n ≤ N, else with replacement. Rejection-samples
 *  a Set so it never materializes N — fine for the common n ≪ N. */
function pickRanks(N: number, n: number): number[] {
  if (n <= 0 || N <= 0) return [];
  if (n >= N) return Array.from({ length: n }, () => randInt(N));
  const set = new Set<number>();
  while (set.size < n) set.add(randInt(N));
  return [...set];
}

// A scalar integer-sequence operator, Listable by default: `broadcastable: true` is CE's mechanism for
// "threads element-wise over a List" (Wolfram's Listable — a function threads unless declared NonThreadable),
// so the evaluate handler only ever sees scalars and CE lifts it over collection args.
const numberOp = (fn: (n: number) => number) => ({
  signature: "(integer) -> integer",
  broadcastable: true,
  evaluate: (ops: ReadonlyArray<Expression>) => engineOf(ops[0]).number(fn(intOf(ops[0]))),
});
// an (integer, base?) → integer op, Listable, base defaulting to 10
const intBaseOp = (fn: (n: number, base: number) => number) => ({
  signature: "(integer, integer?) -> integer",
  broadcastable: true,
  evaluate: (ops: ReadonlyArray<Expression>) => engineOf(ops[0]).number(fn(intOf(ops[0]), ops.length >= 2 ? intOf(ops[1]) : 10)),
});
// a bitwise (integer, integer) → integer op, Listable
const bitOp = (fn: (a: number, b: number) => number) => ({
  signature: "(integer, integer) -> integer",
  broadcastable: true,
  evaluate: (ops: ReadonlyArray<Expression>) => engineOf(ops[0]).number(fn(intOf(ops[0]), intOf(ops[1]))),
});

// Every collection, adapted from its pure PackEntry to a CE-facing FamilySpec.
const FAMILIES: Record<string, FamilySpec> = Object.fromEntries(
  allEntries.map((e) => [e.head, adaptEntry(e)]),
);

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
  if (head === "Zip") {
    const a = coll.op1, b = coll.op2;
    const pair = elt?.ops; if (!pair || pair.length !== 2) return undefined;
    const ra = rankOf(a, pair[0]); const rb = rankOf(b, pair[1]);
    if (ra === undefined || rb === undefined || ra !== rb) return undefined; // same index in both
    return ra < Math.min(a.count as number, b.count as number) ? ra : undefined;
  }
  if (head === "Power") {
    const base = coll.op1; const k = intOf(coll.op2); const nb = base.count as number;
    const tuple = elt?.ops; if (!tuple || tuple.length !== k) return undefined;
    let r = 0;
    for (let j = 0; j < k; j++) { const rj = rankOf(base, tuple[j]); if (rj === undefined) return undefined; r = r * nb + rj; }
    return r;
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
  Power: {
    // k-fold Cartesian power of one collection: element = a k-tuple of its elements. O(1) mixed-radix.
    signature: "(collection, integer) -> collection",
    collection: {
      count: (c: any) => { const nb = c.op1.count; return nb == null ? undefined : nb ** intOf(c.op2); },
      isFinite: () => true, isLazy: () => true, isEnumerable: () => true,
      isEmpty: (c: any) => (c.op1.count ?? 0) ** intOf(c.op2) === 0,
      iterator: (c: any) => { const nb = c.op1.count ?? 0, k = intOf(c.op2); return walkIterator(nb ** k, (i) => powerAt(c, i, nb, k)); },
      at: (c: any, index: number | string) => {
        if (typeof index !== "number") return undefined;
        const nb = c.op1.count; if (nb == null) return undefined;
        const k = intOf(c.op2); const N = nb ** k; const i = index < 0 ? N + index + 1 : index;
        if (i < 1 || i > N) return undefined;
        return powerAt(c, i, nb, k);
      },
      contains: sourceContains,
    } as CollectionHandlers,
  },
  Zip: {
    // parallel pairing: element i = [a.at(i), b.at(i)]. Count = min(|a|,|b|). O(1).
    signature: "(collection, collection) -> collection",
    collection: {
      count: (c: any) => { const a = c.op1.count, b = c.op2.count; return a == null || b == null ? undefined : Math.min(a, b); },
      isFinite: () => true, isLazy: () => true, isEnumerable: () => true,
      isEmpty: (c: any) => Math.min(c.op1.count ?? 0, c.op2.count ?? 0) === 0,
      iterator: (c: any) => { const N = Math.min(c.op1.count ?? 0, c.op2.count ?? 0); return walkIterator(N, (i) => zipAt(c, i)); },
      at: (c: any, index: number | string) => {
        if (typeof index !== "number") return undefined;
        const na = c.op1.count, nb = c.op2.count; if (na == null || nb == null) return undefined;
        const N = Math.min(na, nb); const i = index < 0 ? N + index + 1 : index;
        if (i < 1 || i > N) return undefined;
        return zipAt(c, i);
      },
      contains: sourceContains,
    } as CollectionHandlers,
  },
};
function zipAt(c: any, i: number): any {
  const ea = c.op1.at(i), eb = c.op2.at(i);
  if (ea == null || eb == null) return undefined;
  return engineOf(c).box(["List", ea, eb]);
}
function productAt(c: any, i: number, nb: number): any {
  const i0 = i - 1;
  const ea = c.op1.at(Math.floor(i0 / nb) + 1);
  const eb = c.op2.at((i0 % nb) + 1);
  if (ea == null || eb == null) return undefined;
  return engineOf(c).box(["List", ea, eb]);
}
function powerAt(c: any, i: number, nb: number, k: number): any {
  let i0 = i - 1;
  const els: any[] = new Array(k);
  for (let pos = k - 1; pos >= 0; pos--) { const e = c.op1.at((i0 % nb) + 1); if (e == null) return undefined; els[pos] = e; i0 = Math.floor(i0 / nb); }
  return engineOf(c).box(["List", ...els]);
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
        return c.at(randInt(N) + 1) ?? undefined;
      },
    },

    // No bespoke shuffle head: CE's own `RandomShuffle` already permutes a List/Tuple/String AND any of our
    // collection views (it iterates through the CollectionHandlers we install), so we reuse it rather than
    // reimplement it. `installEnumeratio` only (a) routes CE's RNG through our seeded stream so `seedRandom`
    // governs it, and (b) adds a Set short-circuit — see `overrideRandomShuffle`.

    // RandomSample(collection, n) — n random elements: DISTINCT while n ≤ |collection| (a random n-subset by
    // rank), with replacement once n exceeds the size. O(n) at any collection size (never materializes it).
    RandomSample: {
      signature: "(collection, integer) -> collection",
      evaluate: (ops: ReadonlyArray<Expression>) => {
        const c: any = ops[0];
        const N = c.count;
        if (N == null || N < 0) return undefined;
        return engineOf(ops[0]).box(["List", ...pickRanks(N, intOf(ops[1])).map((r) => c.at(r + 1))]);
      },
    },

    // Scalar stat over a permutation word. Composes with At: Inversions(At(Permutations(9), 5)).
    Inversions: {
      signature: "(list<integer>) -> integer",
      evaluate: (ops: ReadonlyArray<Expression>) => engineOf(ops[0]).number(Inversions(asIntList(ops[0]))),
    },

    // ── the counting sequences, as first-class Listable scalar operators (heads CE lacks). Primary spelling is
    // PascalCase-of-the-catalog-ident (BellNumber/FubiniNumber/PartitionNumber); Wolfram's own spellings (BellB,
    // PartitionsP) are kept below as aliases so existing notebooks/dictionary entries still resolve. ──
    BellNumber: numberOp(BellNumber),
    BellB: numberOp(BellNumber),
    CatalanNumber: numberOp(CatalanNumber),
    FubiniNumber: numberOp(FubiniNumber),
    PartitionNumber: numberOp((n) => PartitionNumber(n)),
    PartitionsP: numberOp((n) => PartitionNumber(n)),
    PartitionsQ: numberOp((n) => PartitionsQ(n)),
    // Double factorial n!! (Wolfram Factorial2) — CE has Factorial but not this one.
    Factorial2: numberOp(Factorial2),
    // PolygonalNumber(n) = triangular (r=3); PolygonalNumber(r, n) = r-gonal. Listable — threads over a List arg.
    PolygonalNumber: {
      signature: "(integer, integer?) -> integer",
      broadcastable: true,
      evaluate: (ops: ReadonlyArray<Expression>) => {
        const r = ops.length === 2 ? intOf(ops[0]) : 3;
        const n = ops.length === 2 ? intOf(ops[1]) : intOf(ops[0]);
        return engineOf(ops[0]).number(PolygonalNumber(r, n));
      },
    },

    // ── digit functions (Wolfram) ──
    // IntegerDigits(n, base?, len?) → base-b digit list (default 10), most-significant first. Listable over n.
    IntegerDigits: {
      signature: "(integer, integer?, integer?) -> list<integer>",
      broadcastable: true,
      evaluate: (ops: ReadonlyArray<Expression>) => {
        const base = ops.length >= 2 ? intOf(ops[1]) : 10;
        const len = ops.length >= 3 ? intOf(ops[2]) : undefined;
        return engineOf(ops[0]).box(["List", ...IntegerDigitsKernel(intOf(ops[0]), base, len)]);
      },
    },
    // FromDigits(digits, base?) → the integer with those base-b digits. Inverse of IntegerDigits.
    FromDigits: {
      signature: "(list<integer>, integer?) -> integer",
      evaluate: (ops: ReadonlyArray<Expression>) => {
        const base = ops.length >= 2 ? intOf(ops[1]) : 10;
        return engineOf(ops[0]).number(FromDigitsKernel(asIntList(ops[0]), base));
      },
    },
    // RealDigits(n, base?) → [digits, exponent] (Wolfram; exponent = number of integer digits).
    RealDigits: {
      signature: "(integer, integer?) -> tuple<list<integer>, integer>",
      evaluate: (ops: ReadonlyArray<Expression>) => {
        const base = ops.length >= 2 ? intOf(ops[1]) : 10;
        const [digits, exp] = RealDigitsKernel(intOf(ops[0]), base);
        return engineOf(ops[0]).box(["List", ["List", ...digits], exp]);
      },
    },
    IntegerLength: intBaseOp(IntegerLengthKernel),
    IntegerReverse: intBaseOp(IntegerReverseKernel),
    DigitSum: intBaseOp(DigitSumKernel),
    // DigitCount(n, base?) → per-digit counts (Wolfram order 1..b-1,0); DigitCount(n, base, d) → count of digit d.
    DigitCount: {
      signature: "(integer, integer?, integer?) -> collection",
      evaluate: (ops: ReadonlyArray<Expression>) => {
        const base = ops.length >= 2 ? intOf(ops[1]) : 10;
        return ops.length >= 3
          ? engineOf(ops[0]).number(DigitCountOfKernel(intOf(ops[0]), base, intOf(ops[2])))
          : engineOf(ops[0]).box(["List", ...DigitCountKernel(intOf(ops[0]), base)]);
      },
    },
    // Bitwise ops CE lacks (Wolfram BitAnd/BitOr/BitXor).
    BitAnd: bitOp((a, b) => a & b),
    BitOr: bitOp((a, b) => a | b),
    BitXor: bitOp((a, b) => a ^ b),
  },
};

/** Declare the enumeratio definitions into an existing engine (which keeps its standard library). */
export function installEnumeratio(ce: ComputeEngine): ComputeEngine {
  const defs = enumeratioLibrary.definitions as Record<string, unknown>;
  for (const [name, def] of Object.entries(defs)) ce.declare(name, def as any);
  seedCeRandom(ce);
  overrideRandomShuffle(ce);
  return ce;
}

/** Route CE's own RNG through our seeded stream, so `seedRandom()` governs CE-native random ops (RandomShuffle,
 *  Random, …) and our O(1) ones (RandomElement/RandomSample) from one seed — the notebook's reshuffle reseeds all.
 *  `ce._random` is an internal in 0.125.0 (no public seed hook); the arrow reads the live `rng` binding, so a later
 *  `seedRandom()` still takes. `WithRandomSeed(seed, …)` remains CE's own per-expression override on top of this. */
function seedCeRandom(ce: any): void {
  try { ce._random = () => rng(); } catch { /* CE build without a settable _random — native RNG stays */ }
}

/** Wrap CE's native `RandomShuffle` with a Set short-circuit: a Set is unordered, so shuffling it is a no-op —
 *  return it unchanged instead of CE's `incompatible-type` (it demands an indexed_collection). Everything else
 *  delegates to the captured native handler, reimplementing nothing. */
function overrideRandomShuffle(ce: any): void {
  const native = ce.lookupDefinition?.("RandomShuffle")?.operator;
  const evaluate = native?.evaluate, evaluateAsync = native?.evaluateAsync;
  if (!evaluate) return; // CE build without RandomShuffle — leave it alone
  const isSet = (x: any) => x?.operator === "Set";
  ce.declare("RandomShuffle", {
    signature: "(collection) -> collection",
    evaluate: (ops: any, opts: any) => (isSet(ops[0]) ? ops[0] : evaluate.call(native, ops, opts)),
    evaluateAsync: evaluateAsync
      ? (ops: any, opts: any) => (isSet(ops[0]) ? ops[0] : evaluateAsync.call(native, ops, opts))
      : undefined,
  });
}

// Wolfram call forms that widen the ARG SHAPE of a few already-declared heads:
//
//   IntegerPartitions(n, k)          -- at most k parts
//   IntegerPartitions(n, {k})        -- exactly k parts
//   IntegerPartitions(n, All, parts) -- parts drawn only from the given list
//   SetPartitions(n, k)              -- exactly k blocks (Stirling numbers of the 2nd kind)
//   Subsets(n, k)                    -- at most k elements
//   Subsets(n, {k})                  -- exactly k elements
//   Subsets(n, {kmin, kmax})         -- size in [kmin, kmax]
//   Subsets(n, {kmin, kmax, step})   -- size in the arithmetic range kmin, kmin+step, …
//
// (GroupOrder(SymmetricGroup(n)) -> n! is a sibling of these but lives in
// packages/symbols/algebras/groupalgebra/src/declare.ts instead -- GroupOrder is GroupAlgebra's head, and
// wrapping it there sidesteps a declare-order dependency between the two packages; see the
// comment on that wrapOperator call for why.)
//
// declareFamilies() (./declare.ts) gives every family ONE fixed paramCount and a
// collection built from ITS kernel alone -- there is no per-call branching on arg shape.
// Rather than teach `FamilyKernel`/declare.ts a variable-arity contract every other family
// would have to opt out of, this module widens the signature of the few heads that need
// it (`widenSignature`, same as any other library extending a call form) and replaces
// their `collection` handlers in place with a small dispatcher that reads the actual call
// and routes to the SAME rank/unrank/valid kernels the fixed-arity heads already use --
// never a reimplementation. This is the "small extension" the sibling families don't pay
// for, confined to the one file that needs it.
import type { BoxedExpression, CollectionHandlers, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf, symbolNameOf, widenSignature } from "@enumeratio/boxed";
import {
  BellB,
  IsSetPartitionOf,
  KPartPartitionCount,
  IntegerPartitionKUnrank,
  IntegerPartitionUnrank,
  IsPartitionOf,
  PartitionsP,
  RgsToBlocks,
  RgsUnrank,
  SetPartitionsIntoKBlocksUnrank,
  StirlingS2,
} from "./kernels-combinatorics.ts";
import { IsKSubsetOf, IsSubsetOf, KSubsetCount, KSubsetUnrank, SubsetCount, SubsetUnrank } from "./kernels-extra.ts";
import { partsInSet } from "./partitions.ts";
import { subsetsAtMostKCount, subsetsAtMostKUnrank, subsetsAtMostKValid } from "./subsets.ts";
import { asBlockList, asIntList, type Boxed, blocksMJ, listMJ } from "./types.ts";

type BoxInput = Parameters<ComputeEngine["box"]>[0];
const asBoxed = (c: BoxedExpression): Boxed => c as unknown as Boxed;

/** A fully-resolved call: closed over its params, ready to count/unrank/validate.
 *  `encode`, when present, overrides the family-wide MathJSON encoder for this one
 *  resolution -- used by the explicit-list call forms (`Subsets(list)`,
 *  `SetPartitions(list)`), where the family's integer kernel still unranks POSITIONS
 *  1..n, but each position has to print as the list's own element at that position
 *  rather than as the bare integer. */
interface Resolved<E> {
  readonly count: number;
  unrank(r: number): E;
  valid(e: unknown): boolean;
  encode?: (e: E) => unknown;
}

/** Build `CollectionHandlers` that re-resolve the kernel from the call's actual operands
 *  on every access -- `resolve` returns `undefined` for a shape none of the call forms
 *  recognise, which reads as the empty collection rather than throwing. */
function polyCollection<E>(
  ce: ComputeEngine,
  encode: (e: E) => unknown,
  decode: (b: Boxed) => unknown,
  resolve: (ops: readonly BoxedExpression[]) => Resolved<E> | undefined,
): CollectionHandlers {
  const opsOf = (c: BoxedExpression) => operandsOf(c);
  const element = (res: Resolved<E>, i: number): BoxedExpression =>
    ce.box((res.encode ?? encode)(res.unrank(i)) as BoxInput);
  return {
    count: (c) => resolve(opsOf(c))?.count ?? 0,
    isFinite: () => true,
    isLazy: () => true,
    isEnumerable: () => true,
    isEmpty: (c) => (resolve(opsOf(c))?.count ?? 0) === 0,
    iterator: (c) => {
      const res = resolve(opsOf(c));
      const total = res?.count ?? 0;
      let i = 0;
      return {
        next: () =>
          res !== undefined && i < total ? { value: element(res, i++), done: false } : { value: undefined, done: true },
      };
    },
    at: (c, index) => {
      if (typeof index !== "number") return undefined;
      const res = resolve(opsOf(c));
      if (res === undefined) return undefined;
      const total = res.count;
      const i = index < 0 ? total + index + 1 : index;
      return i < 1 || i > total ? undefined : element(res, i - 1);
    },
    contains: (c, target) => {
      const res = resolve(opsOf(c));
      return res === undefined ? false : res.valid(decode(asBoxed(target)));
    },
  };
}

// ─── IntegerPartitions(n) / (n, k) / (n, {k}) / (n, All, parts) ────────────────────────

function isValidAtMostKParts(e: unknown, n: number, k: number): boolean {
  if (!Array.isArray(e) || e.length > k) return false;
  let sum = 0;
  let prev = Number.POSITIVE_INFINITY;
  for (const x of e) {
    if (typeof x !== "number" || !Number.isInteger(x) || x < 1 || x > prev) return false;
    sum += x;
    prev = x;
  }
  return sum === n;
}

function resolveIntegerPartitions(ops: readonly BoxedExpression[]): Resolved<number[]> | undefined {
  const n = integerAt(ops[0]);
  if (n === undefined) return undefined;

  if (ops.length <= 1) {
    return {
      count: PartitionsP(n),
      unrank: (r) => IntegerPartitionUnrank(n, r),
      valid: (e) => IsPartitionOf(e as number[], n),
    };
  }

  const second = ops[1];
  if (second === undefined) return undefined;

  if (ops.length === 2) {
    if (second.operator === "List") {
      // Exactly k parts: PartitionsIntoKParts' own kernel, unchanged.
      const kOps = operandsOf(second);
      if (kOps.length !== 1) return undefined;
      const k = integerAt(kOps[0]);
      if (k === undefined || k < 0) return undefined;
      return {
        count: KPartPartitionCount(n, k),
        unrank: (r) => IntegerPartitionKUnrank(n, k, r),
        valid: (e) => IsPartitionOf(e as number[], n, k),
      };
    }
    // At most k parts: partitions of n into ≤ k parts ↔ partitions of n+k into EXACTLY k
    // positive parts, by adding 1 to each of the k parts (padding shorter ones with 0
    // first) -- a classic bijection that also preserves the largest-part-first order
    // IntegerPartitions(n) itself enumerates in, once the added 1s are stripped back off
    // and any resulting 0 parts dropped. Reuses PartitionsIntoKParts' kernel verbatim.
    const k = integerAt(second);
    if (k === undefined || k < 0) return undefined;
    return {
      count: KPartPartitionCount(n + k, k),
      unrank: (r) =>
        IntegerPartitionKUnrank(n + k, k, r)
          .map((part) => part - 1)
          .filter((part) => part > 0),
      valid: (e) => isValidAtMostKParts(e, n, k),
    };
  }

  if (ops.length === 3) {
    // IntegerPartitions(n, All, parts): parts drawn only from the given list -- the same
    // partsInSet(inSet) DP that OddPartitions/PrimePartitions/… already use (partitions.ts),
    // instantiated on `parts.includes` instead of a fixed predicate.
    if (symbolNameOf(second) !== "All") return undefined;
    const listArg = ops[2];
    if (listArg === undefined || listArg.operator !== "List") return undefined;
    const allowedOps = operandsOf(listArg).map((op) => integerAt(op));
    if (allowedOps.some((v) => v === undefined)) return undefined;
    const allowed = new Set(allowedOps as number[]);
    const kernel = partsInSet((s) => allowed.has(s));
    return {
      count: kernel.count(n),
      unrank: (r) => kernel.unrank(n, r),
      valid: (e) => kernel.valid(e, n),
    };
  }

  return undefined;
}

// ─── SetPartitions(n) / (n, k) ──────────────────────────────────────────────────────────

/** The elements of any finite collection ops[0] denotes -- a `List`, but also `Range(...)`
 *  or any other lazy indexed collection -- materialized via `.each()`. `undefined` for
 *  anything that isn't a finite collection at all (an integer n, a free symbol, …), which
 *  is what lets the caller fall through to the plain integer-n family form. `.isCollection`
 *  is false for a bare number, so this never mistakes `Subsets(4)` for a 1-collection call. */
function elementsOf(expr: BoxedExpression | undefined): readonly BoxedExpression[] | undefined {
  if (expr === undefined || expr.isCollection !== true) return undefined;
  if (expr.isFiniteCollection === false) return undefined;
  return [...expr.each()];
}

/** `SetPartitions(list)`: the same RGS unranking as `SetPartitions(n)` over the list's
 *  positions 1..n, with each position printed as the list's own element there instead of
 *  the bare position -- `encode` overrides `blocksMJ` for this one resolution. */
function resolveSetPartitionsOfList(elements: readonly BoxedExpression[]): Resolved<number[][]> {
  const n = elements.length;
  return {
    count: BellB(n),
    unrank: (r) => RgsToBlocks(RgsUnrank(n, r)),
    valid: (e) => Array.isArray(e) && IsSetPartitionOf(e as number[][], n),
    encode: (blocks) => ["List", ...blocks.map((block) => ["List", ...block.map((i) => elements[i - 1]!.json)])],
  };
}

function resolveSetPartitions(ops: readonly BoxedExpression[]): Resolved<number[][]> | undefined {
  if (ops.length === 1) {
    const elements = elementsOf(ops[0]);
    if (elements !== undefined) return resolveSetPartitionsOfList(elements);
  }

  const n = integerAt(ops[0]);
  if (n === undefined) return undefined;

  if (ops.length <= 1) {
    return {
      count: BellB(n),
      unrank: (r) => RgsToBlocks(RgsUnrank(n, r)),
      valid: (e) => IsSetPartitionOf(e as number[][], n),
    };
  }

  // Exactly k blocks -- Stirling numbers of the second kind, SetPartitionsIntoKBlocks' own kernel.
  const k = integerAt(ops[1]);
  if (k === undefined || k < 0) return undefined;
  return {
    count: StirlingS2(n, k),
    unrank: (r) => RgsToBlocks(SetPartitionsIntoKBlocksUnrank(n, k, r)),
    valid: (e) => IsSetPartitionOf(e as number[][], n, k),
  };
}

// ─── Subsets(n) / (n, k) / (n, {k}) / (n, {kmin, kmax}) / (n, {kmin, kmax, step}) ──────

/** Subsets of {1,…,n} whose size lands in `sizes` -- concatenated size-blocks, each in
 *  KSubsets' own colex order (same shape as SubsetsOfSizeAtMost, generalised past 0..k). */
function subsetsInSizesCount(n: number, sizes: readonly number[]): number {
  let total = 0;
  for (const k of sizes) total += KSubsetCount(n, k);
  return total;
}
function subsetsInSizesUnrank(n: number, sizes: readonly number[], r: number): number[] {
  const total = subsetsInSizesCount(n, sizes);
  let rr = total ? ((r % total) + total) % total : 0;
  for (const k of sizes) {
    const c = KSubsetCount(n, k);
    if (rr < c) return KSubsetUnrank(n, k, rr);
    rr -= c;
  }
  return [];
}
function subsetsInSizesValid(e: unknown, n: number, sizes: readonly number[]): boolean {
  if (!Array.isArray(e)) return false;
  return sizes.includes(e.length) && IsKSubsetOf(e as number[], n, e.length);
}
/** sizes kmin, kmin+step, … not exceeding kmax (Wolfram's Subsets(list, {kmin,kmax,dn})). */
function sizesInRange(kmin: number, kmax: number, step: number): number[] {
  const sizes: number[] = [];
  if (step <= 0) return sizes;
  for (let k = kmin; k <= kmax; k += step) sizes.push(k);
  return sizes;
}

/** `Subsets(list)`: the same binary-mask unranking as `Subsets(n)` over the list's
 *  positions 1..n, with each position printed as the list's own element there instead of
 *  the bare position -- `encode` overrides `listMJ` for this one resolution. */
function resolveSubsetsOfList(elements: readonly BoxedExpression[]): Resolved<number[]> {
  const n = elements.length;
  return {
    count: SubsetCount(n),
    unrank: (r) => SubsetUnrank(n, r),
    valid: (e) => Array.isArray(e) && IsSubsetOf(e as number[], n),
    encode: (idxs) => ["List", ...idxs.map((i) => elements[i - 1]!.json)],
  };
}

function resolveSubsets(ops: readonly BoxedExpression[]): Resolved<number[]> | undefined {
  if (ops.length === 1) {
    const elements = elementsOf(ops[0]);
    if (elements !== undefined) return resolveSubsetsOfList(elements);
  }

  const n = integerAt(ops[0]);
  if (n === undefined) return undefined;

  if (ops.length <= 1) {
    return {
      count: SubsetCount(n),
      unrank: (r) => SubsetUnrank(n, r),
      valid: (e) => IsSubsetOf(e as number[], n),
    };
  }

  const second = ops[1];
  if (second === undefined) return undefined;

  if (second.operator === "List") {
    const listOps = operandsOf(second).map((op) => integerAt(op));
    if (listOps.some((v) => v === undefined) || listOps.length === 0 || listOps.length > 3) {
      return undefined;
    }
    const vals = listOps as number[];
    if (vals.length === 1) {
      // Exactly k -- KSubsets' own kernel.
      const k = vals[0]!;
      return {
        count: KSubsetCount(n, k),
        unrank: (r) => KSubsetUnrank(n, k, r),
        valid: (e) => IsKSubsetOf(e as number[], n, k),
      };
    }
    const [kmin, kmax, step = 1] = vals;
    const sizes = sizesInRange(kmin!, kmax!, step!);
    return {
      count: subsetsInSizesCount(n, sizes),
      unrank: (r) => subsetsInSizesUnrank(n, sizes, r),
      valid: (e) => subsetsInSizesValid(e, n, sizes),
    };
  }

  // At most k -- SubsetsOfSizeAtMost' own kernel.
  const k = integerAt(second);
  if (k === undefined || k < 0) return undefined;
  return {
    count: subsetsAtMostKCount([n, k]),
    unrank: (r) => subsetsAtMostKUnrank([n, k], r),
    valid: (e) => subsetsAtMostKValid(e, [n, k]),
  };
}

// ─── wiring ─────────────────────────────────────────────────────────────────────────────

function operatorOf(ce: ComputeEngine, name: string) {
  const definition = ce.lookupDefinition(name);
  return definition !== undefined && "operator" in definition ? definition.operator : undefined;
}

/** Replace `head`'s `collection` handlers in place -- a no-op if `head` isn't declared on
 *  `ce` (e.g. a test engine that only runs declareFamilies, or GroupOrder's owning package
 *  not being loaded), matching widenSignature's own quiet no-op in that case. */
function setCollection(ce: ComputeEngine, head: string, handlers: CollectionHandlers): void {
  const operator = operatorOf(ce, head);
  if (operator === undefined) return;
  (operator as { collection: CollectionHandlers }).collection = handlers;
}

/** Declare the widened call forms. Call AFTER declareFamilies (IntegerPartitions,
 *  SetPartitions and Subsets must already be declared) -- declareCollections does. */
export function declareCallForms(ce: ComputeEngine): void {
  widenSignature(ce, "IntegerPartitions", "(integer, any?, any?) -> list<list<integer>>");
  setCollection(ce, "IntegerPartitions", polyCollection(ce, listMJ, asIntList, resolveIntegerPartitions));

  // `any` on the first parameter admits `SetPartitions(list)` / `Subsets(list)` -- an
  // explicit list of elements, not just the family's integer index n -- alongside the
  // plain integer form; resolveSetPartitions/resolveSubsets dispatch on which it got.
  widenSignature(ce, "SetPartitions", "(any, integer?) -> list<list<list<any>>>");
  setCollection(ce, "SetPartitions", polyCollection(ce, blocksMJ, asBlockList, resolveSetPartitions));

  widenSignature(ce, "Subsets", "(any, any?) -> list<list<any>>");
  setCollection(ce, "Subsets", polyCollection(ce, listMJ, asIntList, resolveSubsets));

  // GroupOrder(SymmetricGroup(n)) -> n! is wired from packages/symbols/algebras/groupalgebra/src/declare.ts
  // (the package that declares GroupOrder), not here: this module and groupalgebra declare
  // in different orders depending on which engine composes them (census/engine.ts declares
  // groupalgebra before collections; reference/scripts/engines.ts the other way around),
  // and wrapOperator needs GroupOrder's OWN definition to already exist at the point it
  // attaches. Declaring the wrap next to GroupOrder itself sidesteps the ordering
  // entirely -- SymmetricGroup only needs to exist by the time someone actually calls
  // GroupOrder(SymmetricGroup(n)), long after every library has finished declaring.
}

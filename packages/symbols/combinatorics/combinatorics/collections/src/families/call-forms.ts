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
import {
  type Engine,
  type Expr,
  extendHead,
  type HeadPatch,
  integerAt,
  operandsOf,
  symbolNameOf,
  widenSignature,
  wrapOperator,
} from "@enumeratio/engine";
import { carrierTypeForName } from "@enumeratio/structures";
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
import { partsInSet } from "../../../partitions/src/families/partitions.ts";
import { kSubsets, subsets, subsetsOfSizeAtMost } from "./closed-forms.ts";
import { kernelOn } from "./epsil.ts";
import { asBlockList, asIntList, type Boxed, blocksMJ, type FamilyKernel, listMJ } from "./types.ts";

type CollectionHandlers = NonNullable<HeadPatch["collection"]>;

type BoxInput = Parameters<Engine["box"]>[0];
const asBoxed = (c: Expr): Boxed => c as unknown as Boxed;

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
  ce: Engine,
  encode: (e: E) => unknown,
  decode: (b: Boxed) => unknown,
  resolve: (ops: readonly Expr[]) => Resolved<E> | undefined,
): CollectionHandlers {
  const opsOf = (c: Expr) => operandsOf(c);
  const element = (res: Resolved<E>, i: number): Expr => ce.box((res.encode ?? encode)(res.unrank(i)) as BoxInput);
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

function resolveIntegerPartitions(ops: readonly Expr[]): Resolved<number[]> | undefined {
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
function elementsOf(expr: Expr | undefined): readonly Expr[] | undefined {
  if (expr === undefined || expr.isCollection !== true) return undefined;
  if (expr.isFiniteCollection === false) return undefined;
  return [...expr.each()];
}

/** `SetPartitions(list)`: the same RGS unranking as `SetPartitions(n)` over the list's
 *  positions 1..n, with each position printed as the list's own element there instead of
 *  the bare position -- `encode` overrides `blocksMJ` for this one resolution. */
function resolveSetPartitionsOfList(elements: readonly Expr[]): Resolved<number[][]> {
  const n = elements.length;
  return {
    count: BellB(n),
    unrank: (r) => RgsToBlocks(RgsUnrank(n, r)),
    valid: (e) => Array.isArray(e) && IsSetPartitionOf(e as number[][], n),
    encode: (blocks) => ["List", ...blocks.map((block) => ["List", ...block.map((i) => elements[i - 1]!.json)])],
  };
}

function resolveSetPartitions(ops: readonly Expr[]): Resolved<number[][]> | undefined {
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
// Graded by size, lex within a size: the Epsil families' own kernels (./closed-forms.ts), so
// every call form lists subsets in the order `Subsets(n)` does.

/** The subset kernels on one engine. */
interface SubsetKernels {
  readonly all: FamilyKernel;
  readonly ofSize: FamilyKernel;
  readonly atMost: FamilyKernel;
}

const subsetKernels = (ce: Engine): SubsetKernels => ({
  all: kernelOn(ce, subsets({ head: "Subsets", params: ["_n"] })),
  ofSize: kernelOn(ce, kSubsets({ head: "KSubsets", params: ["_n", "_k"] })),
  atMost: kernelOn(ce, subsetsOfSizeAtMost({ head: "SubsetsOfSizeAtMost", params: ["_n", "_k"] })),
});

/** A kernel at `p` as a call form's resolution. */
const resolvedFrom = (kernel: FamilyKernel, p: number[], encode?: (e: number[]) => unknown): Resolved<number[]> => ({
  count: Number(kernel.count(p)),
  unrank: (r) => kernel.unrank(p, BigInt(r)) as number[],
  valid: (e) => kernel.valid(e, p),
  ...(encode === undefined ? {} : { encode }),
});

/** Subsets of {1,…,n} whose size lands in `sizes`: the size blocks in turn, each lex. */
function subsetsInSizes(kernels: SubsetKernels, n: number, sizes: readonly number[]): Resolved<number[]> {
  const blocks = sizes.map((k) => [k, Number(kernels.ofSize.count([n, k]))] as const);
  return {
    count: blocks.reduce((total, [, c]) => total + c, 0),
    unrank: (r) => {
      let left = r;
      for (const [k, c] of blocks) {
        if (left < c) return kernels.ofSize.unrank([n, k], BigInt(left)) as number[];
        left -= c;
      }
      return [];
    },
    valid: (e) => Array.isArray(e) && sizes.includes(e.length) && kernels.ofSize.valid(e, [n, e.length]),
  };
}
/** sizes kmin, kmin+step, … not exceeding kmax (Wolfram's Subsets(list, {kmin,kmax,dn})). */
function sizesInRange(kmin: number, kmax: number, step: number): number[] {
  const sizes: number[] = [];
  if (step <= 0) return sizes;
  for (let k = kmin; k <= kmax; k += step) sizes.push(k);
  return sizes;
}

/** Elements over 1..n go through `wrapElement` -- Finset when the carrier is declared, the bare
 *  list otherwise. A list's own subsets are over its positions 1..n, printed as the list's
 *  elements, and stay unwrapped: they are the original list's values, not a Finset's 1..n. */
function resolveSubsets(
  kernels: SubsetKernels,
  ops: readonly Expr[],
  wrapElement: (n: number, idxs: number[]) => unknown,
): Resolved<number[]> | undefined {
  const elements = elementsOf(ops[0]);
  const n = elements !== undefined ? elements.length : integerAt(ops[0]);
  if (n === undefined) return undefined;
  const encode =
    elements !== undefined
      ? (idxs: number[]) => ["List", ...idxs.map((i) => elements[i - 1]!.json)]
      : (idxs: number[]) => wrapElement(n, idxs);

  if (ops.length <= 1) return resolvedFrom(kernels.all, [n], encode);

  const second = ops[1];
  if (second === undefined) return undefined;

  if (second.operator === "List") {
    const listOps = operandsOf(second).map((op) => integerAt(op));
    if (listOps.some((v) => v === undefined) || listOps.length === 0 || listOps.length > 3) {
      return undefined;
    }
    const vals = listOps as number[];
    // Exactly k -- KSubsets' own kernel.
    if (vals.length === 1) return resolvedFrom(kernels.ofSize, [n, vals[0]!], encode);
    const [kmin, kmax, step = 1] = vals;
    return { ...subsetsInSizes(kernels, n, sizesInRange(kmin!, kmax!, step!)), encode };
  }

  // At most k -- SubsetsOfSizeAtMost' own kernel.
  const k = integerAt(second);
  if (k === undefined || k < 0) return undefined;
  return resolvedFrom(kernels.atMost, [n, k], encode);
}

// ─── wiring ─────────────────────────────────────────────────────────────────────────────

/** Replace `head`'s `collection` handlers -- a no-op if `head` isn't declared on `ce`
 *  (e.g. a test engine that only runs declareFamilies, or GroupOrder's owning package
 *  not being loaded), matching widenSignature's own quiet no-op in that case. */
function setCollection(ce: Engine, head: string, handlers: CollectionHandlers): void {
  extendHead(ce, head, { collection: handlers });
}

/** Declare the widened call forms. Call AFTER declareFamilies (IntegerPartitions,
 *  SetPartitions and Subsets must already be declared) -- declareCollections does. Each
 *  widened head's carrier type, when it has one, is read back from `ce`'s own registry
 *  (`carrierTypeForName`) rather than passed in -- self-contained per head, since
 *  IntegerPartitions/SetPartitions/Subsets are each declared, and typed, before this runs. */
export function declareCallForms(ce: Engine): void {
  // Typed by its carrier when it has one: `IntegerPartition([3, 1])`, as the plain family is.
  const partition = carrierTypeForName(ce, "IntegerPartition");
  widenSignature(ce, "IntegerPartitions", `(integer, any?, any?) -> list<${partition ?? "list<integer>"}>`);
  setCollection(
    ce,
    "IntegerPartitions",
    partition === undefined
      ? polyCollection(ce, listMJ, asIntList, resolveIntegerPartitions)
      : polyCollection(
          ce,
          (e: number[]) => ["IntegerPartition", listMJ(e)],
          (b) => asIntList((b as unknown as Expr).operator === "IntegerPartition" ? b.ops![0]! : b),
          resolveIntegerPartitions,
        ),
  );

  // `any` on the first parameter admits `SetPartitions(list)` / `Subsets(list)` -- an
  // explicit list of elements, not just the family's integer index n -- alongside the
  // plain integer form; resolveSetPartitions/resolveSubsets dispatch on which it got.
  // Over 1..n, typed by its carrier when it has one; over an explicit list, blocks of those
  // elements, which no carrier holds.
  const setPartition = carrierTypeForName(ce, "SetPartition");
  widenSignature(
    ce,
    "SetPartitions",
    setPartition === undefined
      ? "(integer | collection<any>, integer?) -> list<list<list<any>>>"
      : `(integer | collection<any>, integer?) -> list<${setPartition} | list<list<any>>>`,
  );
  setCollection(
    ce,
    "SetPartitions",
    setPartition === undefined
      ? polyCollection(ce, blocksMJ, asBlockList, resolveSetPartitions)
      : polyCollection(
          ce,
          (blocks: number[][]) => ["SetPartition", blocksMJ(blocks)],
          (b) => asBlockList((b as unknown as Expr).operator === "SetPartition" ? b.ops![0]! : b),
          resolveSetPartitions,
        ),
  );

  // Typed by its carrier when it has one, over 1..n; the list form stays untyped (see
  // resolveSubsets's comment) -- same split SetPartitions makes above.
  const finset = carrierTypeForName(ce, "Finset");
  widenSignature(
    ce,
    "Subsets",
    finset === undefined
      ? "(integer | collection<any>, (integer | list<integer>)?) -> list<list<any>>"
      : `(integer | collection<any>, (integer | list<integer>)?) -> list<${finset} | list<any>>`,
  );
  const kernels = subsetKernels(ce);
  const wrapSubset = (n: number, idxs: number[]): unknown =>
    finset === undefined ? listMJ(idxs) : ["Finset", ["Tuple", n, listMJ(idxs)]];
  setCollection(
    ce,
    "Subsets",
    polyCollection(
      ce,
      listMJ,
      (b) =>
        asIntList(
          (finset !== undefined && (b as unknown as Expr).operator === "Finset"
            ? (b.ops![0]!.ops![b.ops![0]!.ops!.length - 1]! as Boxed)
            : b) as never,
        ),
      (ops) => resolveSubsets(kernels, ops, wrapSubset),
    ),
  );

  // `Permutations(n)`: the permutations of [n], the family `SymmetricGroup(n)` already is.
  // compute-engine's own `Permutations` takes a collection (the permutations of a given
  // list), so this is one more arm beside it, not a replacement: an integer is never a
  // collection, and the native arms still answer everything else.
  const permutationType = carrierTypeForName(ce, "Permutation");
  extendHead(ce, "Permutations", {
    addSignature: `(integer<0..>) -> indexed_collection<${permutationType ?? "list<integer>"}>`,
  });
  wrapOperator(
    ce,
    ["Permutations"],
    (ops) => ops.length === 1 && (integerAt(ops[0]) ?? -1) >= 0,
    () => (ops) => ce.function("SymmetricGroup", [ce.number(integerAt(ops[0])!)]),
  );

  // GroupOrder(SymmetricGroup(n)) -> n! is wired from packages/symbols/algebras/groupalgebra/src/declare.ts
  // (the package that declares GroupOrder), not here: this module and groupalgebra declare
  // in different orders depending on which engine composes them (census/engine.ts declares
  // groupalgebra before collections; reference/scripts/engines.ts the other way around),
  // and wrapOperator needs GroupOrder's OWN definition to already exist at the point it
  // attaches. Declaring the wrap next to GroupOrder itself sidesteps the ordering
  // entirely -- SymmetricGroup only needs to exist by the time someone actually calls
  // GroupOrder(SymmetricGroup(n)), long after every library has finished declaring.
}

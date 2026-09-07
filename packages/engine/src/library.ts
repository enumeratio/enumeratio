// The compute-engine LibraryDefinition for enumeratio. It publishes enumeratio's rank/unrank catalog as
// loadable CE operators. This is the "extend" posture: install it into any ComputeEngine and CE's WHOLE
// standard library stays live (Add, Factorial, Fibonacci, Totient, Sum, Map, …) — we declare our heads ON
// TOP, reimplementing nothing, and CE's operators compose over our handlers. (See interop.test.ts.)
//
// The thesis in one line: CE's combinatorial collections have closed-form counts but SCAN-based random
// access (its `at` is a linear walk), and NO rank (element → index) anywhere. Every family here supplies an
// O(1) `at` (via unrank) AND `Rank` (its inverse) — the half CE lacks entirely.
//
// Heads as a family of siblings (D2): CE ships `Permutations(list)` — arrangements of a *given* collection.
// Ours is the graded family of all n! permutations of [n], indexed by the *size* n. SIBLINGS keyed by domain
// (a concrete list vs a size), the way enumeratio hangs carrier/domain and grading-axis/family configs off
// distinct heads — not rivals, not a name chosen to dodge a collision. (Absorbing both onto one `Permutations`
// head is not viable: CE's `Permutations` signature is a locked overload pinned to collection args, so
// `Permutations(12)` fails type-check before any handler runs, and mutating it in place crashes CE. Verified.)
// Head/package names still provisional — rename-later.

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

const intOf = (x: any): number => Math.trunc(Number(x?.re ?? x?.value ?? x?.json));
const engineOf = (e: any): ComputeEngine => e.engine;

// element ⇄ MathJSON / JS
type MathJson = any;
const asIntList = (t: any): number[] => (t?.ops ?? []).map(intOf);
const asBlockList = (t: any): number[][] => (t?.ops ?? []).map((b: any) => (b?.ops ?? []).map(intOf));
const listMJ = (xs: number[]): MathJson => ["List", ...xs];
const blocksMJ = (bs: number[][]): MathJson => ["List", ...bs.map((b) => ["List", ...b])];

// ─── one spec per family: the single source of truth the collection handlers, Rank and RandomElement share.
// count/elt/rank all agree on the SAME order (the SQL floor's); `rank` returns a 0-based index or undefined
// when the target is not a member. `elt` returns the element as a MathJSON expression.
interface FamilySpec {
  paramCount: 1 | 2;
  signature: string; // collection signature
  count: (p: number[]) => number;
  elt: (p: number[], rank0: number) => MathJson;
  rank: (target: Expression, p: number[]) => number | undefined;
}

const FAMILIES: Record<string, FamilySpec> = {
  SymmetricGroup: {
    paramCount: 1,
    signature: "(integer) -> list<list<integer>>",
    count: ([n]) => Factorial(n),
    elt: ([n], r) => listMJ(PermutationUnrank(n, r)),
    rank: (t, [n]) => { const a = asIntList(t); return IsPermutationOf(a, n) ? PermutationRank(a) : undefined; },
  },
  IntegerCompositions: {
    paramCount: 1,
    signature: "(integer) -> list<list<integer>>",
    count: ([n]) => CompositionCount(n),
    elt: ([n], r) => listMJ(CompositionFromMask(n, r)),
    rank: (t, [n]) => { const a = asIntList(t); return IsCompositionOf(a, n) ? CompositionRank(a) : undefined; },
  },
  IntegerPartitions: {
    paramCount: 1,
    signature: "(integer) -> list<list<integer>>",
    count: ([n]) => PartitionNumber(n),
    elt: ([n], r) => listMJ(IntegerPartitionUnrank(n, r)),
    rank: (t, [n]) => { const a = asIntList(t); return IsPartitionOf(a, n) ? IntegerPartitionRank(a, n) : undefined; },
  },
  PartitionsIntoKParts: {
    paramCount: 2,
    signature: "(integer, integer) -> list<list<integer>>",
    count: ([n, k]) => KPartPartitionCount(n, k),
    elt: ([n, k], r) => listMJ(IntegerPartitionKUnrank(n, k, r)),
    rank: (t, [n, k]) => { const a = asIntList(t); return IsPartitionOf(a, n, k) ? IntegerPartitionKRank(a, n) : undefined; },
  },
  SetPartitions: {
    paramCount: 1,
    signature: "(integer) -> list<list<list<integer>>>",
    count: ([n]) => Bell(n),
    elt: ([n], r) => blocksMJ(RgsToBlocks(RgsUnrank(n, r))),
    rank: (t, [n]) => { const b = asBlockList(t); return IsSetPartitionOf(b, n) ? RgsRank(BlocksToRgs(b, n)) : undefined; },
  },
  SetPartitionsIntoKBlocks: {
    paramCount: 2,
    signature: "(integer, integer) -> list<list<list<integer>>>",
    count: ([n, k]) => StirlingSecond(n, k),
    elt: ([n, k], r) => blocksMJ(RgsToBlocks(SetPartitionsIntoKBlocksUnrank(n, k, r))),
    rank: (t, [n, k]) => { const b = asBlockList(t); return IsSetPartitionOf(b, n, k) ? SetPartitionsIntoKBlocksRank(BlocksToRgs(b, n), k) : undefined; },
  },
  SetCompositions: {
    paramCount: 1,
    signature: "(integer) -> list<list<list<integer>>>",
    count: ([n]) => Fubini(n),
    elt: ([n], r) => blocksMJ(LabelsToOrderedBlocks(SetCompositionUnrank(n, r))),
    rank: (t, [n]) => { const b = asBlockList(t); return IsSetPartitionOf(b, n) ? SetCompositionRank(BlocksToLabels(b), n) : undefined; },
  },
};

const readParams = (coll: any, pc: 1 | 2): number[] =>
  pc === 1 ? [intOf(coll.op1)] : [intOf(coll.op1), intOf(coll.op2)];

// Full CollectionHandlers from a spec: closed-form Length, O(1) At (CE 1-based → 0-based rank), lazy
// iteration, and membership (via the spec's rank — a target is a member iff it has a rank).
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
      const N = spec.count(p);
      let i = 1;
      return {
        next() {
          if (i > N) return { value: undefined as any, done: true as const };
          const e = spec.elt(p, i - 1);
          i++;
          return { value: ce.box(e), done: false as const };
        },
      };
    },
    at: (c: Expression, index: number | string) => {
      if (typeof index !== "number") return undefined;
      const p = readParams(c, spec.paramCount);
      const N = spec.count(p);
      let i = index < 0 ? N + index + 1 : index;
      if (i < 1 || i > N) return undefined;
      return engineOf(c).box(spec.elt(p, i - 1));
    },
    contains: (c: Expression, target: Expression) => spec.rank(target, readParams(c, spec.paramCount)) !== undefined,
  };
}

// Build one operator definition (signature + collection handlers) per family.
const collectionDefs = Object.fromEntries(
  Object.entries(FAMILIES).map(([head, spec]) => [head, { signature: spec.signature, collection: gradedHandlers(spec) }]),
);

/**
 * The enumeratio library. Sync collection handlers + Rank/RandomElement/Inversions back everything with no
 * engine, no database — the offline rung of the degradation ladder. The SQL/async rungs live in sql-target.ts
 * and are wired by a consumer that supplies a backend.
 */
export const enumeratioLibrary: LibraryDefinition = {
  name: "enumeratio",
  definitions: {
    ...collectionDefs,

    // Rank — element → 1-based index, the inverse of At and the half CE lacks entirely. Dispatches on the
    // collection operand's head; returns undefined when the element is not a member of that family.
    Rank: {
      signature: "(collection, collection) -> integer",
      evaluate: (ops: ReadonlyArray<Expression>) => {
        const coll: any = ops[0];
        const spec = FAMILIES[coll.operator as string];
        if (!spec) return undefined;
        const r = spec.rank(ops[1], readParams(coll, spec.paramCount));
        return r === undefined ? undefined : engineOf(coll).number(r + 1); // 1-based, matches At
      },
    },

    // RandomElement — draw a uniform element by unranking a random rank. O(1), any size: this is the
    // accelerator that lifts CE's materialize-and-cap RandomShuffle past its cap for our families.
    RandomElement: {
      signature: "(collection) -> collection",
      evaluate: (ops: ReadonlyArray<Expression>) => {
        const coll: any = ops[0];
        const spec = FAMILIES[coll.operator as string];
        if (!spec) return undefined;
        const p = readParams(coll, spec.paramCount);
        const N = spec.count(p);
        if (N <= 0) return undefined;
        const r = Math.floor(Math.random() * N);
        return engineOf(coll).box(spec.elt(p, r));
      },
    },

    // Scalar stat over a permutation word. Composes with At: Inversions(At(SymmetricGroup(9), 5)).
    Inversions: {
      signature: "(list<integer>) -> integer",
      evaluate: (ops: ReadonlyArray<Expression>) =>
        engineOf(ops[0]).number(Inversions(asIntList(ops[0]))),
    },
  },
};

/**
 * Declare the enumeratio definitions into an existing engine (which keeps its standard library). The
 * guaranteed install route; the `libraries: [enumeratioLibrary]` constructor route also works but replaces
 * the standard set unless you spread it back in.
 */
export function installEnumeratio(ce: ComputeEngine): ComputeEngine {
  const defs = enumeratioLibrary.definitions as Record<string, unknown>;
  for (const [name, def] of Object.entries(defs)) ce.declare(name, def as any);
  return ce;
}

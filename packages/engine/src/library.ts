// The compute-engine LibraryDefinition for enumeratio. Wave 1 is one vertical slice: the
// permutations family, exposed as SymmetricGroup(n) — an O(1) rank/unrank-backed indexed collection —
// plus one scalar stat, Inversions. This is the "extend" posture: install it into any ComputeEngine
// and CE's WHOLE standard library stays live (Add, Factorial, Fibonacci, Totient, Sum, Map, …) — we
// declare our heads ON TOP, reimplementing nothing, and CE's operators compose over our handlers.
// (See interop.test.ts for the proof: CE ops fold over our collection; our count equals CE Factorial.)
//
// Heads as a family of siblings (D2): CE ships `Permutations(list)` — arrangements of a *given*
// collection. Ours is the graded family of all n! permutations of [n] in lex order, indexed by the
// *size* n. These are SIBLINGS keyed by domain (a concrete list vs a size), the way enumeratio hangs
// carrier/domain variants and grading-axis/family configs off distinct heads — not rivals, and not a
// name chosen to dodge a collision. `SymmetricGroup(n)` is the size-indexed sibling (its elements ARE
// S_n's, as one-line words) and the natural hook for later grading/carrier configs.
//
// (Absorbing the two onto ONE `Permutations` head is not viable: CE's `Permutations` signature is a
// locked overload `((S,integer?)->list<string>) & ((collection,integer?)->list<list>)` — its first
// arg is pinned to a collection, so `Permutations(12)` fails type-check before any handler runs, and
// mutating the signature in place crashes CE. Verified. Head name still provisional — rename-later.)

import type { LibraryDefinition, Expression, ComputeEngine, CollectionHandlers } from "@cortex-js/compute-engine";
import { Factorial, PermutationUnrank, IsPermutationOf, Inversions } from "./kernels.js";
import {
  CompositionCount, CompositionFromMask, IsCompositionOf,
  PartitionNumber, IntegerPartitionUnrank, IsPartitionOf,
  KPartPartitionCount, IntegerPartitionKUnrank,
  Bell, RgsUnrank, RgsToBlocks, IsSetPartitionOf,
  StirlingSecond, SetPartitionsIntoKBlocksUnrank,
  Fubini, SetCompositionUnrank, LabelsToOrderedBlocks,
} from "./kernels-combinatorics.js";

const intOf = (x: any): number => Math.trunc(Number(x?.re ?? x?.value ?? x?.json));
const argN = (coll: any): number => intOf(coll.op1); // ["SymmetricGroup", n] → n
const engineOf = (e: any): ComputeEngine => e.engine;
const asPerm = (list: any): number[] => (list?.ops ?? []).map(intOf);
const boxPerm = (ce: ComputeEngine, perm: number[]): Expression =>
  ce.box(["List", ...perm]);

// ─── graded-collection factory ─────────────────────────────────────────────────────────────────────────
// A family indexed by 1 or 2 integer params, backed by a closed-form count and an O(1) unrank. `elt` returns
// the element as a MathJSON expression (a list, or a list of blocks); the factory boxes it. Everything else —
// closed-form Length, O(1) At (CE 1-based → 0-based rank), lazy iteration, membership — comes for free.
type MathJson = any;
const asIntList = (t: any): number[] => (t?.ops ?? []).map(intOf);
const asBlockList = (t: any): number[][] => (t?.ops ?? []).map((b: any) => (b?.ops ?? []).map(intOf));
const listMJ = (xs: number[]): MathJson => ["List", ...xs];
const blocksMJ = (blocks: number[][]): MathJson => ["List", ...blocks.map((b) => ["List", ...b])];

function graded(
  paramCount: 1 | 2,
  count: (p: number[]) => number,
  elt: (p: number[], rank0: number) => MathJson,
  contains: (target: Expression, p: number[]) => boolean,
): CollectionHandlers {
  const params = (c: any): number[] =>
    paramCount === 1 ? [intOf(c.op1)] : [intOf(c.op1), intOf(c.op2)];
  return {
    count: (c: Expression) => count(params(c)),
    isFinite: () => true,
    isLazy: () => true,
    isEnumerable: () => true,
    isEmpty: (c: Expression) => count(params(c)) === 0,
    iterator: (c: Expression) => {
      const ce = engineOf(c);
      const p = params(c);
      const N = count(p);
      let i = 1;
      return {
        next() {
          if (i > N) return { value: undefined as any, done: true as const };
          const e = elt(p, i - 1);
          i++;
          return { value: ce.box(e), done: false as const };
        },
      };
    },
    at: (c: Expression, index: number | string) => {
      if (typeof index !== "number") return undefined;
      const p = params(c);
      const N = count(p);
      let i = index < 0 ? N + index + 1 : index;
      if (i < 1 || i > N) return undefined;
      return engineOf(c).box(elt(p, i - 1));
    },
    contains: (c: Expression, target: Expression) => contains(target, params(c)),
  };
}

/**
 * The enumeratio library. Sync `evaluate` + full CollectionHandlers back everything with no engine,
 * no database — the offline rung of the degradation ladder. The SQL/async rungs (evaluateAsync,
 * compile) live in sql-target.ts and are wired by a consumer that supplies a backend.
 */
export const enumeratioLibrary: LibraryDefinition = {
  name: "enumeratio",
  definitions: {
    SymmetricGroup: {
      signature: "(integer) -> list<list<integer>>",
      collection: {
        count: (c: Expression) => Factorial(argN(c)),
        isFinite: () => true,
        isLazy: () => true,
        isEmpty: (c: Expression) => Factorial(argN(c)) === 0, // never (0! = 1)
        isEnumerable: () => true,
        iterator: (c: Expression) => {
          const ce = engineOf(c);
          const n = argN(c);
          const N = Factorial(n);
          let i = 1;
          return {
            next() {
              if (i > N) return { value: undefined as any, done: true as const };
              const p = PermutationUnrank(n, i - 1);
              i++;
              return { value: boxPerm(ce, p), done: false as const };
            },
          };
        },
        // CE `at` is 1-based, negative from the end; our rank is 0-based → unrank(n, index-1).
        at: (c: Expression, index: number | string) => {
          if (typeof index !== "number") return undefined;
          const n = argN(c);
          const N = Factorial(n);
          let i = index < 0 ? N + index + 1 : index;
          if (i < 1 || i > N) return undefined;
          return boxPerm(engineOf(c), PermutationUnrank(n, i - 1));
        },
        contains: (c: Expression, target: Expression) =>
          IsPermutationOf(asPerm(target), argN(c)),
      },
    },

    // Scalar stat over a permutation word. Composes with At: Inversions(At(SymmetricGroup(9), 5)).
    Inversions: {
      signature: "(list<integer>) -> integer",
      evaluate: (ops: ReadonlyArray<Expression>) => {
        const perm = asPerm(ops[0]);
        return engineOf(ops[0]).number(Inversions(perm));
      },
    },

    // ── the other six certified families (siblings of SymmetricGroup), each O(1) at ──
    // element = list<integer> (parts): compositions & integer partitions.
    IntegerCompositions: {
      signature: "(integer) -> list<list<integer>>",
      collection: graded(1, ([n]) => CompositionCount(n), ([n], r) => listMJ(CompositionFromMask(n, r)),
        (t, [n]) => IsCompositionOf(asIntList(t), n)),
    },
    IntegerPartitions: {
      signature: "(integer) -> list<list<integer>>",
      collection: graded(1, ([n]) => PartitionNumber(n), ([n], r) => listMJ(IntegerPartitionUnrank(n, r)),
        (t, [n]) => IsPartitionOf(asIntList(t), n)),
    },
    PartitionsIntoKParts: {
      signature: "(integer, integer) -> list<list<integer>>",
      collection: graded(2, ([n, k]) => KPartPartitionCount(n, k), ([n, k], r) => listMJ(IntegerPartitionKUnrank(n, k, r)),
        (t, [n, k]) => IsPartitionOf(asIntList(t), n, k)),
    },
    // element = list<list<integer>> (blocks): set partitions & ordered set partitions.
    SetPartitions: {
      signature: "(integer) -> list<list<list<integer>>>",
      collection: graded(1, ([n]) => Bell(n), ([n], r) => blocksMJ(RgsToBlocks(RgsUnrank(n, r))),
        (t, [n]) => IsSetPartitionOf(asBlockList(t), n)),
    },
    SetPartitionsIntoKBlocks: {
      signature: "(integer, integer) -> list<list<list<integer>>>",
      collection: graded(2, ([n, k]) => StirlingSecond(n, k), ([n, k], r) => blocksMJ(RgsToBlocks(SetPartitionsIntoKBlocksUnrank(n, k, r))),
        (t, [n, k]) => IsSetPartitionOf(asBlockList(t), n, k)),
    },
    SetCompositions: {
      signature: "(integer) -> list<list<list<integer>>>",
      collection: graded(1, ([n]) => Fubini(n), ([n], r) => blocksMJ(LabelsToOrderedBlocks(SetCompositionUnrank(n, r))),
        (t, [n]) => IsSetPartitionOf(asBlockList(t), n)),
    },
  },
};

/**
 * Declare the enumeratio definitions into an existing engine (which keeps its standard library).
 * The guaranteed install route; the `libraries: [enumeratioLibrary]` constructor route also works
 * but replaces the standard set unless you spread it back in.
 */
export function installEnumeratio(ce: ComputeEngine): ComputeEngine {
  const defs = enumeratioLibrary.definitions as Record<string, unknown>;
  for (const [name, def] of Object.entries(defs)) ce.declare(name, def as any);
  return ce;
}

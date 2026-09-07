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

import type { LibraryDefinition, Expression, ComputeEngine } from "@cortex-js/compute-engine";
import { Factorial, PermutationUnrank, IsPermutationOf, Inversions } from "./kernels.js";

const intOf = (x: any): number => Math.trunc(Number(x?.re ?? x?.value ?? x?.json));
const argN = (coll: any): number => intOf(coll.op1); // ["SymmetricGroup", n] → n
const engineOf = (e: any): ComputeEngine => e.engine;
const asPerm = (list: any): number[] => (list?.ops ?? []).map(intOf);
const boxPerm = (ce: ComputeEngine, perm: number[]): Expression =>
  ce.box(["List", ...perm]);

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

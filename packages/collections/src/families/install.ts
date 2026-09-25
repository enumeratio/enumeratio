import type { BoxedExpression, CollectionHandlers, ComputeEngine } from "@cortex-js/compute-engine";
import { allEntries } from "./index.ts";
import { adaptEntry, type Boxed, type FamilySpec, intOf } from "./types.ts";

type BoxInput = Parameters<ComputeEngine["box"]>[0];

const asBoxed = (c: BoxedExpression): Boxed => c as unknown as Boxed;

function readParams(c: BoxedExpression, paramCount: number): number[] {
  const ops = asBoxed(c).ops ?? [];
  return Array.from({ length: paramCount }, (_, i) => intOf(ops[i]));
}

/** Full CollectionHandlers from a pure family spec (count / at / iterator by unranking). */
function gradedHandlers(ce: ComputeEngine, spec: FamilySpec): CollectionHandlers {
  const box = (element: unknown): BoxedExpression => ce.box(element as BoxInput);
  return {
    count: (c) => spec.count(readParams(c, spec.paramCount)),
    isFinite: () => true,
    isLazy: () => true,
    isEnumerable: () => true,
    isEmpty: (c) => spec.count(readParams(c, spec.paramCount)) === 0,
    iterator: (c) => {
      const p = readParams(c, spec.paramCount);
      const total = spec.count(p);
      let i = 1;
      return {
        next: () => {
          if (i > total) return { value: undefined, done: true };
          const value = box(spec.elt(p, i - 1));
          i++;
          return { value, done: false };
        },
      };
    },
    at: (c, index) => {
      if (typeof index !== "number") return undefined;
      const p = readParams(c, spec.paramCount);
      const total = spec.count(p);
      const i = index < 0 ? total + index + 1 : index;
      if (i < 1 || i > total) return undefined;
      return box(spec.elt(p, i - 1));
    },
    contains: (c, target) =>
      spec.rank(asBoxed(target), readParams(c, spec.paramCount)) !== undefined,
  };
}

/** Declare every pack family as a lazy indexed collection head on `ce`. */
export function installFamilies(ce: ComputeEngine): void {
  for (const entry of allEntries) {
    const spec = adaptEntry(entry);
    ce.declare(entry.head, {
      signature: spec.signature,
      collection: gradedHandlers(ce, spec),
    });
  }
}

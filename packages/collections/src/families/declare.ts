import type { BoxedExpression, CollectionHandlers, ComputeEngine } from "@cortex-js/compute-engine";
import { allEntries } from "./index.ts";
import {
  asBlockList,
  asIntList,
  blocksMJ,
  type Boxed,
  denest,
  type FamilyKernel,
  intOf,
  listMJ,
  nestMJ,
} from "./types.ts";

type BoxInput = Parameters<ComputeEngine["box"]>[0];

const asBoxed = (c: BoxedExpression): Boxed => c as unknown as Boxed;

const signatureOf = ({ kind, paramCount }: FamilyKernel): string => {
  const params = paramCount === 1 ? "(integer)" : "(integer, integer)";
  if (kind === "nested") return `${params} -> collection`;
  return `${params} -> ${kind === "ints" ? "list<list<integer>>" : "list<list<list<integer>>>"}`;
};

/** A family's kernel as compute-engine collection handlers: Count, At and iteration by
 *  unranking, membership by `valid`. */
function handlersOf(ce: ComputeEngine, family: FamilyKernel): CollectionHandlers {
  const encode = family.kind === "ints" ? listMJ : family.kind === "blocks" ? blocksMJ : nestMJ;
  const decode =
    family.kind === "ints" ? asIntList : family.kind === "blocks" ? asBlockList : denest;
  const params = (c: BoxedExpression): number[] => {
    const ops = asBoxed(c).ops ?? [];
    return Array.from({ length: family.paramCount }, (_, i) => intOf(ops[i]));
  };
  const element = (p: number[], rank0: number): BoxedExpression =>
    ce.box(encode(family.unrank(p, rank0) as never) as BoxInput);
  return {
    count: (c) => family.count(params(c)),
    isFinite: () => true,
    isLazy: () => true,
    isEnumerable: () => true,
    isEmpty: (c) => family.count(params(c)) === 0,
    iterator: (c) => {
      const p = params(c);
      const total = family.count(p);
      let i = 0;
      return {
        next: () =>
          i < total ? { value: element(p, i++), done: false } : { value: undefined, done: true },
      };
    },
    at: (c, index) => {
      if (typeof index !== "number") return undefined;
      const p = params(c);
      const total = family.count(p);
      const i = index < 0 ? total + index + 1 : index;
      return i < 1 || i > total ? undefined : element(p, i - 1);
    },
    contains: (c, target) => family.valid(decode(asBoxed(target)), params(c)),
  };
}

/** Declare every family as a lazy indexed collection head on `ce`. */
export function declareFamilies(ce: ComputeEngine): void {
  for (const family of allEntries) {
    ce.declare(family.head, { signature: signatureOf(family), collection: handlersOf(ce, family) });
  }
}

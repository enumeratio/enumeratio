// A restriction of the permutations of n in the order they come with (lex), for a family whose
// completion count isn't known yet (https://github.com/enumeratio/enumeratio/wiki/Speculative-Restrictions):
// unrank and rank filter all n! permutations, once per fiber, and say so in their declared cost.

import { Factorial, IsPermutationOf, PermutationUnrank } from "./kernels.ts";
import type { Declared, NumberKernel, Param } from "./types.ts";

function compare(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** The members of each fiber, in lex order, by filtering the permutations of n = p[0]. */
export function inducedOrder(options: {
  head: string;
  paramCount: 1 | 2;
  /** A closed count, so counting doesn't filter. */
  count: (p: number[]) => number;
  /** Whether a permutation of n is a member. */
  member: (perm: readonly number[], p: number[]) => boolean;
}): NumberKernel {
  const { head, paramCount, count, member } = options;
  const fibers = new Map<string, number[][]>();
  const fiber = (p: number[]): number[][] => {
    const key = p.join(",");
    let list = fibers.get(key);
    if (list === undefined) {
      const [n] = p;
      list = [];
      for (let r = 0; r < Factorial(n); r++) {
        const perm = PermutationUnrank(n, r);
        if (member(perm, p)) list.push(perm);
      }
      fibers.set(key, list);
    }
    return list;
  };
  const params: Param[] =
    paramCount === 1
      ? [{ name: "size", role: "axis", min: 0 }]
      : [
          { name: "size", role: "axis", min: 0 },
          { name: "k", role: "param", min: 0 },
        ];
  const declared: Declared = {
    carrier: "Permutation",
    params,
    cost: { count: "closed", unrank: "enumerative", rank: "enumerative", valid: "polynomial" },
    work: ([n]) => BigInt(Factorial(n)),
  };
  return {
    head,
    carrier: "Permutation",
    paramCount,
    kind: "ints",
    declared,
    count,
    unrank: (p, r) => fiber(p)[r],
    rank: (element, p) => {
      const perm = element as number[];
      const list = fiber(p);
      let lo = 0;
      let hi = list.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const order = compare(list[mid], perm);
        if (order === 0) return mid;
        if (order < 0) lo = mid + 1;
        else hi = mid - 1;
      }
      return -1;
    },
    valid: (element, p) => IsPermutationOf(element as number[], p[0]) && member(element as number[], p),
  };
}

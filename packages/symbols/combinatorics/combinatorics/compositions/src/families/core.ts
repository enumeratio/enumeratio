// Compositions-area families split out of collections/src/families/core.ts (which mixed every
// area) per https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5: IntegerCompositions and its two siblings. The generic kernel math they call stays in
// collections/src/families/kernels*.ts — reused across areas, not compositions-specific machinery.
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import {
  CompositionCount,
  CompositionFromMask,
  CompositionRank,
  IsCompositionOf,
} from "../../../collections/src/families/kernels-combinatorics.ts";
import {
  CompositionsIntoKPartsCount,
  CompositionsIntoKPartsUnrank,
  CompositionsIntoKPartsRank,
  IsCompositionIntoKParts,
  WeakCompositionCount,
  WeakCompositionUnrank,
  WeakCompositionRank,
  IsWeakCompositionOf,
} from "../../../collections/src/families/kernels-extra.ts";

// helper to cut boilerplate for the flat (number[]) shape; mirrors collections/core.ts's private `ints`.
const ints = (
  head: string,
  paramCount: 1 | 2,
  count: (p: number[]) => number,
  unrank: (p: number[], r: number) => number[],
  valid: (e: number[], p: number[]) => boolean,
  rank: (e: number[], p: number[]) => number,
): NumberKernel => ({
  head,
  paramCount,
  kind: "ints",
  count,
  unrank,
  valid: (e, p) => valid(e as number[], p),
  rank: (e, p) => rank(e as number[], p),
});

export const entries: NumberKernel[] = [
  // ── compositions ──
  {
    ...ints(
      "IntegerCompositions",
      1,
      ([n]) => CompositionCount(n),
      ([n], r) => CompositionFromMask(n, r),
      (a, [n]) => IsCompositionOf(a, n),
      (a) => CompositionRank(a),
    ),
    carrier: "Composition",
  },
  {
    ...ints(
      "CompositionsIntoKParts",
      2,
      ([n, k]) => CompositionsIntoKPartsCount(n, k),
      ([n, k], r) => CompositionsIntoKPartsUnrank(n, k, r),
      (a, [n, k]) => IsCompositionIntoKParts(a, n, k),
      (a) => CompositionsIntoKPartsRank(a),
    ),
    carrier: "Composition",
  },
  ints(
    "WeakCompositions",
    2,
    ([n, k]) => WeakCompositionCount(n, k),
    ([n, k], r) => WeakCompositionUnrank(n, k, r),
    (a, [n, k]) => IsWeakCompositionOf(a, n, k),
    (a) => WeakCompositionRank(a),
  ),
];

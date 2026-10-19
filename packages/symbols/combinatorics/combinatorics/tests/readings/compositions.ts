// The compositions families' TS kernels, read in the order their Epsil definitions list. They answered
// ahead of Epsil until compiled Epsil made that unnecessary (BL-225); tests/fast-kernels.test.ts holds
// them to the definitions.
import type { FastKernel } from "../../collections/src/families/epsil.ts";
import {
  dyadicCompositionsExact,
  oddCompositionsExact,
  primeCompositionsExact,
  properCompositionsExact,
  triangularCompositionsExact,
  windowSumsExact,
} from "../../collections/src/families/exact-recurrences.ts";
import {
  CompositionsIntoKPartsCount,
  CompositionsIntoKPartsRank,
  CompositionsIntoKPartsUnrank,
  IsCompositionIntoKParts,
  IsWeakCompositionOf,
  WeakCompositionCount,
  WeakCompositionRank,
  WeakCompositionUnrank,
} from "./kernels/collections-kernels-extra.ts";
import {
  dyadicComp,
  fibComp,
  oddComp,
  partSizeBoundedFast,
  primeComp,
  properComp,
  tetraComp,
  triangularComp,
  triComp,
} from "./kernels/compositions-compositions.ts";

interface Builder {
  unrank: (n: number, r: number) => number[];
  rank: (parts: readonly number[]) => number;
  valid: (parts: unknown, n: number) => boolean;
}

/** A family whose parts come from a set: the builder's kernel, its count exact past 2^53. */
const inSet = (builder: Builder, exact: (n: number) => bigint | undefined): FastKernel => ({
  count: ([n]) => exact(n),
  unrank: ([n], r) => builder.unrank(n, r),
  rank: (x) => builder.rank(x as number[]),
  valid: (x, [n]) => builder.valid(x, n),
});

export const readings: Record<string, FastKernel> = {
  CompositionsIntoKParts: {
    count: ([n, k]) => CompositionsIntoKPartsCount(n, k),
    unrank: ([n, k], r) => CompositionsIntoKPartsUnrank(n, k, r),
    rank: (x) => CompositionsIntoKPartsRank(x as number[]),
    valid: (x, [n, k]) => IsCompositionIntoKParts(x as number[], n, k),
  },
  WeakCompositions: {
    count: ([n, k]) => WeakCompositionCount(n, k),
    unrank: ([n, k], r) => WeakCompositionUnrank(n, k, r),
    rank: (x) => WeakCompositionRank(x as number[]),
    valid: (x, [n, k]) => IsWeakCompositionOf(x as number[], n, k),
  },
  OddCompositions: inSet(oddComp, oddCompositionsExact),
  ProperCompositions: inSet(properComp, properCompositionsExact),
  DyadicCompositions: inSet(dyadicComp, dyadicCompositionsExact),
  FibonacciCompositions: inSet(fibComp, (n) => windowSumsExact(n, 2)),
  TriCompositions: inSet(triComp, (n) => windowSumsExact(n, 3)),
  TetraCompositions: inSet(tetraComp, (n) => windowSumsExact(n, 4)),
  TriangularCompositions: inSet(triangularComp, triangularCompositionsExact),
  PrimeCompositions: inSet(primeComp, primeCompositionsExact),
  PartSizeBoundedCompositions: partSizeBoundedFast,
};

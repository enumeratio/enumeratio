// The trees families' TS kernels, read in the order their Epsil definitions list. They answered ahead of
// Epsil until compiled Epsil made that unnecessary (BL-225); tests/fast-kernels.test.ts holds them to the
// definitions.
import type { FastKernel } from "../../collections/src/families/epsil.ts";
import { catalanExact, fussCatalanExact } from "../../collections/src/families/exact-counts.ts";
import { binaryTreeParentArraysKernel } from "./kernels/trees-core.ts";
import { labeledTreesKernel } from "./kernels/trees-labeled.ts";
import {
  IsPruferSequenceOf,
  PruferSequenceCount,
  PruferSequenceRank,
  PruferSequenceUnrank,
} from "./kernels/trees-prufer-sequences.ts";
import { rootedForestsKernel } from "./kernels/trees-rooted-forests.ts";
import { nonCrossingTreesKernel } from "./kernels/trees-unlabeled-trees.ts";

export const readings: Record<string, FastKernel> = {
  PruferSequences: {
    count: ([n]) => PruferSequenceCount(n),
    unrank: ([n], r) => PruferSequenceUnrank(n, r),
    rank: (x, [n]) => PruferSequenceRank(x as number[], n),
    valid: (x, [n]) => IsPruferSequenceOf(x, n),
  },
  LabeledTrees: labeledTreesKernel,
  RootedForests: rootedForestsKernel,
  BinaryTreeParentArrays: { ...binaryTreeParentArraysKernel, count: ([n]) => catalanExact(n) },
  NonCrossingTrees: { ...nonCrossingTreesKernel, count: ([n]) => fussCatalanExact(n, 3) },
};

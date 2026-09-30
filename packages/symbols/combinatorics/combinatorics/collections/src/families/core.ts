// The originally hand-authored collections, expressed as NumberKernel[] over the certified kernel library
// (./kernels*.ts). Same registration mechanism as the other families — no special-casing in library.ts.
import type { NumberKernel } from "./types.ts";
import {
  SubsetCount,
  SubsetUnrank,
  SubsetRank,
  IsSubsetOf,
  KSubsetCount,
  KSubsetUnrank,
  KSubsetRank,
  IsKSubsetOf,
  TupleCount,
  TupleUnrank,
  TupleRank,
  IsTupleOf,
  MultisetCount,
  MultisetUnrank,
  MultisetRank,
  IsMultisetOf,
  LatticePathCount,
  LatticePathUnrank,
  LatticePathRank,
  IsLatticePathOf,
  FibonacciWordCount,
  FibonacciWordUnrank,
  FibonacciWordRank,
  IsFibonacciWord,
  GrayCodeSubsetUnrank,
  GrayCodeSubsetRank,
  BinaryStringCount,
  BinaryStringUnrank,
  BinaryStringRank,
  IsBinaryString,
  RootedForestCount,
  RootedForestUnrank,
  RootedForestRank,
  IsRootedForest,
} from "./kernels-extra.ts";

// helper to cut boilerplate for the flat (number[]) shape; casts the unknown element once here,
// same pattern subsets.ts uses at each call site.
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

// Kept separate from `entries` below only so collections/src/families/index.ts can splice
// `latticePathsDyckPathsEntries` (DyckPaths) back in at the exact interior position it held
// before the lattice-paths-area move — §4 step 5,
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible.
// Kept separate from `entriesBeforeDyckPaths` below only so collections/src/families/index.ts
// can splice `setPartitionsSurjectionsEntries` (Surjections) back in at the exact interior
// position it held before the set-partitions-area move — §4 step 5,
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible.
export const entriesBeforeSurjections: NumberKernel[] = [
  // ── subsets / multisets / tuples / functions / binary words ──
  ints(
    "Subsets",
    1,
    ([n]) => SubsetCount(n),
    ([n], r) => SubsetUnrank(n, r),
    (a, [n]) => IsSubsetOf(a, n),
    (a) => SubsetRank(a),
  ),
  ints(
    "KSubsets",
    2,
    ([n, k]) => KSubsetCount(n, k),
    ([n, k], r) => KSubsetUnrank(n, k, r),
    (a, [n, k]) => IsKSubsetOf(a, n, k),
    (a) => KSubsetRank(a),
  ),
  ints(
    "GrayCodeSubsets",
    1,
    ([n]) => SubsetCount(n),
    ([n], r) => GrayCodeSubsetUnrank(n, r),
    (a, [n]) => IsSubsetOf(a, n),
    (a) => GrayCodeSubsetRank(a),
  ),
  ints(
    "Multisets",
    2,
    ([n, k]) => MultisetCount(n, k),
    ([n, k], r) => MultisetUnrank(n, k, r),
    (a, [n, k]) => IsMultisetOf(a, n, k),
    (a) => MultisetRank(a),
  ),
  ints(
    "Tuples",
    2,
    ([n, k]) => TupleCount(n, k),
    ([n, k], r) => TupleUnrank(n, k, r),
    (a, [n, k]) => IsTupleOf(a, n, k),
    (a, [n]) => TupleRank(a, n),
  ),
];

// Surjections moved to set-partitions/src/families/core.ts -- §4 step 5, the only family in this
// section carrying a `carrier` ("Surjection"). Endofunctions moved to words/src/families/core.ts
// (wire-carriers lane A-91): it now carries "Endofunction". BinaryStrings/LatticePaths below
// declare no carrier and stay here per step 5 rule 4.
export const entriesBeforeDyckPaths: NumberKernel[] = [
  ints(
    "BinaryStrings",
    1,
    ([n]) => BinaryStringCount(n),
    ([n], r) => BinaryStringUnrank(n, r),
    (a, [n]) => IsBinaryString(a, n),
    (a) => BinaryStringRank(a),
  ),

  // ── lattice-path words ──
  ints(
    "LatticePaths",
    2,
    ([a, b]) => LatticePathCount(a, b),
    ([a, b], r) => LatticePathUnrank(a, b, r),
    (x, [a, b]) => IsLatticePathOf(x, a, b),
    (x) => LatticePathRank(x),
  ),
];

// Kept separate from the final `entries` export below only so collections/src/families/index.ts
// can splice `treesCoreEntries` (BinaryTrees, BinaryTreeParentArrays) back in at the exact
// interior position it held before the trees-area move — §4 step 5,
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible.
// Kept separate from `entriesBeforeTrees` below only so collections/src/families/index.ts can
// splice `setPartitionsCoreEntries` (SetPartitions, SetPartitionsIntoKBlocks, SetCompositions)
// back in at the exact interior position it held before the set-partitions-area move — §4 step 5.
// MotzkinPaths/SchroederPaths moved to lattice-paths/src/families/core.ts (wire-carriers lane
// A-90): both now carry "MotzkinPath"/"SchroederPath". FibonacciWords declares no carrier and
// stays here per step 5 rule 4.
export const entriesBeforeSetPartitions: NumberKernel[] = [
  ints(
    "FibonacciWords",
    1,
    ([n]) => FibonacciWordCount(n),
    ([n], r) => FibonacciWordUnrank(n, r),
    (a, [n]) => IsFibonacciWord(a, n),
    (a) => FibonacciWordRank(a),
  ),
];

// SetPartitions/SetPartitionsIntoKBlocks/SetCompositions/PerfectMatchings moved to
// set-partitions/src/families/core.ts -- §4 step 5. PerfectMatchings' "blocks" shape
// (list<list<integer>>) matches "SetPartition"'s exactly (the wiki's open question 1
// resolved: pairs are its blocks, a restriction rather than the "PerfectMatching" carrier,
// whose shape is list<integer> and does not match). LabeledTrees moved to
// trees/src/families/labeled.ts (wire-carriers lane A-92): it now carries "LabeledTree" (the
// edge set). RootedForests below still declares no carrier and stays here per step 5 rule 4.
export const entriesBeforeTrees: NumberKernel[] = [
  {
    head: "RootedForests",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => RootedForestCount(n),
    unrank: ([n], r) => RootedForestUnrank(n, r),
    valid: (a, [n]) => IsRootedForest(a, n),
    rank: (a, [n]) => RootedForestRank(a as number[], n),
  },
];

// BinaryTrees/BinaryTreeParentArrays/KAryTrees/OrderedTrees moved to trees/src/families/core.ts
// -- §4 step 5, every family in this section carrying a `carrier` (KAryTrees/OrderedTrees'
// carriers wired lane A-92, matching BinaryTree's own nested shape per #401). Nothing left here
// with no carrier at this position, but the export stays (splice position, and the general
// `entries` name other tooling reads) as an empty array.
export const entries: NumberKernel[] = [];

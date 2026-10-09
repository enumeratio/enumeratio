// The originally hand-authored collections: Epsil definitions (./closed-forms.ts), each with its TS
// kernel over the certified kernel library (./kernels*.ts) as a `fast` path where it lists the same
// members in the same order.
import {
  binaryStrings,
  fibonacciWords,
  grayCodeSubsets,
  kSubsets,
  latticePaths,
  multisets,
  subsets,
  tuples,
} from "./closed-forms.ts";
import type { EpsilFamily } from "./epsil.ts";
import type { NumberKernel } from "./types.ts";
import {
  FibonacciWordCount,
  FibonacciWordRank,
  FibonacciWordUnrank,
  GrayCodeSubsetRank,
  GrayCodeSubsetUnrank,
  IsFibonacciWord,
  IsLatticePathOf,
  IsMultisetOf,
  IsSubsetOf,
  IsTupleOf,
  IsBinaryString,
  LatticePathCount,
  LatticePathRank,
  LatticePathUnrank,
  MultisetCount,
  MultisetRank,
  MultisetUnrank,
  SubsetCount,
  TupleCount,
  TupleRank,
  TupleUnrank,
  BinaryStringCount,
  BinaryStringRank,
  BinaryStringUnrank,
} from "./kernels-extra.ts";

// Closed-form families, defined in Epsil (./closed-forms.ts).
const subsetsFamily = subsets({ head: "Subsets", params: ["_n"], carrier: "Finset", carrierParams: 1 });
// Not carrier-typed here: out of scope for A-116 (only Subsets/KSubsets/Multisets asked for), though
// its elements are the same Finset shape as Subsets'.
const grayCodeSubsetsFamily = grayCodeSubsets({
  head: "GrayCodeSubsets",
  params: ["_n"],
  fast: {
    count: ([n]) => SubsetCount(n),
    unrank: ([n], r) => GrayCodeSubsetUnrank(n, r),
    rank: (x) => GrayCodeSubsetRank(x as number[]),
    valid: (x, [n]) => IsSubsetOf(x as number[], n),
  },
});
const kSubsetsFamily = kSubsets({ head: "KSubsets", params: ["_n", "_k"], carrier: "Finset", carrierParams: 1 });
const multisetsFamily = multisets({
  head: "Multisets",
  params: ["_n", "_k"],
  carrier: "Multiset",
  carrierParams: 1,
  fast: {
    count: ([n, k]) => MultisetCount(n, k),
    unrank: ([n, k], r) => MultisetUnrank(n, k, r),
    rank: (x) => MultisetRank(x as number[]),
    valid: (x, [n, k]) => IsMultisetOf(x as number[], n, k),
  },
});
const tuplesFamily = tuples({
  head: "Tuples",
  params: ["_n", "_k"],
  fast: {
    count: ([n, k]) => TupleCount(n, k),
    unrank: ([n, k], r) => TupleUnrank(n, k, r),
    rank: (x, [n]) => TupleRank(x as number[], n),
    valid: (x, [n, k]) => IsTupleOf(x as number[], n, k),
  },
});
const binaryStringsFamily = binaryStrings({
  head: "BinaryStrings",
  params: ["_n"],
  fast: {
    count: ([n]) => BinaryStringCount(n),
    unrank: ([n], r) => BinaryStringUnrank(n, r),
    rank: (x) => BinaryStringRank(x as number[]),
    valid: (x, [n]) => IsBinaryString(x as number[], n),
  },
});
const latticePathsFamily = latticePaths({
  head: "LatticePaths",
  params: ["_a", "_b"],
  fast: {
    count: ([a, b]) => LatticePathCount(a, b),
    unrank: ([a, b], r) => LatticePathUnrank(a, b, r),
    rank: (x) => LatticePathRank(x as number[]),
    valid: (x, [a, b]) => IsLatticePathOf(x as number[], a, b),
  },
});

// Kept separate from `entries` below only so collections/src/families/index.ts can splice
// `latticePathsDyckPathsEntries` (DyckPaths) back in at the exact interior position it held
// before the lattice-paths-area move — §4 step 5,
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible.
// Kept separate from `entriesBeforeDyckPaths` below only so collections/src/families/index.ts
// can splice `setPartitionsSurjectionsEntries` (Surjections) back in at the exact interior
// position it held before the set-partitions-area move — §4 step 5,
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible.
export const entriesBeforeSurjections: (NumberKernel | EpsilFamily)[] = [
  // ── subsets / multisets / tuples / functions / binary words ──
  subsetsFamily,
  kSubsetsFamily,
  grayCodeSubsetsFamily,
  multisetsFamily,
  tuplesFamily,
];

// Surjections moved to set-partitions/src/families/core.ts -- §4 step 5, the only family in this
// section carrying a `carrier` ("Surjection"). Endofunctions moved to words/src/families/core.ts
// (wire-carriers lane A-91): it now carries "Endofunction". BinaryStrings/LatticePaths below
// declare no carrier and stay here per step 5 rule 4.
export const entriesBeforeDyckPaths: (NumberKernel | EpsilFamily)[] = [
  binaryStringsFamily,

  // ── lattice-path words ──
  latticePathsFamily,
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
export const entriesBeforeSetPartitions: EpsilFamily[] = [
  fibonacciWords({
    head: "FibonacciWords",
    params: ["_n"],
    fast: {
      count: ([n]) => FibonacciWordCount(n),
      unrank: ([n], r) => FibonacciWordUnrank(n, r),
      rank: (x) => FibonacciWordRank(x as number[]),
      valid: (x, [n]) => IsFibonacciWord(x as number[], n),
    },
  }),
];

// SetPartitions/SetPartitionsIntoKBlocks/SetCompositions/PerfectMatchings moved to
// set-partitions/src/families/core.ts -- §4 step 5. PerfectMatchings' "blocks" shape
// (list<list<integer>>) matches "SetPartition"'s exactly (the wiki's open question 1
// resolved: pairs are its blocks, a restriction rather than the "PerfectMatching" carrier,
// whose shape is list<integer> and does not match). LabeledTrees moved to
// trees/src/families/labeled.ts (wire-carriers lane A-92): it now carries "LabeledTree" (the
// edge set). RootedForests joined it there (same lane), now carrying the new "RootedForest"
// carrier. Nothing left here at this splice position, but the export stays (splice position,
// and the general `entriesBeforeTrees` name other tooling reads) as an empty array.
export const entriesBeforeTrees: NumberKernel[] = [];

// BinaryTrees/BinaryTreeParentArrays/FullKAryTrees/OrderedTrees moved to trees/src/families/core.ts
// -- §4 step 5, every family in this section carrying a `carrier` (FullKAryTrees/OrderedTrees'
// carriers wired lane A-92, matching BinaryTree's own nested shape per #401). Nothing left here
// with no carrier at this position, but the export stays (splice position, and the general
// `entries` name other tooling reads) as an empty array.
export const entries: NumberKernel[] = [];

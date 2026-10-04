// The originally hand-authored collections, expressed as NumberKernel[] over the certified kernel library
// (./kernels*.ts). Same registration mechanism as the other families — no special-casing in library.ts.
import { binaryStrings, grayCodeSubsets, kSubsets, latticePaths, multisets, subsets, tuples } from "./closed-forms.ts";
import type { EpsilFamily } from "./epsil.ts";
import type { NumberKernel } from "./types.ts";
import { FibonacciWordCount, FibonacciWordUnrank, FibonacciWordRank, IsFibonacciWord } from "./kernels-extra.ts";

// helper to cut boilerplate for the flat (number[]) shape; casts the unknown element once here,
// same pattern subsets.ts uses at each call site.
const ints = (
  head: string,
  paramCount: 1 | 2,
  count: (p: number[]) => number,
  unrank: (p: number[], r: number) => number[],
  valid: (e: number[], p: number[]) => boolean,
  rank: (e: number[], p: number[]) => number,
  // Carrier options, when this family's elements are typed.
  carrierOptions?: { carrier: string; carrierParams?: number },
): NumberKernel => ({
  head,
  paramCount,
  kind: "ints",
  count,
  unrank,
  valid: (e, p) => valid(e as number[], p),
  rank: (e, p) => rank(e as number[], p),
  ...carrierOptions,
});

// Closed-form families, defined in Epsil (./closed-forms.ts).
const subsetsFamily = subsets({ head: "Subsets", params: ["_n"], carrier: "Finset", carrierParams: 1 });
// Not carrier-typed here: out of scope for A-116 (only Subsets/KSubsets/Multisets asked for), though
// its elements are the same Finset shape as Subsets'.
const grayCodeSubsetsFamily = grayCodeSubsets({ head: "GrayCodeSubsets", params: ["_n"] });
const kSubsetsFamily = kSubsets({ head: "KSubsets", params: ["_n", "_k"], carrier: "Finset", carrierParams: 1 });
const multisetsFamily = multisets({ head: "Multisets", params: ["_n", "_k"], carrier: "Multiset", carrierParams: 1 });
const tuplesFamily = tuples({ head: "Tuples", params: ["_n", "_k"] });
const binaryStringsFamily = binaryStrings({ head: "BinaryStrings", params: ["_n"] });
const latticePathsFamily = latticePaths({ head: "LatticePaths", params: ["_a", "_b"] });

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

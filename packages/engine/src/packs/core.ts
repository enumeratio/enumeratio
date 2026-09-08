// The originally hand-authored collections, expressed as PackEntry[] over the certified kernel library
// (../kernels*.ts). Same registration mechanism as the pure-kernel packs — no special-casing in library.ts.
import type { PackEntry } from "./types.js";
import { Factorial, PermutationUnrank, PermutationRank, IsPermutationOf } from "../kernels.js";
import {
  CompositionCount, CompositionFromMask, CompositionRank, IsCompositionOf,
  PartitionNumber, IntegerPartitionUnrank, IntegerPartitionRank, IsPartitionOf,
  KPartPartitionCount, IntegerPartitionKUnrank, IntegerPartitionKRank,
  BellB, RgsUnrank, RgsRank, RgsToBlocks, BlocksToRgs, IsSetPartitionOf,
  StirlingS2, SetPartitionsIntoKBlocksUnrank, SetPartitionsIntoKBlocksRank,
  Fubini, SetCompositionUnrank, SetCompositionRank, LabelsToOrderedBlocks, BlocksToLabels,
} from "../kernels-combinatorics.js";
import {
  SubsetCount, SubsetUnrank, SubsetRank, IsSubsetOf,
  KSubsetCount, KSubsetUnrank, KSubsetRank, IsKSubsetOf,
  TupleCount, TupleUnrank, TupleRank, IsTupleOf,
  CompositionsIntoKPartsCount, CompositionsIntoKPartsUnrank, CompositionsIntoKPartsRank, IsCompositionIntoKParts,
  WeakCompositionCount, WeakCompositionUnrank, WeakCompositionRank, IsWeakCompositionOf,
  MultisetCount, MultisetUnrank, MultisetRank, IsMultisetOf,
  LatticePathCount, LatticePathUnrank, LatticePathRank, IsLatticePathOf,
  KPermutationCount, KPermutationUnrank, KPermutationRank, IsKPermutationOf,
  SignedPermutationCount, SignedPermutationUnrank, SignedPermutationRank, IsSignedPermutationOf,
  ColoredPermutationCount, ColoredPermutationUnrank, ColoredPermutationRank, IsColoredPermutationOf,
  DyckPathCount, DyckPathUnrank, DyckPathRank, IsDyckPath,
  LabeledTreeCount, LabeledTreeUnrank, LabeledTreeRank, IsLabeledTreeOf,
  InvolutionCount, InvolutionUnrank, InvolutionRank, IsInvolutionOf,
  DerangementCount, DerangementUnrank, DerangementRank, IsDerangementOf,
  MotzkinCount, MotzkinUnrank, MotzkinRank, IsMotzkinPath,
  FibonacciWordCount, FibonacciWordUnrank, FibonacciWordRank, IsFibonacciWord,
  GrayCodeSubsetUnrank, GrayCodeSubsetRank,
  DistinctPartitionCount, DistinctPartitionUnrank, DistinctPartitionRank, IsDistinctPartitionOf,
  PartitionsInBoxCount, PartitionsInBoxUnrank, PartitionsInBoxRank, IsPartitionInBox,
  BinaryTreeCount, BinaryTreeUnrank, BinaryTreeRank, IsBinaryTree,
  SchroderCount, SchroderUnrank, SchroderRank, IsSchroderPath,
  OrderedTreeCount, OrderedTreeUnrank, OrderedTreeRank, IsOrderedTree,
  KAryTreeCount, KAryTreeUnrank, KAryTreeRank, IsKAryTree,
  SurjectionCount, SurjectionUnrank, SurjectionRank, IsSurjectionOf,
  BinaryStringCount, BinaryStringUnrank, BinaryStringRank, IsBinaryString,
  CyclicPermutationCount, CyclicPermutationUnrank, CyclicPermutationRank, IsCyclicPermutationOf,
  PerfectMatchingCount, PerfectMatchingUnrank, PerfectMatchingRank, IsPerfectMatchingOf,
  PartitionsMaxPartCount, PartitionsMaxPartUnrank, PartitionsMaxPartRank, IsPartitionMaxPart,
  RootedForestCount, RootedForestUnrank, RootedForestRank, IsRootedForest,
} from "../kernels-extra.js";

// helper to cut boilerplate for the two flat/block shapes
const ints = (head: string, paramCount: 1 | 2, count: (p: number[]) => number,
  unrank: (p: number[], r: number) => number[], valid: (e: any, p: number[]) => boolean,
  rank: (e: any, p: number[]) => number): PackEntry => ({ head, paramCount, kind: "ints", count, unrank, rank, valid });

export const entries: PackEntry[] = [
  // ── permutations (one-line words) ──
  ints("SymmetricGroup", 1, ([n]) => Factorial(n), ([n], r) => PermutationUnrank(n, r), (a, [n]) => IsPermutationOf(a, n), (a) => PermutationRank(a)),
  ints("KPermutations", 2, ([n, k]) => KPermutationCount(n, k), ([n, k], r) => KPermutationUnrank(n, k, r), (a, [n, k]) => IsKPermutationOf(a, n, k), (a, [n]) => KPermutationRank(a, n)),
  ints("SignedPermutations", 1, ([n]) => SignedPermutationCount(n), ([n], r) => SignedPermutationUnrank(n, r), (a, [n]) => IsSignedPermutationOf(a, n), (a) => SignedPermutationRank(a)),
  ints("CyclicPermutations", 1, ([n]) => CyclicPermutationCount(n), ([n], r) => CyclicPermutationUnrank(n, r), (a, [n]) => IsCyclicPermutationOf(a, n), (a) => CyclicPermutationRank(a)),
  ints("Involutions", 1, ([n]) => InvolutionCount(n), ([n], r) => InvolutionUnrank(n, r), (a, [n]) => IsInvolutionOf(a, n), (a) => InvolutionRank(a)),
  ints("Derangements", 1, ([n]) => DerangementCount(n), ([n], r) => DerangementUnrank(n, r), (a, [n]) => IsDerangementOf(a, n), (a) => DerangementRank(a)),
  { head: "ColoredPermutations", paramCount: 2, kind: "blocks",
    count: ([n, k]) => ColoredPermutationCount(n, k),
    unrank: ([n, k], r) => { const [img, cols] = ColoredPermutationUnrank(n, k, r); return [img, cols]; },
    valid: (b, [n, k]) => IsColoredPermutationOf(b[0] ?? [], b[1] ?? [], n, k),
    rank: (b, [, k]) => ColoredPermutationRank(b[0], b[1], k) },

  // ── compositions ──
  ints("IntegerCompositions", 1, ([n]) => CompositionCount(n), ([n], r) => CompositionFromMask(n, r), (a, [n]) => IsCompositionOf(a, n), (a) => CompositionRank(a)),
  ints("CompositionsIntoKParts", 2, ([n, k]) => CompositionsIntoKPartsCount(n, k), ([n, k], r) => CompositionsIntoKPartsUnrank(n, k, r), (a, [n, k]) => IsCompositionIntoKParts(a, n, k), (a) => CompositionsIntoKPartsRank(a)),
  ints("WeakCompositions", 2, ([n, k]) => WeakCompositionCount(n, k), ([n, k], r) => WeakCompositionUnrank(n, k, r), (a, [n, k]) => IsWeakCompositionOf(a, n, k), (a) => WeakCompositionRank(a)),

  // ── partitions ──
  ints("IntegerPartitions", 1, ([n]) => PartitionNumber(n), ([n], r) => IntegerPartitionUnrank(n, r), (a, [n]) => IsPartitionOf(a, n), (a, [n]) => IntegerPartitionRank(a, n)),
  ints("PartitionsIntoKParts", 2, ([n, k]) => KPartPartitionCount(n, k), ([n, k], r) => IntegerPartitionKUnrank(n, k, r), (a, [n, k]) => IsPartitionOf(a, n, k), (a, [n]) => IntegerPartitionKRank(a, n)),
  ints("DistinctPartitions", 1, ([n]) => DistinctPartitionCount(n), ([n], r) => DistinctPartitionUnrank(n, r), (a, [n]) => IsDistinctPartitionOf(a, n), (a, [n]) => DistinctPartitionRank(a, n)),
  ints("PartitionsMaxPart", 2, ([n, m]) => PartitionsMaxPartCount(n, m), ([n, m], r) => PartitionsMaxPartUnrank(n, m, r), (a, [n, m]) => IsPartitionMaxPart(a, n, m), (a, [, m]) => PartitionsMaxPartRank(a, m)),
  ints("PartitionsInBox", 2, ([a, b]) => PartitionsInBoxCount(a, b), ([a, b], r) => PartitionsInBoxUnrank(a, b, r), (x, [a, b]) => IsPartitionInBox(x, a, b), (x, [a, b]) => PartitionsInBoxRank(x, a, b)),

  // ── subsets / multisets / tuples / functions / binary words ──
  ints("Subsets", 1, ([n]) => SubsetCount(n), ([n], r) => SubsetUnrank(n, r), (a, [n]) => IsSubsetOf(a, n), (a) => SubsetRank(a)),
  ints("KSubsets", 2, ([n, k]) => KSubsetCount(n, k), ([n, k], r) => KSubsetUnrank(n, k, r), (a, [n, k]) => IsKSubsetOf(a, n, k), (a) => KSubsetRank(a)),
  ints("GrayCodeSubsets", 1, ([n]) => SubsetCount(n), ([n], r) => GrayCodeSubsetUnrank(n, r), (a, [n]) => IsSubsetOf(a, n), (a) => GrayCodeSubsetRank(a)),
  ints("Multisets", 2, ([n, k]) => MultisetCount(n, k), ([n, k], r) => MultisetUnrank(n, k, r), (a, [n, k]) => IsMultisetOf(a, n, k), (a) => MultisetRank(a)),
  ints("Tuples", 2, ([n, k]) => TupleCount(n, k), ([n, k], r) => TupleUnrank(n, k, r), (a, [n, k]) => IsTupleOf(a, n, k), (a, [n]) => TupleRank(a, n)),
  ints("Surjections", 2, ([n, k]) => SurjectionCount(n, k), ([n, k], r) => SurjectionUnrank(n, k, r), (a, [n, k]) => IsSurjectionOf(a, n, k), (a, [, k]) => SurjectionRank(a, k)),
  ints("Endofunctions", 1, ([n]) => n ** n, ([n], r) => TupleUnrank(n, n, r), (a, [n]) => IsTupleOf(a, n, n), (a, [n]) => TupleRank(a, n)),
  ints("BinaryStrings", 1, ([n]) => BinaryStringCount(n), ([n], r) => BinaryStringUnrank(n, r), (a, [n]) => IsBinaryString(a, n), (a) => BinaryStringRank(a)),

  // ── lattice-path words ──
  ints("LatticePaths", 2, ([a, b]) => LatticePathCount(a, b), ([a, b], r) => LatticePathUnrank(a, b, r), (x, [a, b]) => IsLatticePathOf(x, a, b), (x) => LatticePathRank(x)),
  ints("DyckPaths", 1, ([n]) => DyckPathCount(n), ([n], r) => DyckPathUnrank(n, r), (a, [n]) => IsDyckPath(a, n), (a) => DyckPathRank(a)),
  ints("MotzkinPaths", 1, ([n]) => MotzkinCount(n), ([n], r) => MotzkinUnrank(n, r), (a, [n]) => IsMotzkinPath(a, n), (a) => MotzkinRank(a)),
  ints("SchroderPaths", 1, ([n]) => SchroderCount(n), ([n], r) => SchroderUnrank(n, r), (a, [n]) => IsSchroderPath(a, n), (a) => SchroderRank(a)),
  ints("FibonacciWords", 1, ([n]) => FibonacciWordCount(n), ([n], r) => FibonacciWordUnrank(n, r), (a, [n]) => IsFibonacciWord(a, n), (a) => FibonacciWordRank(a)),

  // ── set partitions / matchings (blocks) ──
  { head: "SetPartitions", paramCount: 1, kind: "blocks", count: ([n]) => BellB(n),
    unrank: ([n], r) => RgsToBlocks(RgsUnrank(n, r)), valid: (b, [n]) => IsSetPartitionOf(b, n), rank: (b, [n]) => RgsRank(BlocksToRgs(b, n)) },
  { head: "SetPartitionsIntoKBlocks", paramCount: 2, kind: "blocks", count: ([n, k]) => StirlingS2(n, k),
    unrank: ([n, k], r) => RgsToBlocks(SetPartitionsIntoKBlocksUnrank(n, k, r)), valid: (b, [n, k]) => IsSetPartitionOf(b, n, k), rank: (b, [n, k]) => SetPartitionsIntoKBlocksRank(BlocksToRgs(b, n), k) },
  { head: "SetCompositions", paramCount: 1, kind: "blocks", count: ([n]) => Fubini(n),
    unrank: ([n], r) => LabelsToOrderedBlocks(SetCompositionUnrank(n, r)), valid: (b, [n]) => IsSetPartitionOf(b, n), rank: (b, [n]) => SetCompositionRank(BlocksToLabels(b), n) },
  { head: "PerfectMatchings", paramCount: 1, kind: "blocks", count: ([n]) => PerfectMatchingCount(n),
    unrank: ([n], r) => PerfectMatchingUnrank(n, r), valid: (b, [n]) => IsPerfectMatchingOf(b, n), rank: (b, [n]) => PerfectMatchingRank(b, n) },
  { head: "LabeledTrees", paramCount: 1, kind: "blocks", count: ([n]) => LabeledTreeCount(n),
    unrank: ([n], r) => LabeledTreeUnrank(n, r), valid: (e, [n]) => IsLabeledTreeOf(e, n), rank: (e, [n]) => LabeledTreeRank(e, n) },
  { head: "RootedForests", paramCount: 1, kind: "ints", count: ([n]) => RootedForestCount(n),
    unrank: ([n], r) => RootedForestUnrank(n, r), valid: (a, [n]) => IsRootedForest(a, n), rank: (a, [n]) => RootedForestRank(a, n) },

  // ── trees with nested elements (leaf 0 / [], node = children) ──
  { head: "BinaryTrees", paramCount: 1, kind: "nested", count: ([n]) => BinaryTreeCount(n),
    unrank: ([n], r) => BinaryTreeUnrank(n, r), valid: (e, [n]) => IsBinaryTree(e, n), rank: (e) => BinaryTreeRank(e) },
  { head: "KAryTrees", paramCount: 2, kind: "nested", count: ([n, k]) => KAryTreeCount(n, k),
    unrank: ([n, k], r) => KAryTreeUnrank(n, k, r), valid: (e, [n, k]) => IsKAryTree(e, n, k), rank: (e, [, k]) => KAryTreeRank(e, k) },
  { head: "OrderedTrees", paramCount: 1, kind: "nested", count: ([n]) => OrderedTreeCount(n),
    unrank: ([n], r) => OrderedTreeUnrank(n, r), valid: (e, [n]) => IsOrderedTree(e, n), rank: (e) => OrderedTreeRank(e) },
];

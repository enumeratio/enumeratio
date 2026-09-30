// Carrier data for the trees area (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 4). Hand-maintained: split from the retired domains/scripts/extract.ts
// generator, one-time, from the last generated domain-data.ts. Families for this area move
// here in step 5.

import type { Carrier } from "@enumeratio/structures";

export const TREES_CARRIERS: readonly Carrier[] = [
  {
    name: "BinaryTree",
    type: "binary_tree",
    shape: "integer | list<any>",
    id: "binary_tree",
    plural: "BinaryTrees",
  },
  {
    name: "BinaryTreeParentArray",
    type: "binary_tree_parent_array",
    shape: "list<integer>",
    id: "binary_tree_parent_array",
    plural: "BinaryTreeParentArrays",
  },
  {
    name: "Dissection",
    type: "dissection",
    shape: "tuple<list<integer>, integer>",
    id: "dissection",
    plural: "Dissections",
  },
  {
    name: "IncreasingBinaryTree",
    type: "increasing_binary_tree",
    // Nested, following BinaryTree/KAryTree/OrderedTree's own convention (leaf 0, node a
    // list): [label, left, right], label folded in as the first slot. Matches what
    // IncreasingBinaryTrees (collections) and FromPermutation (permutations/src/maps.ts) both
    // build -- neither constructs the flat by-value parent-array tuple this carrier declared
    // before (A-116).
    shape: "integer | list<any>",
    id: "increasing_binary_tree",
    plural: "IncreasingBinaryTrees",
  },
  {
    name: "KAryTree",
    type: "k_ary_tree",
    shape: "integer | list<any>",
    id: "k_ary_tree",
    plural: "KAryTrees",
  },
  {
    name: "LabeledTree",
    type: "labeled_tree",
    shape: "list<list<integer>>",
    id: "labeled_tree",
    plural: "LabeledTrees",
  },
  {
    name: "NonCrossingTree",
    type: "non_crossing_tree",
    shape: "list<integer>",
    id: "non_crossing_tree",
    plural: "NonCrossingTrees",
  },
  {
    name: "OrderedTree",
    type: "ordered_tree",
    shape: "integer | list<any>",
    id: "ordered_tree",
    plural: "OrderedTrees",
  },
  {
    name: "PhylogeneticTree",
    type: "phylogenetic_tree",
    shape: "list<integer>",
    id: "phylogenetic_tree",
    plural: "PhylogeneticTrees",
  },
  {
    name: "PlaneTree",
    type: "plane_tree",
    shape: "list<integer>",
    id: "plane_tree",
    plural: "PlaneTrees",
  },
  {
    name: "PruferSequence",
    // A word, not an edge list -- counted in its own right (n^(n-2)), and the Prüfer bijection
    // to LabeledTree is a conversion (LabeledTree(PruferSequence(...))), not this carrier's shape.
    type: "prufer_sequence",
    shape: "list<integer>",
    id: "prufer_sequence",
    plural: "PruferSequences",
  },
  {
    name: "RootedForest",
    type: "rooted_forest",
    shape: "list<integer>",
    id: "rooted_forest",
    plural: "RootedForests",
  },
  {
    name: "RootedLabeledTree",
    type: "rooted_labeled_tree",
    shape: "list<integer>",
    id: "rooted_labeled_tree",
    plural: "RootedLabeledTrees",
  },
  {
    name: "RootedUnlabeledTree",
    type: "rooted_unlabeled_tree",
    shape: "list<integer>",
    id: "rooted_unlabeled_tree",
    plural: "RootedUnlabeledTrees",
  },
  {
    name: "UnlabeledFreeTree",
    type: "unlabeled_free_tree",
    shape: "list<integer>",
    id: "unlabeled_free_tree",
    plural: "UnlabeledFreeTrees",
  },
];

// Carrier domains for the trees area (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 4). Hand-maintained: split from the retired domains/scripts/extract.ts
// generator, one-time, from the last generated domain-data.ts. Families for this area move
// here in step 5.

import type { Domain } from "@enumeratio/structures";

export const TREES_DOMAINS: readonly Domain[] = [
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
    shape: "tuple<integer, list<integer>, list<integer>>",
    id: "increasing_binary_tree",
    plural: "IncreasingBinaryTrees",
  },
  {
    name: "KAryTree",
    type: "k_ary_tree",
    shape: "list<integer>",
    id: "k_ary_tree",
    plural: "KAryTrees",
  },
  {
    name: "LabeledTree",
    type: "labeled_tree",
    shape: "list<integer>",
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
    shape: "list<integer>",
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

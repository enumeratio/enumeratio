// Where this project stores a carrier differently from enumeratio's SQL composite type, and the
// carriers it adds. scripts/extract.ts applies both.
//
// A set partition is its blocks: the collections, every set-partition statistic and FindStat
// all read it that way. Its restricted growth string, the SQL storage, is a carrier of its own,
// order-isomorphic to it (the k-th set partition's string is the k-th string), and the two are
// each constructor converting from the other (src/map.ts).
// A set composition is likewise its ordered blocks; its word (position i labelled with its
// block's index) is a Surjection, converted the same way.
// A binary tree is nested, leaf 0 and node [left, right], as BinaryTrees lists it; the flat
// storage is its in-order parent array, a carrier of its own (src/binary-tree.ts).
export const SHAPE_OVERRIDES: Readonly<Record<string, string>> = {
  binary_tree: "integer | list<any>",
  set_composition: "list<list<integer>>",
  set_partition: "list<list<integer>>",
};

/** SQL carriers this project replaces. `permutation_cycles` was a flat word with no size; a
 *  permutation in cycle notation is a `cycle_decomposition`, fixed points kept. */
export const RETIRED_CARRIERS: ReadonlySet<string> = new Set(["permutation_cycles"]);

/** Carriers with no SQL composite type of their own: `[id, shape, plural]`. */
export const ADDED_CARRIERS: readonly (readonly [id: string, shape: string, plural: string])[] = [
  ["binary_tree_parent_array", "list<integer>", "BinaryTreeParentArrays"],
  ["cycle_decomposition", "list<list<integer>>", "PermutationsAsCycles"],
  ["restricted_growth_string", "list<integer>", "RestrictedGrowthStrings"],
];

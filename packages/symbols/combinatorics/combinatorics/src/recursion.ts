// Recursion in Epsil is generic machinery, not combinatorics-specific — moved to
// @enumeratio/structures. Re-exported here so the area files that import it by relative path
// (trees/src/binary-tree.ts, permutations/src/cycle-decomposition.ts) don't have to know that.
export { isLeaf, recurse, self } from "@enumeratio/structures";

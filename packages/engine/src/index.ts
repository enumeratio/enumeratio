// @enumeratio/engine (provisional name) — enumeratio as a loadable compute-engine library.
// Wave 1: the permutations vertical (SymmetricGroup + Inversions), O(1) rank/unrank random access.

export { enumeratioLibrary, installEnumeratio } from "./library.js";
export * from "./kernels.js";
export { emitScalarSql, sqlPermutationAt, sqlInversions } from "./sql-target.js";

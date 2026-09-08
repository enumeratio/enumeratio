// @enumeratio/compute-engine — enumeratio as a loadable compute-engine library: ~90 combinatorial
// collections with O(1) rank/unrank random access backing CE's CollectionHandlers, plus Wolfram-aligned
// counting/digit operators. installEnumeratio(ce) loads them into any ComputeEngine.

export { enumeratioLibrary, installEnumeratio, seedRandom } from "./library.js";
export * from "./kernels.js";
export * from "./kernels-combinatorics.js";
export * from "./kernels-extra.js";
export { emitScalarSql, sqlPermutationAt, sqlInversions } from "./sql-target.js";

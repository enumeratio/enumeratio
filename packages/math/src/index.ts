// @enumeratio/math — pure-TS, zero-runtime-dependency twins of enumeratio's SQL math primitives. Each export
// here is named to match its SQL counterpart exactly (see packages/data/sqlsrc/) and is verified against it by
// the differential oracle in selfcert-math.mts. See each module's header for the numbers-repo source + SQL name.

export * from "./number_theory.js";
export * from "./combinat.js";
export * from "./catalan.js";
export * from "./complex.js";
export * from "./multicomplex.js";
export * from "./compositions.js";
export * from "./permutations.js";
export * from "./permutation_statistics.js";
export * from "./integer_partitions.js";
export * from "./set_partitions.js";
export * from "./set_compositions.js";

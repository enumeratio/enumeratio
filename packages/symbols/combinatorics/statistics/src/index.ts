// The combinatorial statistics (permutation, partition, Dyck-path and set-partition
// definitions, their generic declare/compile/naming/core machinery, findstat data and
// frontier stubs) moved to @enumeratio/combinatorics, one kernel per area (step 6b) — that
// package now devDeps this one for nothing; every former importer of `ALL_STATISTICS`,
// `declareStatistics`, `findstat`, `blessedName`, `CARDINALITIES`, `NATIVE_TO_ENGINE`,
// `FRONTIER`/`ALL_FRONTIER`, `core`/`cycles`/`headUsage`/`tower` and the `Definition` type
// moved with them, to `@enumeratio/combinatorics`'s own `src` barrel — no compatibility
// re-export here, since nothing outside this package still imports the old names.
//
// What's left is genuinely this package's own: probability distributions and processes, no
// combinatorics carrier involved.
export { declareDistributions } from "./distributions.ts";
export { declareDistributions2 } from "./distributions-2.ts";
export { declareDistributions3 } from "./distributions-3.ts";
export { declareDistributions4 } from "./distributions-4.ts";
export { declareDistributions5 } from "./distributions-5.ts";
export { declareDistributions6 } from "./distributions-6.ts";
export { declareProcesses } from "./processes.ts";

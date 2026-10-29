// Compile every permutation statistic's Epsil definition to JavaScript ahead of time, into
// src/statistics.compiled.generated.js (step 6b: one generator per area).
//
//   vp node packages/symbols/combinatorics/combinatorics/permutations/scripts/compile-definitions.ts

import { fileURLToPath } from "node:url";
import { compileArea } from "../../scripts/compile-area.ts";
import { PERMUTATION_STATISTICS } from "../src/statistics.ts";

if (process.argv[1] === fileURLToPath(import.meta.url))
  await compileArea(
    import.meta.url,
    "compile-permutations",
    PERMUTATION_STATISTICS,
    "list<integer>",
    "../src/statistics.compiled.generated.js",
  );

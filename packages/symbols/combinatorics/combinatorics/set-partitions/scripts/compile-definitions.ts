// Compile every set-partition statistic's Epsil definition to JavaScript ahead of time, into
// src/statistics.compiled.generated.js (step 6b: one generator per area).
//
//   vp node packages/symbols/combinatorics/combinatorics/set-partitions/scripts/compile-definitions.ts

import { fileURLToPath } from "node:url";
import { compileArea } from "../../scripts/compile-area.ts";
import { SET_PARTITION_STATISTICS } from "../src/statistics.ts";

// A set partition is a list of BLOCKS, not integers.
if (process.argv[1] === fileURLToPath(import.meta.url))
  await compileArea(
    import.meta.url,
    "compile-set-partitions",
    SET_PARTITION_STATISTICS,
    "list<list<integer>>",
    "../src/statistics.compiled.generated.js",
  );

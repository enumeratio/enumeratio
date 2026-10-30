// Compile every tree statistic's Epsil definition to JavaScript ahead of time, into
// src/statistics.compiled.generated.js (step 6b: one generator per area).
//
//   vp node packages/symbols/combinatorics/combinatorics/trees/scripts/compile-definitions.ts

import { fileURLToPath } from "node:url";
import { compileArea } from "../../scripts/compile-area.ts";
import { TREE_STATISTICS } from "../src/statistics.ts";

if (process.argv[1] === fileURLToPath(import.meta.url))
  await compileArea(
    import.meta.url,
    "compile-trees",
    TREE_STATISTICS,
    "list<any>",
    "../src/statistics.compiled.generated.js",
  );

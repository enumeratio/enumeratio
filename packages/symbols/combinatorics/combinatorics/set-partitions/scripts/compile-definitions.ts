// Compile every set-partition statistic's Epsil definition to JavaScript ahead of time, into
// src/statistics.compiled.generated.js (step 6b: one generator per area).
//
//   vp node packages/symbols/combinatorics/combinatorics/set-partitions/scripts/compile-definitions.ts

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compiledDefinitionsFor, renderCompiled } from "../../src/statistics/generate-compiled.ts";
import { SET_PARTITION_STATISTICS } from "../src/statistics.ts";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // A set partition is a list of BLOCKS, not integers.
  const entries = compiledDefinitionsFor(SET_PARTITION_STATISTICS, "list<list<integer>>");
  const target = fileURLToPath(new URL("../src/statistics.compiled.generated.js", import.meta.url));
  writeFileSync(target, renderCompiled(entries));
  execFileSync("vp", ["fmt", target], { stdio: "ignore" });
  console.log(`${entries.length} of ${SET_PARTITION_STATISTICS.length} definitions compiled`);
}

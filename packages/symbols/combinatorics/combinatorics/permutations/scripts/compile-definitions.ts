// Compile every permutation statistic's Epsil definition to JavaScript ahead of time, into
// src/statistics.compiled.generated.js (step 6b: one generator per area).
//
//   vp node packages/symbols/combinatorics/combinatorics/permutations/scripts/compile-definitions.ts

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compiledDefinitionsFor, renderCompiled } from "../../src/statistics/generate-compiled.ts";
import { PERMUTATION_STATISTICS } from "../src/statistics.ts";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const entries = compiledDefinitionsFor(PERMUTATION_STATISTICS, "list<integer>");
  const target = fileURLToPath(new URL("../src/statistics.compiled.generated.js", import.meta.url));
  writeFileSync(target, renderCompiled(entries));
  // Laid out as `vp fmt` lays it out, so a rerun with nothing changed changes nothing.
  execFileSync("vp", ["fmt", target], { stdio: "ignore" });
  console.log(`${entries.length} of ${PERMUTATION_STATISTICS.length} definitions compiled`);
}

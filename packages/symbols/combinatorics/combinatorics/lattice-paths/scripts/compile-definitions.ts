// Compile every Dyck-path statistic's Epsil definition to JavaScript ahead of time, into
// src/statistics.compiled.generated.js (step 6b: one generator per area).
//
//   vp node packages/symbols/combinatorics/combinatorics/lattice-paths/scripts/compile-definitions.ts

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compiledDefinitionsFor, renderCompiled } from "../../src/statistics/generate-compiled.ts";
import { DYCK_STATISTICS } from "../src/statistics.ts";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const entries = compiledDefinitionsFor(DYCK_STATISTICS, "list<integer>");
  const target = fileURLToPath(new URL("../src/statistics.compiled.generated.js", import.meta.url));
  writeFileSync(target, renderCompiled(entries));
  execFileSync("vp", ["fmt", target], { stdio: "ignore" });
  console.log(`${entries.length} of ${DYCK_STATISTICS.length} definitions compiled`);
}

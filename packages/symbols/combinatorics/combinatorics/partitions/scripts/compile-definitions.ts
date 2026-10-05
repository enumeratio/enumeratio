// Compile every partition statistic's Epsil definition to JavaScript ahead of time, into
// src/statistics.compiled.generated.js (step 6b: one generator per area).
//
//   vp node packages/symbols/combinatorics/combinatorics/partitions/scripts/compile-definitions.ts

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { smallElements } from "../../scripts/samples.ts";
import { verdictsFor } from "../../scripts/verdicts.ts";
import { compiledDefinitionsFor, renderCompiled } from "../../src/statistics/generate-compiled.ts";
import { PARTITION_STATISTICS } from "../src/statistics.ts";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const verdicts = verdictsFor("compile-partitions");
  const { compiled: entries, disagreed } = compiledDefinitionsFor(
    PARTITION_STATISTICS,
    "list<integer>",
    smallElements,
    verdicts,
  );
  const target = fileURLToPath(new URL("../src/statistics.compiled.generated.js", import.meta.url));
  writeFileSync(target, renderCompiled(entries));
  verdicts.save();
  execFileSync("vp", ["fmt", target], { stdio: "ignore" });
  console.log(`${entries.length} of ${PARTITION_STATISTICS.length} definitions compiled`);
  for (const signature of disagreed)
    console.log(`${signature}: compiled code disagreed with the interpreter; left interpreted`);
}

// Compile every set-partition statistic's Epsil definition to JavaScript ahead of time, into
// src/statistics.compiled.generated.js (step 6b: one generator per area).
//
//   vp node packages/symbols/combinatorics/combinatorics/set-partitions/scripts/compile-definitions.ts

import { fileURLToPath } from "node:url";
import { smallElements } from "../../scripts/samples.ts";
import { verdictsFor } from "../../scripts/verdicts.ts";
import { writeGenerated } from "../../scripts/write-generated.ts";
import { compiledDefinitionsFor, renderCompiled } from "../../src/statistics/generate-compiled.ts";
import { SET_PARTITION_STATISTICS } from "../src/statistics.ts";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const verdicts = verdictsFor("compile-set-partitions");
  // A set partition is a list of BLOCKS, not integers.
  const { compiled: entries, disagreed } = compiledDefinitionsFor(
    SET_PARTITION_STATISTICS,
    "list<list<integer>>",
    smallElements,
    verdicts,
  );
  const target = fileURLToPath(new URL("../src/statistics.compiled.generated.js", import.meta.url));
  writeGenerated(target, renderCompiled(entries));
  verdicts.save();
  console.log(`${entries.length} of ${SET_PARTITION_STATISTICS.length} definitions compiled`);
  for (const signature of disagreed)
    console.log(`${signature}: compiled code disagreed with the interpreter; left interpreted`);
}

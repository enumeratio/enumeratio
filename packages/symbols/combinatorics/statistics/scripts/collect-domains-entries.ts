// Write combinatorics' domains-area generated map entries (domains-entries.ts) into its
// reference/. Lives in statistics/scripts/, not combinatorics/, so the generator can import
// declareStatistics without cycling (see domains-entries.ts).
//
//   vp node packages/symbols/combinatorics/statistics/scripts/collect-domains-entries.ts

import { writeEntries } from "@enumeratio/entry/node";
import { generated } from "./domains-entries.ts";

await writeEntries(new URL("../../combinatorics/reference/", import.meta.url), generated);
process.stdout.write(`wrote ${generated.entries.length} entries\n`);

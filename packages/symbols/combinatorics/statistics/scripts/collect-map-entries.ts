// Write combinatorics' generated map entries (map-entries.ts) into its
// reference/. Lives in statistics/scripts/, not combinatorics/, so the generator can import
// declareStatistics without cycling (see map-entries.ts).
//
//   vp node packages/symbols/combinatorics/statistics/scripts/collect-map-entries.ts

import { writeEntries } from "@enumeratio/entry/node";
import { generated } from "./map-entries.ts";

await writeEntries(new URL("../../combinatorics/reference/", import.meta.url), generated);
process.stdout.write(`wrote ${generated.entries.length} entries\n`);

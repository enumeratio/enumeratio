// Write combinatorics' generated map entries (map-entries.ts) into its reference/.
//
//   vp node packages/symbols/combinatorics/combinatorics/scripts/collect-map-entries.ts

import { writeEntries } from "@enumeratio/entry/node";
import { generated } from "./map-entries.ts";

await writeEntries(new URL("../reference/", import.meta.url), generated);
process.stdout.write(`wrote ${generated.entries.length} entries\n`);

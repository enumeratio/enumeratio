// Write the generated map entries (scripts/entries.ts) into reference/.
//
//   vp node packages/symbols/combinatorics/domains/scripts/collect-entries.ts

import { writeEntries } from "@enumeratio/entry/node";
import { generated } from "./entries.ts";

await writeEntries(new URL("../reference/", import.meta.url), generated);
process.stdout.write(`wrote ${generated.entries.length} entries\n`);

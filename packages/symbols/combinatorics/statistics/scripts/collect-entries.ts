// Write the generated statistics entries (scripts/entries.ts) into reference/, leaving the
// hand-written records there alone.
//
//   vp node packages/symbols/combinatorics/statistics/scripts/collect-entries.ts

import { writeEntries } from "@enumeratio/entry/node";
import { generated } from "./entries.ts";

await writeEntries(new URL("../reference/", import.meta.url), generated);
process.stdout.write(`wrote ${generated.entries.length} entries\n`);

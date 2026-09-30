// Write Dyck-path statistics' generated reference entries (scripts/entries.ts) into
// ../../reference/, leaving the hand-written records (and the other areas') alone.
//
//   vp node packages/symbols/combinatorics/combinatorics/lattice-paths/scripts/collect-entries.ts

import { writeEntries } from "@enumeratio/entry/node";
import { generated, REFERENCE_DIR } from "./entries.ts";

await writeEntries(REFERENCE_DIR, generated.standard);
await writeEntries(REFERENCE_DIR, generated.curated);
process.stdout.write(`wrote ${generated.standard.entries.length} entries\n`);

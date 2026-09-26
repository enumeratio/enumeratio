// Move statistics' `RENAMED` (naming.ts) into a `formerly:` field on the head it renamed TO --
// symbol-metadata step 3 (design/speculative/symbol-metadata.md, lanes/handoff-M.md item 2.3).
//
//   vp node packages/reference/scripts/migrate/renamed-to-yaml.ts [--write]
//
// Without --write, only reports what would change. `naming.ts`'s `RENAMED` is left alone here
// -- a follow-up commit deletes it once `blessedName` reads the generated table instead
// (`packages/symbols/combinatorics/statistics/scripts/collect-naming.ts`).
//
// CAUTION: do not run statistics' `scripts/collect-entries.ts` to "help" -- it deletes every
// hand-written record in its reference/ directory (a known, separately tracked bug). This
// script only reads entries with `@enumeratio/entry/node`'s `readEntry`/`writeEntry`, which
// touch exactly the one file each named head owns.

import { dirname } from "node:path";
import { readEntry, writeEntry } from "@enumeratio/entry/node";
import { RENAMED } from "../../../symbols/combinatorics/statistics/src/naming.ts";
import { loadReferenceData, PACKAGES } from "../../src/node.ts";

const write = process.argv.includes("--write");

const { heads } = loadReferenceData(PACKAGES);
// `formerly:` is read back by this package's own generator (collect-naming.ts), which only
// scans statistics' reference/ -- so it has to land on STATISTICS' copy of a shared head
// (design/examples-as-data.md §9), not whichever copy `referenceData()` resolves the name to
// globally (that's `canonicalHeads`, the right choice for the crosswalk in curated-to-yaml.ts,
// wrong here: CycleCount's canonical copy is collections', which this generator never reads).
const byName = new Map(heads.filter((h) => h.package === "statistics").map((h) => [h.head, h]));

// One catalog stat currently renders with no head of its own at all (a cardinality answered
// by `Count` over a collection, not a definition -- see cardinalities.ts). Nothing to attach
// `formerly:` to; the generator carries this one exception by hand.
const NO_HEAD = new Set(["NumberOfStandardTableaux"]);

let updated = 0;
const skipped: string[] = [];

for (const [oldName, newName] of Object.entries(RENAMED).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
  const existing = byName.get(newName);
  if (!existing) {
    if (!NO_HEAD.has(oldName)) skipped.push(`${oldName} -> ${newName} (no <Head>.yaml for ${newName})`);
    continue;
  }
  const dir = dirname(existing.entryPath);
  const entry = readEntry(dir, newName);
  const formerly = [...new Set([...(entry.formerly ?? []), oldName])];
  if (formerly.length === (entry.formerly?.length ?? 0)) continue; // already there
  if (write) await writeEntry(dir, { ...entry, formerly });
  updated++;
}

if (skipped.length) console.log(`skipped (no record to attach formerly to):\n  ${skipped.join("\n  ")}`);
console.log(`${updated} records updated${write ? "" : " (dry run; pass --write)"}`);

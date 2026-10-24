// Give every head FindStat matched by value (`find-findstat.ts`, `find-findstat-maps.ts`) its
// `catalog:` entry per matched id and the carrier in `statOn` / `mapOn`. A step over the
// committed records, after the generators (`collect-entries`, `collect-map-entries`), which keep
// these fields as curated: it only adds what is missing, so hand-written entries are untouched
// and a second run changes nothing.
//
//   vp node packages/reference/scripts/collect-findstat-catalog.ts

import { updateHead } from "@enumeratio/entry/node";
import { canonicalHeads, referenceData } from "../src/node.ts";
import { type Wanted, wanted, withFindStat } from "./findstat-catalog.ts";

const data = referenceData();
const chosen = canonicalHeads(data.heads);

const byHead = new Map<string, Wanted[]>();
for (const row of wanted()) byHead.set(row.head, [...(byHead.get(row.head) ?? []), row]);

let written = 0;
for (const [head, rows] of byHead) {
  const loaded = chosen.get(head);
  if (loaded === undefined) throw new Error(`findstat catalog: no record for ${head}`);
  const entry = withFindStat(loaded.entry, rows);
  if (JSON.stringify(entry) === JSON.stringify(loaded.entry)) continue;
  await updateHead(loaded.dir, head, { entry });
  written++;
}
console.log(`${written} records updated, ${byHead.size} heads matched`);

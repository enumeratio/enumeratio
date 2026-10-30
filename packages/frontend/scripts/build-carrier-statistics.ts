// The statistics a table opens with, per carrier, and the carrier of each collection head, into
// generated/carrier-statistics.json: what `Columns -> Automatic` needs where the runtime loads no
// manifest (src/carrier-statistics.ts reads it). A carrier keeps its first DEFAULT_COLUMNS
// statistics, in the explorer's order (catalogOf). `build` runs it; never committed.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readEntries, recordDirs } from "@enumeratio/entry/node";
import type { ReferenceEntry } from "@enumeratio/entry";
import { catalogOf } from "../src/explorer.ts";
import { DEFAULT_COLUMNS } from "../src/table-state.ts";

const PACKAGES = fileURLToPath(new URL("../../", import.meta.url));
const TABLE = fileURLToPath(new URL("../generated/carrier-statistics.json", import.meta.url));

const byName = new Map<string, ReferenceEntry>();
for (const { dir } of recordDirs(PACKAGES))
  for (const e of readEntries(dir)) if (!byName.has(e.name)) byName.set(e.name, e);
const records = [...byName.values()].toSorted((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
const catalog = catalogOf(records);

const carriers: Record<string, string[]> = {};
const heads: Record<string, string> = {};
const open = (carrier: string): boolean => {
  const names = catalog.statisticsOn(carrier).map((s) => s.name);
  if (names.length > 0) carriers[carrier] = names.slice(0, DEFAULT_COLUMNS);
  return names.length > 0;
};
for (const r of records) {
  if (r.catalogCarrier) open(r.name);
  if (r.carrier !== undefined && r.name !== r.carrier && open(r.carrier)) heads[r.name] = r.carrier;
}

mkdirSync(dirname(TABLE), { recursive: true });
writeFileSync(TABLE, JSON.stringify({ carriers, heads }));
console.log(`statistics for ${Object.keys(carriers).length} carriers, ${Object.keys(heads).length} heads -> ${TABLE}`);

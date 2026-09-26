// Move `@enumeratio/catalog`'s `REFERENCES` onto each head's <Head>.yaml `catalog:` list --
// step 2 of retiring packages/catalog/src/catalog-data.ts (a one-time dump of a database that
// no longer exists), same idea as symbol-metadata steps 2/4/5 for curated.ts/HEADS/MAPPINGS.
//
//   vp node packages/reference/scripts/migrate/catalog-to-yaml.ts [--write]
//
// Without --write, only reports what would change. `catalog-data.ts` is left alone here -- a
// follow-up commit switches its consumers to the generated `catalog-references-data.ts` and
// deletes the dump once nothing reads it (this script stays under scripts/migrate/ until then).
//
// A row's `kind` (collection/stat/map/carrier/function/construction/operation) does not
// survive: it is implicit in which head's record the row lands on. A row's `subject` does
// not survive as a field either -- it is the catalog's OWN name for that head, which is
// either this head's name already, or the alias `names.catalog` already records (the four
// existing cases: SymmetricGroup/Permutations, Stirling/StirlingSecond,
// StirlingS1/Stirling1, NPartition/PartitionNumber, read from the generated CATALOG_ALIASES
// rather than re-derived, since that's already the live source of truth for the alias).
//
// These rows go on a NEW `catalog:` field, not the existing `references:` -- `references:`
// already feeds `collect-curated.ts` -> `CURATED`, which the crosswalk resolves at
// `origin: "curated"`. Landing catalog rows there too would make them indistinguishable from
// hand-curated ones and break every test and page that says `origin: "catalog"` for a Sage,
// FindStat or OEIS pointer the database, not a person, recorded.
//
// Idempotent: a (system, identity, on, relation) row already present is not duplicated.

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Reference, ReferenceEntry } from "@enumeratio/entry";
import { readEntry, writeEntry } from "@enumeratio/entry/node";
import { REFERENCES } from "../../../catalog/src/references.ts";
import { CATALOG_ALIASES } from "../../src/crosswalk/curated-data.ts";
import { engineSymbols } from "../../src/engine-symbols-data.ts";
import { canonicalHeads, loadReferenceData, PACKAGES } from "../../src/node.ts";

const write = process.argv.includes("--write");

const { heads } = loadReferenceData(PACKAGES);
// Same reasoning as curated-to-yaml.ts / mappings-to-yaml.ts: the crosswalk reads through
// `referenceData()`, which resolves a shared head to its CANONICAL copy -- write there or the
// row is invisible to it.
const byName = canonicalHeads(heads);
const engineByName = new Map(engineSymbols.map((s) => [s.name, s]));

const entriesDir = fileURLToPath(new URL("../../entries/", import.meta.url));

/** The catalog's subject name -> the head whose record it belongs on. */
const headForSubject = new Map<string, string>(
  Object.entries(CATALOG_ALIASES).map(([head, subject]) => [subject, head]),
);

function referenceFor(row: (typeof REFERENCES)[number]): Reference {
  return {
    system: row.system as Reference["system"],
    identity: row.identity,
    ...(row.url ? { url: row.url } : {}),
    ...(row.note ? { note: row.note } : {}),
    ...(row.relation ? { relation: row.relation } : {}),
    ...(row.on ? { on: row.on } : {}),
  };
}

const rowKey = (r: Reference): string => `${r.system} ${r.identity} ${r.on ?? ""} ${r.relation ?? ""}`;

function mergedCatalog(existing: readonly Reference[] | undefined, added: readonly Reference[]): Reference[] {
  const seen = new Set((existing ?? []).map(rowKey));
  const extra = added.filter((r) => !seen.has(rowKey(r)));
  return [...(existing ?? []), ...extra];
}

// Grouped by the head whose record the row lands on, in REFERENCES' own row order.
const byHead = new Map<string, { subject: string; rows: Reference[] }>();
for (const row of REFERENCES) {
  const head = headForSubject.get(row.subject) ?? row.subject;
  const group = byHead.get(head) ?? { subject: row.subject, rows: [] };
  if (group.subject !== row.subject) {
    throw new Error(`catalog-to-yaml: ${head} has rows under two subjects: ${group.subject}, ${row.subject}`);
  }
  group.rows.push(referenceFor(row));
  byHead.set(head, group);
}

let updated = 0;
let created = 0;
let skippedIdentical = 0;

for (const head of [...byHead.keys()].sort()) {
  const { subject, rows } = byHead.get(head)!;
  const alias = subject === head ? undefined : subject;

  const existing = byName.get(head);
  if (existing) {
    const dir = dirname(existing.entryPath);
    const entry = readEntry(dir, head);
    const merged = mergedCatalog(entry.catalog, rows);
    if (merged.length === (entry.catalog?.length ?? 0) && (alias === undefined || entry.names?.catalog === alias)) {
      skippedIdentical++;
      continue;
    }
    const next: ReferenceEntry = {
      ...entry,
      catalog: merged,
      ...(alias !== undefined ? { names: { ...entry.names, catalog: alias } } : {}),
    };
    if (write) await writeEntry(dir, next);
    updated++;
    continue;
  }

  // No entry anywhere: a metadata-only record, same story as curated-to-yaml.ts /
  // mappings-to-yaml.ts -- a bare engine symbol's own description where one exists, else a
  // short generic summary naming the systems the catalog crosswalked it to.
  const symbol = engineByName.get(head);
  const systems = [...new Set(rows.map((r) => r.system))].sort();
  const summary =
    symbol?.description ??
    `Catalogued in the enumeratio database, with crosswalk rows in ${systems.join(", ")}; not yet written up here.`;

  const entry: ReferenceEntry = {
    name: head,
    domain: symbol ? "Compute engine" : "Combinatorics",
    signature: symbol ? (symbol.kind === "operator" ? `${head}${symbol.signature ?? ""}` : head) : `${head}(...)`,
    summary,
    examples: [],
    ...(symbol?.signature
      ? {
          signatures: [
            {
              call: symbol.kind === "operator" ? `${head}${symbol.signature}` : `${head}: ${symbol.signature}`,
              description:
                symbol.kind === "operator"
                  ? "as compute-engine declares it"
                  : "a constant, as compute-engine declares it",
            },
          ],
        }
      : {}),
    catalog: rows,
    ...(alias !== undefined ? { names: { catalog: alias } } : {}),
    stub: symbol ? "engine" : "carrier",
  };
  if (write) await writeEntry(entriesDir, entry);
  created++;
}

console.log(
  `${updated} existing records updated, ${created} metadata-only records created, ` +
    `${skippedIdentical} already current` +
    `${write ? "" : " (dry run; pass --write)"}`,
);

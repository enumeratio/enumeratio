// Move curated.ts's hand-kept crosswalk tables into each head's <Head>.yaml: `CURATED` folds
// into `references:`, and `FUNGRIM_NAMES` / `DLMF_NAMES` / `WIKIDATA_FIXES` /
// `WIKIDATA_CONFIRMED` / `CATALOG_ALIASES` fold into a `names:` map -- symbol-metadata step 2
// (design/speculative/symbol-metadata.md, lanes/handoff-M.md item 2.2).
//
//   vp node packages/reference/scripts/migrate/curated-to-yaml.ts [--write]
//
// Without --write, only reports what would change. `curated.ts` itself is left alone here --
// a follow-up commit deletes its tables once the crosswalk consumer reads the YAML instead
// (this script stays under scripts/migrate/ until the last symbol-metadata step, per M's plan).
// Idempotent: a reference or names entry already present is not duplicated.

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Reference, ReferenceEntry, ReferenceNames } from "@enumeratio/entry";
import { readEntry, writeEntry } from "@enumeratio/entry/node";
import {
  CATALOG_ALIASES,
  CURATED,
  DLMF_NAMES,
  FUNGRIM_NAMES,
  WIKIDATA_CONFIRMED,
  WIKIDATA_FIXES,
} from "../../src/crosswalk/curated.ts";
import { engineSymbols } from "../../src/engine-symbols-data.ts";
import { canonicalHeads, loadReferenceData, PACKAGES } from "../../src/node.ts";

const write = process.argv.includes("--write");

const { heads } = loadReferenceData(PACKAGES);
// A head two packages document (design/examples-as-data.md §9) has to be edited at its
// CANONICAL copy -- the one `referenceData()` resolves the name to -- or the write is
// invisible to every consumer.
const byName = canonicalHeads(heads);
const engineByName = new Map(engineSymbols.map((s) => [s.name, s]));

const entriesDir = fileURLToPath(new URL("../../entries/", import.meta.url));

/**
 * A handful of curated heads are neither a documented entry nor a bare engine symbol -- they
 * are collection carriers the catalog names but this package has not written up. A short
 * hand summary stands in; the curated Wikipedia/MathWorld rows say more.
 */
const CARRIER_SUMMARY: Readonly<Record<string, string>> = {
  Compositions: "The compositions of a positive integer: ordered sequences of positive parts summing to it.",
  SetCompositions: "Compositions of a set: an ordered sequence of blocks partitioning it.",
  StandardTableaux: "Standard Young tableaux: fillings of a partition shape, weakly increasing along rows and columns.",
};

const referenceKey = (r: Reference): string => `${r.system} ${r.identity} ${r.arity ?? ""}`;

function mergedReferences(existing: readonly Reference[] | undefined, added: readonly Reference[]): Reference[] {
  const seen = new Set((existing ?? []).map(referenceKey));
  const extra = added.filter((r) => !seen.has(referenceKey(r)));
  return [...(existing ?? []), ...extra];
}

function namesFor(name: string): ReferenceNames | undefined {
  const names: ReferenceNames = {
    ...(FUNGRIM_NAMES[name] ? { fungrim: FUNGRIM_NAMES[name] } : {}),
    ...(DLMF_NAMES[name] ? { dlmf: DLMF_NAMES[name] } : {}),
    ...(WIKIDATA_FIXES[name] ? { wikidata: WIKIDATA_FIXES[name] } : {}),
    ...(WIKIDATA_CONFIRMED.has(name) ? { wikidataConfirmed: true } : {}),
    ...(CATALOG_ALIASES[name] ? { catalog: CATALOG_ALIASES[name] } : {}),
  };
  return Object.keys(names).length > 0 ? names : undefined;
}

const allNames = new Set<string>([
  ...Object.keys(CURATED),
  ...Object.keys(FUNGRIM_NAMES),
  ...Object.keys(DLMF_NAMES),
  ...Object.keys(WIKIDATA_FIXES),
  ...WIKIDATA_CONFIRMED,
  ...Object.keys(CATALOG_ALIASES),
]);

let updated = 0;
let created = 0;

for (const name of [...allNames].sort()) {
  const references = CURATED[name];
  const names = namesFor(name);
  if (!references && !names) continue;

  const existing = byName.get(name);
  if (existing) {
    const dir = dirname(existing.entryPath);
    const entry = readEntry(dir, name);
    const merged: ReferenceEntry = {
      ...entry,
      ...(references ? { references: mergedReferences(entry.references, references) } : {}),
      ...(names ? { names: { ...entry.names, ...names } } : {}),
    };
    if (write) await writeEntry(dir, merged);
    updated++;
    continue;
  }

  // No entry anywhere: a metadata-only record (design doc "Records for heads we don't
  // document"). Sourced from the engine's own description for a bare engine symbol; a short
  // hand summary for the few collection carriers that are not one.
  const symbol = engineByName.get(name);
  const entry: ReferenceEntry = {
    name,
    domain: symbol ? "Compute engine" : "Collections",
    signature: symbol ? (symbol.kind === "operator" ? `${name}${symbol.signature ?? ""}` : name) : `${name}(n)`,
    summary: symbol?.description ?? CARRIER_SUMMARY[name] ?? "",
    examples: [],
    ...(symbol?.signature
      ? {
          signatures: [
            {
              call: symbol.kind === "operator" ? `${name}${symbol.signature}` : `${name}: ${symbol.signature}`,
              description:
                symbol.kind === "operator"
                  ? "as compute-engine declares it"
                  : "a constant, as compute-engine declares it",
            },
          ],
        }
      : {}),
    ...(references ? { references } : {}),
    ...(names ? { names } : {}),
    stub: symbol ? "engine" : "carrier",
  };
  if (write) await writeEntry(entriesDir, entry);
  created++;
}

console.log(
  `${updated} existing records updated, ${created} metadata-only records created` +
    `${write ? "" : " (dry run; pass --write)"}`,
);

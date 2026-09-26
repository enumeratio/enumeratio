// Retiring packages/catalog/src/catalog-data.ts, step 3 of 3 (design/speculative/
// symbol-metadata.md's pattern, applied to the catalog dump): what `declareCatalog` needs --
// CARRIERS, COLLECTIONS, STATS and MAPS -- moved onto each head's own record (`grades`/
// `carrier`/`unbounded`, `catalogCarrier`, `statOn`/`mapOn`), and `@enumeratio/catalog` reads
// a generated cache (`scripts/collect-catalog-records.ts` -> `catalog-records-data.ts`)
// instead of the raw dump -- `declareCatalog` runs wherever compute-engine does, and cannot
// parse YAML at runtime. The dump, its extractor and the one-time codemods that read it are
// all gone now that nothing reads them.
//
// This pins that the generated cache is current; `packages/catalog/tests/catalog.test.ts`
// (unchanged in what it asserts, only in where CARRIERS/COLLECTIONS/STATS/MAPS come from) is
// the proof that `declareCatalog`'s registry itself -- names, kinds, resolution, evaluation --
// is unchanged.
//
// `title`/`description` do NOT round-trip byte-for-byte: the old dump's own prose folds into
// `summary` (verbatim for a name with no other record), so a head documented since the
// original catalog dump now carries ONE description, not two saying almost the same thing.
// Nothing outside this package ever read `Resource.title`/`.description` (grepped repo-wide),
// so this is a deliberate consolidation, not a gap in the migration -- see the migration's
// replay note.

import { expect, test } from "vite-plus/test";
import { CARRIERS, COLLECTIONS, MAPS, STATS } from "@enumeratio/catalog/src";
import { referenceData } from "../src/node.ts";

test("catalog-records-data.ts is what the current records collect to", { timeout: 60_000 }, () => {
  const { entries } = referenceData();

  const carriers: { name: string }[] = [];
  const collections: { name: string; carrier?: string; grades: unknown[]; unbounded?: boolean }[] = [];
  const stats: { name: string; on: readonly string[] }[] = [];
  const maps: { name: string; on: readonly string[] }[] = [];

  for (const entry of entries) {
    if (entry.catalogCarrier) carriers.push({ name: entry.name });
    if (entry.grades !== undefined)
      collections.push({
        name: entry.name,
        ...(entry.carrier ? { carrier: entry.carrier } : {}),
        grades: [...entry.grades],
        ...(entry.unbounded ? { unbounded: true } : {}),
      });
    if (entry.statOn !== undefined) stats.push({ name: entry.name, on: entry.statOn });
    if (entry.mapOn !== undefined) maps.push({ name: entry.name, on: entry.mapOn });
  }

  const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  const byName = <T extends { name: string }>(rows: T[]): T[] => [...rows].sort((a, b) => cmp(a.name, b.name));

  expect(CARRIERS.map((c) => c.name)).toEqual(byName(carriers).map((c) => c.name));
  expect(COLLECTIONS.map(({ description: _d, ...rest }) => rest)).toEqual(byName(collections).map((c) => c));
  expect(STATS.map(({ description: _d, ...rest }) => rest)).toEqual(byName(stats).map((s) => s));
  expect(MAPS.map(({ description: _d, ...rest }) => rest)).toEqual(byName(maps).map((m) => m));
});

test("every collection/stat/map description is the current summary", () => {
  const { entries } = referenceData();
  const summaryOf = new Map(entries.map((e) => [e.name, e.summary]));
  for (const c of COLLECTIONS) expect(c.description, c.name).toBe(summaryOf.get(c.name));
  for (const s of STATS) expect(s.description, s.name).toBe(summaryOf.get(s.name));
  for (const m of MAPS) expect(m.description, m.name).toBe(summaryOf.get(m.name));
});

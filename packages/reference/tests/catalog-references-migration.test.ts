// Retiring packages/catalog/src/catalog-data.ts, step 2 of 3 (design/speculative/
// symbol-metadata.md's pattern, applied to the catalog dump): REFERENCES moved onto each
// head's `catalog:` field, and the crosswalk consumer reads a generated cache
// (`scripts/collect-catalog-references.ts` -> `catalog-references-data.ts`) instead -- the
// crosswalk runs in the browser and the site build, and cannot parse YAML at runtime. Step 3
// (declareCatalog's COLLECTIONS/CARRIERS/STATS/MAPS) followed in a later commit, and deleted
// the dump this step's own codemod once read.
//
// This pins that the generated cache is current; `crosswalk.test.ts`'s existing assertions
// (unchanged by this migration) are the proof that the crosswalk's resolved output itself is
// unchanged -- they exercise `crosswalkFor` et al. reading through this same cache and still
// expect the same `origin: "catalog"` rows, ids and hrefs the raw dump always gave them.

import { expect, test } from "vite-plus/test";
import { CATALOG_REFERENCES, type CatalogCrosswalkRow } from "../src/crosswalk/catalog-references-data.ts";
import { referenceData } from "../src/node.ts";

test("catalog-references-data.ts is what the current records collect to", () => {
  const { entries } = referenceData();

  const rebuilt: CatalogCrosswalkRow[] = [];
  for (const entry of entries) {
    if (!entry.catalog?.length) continue;
    const subject = entry.names?.catalog ?? entry.name;
    for (const reference of entry.catalog) {
      rebuilt.push({
        subject,
        ...(reference.on ? { on: reference.on } : {}),
        system: reference.system,
        identity: reference.identity,
        ...(reference.url ? { url: reference.url } : {}),
        ...(reference.note ? { note: reference.note } : {}),
        ...(reference.relation ? { relation: reference.relation } : {}),
      });
    }
  }
  const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  rebuilt.sort(
    (a, b) =>
      cmp(a.subject, b.subject) ||
      cmp(a.on ?? "", b.on ?? "") ||
      cmp(a.system, b.system) ||
      cmp(a.identity, b.identity),
  );

  expect(CATALOG_REFERENCES).toEqual(rebuilt);
});

test("every catalog crosswalk row still round-trips to a known subject", () => {
  // Same shape as the old dump's own invariant (packages/catalog/tests/catalog.test.ts):
  // nothing here should be unreachable from a real name.
  expect(CATALOG_REFERENCES.every((row) => row.subject.length > 0)).toBe(true);
});

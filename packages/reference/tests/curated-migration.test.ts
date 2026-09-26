// Before/after equivalence for symbol-metadata step 2 (design/speculative/symbol-metadata.md):
// `curated.ts`'s tables now also live as `references:`/`names:` on each head's <Head>.yaml
// (packages/reference/scripts/migrate/curated-to-yaml.ts). This pins that the two agree while
// both exist; a follow-up commit deletes curated.ts's tables and this test switches to
// asserting the crosswalk's resolved output is unchanged instead.

import type { Reference, ReferenceNames } from "@enumeratio/entry";
import { expect, test } from "vite-plus/test";
import {
  CATALOG_ALIASES,
  CURATED,
  DLMF_NAMES,
  FUNGRIM_NAMES,
  WIKIDATA_CONFIRMED,
  WIKIDATA_FIXES,
} from "../src/crosswalk/curated.ts";
import { loadReferenceData, PACKAGES } from "../src/node.ts";

const { heads } = loadReferenceData(PACKAGES);

const referencesFromYaml: Record<string, readonly Reference[]> = {};
const namesFromYaml: Record<string, ReferenceNames> = {};
for (const { head, entry } of heads) {
  if (entry.references?.length) referencesFromYaml[head] = entry.references;
  if (entry.names) namesFromYaml[head] = entry.names;
}

test("every curated reference is on its head's record", () => {
  expect(referencesFromYaml).toEqual(CURATED);
});

test("every curated name is in its head's names map", () => {
  const fungrim = Object.fromEntries(
    Object.entries(namesFromYaml)
      .filter(([, n]) => n.fungrim !== undefined)
      .map(([name, n]) => [name, n.fungrim]),
  );
  expect(fungrim).toEqual(FUNGRIM_NAMES);

  const dlmf = Object.fromEntries(
    Object.entries(namesFromYaml)
      .filter(([, n]) => n.dlmf !== undefined)
      .map(([name, n]) => [name, n.dlmf]),
  );
  expect(dlmf).toEqual(DLMF_NAMES);

  const wikidataFixes = Object.fromEntries(
    Object.entries(namesFromYaml)
      .filter(([, n]) => n.wikidata !== undefined)
      .map(([name, n]) => [name, n.wikidata]),
  );
  expect(wikidataFixes).toEqual(WIKIDATA_FIXES);

  const wikidataConfirmed = new Set(
    Object.entries(namesFromYaml)
      .filter(([, n]) => n.wikidataConfirmed)
      .map(([name]) => name),
  );
  expect(wikidataConfirmed).toEqual(WIKIDATA_CONFIRMED);

  const catalogAliases = Object.fromEntries(
    Object.entries(namesFromYaml)
      .filter(([, n]) => n.catalog !== undefined)
      .map(([name, n]) => [name, n.catalog]),
  );
  expect(catalogAliases).toEqual(CATALOG_ALIASES);
});

test("the migration script is idempotent (a re-run touches nothing)", () => {
  // Every reference the codemod would add is already on the record (`mergedReferences`'
  // de-duplication check), so this is really just documentation of that property -- a
  // regression here means a head picked up a duplicate row.
  for (const [name, references] of Object.entries(referencesFromYaml)) {
    const seen = new Set<string>();
    for (const r of references) {
      const key = `${r.system} ${r.identity} ${r.arity ?? ""}`;
      expect(seen.has(key), `${name}: duplicate ${key}`).toBe(false);
      seen.add(key);
    }
  }
});

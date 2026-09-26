// Symbol-metadata step 2 (design/speculative/symbol-metadata.md), completed: curated.ts's
// tables are gone, and the crosswalk consumer reads each head's `references:`/`names:`
// instead, through a generated cache (`scripts/collect-curated.ts` -> `curated-data.ts`) --
// the crosswalk runs in the browser and the site build, and cannot parse YAML at runtime.
//
// This pins that the generated cache is current; `crosswalk.test.ts`'s existing assertions
// (unchanged by this migration) are the proof that the crosswalk's resolved output itself is
// unchanged -- they exercise `crosswalkFor` et al. reading through this same cache and still
// expect the same origins, ids and hrefs "curated" always meant.

import { expect, test } from "vite-plus/test";
import {
  CATALOG_ALIASES,
  CURATED,
  DLMF_NAMES,
  FUNGRIM_NAMES,
  WIKIDATA_CONFIRMED,
  WIKIDATA_FIXES,
} from "../src/crosswalk/curated-data.ts";
import { referenceData } from "../src/node.ts";

test("curated-data.ts is what the current records collect to", () => {
  const { entries } = referenceData();

  const rebuiltCurated: Record<string, unknown> = {};
  const rebuiltFungrim: Record<string, string> = {};
  const rebuiltDlmf: Record<string, string> = {};
  const rebuiltWikidataFixes: Record<string, string> = {};
  const rebuiltWikidataConfirmed: string[] = [];
  const rebuiltCatalog: Record<string, string> = {};

  for (const entry of entries) {
    if (entry.references?.length) rebuiltCurated[entry.name] = entry.references;
    const names = entry.names;
    if (!names) continue;
    if (names.fungrim !== undefined) rebuiltFungrim[entry.name] = names.fungrim;
    if (names.dlmf !== undefined) rebuiltDlmf[entry.name] = names.dlmf;
    if (names.wikidata !== undefined) rebuiltWikidataFixes[entry.name] = names.wikidata;
    if (names.wikidataConfirmed) rebuiltWikidataConfirmed.push(entry.name);
    if (names.catalog !== undefined) rebuiltCatalog[entry.name] = names.catalog;
  }

  expect(CURATED).toEqual(rebuiltCurated);
  expect(FUNGRIM_NAMES).toEqual(rebuiltFungrim);
  expect(DLMF_NAMES).toEqual(rebuiltDlmf);
  expect(WIKIDATA_FIXES).toEqual(rebuiltWikidataFixes);
  expect(WIKIDATA_CONFIRMED).toEqual(new Set(rebuiltWikidataConfirmed));
  expect(CATALOG_ALIASES).toEqual(rebuiltCatalog);
});

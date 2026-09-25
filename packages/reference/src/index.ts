export type {
  Environment,
  ImplementationOrigin,
  MathJSON,
  PrimitiveReason,
  ReferenceEntry,
  ReferenceExample,
  ReferenceImplementation,
} from "./types.ts";
export { entries, entryFiles, oracleKernels, oracleSidecars } from "./entries.ts";
export { ENGINE_DOMAIN, engineEntries } from "./engine-entries.ts";
export { backlog, type BacklogHead } from "./backlog.ts";
export { engineSymbols, type EngineSymbol } from "./engine-symbols-data.ts";
export {
  crosswalkFor,
  crosswalkForCollection,
  crosswalkForMap,
  crosswalkForStatistic,
  groupBySystem,
  hrefOf,
} from "./crosswalk/index.ts";
export { CATALOG_ALIASES, CURATED, DLMF_NAMES, FUNGRIM_NAMES } from "./crosswalk/curated.ts";
export { dlmfNotations, normaliseName } from "./crosswalk/dlmf.ts";
export { type OracleAgreement, oracleAgreements } from "./crosswalk/oracle.ts";
export {
  fungrimEntryVerdict,
  type FungrimScore,
  fungrimScore,
  KNOWN_CAUSES,
} from "./crosswalk/fungrim.ts";
export { fungrimVerified, type FungrimVerdict } from "./fungrim-verified-data.ts";
export { dlmf, type DlmfNotation } from "./dlmf-data.ts";
export { findstat, type FindStatMatch } from "./findstat-data.ts";
export { oeis, type OeisMatch } from "./oeis-data.ts";
export {
  type CrosswalkSource,
  type CrosswalkSystem,
  isCrosswalkSystem,
  SOURCES,
  SYSTEM_ORDER,
} from "./crosswalk/sources.ts";
export {
  bareName,
  INVENTORIES,
  type InventorySystem,
  inventoryEntry,
  isInventorySystem,
} from "./crosswalk/inventory.ts";
export { inventory, type InventoryEntry } from "./inventory-data.ts";
export { referencesOf, wikidataItem, wikipediaTitle } from "./crosswalk/wikidata.ts";
export { wikidata, type WikidataItem } from "./wikidata-data.ts";
export type {
  Reference,
  ReferenceOrigin,
  ReferenceRelation,
  ResolvedReference,
} from "./crosswalk/types.ts";
export { checkImplementations, type Exists, type Problem } from "./validate.ts";
export { type HeadRecord, provenance } from "./provenance-data.ts";

import { entries } from "./entries.ts";
import type { ReferenceEntry } from "./types.ts";

/** Look up a single entry by name. */
export function getEntry(name: string): ReferenceEntry | undefined {
  return entries.find((entry) => entry.name === name);
}

/** Entries grouped by domain, preserving definition order within each group. */
export function entriesByDomain(): { domain: string; entries: ReferenceEntry[] }[] {
  const groups = new Map<string, ReferenceEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.domain) ?? [];
    group.push(entry);
    groups.set(entry.domain, group);
  }
  return [...groups].map(([domain, group]) => ({ domain, entries: group }));
}

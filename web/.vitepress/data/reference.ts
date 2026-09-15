import { DOMAINS } from "@enumeratio/domains";
import { entries as collectionsEntries } from "@enumeratio/collections/reference";
import { entries as domainsEntries } from "@enumeratio/domains/reference";
import type { ReferenceEntry } from "@enumeratio/reference";
import { engineEntries, entries as coreEntries } from "@enumeratio/reference";
import { entries as statisticsEntries } from "@enumeratio/statistics/reference";

// The reference is assembled from every library that ships entries -- core
// compute-engine heads plus the enumeratio extension libraries. A head declared by two
// libraries is documented once: the first entry wins, the way the engines declare.
const all = [...coreEntries, ...collectionsEntries, ...statisticsEntries, ...domainsEntries];
const byName = new Map<string, ReferenceEntry>();
for (const entry of all) if (!byName.has(entry.name)) byName.set(entry.name, entry);

/** The documented heads -- the ones with examples, and the ones prose auto-links. */
export const documented: readonly ReferenceEntry[] = [...byName.values()];

// Behind them, a stub for every carrier domain and every symbol the bare engine binds, so
// each has a page that shows its crosswalk. Stubs never shadow an entry.
const carrierStubs: ReferenceEntry[] = DOMAINS.filter((d) => !byName.has(d.name)).map((d) => ({
  name: d.name,
  domain: "Carrier domains",
  signature: `${d.name}: ${d.shape}`,
  summary: d.restricts
    ? `A carrier domain restricting ${d.restricts}.`
    : "A carrier domain: the nominal type this object is stored and dispatched as.",
  examples: [],
  stub: "carrier",
}));
export const entries: readonly ReferenceEntry[] = [
  ...documented,
  ...carrierStubs,
  ...engineEntries(new Set([...byName.keys(), ...carrierStubs.map((s) => s.name)])),
];

export function getEntry(name: string): ReferenceEntry | undefined {
  return entries.find((entry) => entry.name === name);
}

/** What TreeForm needs to know about a head, from its entry -- see `HeadInfo` in elements. */
export interface HeadInfo {
  href?: string;
  definition?: ReferenceEntry["examples"][number]["expr"];
  primitive?: string;
}

/**
 * The head resolver a reference page hands to its TreeForm cells: a link to the entry, the
 * `reference` implementation to unfold into, and the primitive reason when there is one.
 */
export function resolveHead(name: string): HeadInfo | undefined {
  const entry = getEntry(name);
  if (!entry) return undefined;
  const definition = entry.implementations?.find((impl) => impl.origin === "reference")?.expr;
  return {
    href: `/reference/symbol/${name}`,
    ...(definition === undefined ? {} : { definition }),
    ...(entry.primitive ? { primitive: entry.primitive } : {}),
  };
}

export function entriesByDomain(): { domain: string; entries: ReferenceEntry[] }[] {
  const groups = new Map<string, ReferenceEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.domain) ?? [];
    group.push(entry);
    groups.set(entry.domain, group);
  }
  return [...groups].map(([domain, group]) => ({ domain, entries: group }));
}

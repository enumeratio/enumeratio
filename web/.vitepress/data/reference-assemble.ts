// The site's reference, assembled from the documented entries (the loader's, one per head):
// behind them a stub for every carrier domain and every symbol the bare engine binds, so each
// has a page that shows its crosswalk. Stubs never shadow an entry. Shared by the browser
// (reference.ts, over the virtual module) and the Node side of the site (reference-node.ts).

import { DOMAINS } from "@enumeratio/domains";
import type { ReferenceEntry } from "@enumeratio/reference";
import { engineEntries } from "@enumeratio/reference";

export interface HeadInfo {
  href?: string;
  definition?: ReferenceEntry["examples"][number]["expr"];
  primitive?: string;
}

export function assemble(loaded: readonly ReferenceEntry[]) {
  const byName = new Map<string, ReferenceEntry>(loaded.map((entry) => [entry.name, entry]));
  /** The documented heads -- the ones with examples, and the ones prose auto-links. */
  const documented: readonly ReferenceEntry[] = [...byName.values()];
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
  const entries: readonly ReferenceEntry[] = [
    ...documented,
    ...carrierStubs,
    ...engineEntries(new Set([...byName.keys(), ...carrierStubs.map((s) => s.name)])),
  ];
  const getEntry = (name: string): ReferenceEntry | undefined =>
    entries.find((entry) => entry.name === name);
  /**
   * The head resolver a reference page hands to its TreeForm cells: a link to the entry, the
   * `reference` implementation to unfold into, and the primitive reason when there is one.
   */
  const resolveHead = (name: string): HeadInfo | undefined => {
    const entry = getEntry(name);
    if (!entry) return undefined;
    const definition = entry.implementations?.find((impl) => impl.origin === "reference")?.expr;
    return {
      href: `/reference/symbol/${name}`,
      ...(definition === undefined ? {} : { definition }),
      ...(entry.primitive ? { primitive: entry.primitive } : {}),
    };
  };
  const entriesByDomain = (): { domain: string; entries: ReferenceEntry[] }[] => {
    const groups = new Map<string, ReferenceEntry[]>();
    for (const entry of entries) {
      const group = groups.get(entry.domain) ?? [];
      group.push(entry);
      groups.set(entry.domain, group);
    }
    return [...groups].map(([domain, group]) => ({ domain, entries: group }));
  };
  return { documented, entries, getEntry, resolveHead, entriesByDomain };
}

// Lookups over the assembled reference (reference-assemble.ts), for the browser and Node alike.

import type { ReferenceEntry } from "@enumeratio/reference";

export interface HeadInfo {
  href?: string;
  definition?: ReferenceEntry["examples"][number]["expr"];
  primitive?: string;
}

export function lookups(entries: readonly ReferenceEntry[]) {
  const getEntry = (name: string): ReferenceEntry | undefined => entries.find((entry) => entry.name === name);
  /**
   * The head resolver a reference page hands to its TreeForm cells: a link to the entry, the
   * `reference` implementation to unfold into, and the primitive reason when there is one.
   */
  const resolveHead = (name: string): HeadInfo | undefined => {
    const entry = getEntry(name);
    if (!entry) return undefined;
    const definition = entry.bindings?.find((impl) => impl.origin === "reference")?.expr;
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
  return { entries, getEntry, resolveHead, entriesByDomain };
}

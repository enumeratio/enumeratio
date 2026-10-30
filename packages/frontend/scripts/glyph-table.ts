// The head-to-glyph table the records imply, shared by the build and its test.

import type { ReferenceEntry } from "@enumeratio/entry";

/**
 * Each carrier's `glyph:` under the carrier's name, and under the name of every record whose
 * `carrier:` is that carrier. The first record of a name wins, as the site's loader has it.
 */
export function glyphTable(entries: readonly Pick<ReferenceEntry, "name" | "glyph" | "catalogCarrier" | "carrier">[]) {
  const byName = new Map<string, (typeof entries)[number]>();
  for (const e of entries) if (!byName.has(e.name)) byName.set(e.name, e);
  const table: Record<string, string> = {};
  for (const e of byName.values()) {
    if (e.catalogCarrier && e.glyph !== undefined) table[e.name] = e.glyph;
    else if (e.carrier !== undefined) {
      const kind = byName.get(e.carrier);
      if (kind?.catalogCarrier && kind.glyph !== undefined) table[e.name] = kind.glyph;
    }
  }
  return Object.fromEntries(Object.entries(table).toSorted(([a], [b]) => (a < b ? -1 : 1)));
}

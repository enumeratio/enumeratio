// What FindStat's matched rows (`findstat-data.ts`, `findstat-maps-data.ts`) say each head's
// record must carry: a `catalog:` entry per (id, carrier), and the carrier in `statOn` / `mapOn`.
// Shared by `collect-findstat-catalog.ts`, which writes them, and the test that holds the records to it.

import { findstat } from "../../symbols/combinatorics/combinatorics/findstat/src/findstat-data.ts";
import { findstatMaps } from "../../symbols/combinatorics/combinatorics/findstat/src/findstat-maps-data.ts";

/** One FindStat id a head matches on one carrier. */
export interface Wanted {
  readonly head: string;
  readonly id: string;
  readonly on: string;
  /** Which overload list carries the carrier: a statistic's `statOn` or a map's `mapOn`. */
  readonly overloads: "statOn" | "mapOn";
}

/** Every matched (head, carrier, id), statistics then maps. */
export function wanted(): Wanted[] {
  return [
    ...findstat.flatMap((m) => m.findstat.map((id) => ({ head: m.head, id, on: m.on, overloads: "statOn" as const }))),
    ...findstatMaps.flatMap((m) =>
      m.findstat.map((a) => ({ head: m.name, id: a.id, on: m.from, overloads: "mapOn" as const })),
    ),
  ];
}

/** A catalog entry as a record writes it, in its usual key order. */
export const catalogEntry = ({ id, on }: Pick<Wanted, "id" | "on">) => ({
  system: "findstat",
  identity: id,
  url: `https://www.findstat.org/${id}`,
  on,
});

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** `existing`'s catalog entries and carriers, plus whatever `rows` (one head's) add: an entry is
 *  new when no FindStat entry already has its id and carrier. Nothing existing is touched. */
export function withFindStat<
  T extends { catalog?: readonly any[]; statOn?: readonly string[]; mapOn?: readonly string[]; catalogCarrier?: true },
>(entry: T, rows: readonly Wanted[]): T {
  const catalog = [...(entry.catalog ?? [])];
  const have = (r: Wanted) => catalog.some((c) => c.system === "findstat" && c.identity === r.id && c.on === r.on);
  for (const row of rows.toSorted((a, b) => cmp(a.id, b.id) || cmp(a.on, b.on)))
    if (!have(row)) catalog.push(catalogEntry(row));
  const out: any = { ...entry, catalog };
  for (const key of ["statOn", "mapOn"] as const) {
    // A carrier's conversions are constructor overloads, not catalogued maps.
    if (key === "mapOn" && entry.catalogCarrier) continue;
    const carriers = rows.filter((r) => r.overloads === key).map((r) => r.on);
    if (carriers.length > 0) out[key] = [...new Set([...(entry[key] ?? []), ...carriers])].toSorted(cmp);
  }
  return out;
}

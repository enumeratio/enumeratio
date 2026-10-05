// Row data for the four reference catalogue pages, read straight from the packages
// that own each class. Kept in one module so the shared row shape stays in sync.
import { allFamilies } from "@enumeratio/combinatorics/collections";
import { CARRIERS, MAPS, UNDEFINED_MAPS } from "@enumeratio/combinatorics";
import {
  crosswalkFor,
  crosswalkForCollection,
  crosswalkForMap,
  crosswalkForStatistic,
  type ResolvedReference,
} from "@enumeratio/reference";
import { ALL_STATISTICS } from "@enumeratio/combinatorics";
import { getEntry } from "./reference.ts";

export interface CatalogRow {
  readonly name: string;
  readonly href?: string;
  readonly badges?: readonly string[];
  readonly summary?: string;
  readonly note?: string;
  readonly frontier?: boolean;
  /** Where this row's object lives elsewhere -- FindStat for a statistic, Sage for a family. */
  readonly references?: readonly ResolvedReference[];
}

// A row links to its symbol page when one exists; a name with no page is left plain rather
// than sent somewhere dead.
const symbol = (name: string): string | undefined => (getEntry(name) ? `/reference/symbol/${name}` : undefined);

const byName = (a: CatalogRow, b: CatalogRow): number =>
  a.name.localeCompare(b.name) || (a.badges?.[0] ?? "").localeCompare(b.badges?.[0] ?? "");

// Combinatorial statistics — one row per (head, carrier), since a head can be a
// different statistic on a different carrier.
export const statisticsRows: readonly CatalogRow[] = [...ALL_STATISTICS]
  .map((d) => ({
    name: d.head,
    href: symbol(d.head),
    badges: [d.on],
    summary: d.summary,
    note: d.note,
    references: crosswalkForStatistic(d.head, d.on),
  }))
  .toSorted(byName);

// A map's endpoints are carrier TYPES (`permutation`); the crosswalk is keyed by the carrier's
// domain name (`Permutation`).
const carrierName = (type: string): string => CARRIERS.find((c) => c.type === type)?.name ?? type;

// Combinatorial maps — a directed arrow between carriers; frontier maps are named but
// not yet defined.
export const mapsRows: readonly CatalogRow[] = [
  ...MAPS.map((m) => ({
    name: m.name,
    href: symbol(m.name),
    badges: [`${m.from} → ${m.to}`],
    summary: m.summary,
    note: m.note,
    references: crosswalkForMap(m.name, carrierName(m.from)),
  })),
  ...UNDEFINED_MAPS.map((m) => ({
    name: m.name,
    badges: [`${m.from} → ${m.to}`],
    summary: m.why,
    frontier: true,
    references: crosswalkForMap(m.name, carrierName(m.from)),
  })),
].toSorted(byName);

// Carrier domains — the nominal types combinatorial objects are stored as; badge is the
// underlying storage shape.
export const domainsRows: readonly CatalogRow[] = [...CARRIERS]
  .map((c) => ({
    name: c.name,
    href: symbol(c.name),
    badges: [c.shape],
    summary: c.restricts ? `restricts ${c.restricts}` : undefined,
    references: crosswalkFor(c.name),
  }))
  .toSorted(byName);

// The enumerable collection families — each a head whose elements are one kind of
// combinatorial object, taking one or two size parameters.
export const collectionsRows: readonly CatalogRow[] = [...allFamilies]
  .map((e) => ({
    name: e.head,
    href: symbol(e.head),
    summary: getEntry(e.head)?.summary,
    badges: [e.kind, `${e.paramCount} param${e.paramCount > 1 ? "s" : ""}`],
    references: crosswalkForCollection(e.head),
  }))
  .toSorted(byName);

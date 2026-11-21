/**
 * How the site reads an address: the grammar (`@enumeratio/address`) with the
 * route file's collections, each collection's reader for its elements, and the
 * statistics and maps notatio records for it.
 */
import {
  type Address,
  type Catalog,
  type ParseOptions,
  type ParseResult,
  areas,
  parseAddress,
} from '@enumeratio/address';
import { type Codec, type Items, codecs } from '@enumeratio/codecs';
import { elementHead } from '@enumeratio/kernel/expressions';
import { type RouteRow, isServed, rowByName, rows, specOf } from '@enumeratio/routes';
import names from 'virtual:notatio-names';

/** The carrier of a row: the head that constructs one of its elements, when notatio records it. */
export function carrierOf(row: RouteRow): string | undefined {
  const head = elementHead(row);
  return head !== undefined && names.carriers[head] !== undefined ? head : undefined;
}

export const statisticsOf = (row: RouteRow): readonly string[] =>
  names.carriers[carrierOf(row) ?? '']?.statistics ?? [];
export const mapsOf = (row: RouteRow): readonly string[] =>
  names.carriers[carrierOf(row) ?? '']?.maps ?? [];

const all = (pick: 'statistics' | 'maps'): string[] => [
  ...new Set(Object.values(names.carriers).flatMap((c) => c[pick])),
];
/** Every statistic, and every map, of the served collections. */
export const allStatistics: readonly string[] = all('statistics');
export const allMaps: readonly string[] = all('maps');

export const codecOf = (row: RouteRow): Codec | undefined =>
  row.value === undefined ? undefined : codecs[row.value];

/** The catalog the site reads addresses against. */
export const catalog: Catalog = {
  collections: rows.map((row) => ({
    ...specOf(row),
    properties: [...new Set([...row.show, ...statisticsOf(row), ...mapsOf(row)])],
  })),
  subjects: [...new Set([...allStatistics, ...allMaps])],
};

export const parseOptions: ParseOptions = {
  catalog,
  readElement(collection, raw, notation) {
    const row = rowByName.get(collection);
    const codec = row && isServed(row) ? codecOf(row) : undefined;
    if (!codec) return undefined;
    const items = codec.read(raw, notation);
    return items === null ? null : codec.write(items);
  },
  resolveSubject(area, raw) {
    if (area !== areas.stat && area !== areas.map) return undefined;
    const found = Object.entries(names.identifiers).find(
      ([id]) => id.toLowerCase() === raw.toLowerCase(),
    );
    return found?.[1];
  },
};

export const readAddress = (pathname: string, search: string): ParseResult =>
  parseAddress(pathname, search, parseOptions);

/** An element's value as its collection reads it, or undefined when it cannot. */
export function itemsOf(row: RouteRow, address: Address): Items | undefined {
  const el = address.element;
  if (el?.kind !== 'value' || el.notation !== undefined) return undefined;
  return codecOf(row)?.read(el.value) ?? undefined;
}

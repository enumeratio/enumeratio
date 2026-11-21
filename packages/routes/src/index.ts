/**
 * The route file, and the one module that reads it. Nothing else opens
 * `routes/*.tsv`: pages, tests and the address reader all go through here
 * (a script outside Vite reads the same text through `./parse.ts`).
 */
import type { Catalog } from '@enumeratio/address';
import collectionTsv from '../../../routes/collection.tsv?raw';
import { type RouteFile, type RouteRow, catalogOf, parseRouteFile } from './parse.ts';

export * from './parse.ts';

export const routeFile: RouteFile = parseRouteFile(collectionTsv);
export const rows: readonly RouteRow[] = routeFile.rows;

/** Has the promise of permanence started? Until it has, the atlas says so. */
export const promiseStarted: boolean = routeFile.meta.promise !== 'not started';

/** The catalog of the route file in this repository. */
export const catalog: Catalog = catalogOf(routeFile);

export const rowByName = new Map(rows.map((r) => [r.name, r]));

/** The unrestricted collection an element's canonical address lives in (§2.2). */
export function unrestrictedCollection(name: string): string {
  let row = rowByName.get(name);
  const seen = new Set<string>();
  while (row?.within && !seen.has(row.name)) {
    seen.add(row.name);
    const parent = rowByName.get(row.within);
    if (!parent) break;
    row = parent;
  }
  return row?.name ?? name;
}

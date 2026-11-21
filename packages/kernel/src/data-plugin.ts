/**
 * What the pages know of notatio without a kernel, read from the pinned
 * notatio's catalog and manifest when the site is built (and when the tests
 * start): for the carrier of each served route, its statistics and maps. No
 * statistic or map is listed by hand anywhere in this repository.
 *
 * Two virtual modules, so a page's first paint carries only the names:
 *   `virtual:notatio-names`         the names, their parameters, their outside identifiers
 *   `virtual:notatio-descriptions`  a sentence for each name, loaded when a page shows one
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { catalogResources } from '@notatio/catalog';
import { symbolInfo } from '@notatio/manifest';
import { isServed, parseRouteFile } from '@enumeratio/routes/parse';
import type { Plugin } from 'vite-plus';
import { type Cell, elementHeadOf, headsOfRow } from './cell.ts';
import { cellTable, parseCell } from './parse-cells.ts';

export interface CarrierNames {
  statistics: string[];
  maps: string[];
}

export interface NotatioNames {
  /** By carrier: the head that constructs one element (`DyckPath`, `Finset`). */
  carriers: Record<string, CarrierNames>;
  /** A head's parameters after its first, in order, where it has any: `IntegerDigits` has `base`, `width`. */
  parameters: Record<string, string[]>;
  /** An outside identifier (`St000012`, `Mp00066`) and the name it means. */
  identifiers: Record<string, string>;
  /** By name: its outside identifiers, each with the carrier it is on. */
  findstat: Record<string, { id: string; on?: string }[]>;
}

export type NotatioDescriptions = Record<string, string>;

const routeFile = fileURLToPath(new URL('../../../routes/collection.tsv', import.meta.url));

export function collectNotatioData(): { names: NotatioNames; descriptions: NotatioDescriptions } {
  const rows = parseRouteFile(readFileSync(routeFile, 'utf8')).rows.filter(isServed);
  const resources = catalogResources();
  const names: NotatioNames = { carriers: {}, parameters: {}, identifiers: {}, findstat: {} };
  const descriptions: NotatioDescriptions = {};
  const mentioned = new Set<string>();
  const describe = (name: string): void => {
    const found = resources.find((r) => r.name === name && r.description !== undefined);
    if (found?.description !== undefined) descriptions[name] = found.description;
  };
  for (const row of rows) {
    for (const head of headsOfRow(row, parseCell)) describe(head);
    for (const name of row.show) mentioned.add(name);
    const carrier = elementHeadOf(row, parseCell);
    if (carrier === undefined || names.carriers[carrier] !== undefined) continue;
    if (!resources.some((r) => r.kind === 'carrier' && r.name === carrier)) continue;
    const on = (kind: string): string[] =>
      resources
        .filter((r) => r.kind === kind && (r.on ?? []).includes(carrier))
        .map((r) => r.name)
        .toSorted();
    names.carriers[carrier] = { statistics: on('stat'), maps: on('map') };
  }
  for (const carrier of Object.values(names.carriers)) {
    for (const name of [...carrier.statistics, ...carrier.maps]) mentioned.add(name);
  }
  for (const name of mentioned) {
    describe(name);
    const info = symbolInfo(name);
    const rest = info?.params?.slice(1) ?? [];
    if (rest.length > 0) names.parameters[name] = rest;
    if (info?.findstat && info.findstat.length > 0) {
      names.findstat[name] = info.findstat.map((f) => ({ ...f }));
      for (const f of info.findstat) names.identifiers[f.id] = name;
    }
  }
  return { names, descriptions };
}

const modules = {
  'virtual:notatio-names': 'names',
  'virtual:notatio-descriptions': 'descriptions',
  'virtual:route-cells': 'cells',
} as const;

/**
 * Every Epsil cell of the route file, parsed once by notatio's parser: its MathJSON and the place
 * of each symbol in its text. The page reads this and imports no parser (`expressions.ts`).
 */
export function collectRouteCells(): Record<string, Cell> {
  return cellTable(parseRouteFile(readFileSync(routeFile, 'utf8')).rows);
}

export function notatioData(): Plugin {
  let data: ReturnType<typeof collectNotatioData> | undefined;
  return {
    name: 'enumeratio-notatio-data',
    resolveId(id) {
      return id in modules ? `\0${id}` : undefined;
    },
    load(id) {
      if (!id.startsWith('\0')) return undefined;
      const which = modules[id.slice(1) as keyof typeof modules];
      if (which === undefined) return undefined;
      if (which === 'cells') return `export default ${JSON.stringify(collectRouteCells())};`;
      data ??= collectNotatioData();
      return `export default ${JSON.stringify(data[which])};`;
    },
  };
}

/**
 * Reading the route file's Epsil cells with notatio's parser. Node only, and only at build (the
 * Vite plugin in `data-plugin.ts`, and this package's `build` script) and in tests: this imports
 * the parser and the engine behind it, so no page imports it. The route file's text stays the
 * source. What this makes of it, the MathJSON of each cell, is build output: written to
 * `build/route-cells.json` in this package, gitignored, never committed, and read by the pages as
 * `virtual:route-cells`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseRouteFile } from '@enumeratio/routes/parse';
import type { RouteRow } from '@enumeratio/routes/parse';
import { parseExpression } from '@notatio/formats/expression';
import { type Cell, cellTexts } from './cell.ts';
import { plain } from './index.ts';

/** The route file, the source of every cell. */
export const routeFilePath = fileURLToPath(
  new URL('../../../routes/collection.tsv', import.meta.url),
);

/** The build output: every cell's MathJSON, by the cell's text. */
export const cellsFilePath = fileURLToPath(new URL('../build/route-cells.json', import.meta.url));

/** One cell, read by notatio's parser. Throws when the parser reports an error. */
export function parseCell(text: string): Cell {
  const result = parseExpression(text);
  if (result.errors.length > 0) {
    throw new Error(`cannot read the Epsil “${text}”: ${result.errors.join('; ')}`);
  }
  return { json: plain(result.json) };
}

/** Every cell of these rows, by its text. */
export function cellTable(rows: readonly RouteRow[]): Record<string, Cell> {
  const table: Record<string, Cell> = {};
  for (const row of rows) {
    for (const text of cellTexts(row)) table[text] ??= parseCell(text);
  }
  return table;
}

/** Parses every cell of the route file now. */
export function collectRouteCells(): Record<string, Cell> {
  return cellTable(parseRouteFile(readFileSync(routeFilePath, 'utf8')).rows);
}

/** The build step: writes `build/route-cells.json` from the route file's text, and says where. */
export function writeRouteCells(): string {
  const text = `${JSON.stringify(collectRouteCells(), null, 1)}\n`;
  mkdirSync(fileURLToPath(new URL('../build/', import.meta.url)), { recursive: true });
  writeFileSync(cellsFilePath, text);
  return cellsFilePath;
}

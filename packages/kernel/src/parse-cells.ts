/**
 * Reading the route file's Epsil cells with notatio's parser. Node only, and only at build (the
 * Vite plugin in `data-plugin.ts`) and in tests: this imports the parser and the engine behind it,
 * so no page imports it. A page reads the table this makes (`virtual:route-cells`).
 */
import type { RouteRow } from '@enumeratio/routes/parse';
import { parseExpression } from '@notatio/formats/expression';
import { type Cell, cellTexts } from './cell.ts';
import { plain } from './index.ts';

/** The positions of the symbols in the parser's own MathJSON, which carries each node's source offsets. */
function slotsOf(node: unknown, into: Cell['slots'] = []): Cell['slots'] {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return into;
  const o = node as { sym?: unknown; fn?: unknown; sourceOffsets?: unknown };
  if (typeof o.sym === 'string' && Array.isArray(o.sourceOffsets)) {
    into.push([o.sourceOffsets[0] as number, o.sourceOffsets[1] as number, o.sym]);
  } else if (Array.isArray(o.fn)) {
    for (const operand of o.fn.slice(1)) slotsOf(operand, into);
  }
  return into;
}

/** One cell, read by notatio's parser. Throws when the parser reports an error. */
export function parseCell(text: string): Cell {
  const result = parseExpression(text);
  if (result.errors.length > 0) {
    throw new Error(`cannot read the Epsil “${text}”: ${result.errors.join('; ')}`);
  }
  return { json: plain(result.json), slots: slotsOf(result.json) };
}

/** Every cell of these rows, by its text. */
export function cellTable(rows: readonly RouteRow[]): Record<string, Cell> {
  const table: Record<string, Cell> = {};
  for (const row of rows) {
    for (const text of cellTexts(row)) table[text] ??= parseCell(text);
  }
  return table;
}
